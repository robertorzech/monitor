// Cloudflare Worker - Partnerize Monitor
// 1) Co 15 minut (cron) sprawdza Payment Summary i wysyla email przy zmianie kwot.
// 2) Udostepnia dane dla dashboardu (GitHub Pages) pod /api/summary z naglowkami CORS.
//    Partnerize API nie wysyla Access-Control-Allow-Origin, wiec przegladarka nie moze
//    pytac go bezposrednio - Worker jest jedynym proxy (klucze zostaja w secrets).
//
// Secrets (wrangler secret put ...):
//   PZ_APP_KEY, PZ_API_KEY, PZ_PUBLISHER_ID      - wymagane
//   ACCESS_TOKEN                                 - zalecane: haslo do /api/* (naglowek X-Access-Token)
//   EMAILJS_SERVICE, EMAILJS_TEMPLATE, EMAILJS_PUBKEY, NOTIFY_EMAIL - opcjonalne (email)
// Vars (wrangler.toml):
//   ALLOWED_ORIGIN - origin dashboardu, np. https://robertorzech.github.io ("*" = dowolny)

const PZ_BASE_URLS = ['https://api.partnerize.com', 'https://api.performancehorizon.com'];
const STATUS_ORDER = ['pending', 'approved', 'confirmed', 'available', 'paid'];

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkPartnerize(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname.startsWith('/api/')) {
      if (env.ACCESS_TOKEN && request.headers.get('X-Access-Token') !== env.ACCESS_TOKEN) {
        return json({ error: 'Nieprawidlowy token dostepu' }, 401, cors);
      }

      if (url.pathname === '/api/summary') {
        try {
          const cards = await fetchSummary(env);
          return json({ fetched_at: new Date().toISOString(), cards }, 200, cors);
        } catch (e) {
          return json({ error: e.message }, e.status || 502, cors);
        }
      }

      if (url.pathname === '/api/status') {
        const prevRaw = await env.MONITOR_KV.get('pz_prev');
        const lastCheck = await env.MONITOR_KV.get('last_check');
        return json({ status: 'running', last_check: lastCheck || 'never', has_data: !!prevRaw }, 200, cors);
      }

      if (url.pathname === '/api/check') {
        return json(await checkPartnerize(env), 200, cors);
      }
    }

    return new Response(
      'Partnerize Monitor Worker - OK\n/api/summary - dane dla dashboardu\n/api/status - status crona\n/api/check - sprawdz teraz (cron + email)\n',
      { status: 200, headers: cors }
    );
  },
};

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin') || '';
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  let allowOrigin = allowed[0];
  if (allowed.includes('*')) allowOrigin = '*';
  else if (allowed.includes(origin) || isLocal) allowOrigin = origin;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Access-Token, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Pobiera Payment Summary i zwraca znormalizowana liste {status, currency, amount}
async function fetchSummary(env) {
  const { PZ_APP_KEY, PZ_API_KEY, PZ_PUBLISHER_ID } = env;
  if (!PZ_APP_KEY || !PZ_API_KEY || !PZ_PUBLISHER_ID) {
    const err = new Error('Brak kluczy Partnerize w secrets Workera (PZ_APP_KEY, PZ_API_KEY, PZ_PUBLISHER_ID)');
    err.status = 500;
    throw err;
  }

  const headers = {
    Authorization: 'Basic ' + btoa(`${PZ_APP_KEY}:${PZ_API_KEY}`),
    Accept: 'application/json',
  };

  let lastErr;
  for (const base of PZ_BASE_URLS) {
    try {
      const res = await fetch(`${base}/user/publisher/${encodeURIComponent(PZ_PUBLISHER_ID)}/payment/summary`, { headers });
      if (!res.ok) {
        const text = await res.text();
        lastErr = new Error(`Partnerize API ${res.status}: ${text.slice(0, 200)}`);
        lastErr.status = res.status === 401 || res.status === 403 ? res.status : 502;
        continue;
      }
      return normalizeSummary(await res.json());
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Nie udalo sie pobrac danych z Partnerize');
}

// Obsluguje oba spotykane ksztalty odpowiedzi:
//  a) { payments: { summary: { pending: { GBP: "12.34" }, ... } } }
//  b) { payments: { summary: [ { status, currency, amount }, ... ] } }  (takze pod data.*)
function normalizeSummary(data) {
  const root = data?.data ?? data;
  const summary = root?.payments?.summary ?? root?.payment?.summary ?? root?.summary ?? root;
  const cards = [];

  if (Array.isArray(summary)) {
    for (const item of summary) {
      const amount = parseFloat(item?.amount);
      if (item?.status && item?.currency && !isNaN(amount)) {
        cards.push({ status: String(item.status).toLowerCase(), currency: item.currency, amount });
      }
    }
  } else if (summary && typeof summary === 'object') {
    for (const [status, byCurrency] of Object.entries(summary)) {
      if (!byCurrency || typeof byCurrency !== 'object' || Array.isArray(byCurrency)) continue;
      for (const [currency, value] of Object.entries(byCurrency)) {
        const amount = parseFloat(value);
        if (/^[A-Z]{3}$/.test(currency) && !isNaN(amount)) {
          cards.push({ status: status.toLowerCase(), currency, amount });
        }
      }
    }
  }

  const rank = (s) => (STATUS_ORDER.indexOf(s) + 1 || 99);
  cards.sort((a, b) => rank(a.status) - rank(b.status) || a.currency.localeCompare(b.currency));
  return cards;
}

async function checkPartnerize(env) {
  let currentData;
  try {
    currentData = (await fetchSummary(env)).map((c) => ({ ...c, key: `${c.status}_${c.currency}` }));
  } catch (error) {
    console.error('Blad pobierania Partnerize:', error.message);
    await env.MONITOR_KV.put('last_check', `ERROR: ${new Date().toISOString()} - ${error.message}`);
    return { error: error.message };
  }

  const prevRaw = await env.MONITOR_KV.get('pz_prev');
  const prevData = prevRaw ? JSON.parse(prevRaw) : null;

  const changes = [];
  if (prevData) {
    const prevMap = Object.fromEntries(prevData.map((i) => [i.key, i.amount]));
    const currMap = Object.fromEntries(currentData.map((i) => [i.key, i]));
    const keys = new Set([...Object.keys(prevMap), ...Object.keys(currMap)]);
    for (const key of keys) {
      const prev = prevMap[key] ?? 0;
      const curr = currMap[key]?.amount ?? 0;
      if (Math.abs(curr - prev) > 0.01) {
        const [status, currency] = key.split('_');
        changes.push({ status, currency, prev, current: curr, diff: curr - prev });
      }
    }
  }

  await env.MONITOR_KV.put('pz_prev', JSON.stringify(currentData));
  const now = new Date().toISOString();
  await env.MONITOR_KV.put('last_check', now);

  if (changes.length > 0) {
    console.log(`Wykryto ${changes.length} zmian - wysylam email`);
    await sendEmailNotification(env, changes);
  }

  return { checked: now, changes_count: changes.length, changes, data: currentData };
}

async function sendEmailNotification(env, changes) {
  if (!env.EMAILJS_SERVICE || !env.EMAILJS_TEMPLATE || !env.EMAILJS_PUBKEY || !env.NOTIFY_EMAIL) {
    console.log('Brak konfiguracji EmailJS - pomijam email');
    return;
  }

  const rows = changes
    .map((c) => {
      const sign = c.diff > 0 ? '+' : '';
      const color = c.diff > 0 ? '#27ae60' : '#e74c3c';
      return `<tr>
      <td style="padding:8px;border:1px solid #ddd;">${c.status}</td>
      <td style="padding:8px;border:1px solid #ddd;">${c.currency}</td>
      <td style="padding:8px;border:1px solid #ddd;">${c.prev.toFixed(2)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${c.current.toFixed(2)}</td>
      <td style="padding:8px;border:1px solid #ddd;color:${color};font-weight:bold;">${sign}${c.diff.toFixed(2)}</td>
    </tr>`;
    })
    .join('');

  const changesHtml = `
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
      <tr style="background:#2c3e50;color:white;">
        <th style="padding:8px;border:1px solid #ddd;">Status</th>
        <th style="padding:8px;border:1px solid #ddd;">Waluta</th>
        <th style="padding:8px;border:1px solid #ddd;">Poprzednia</th>
        <th style="padding:8px;border:1px solid #ddd;">Aktualna</th>
        <th style="padding:8px;border:1px solid #ddd;">Zmiana</th>
      </tr>
      ${rows}
    </table>`;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: env.EMAILJS_SERVICE,
        template_id: env.EMAILJS_TEMPLATE,
        user_id: env.EMAILJS_PUBKEY,
        template_params: {
          to_email: env.NOTIFY_EMAIL,
          platform: 'Partnerize',
          changes_html: changesHtml,
          timestamp: new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
        },
      }),
    });
    if (response.ok) console.log('Email wyslany pomyslnie');
    else console.error('Blad EmailJS:', response.status, await response.text());
  } catch (err) {
    console.error('Blad wysylania emaila:', err.message);
  }
}
