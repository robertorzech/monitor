// Cloudflare Worker - Partnerize Monitor
// Uruchamia sie co 15 minut i wysyla email gdy zmieni sie kwota

export default {
  // Cron trigger - odpala sie automatycznie co 15 minut
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkPartnerize(env));
  },

  // HTTP endpoint - do recznego sprawdzenia i testow
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/check') {
      const result = await checkPartnerize(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/status') {
      const prevRaw = await env.MONITOR_KV.get('pz_prev');
      const lastCheck = await env.MONITOR_KV.get('last_check');
      return new Response(
        JSON.stringify({
          status: 'running',
          last_check: lastCheck || 'never',
          has_data: !!prevRaw,
        }, null, 2),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Partnerize Monitor Worker - OK\n/check - sprawdz teraz\n/status - status', {
      status: 200,
    });
  },
};

async function checkPartnerize(env) {
  const {
    PZ_APP_KEY,
    PZ_API_KEY,
    PZ_PUBLISHER_ID,
    EMAILJS_SERVICE,
    EMAILJS_TEMPLATE,
    EMAILJS_PUBKEY,
    NOTIFY_EMAIL,
  } = env;

  // Walidacja - sprawdz czy secrets sa ustawione
  if (!PZ_APP_KEY || !PZ_API_KEY || !PZ_PUBLISHER_ID) {
    console.error('Brak kluczy Partnerize - ustaw secrets w Cloudflare');
    return { error: 'Brak kluczy Partnerize' };
  }

  // Pobierz dane z Partnerize API bezposrednio (Worker nie ma problemu z CORS)
  const authHeader = 'Basic ' + btoa(`${PZ_APP_KEY}:${PZ_API_KEY}`);
  let currentData;

  try {
    // Probuj glowny endpoint
    let response = await fetch(
      `https://api.performancehorizon.com/user/publisher/${PZ_PUBLISHER_ID}/payment/summary`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      }
    );

    // Fallback na drugi endpoint jesli pierwszy nie dziala
    if (!response.ok) {
      response = await fetch(
        `https://api.partnerize.com/user/publisher/${PZ_PUBLISHER_ID}/payment/summary`,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }
      );
    }

    if (!response.ok) {
      throw new Error(`Partnerize API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const summary =
      data?.data?.payments?.summary ||
      data?.data?.payment?.summary ||
      [];

    currentData = summary.map((item) => ({
      key: `${item.status}_${item.currency}`,
      status: item.status,
      currency: item.currency,
      amount: parseFloat(item.amount || 0),
    }));
  } catch (error) {
    console.error('Blad pobierania Partnerize:', error.message);
    await env.MONITOR_KV.put('last_check', `ERROR: ${new Date().toISOString()} - ${error.message}`);
    return { error: error.message };
  }

  // Pobierz poprzednie dane z KV
  const prevRaw = await env.MONITOR_KV.get('pz_prev');
  const prevData = prevRaw ? JSON.parse(prevRaw) : null;

  // Wykryj zmiany
  const changes = [];
  if (prevData && prevData.length > 0) {
    const prevMap = {};
    prevData.forEach((item) => {
      prevMap[item.key] = item.amount;
    });

    currentData.forEach((item) => {
      const prevAmount = prevMap[item.key];
      if (prevAmount !== undefined) {
        if (Math.abs(item.amount - prevAmount) > 0.01) {
          changes.push({
            status: item.status,
            currency: item.currency,
            prev: prevAmount,
            current: item.amount,
            diff: item.amount - prevAmount,
          });
        }
      } else {
        // Nowa kategoria pojawiła sie
        if (item.amount > 0) {
          changes.push({
            status: item.status,
            currency: item.currency,
            prev: 0,
            current: item.amount,
            diff: item.amount,
            new: true,
          });
        }
      }
    });
  }

  // Zapisz aktualne dane do KV
  await env.MONITOR_KV.put('pz_prev', JSON.stringify(currentData));
  const now = new Date().toISOString();
  await env.MONITOR_KV.put('last_check', now);

  // Wyslij powiadomienie jesli sa zmiany (i mamy dane historyczne)
  if (changes.length > 0 && prevData) {
    console.log(`Wykryto ${changes.length} zmian - wysylam email`);
    await sendEmailNotification(env, changes);
  }

  return {
    checked: now,
    changes_count: changes.length,
    changes,
    data: currentData,
  };
}

async function sendEmailNotification(env, changes) {
  if (!env.EMAILJS_SERVICE || !env.EMAILJS_TEMPLATE || !env.EMAILJS_PUBKEY || !env.NOTIFY_EMAIL) {
    console.error('Brak konfiguracji EmailJS - nie mozna wyslac emaila');
    return;
  }

  const changesHtml = changes
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

  const changesHtmlFull = `
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
      <tr style="background:#2c3e50;color:white;">
        <th style="padding:8px;border:1px solid #ddd;">Status</th>
        <th style="padding:8px;border:1px solid #ddd;">Waluta</th>
        <th style="padding:8px;border:1px solid #ddd;">Poprzednia</th>
        <th style="padding:8px;border:1px solid #ddd;">Aktualna</th>
        <th style="padding:8px;border:1px solid #ddd;">Zmiana</th>
      </tr>
      ${changesHtml}
    </table>
  `;

  const timestamp = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

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
          changes_html: changesHtmlFull,
          timestamp,
        },
      }),
    });

    if (response.ok) {
      console.log('Email wyslany pomyslnie');
    } else {
      const text = await response.text();
      console.error('Blad EmailJS:', response.status, text);
    }
  } catch (err) {
    console.error('Blad wysylania emaila:', err.message);
  }
}
