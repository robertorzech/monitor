# 💰 Partnerize Monitor

Dashboard (GitHub Pages) + Cloudflare Worker do monitorowania **Partnerize Payment Summary**
(pending / approved / confirmed / available / paid) z powiadomieniami o zmianach kwot.

## Dlaczego Worker?

Partnerize API nie wysyła nagłówka `Access-Control-Allow-Origin`, więc przeglądarka nie może
pytać go bezpośrednio. Wcześniej dashboard szedł przez publiczne proxy CORS (corsproxy.io,
cors-anywhere, allorigins, codetabs) i przestał działać, gdy wszystkie zostały zamknięte lub
zaczęły wymagać klucza. Teraz jedynym proxy jest Twój Worker:

```
index.html (GitHub Pages) ──GET /api/summary──▶ Worker ──Basic auth──▶ api.partnerize.com
                                                  │
                                    cron co 15 min ┴─▶ KV (poprzedni stan) ─▶ email (EmailJS)
```

Klucze Partnerize siedzą w secrets Workera, nie w przeglądarce.

## Wdrożenie Workera (jednorazowo)

```bash
cd worker
npm install
npx wrangler login                          # logowanie do Cloudflare w przeglądarce
npx wrangler kv namespace create MONITOR_KV # skopiuj "id" do wrangler.toml
npx wrangler secret put PZ_APP_KEY          # Application Key
npx wrangler secret put PZ_API_KEY          # User API Key
npx wrangler secret put PZ_PUBLISHER_ID     # Publisher ID, np. 10111308478
npx wrangler secret put ACCESS_TOKEN        # dowolne hasło do dashboardu (zalecane)
npx wrangler deploy                         # wypisze adres https://partnerize-monitor.xxx.workers.dev
```

Opcjonalnie email przy zmianach (cron, 24/7) – patrz `EMAILJS-SETUP.md`:

```bash
npx wrangler secret put EMAILJS_SERVICE
npx wrangler secret put EMAILJS_TEMPLATE
npx wrangler secret put EMAILJS_PUBKEY
npx wrangler secret put NOTIFY_EMAIL
```

W EmailJS włącz *Account → Security → Allow EmailJS API for non-browser applications*,
inaczej wysyłka z Workera zwróci 403.

Jeśli dashboard ma działać pod innym adresem niż `https://robertorzech.github.io`, zmień
`ALLOWED_ORIGIN` w `worker/wrangler.toml` (kilka adresów po przecinku, `*` = dowolny).
`localhost` jest wpuszczany zawsze.

## Endpointy Workera

| Ścieżka        | Co robi                                              |
|----------------|------------------------------------------------------|
| `/api/summary` | aktualne kwoty `{ cards: [{status, currency, amount}] }` |
| `/api/status`  | kiedy cron ostatnio sprawdzał                        |
| `/api/check`   | uruchamia sprawdzenie od razu (jak cron, z emailem)  |

Wszystkie wymagają nagłówka `X-Access-Token`, jeśli ustawiono `ACCESS_TOKEN`.

## Dashboard

Otwórz `https://robertorzech.github.io/monitor/`, wpisz adres Workera i token, kliknij **Połącz**.

- auto-refresh 5 / 15 / 30 / 60 min,
- plakietka +/− przy kartach, których kwota zmieniła się od ostatniego odczytu,
- powiadomienia push w przeglądarce (gdy karta jest otwarta) i log zmian,
- „Zapamiętaj i łącz automatycznie” zapisuje adres i token w `localStorage`.

Powiadomienia działające bez otwartej karty wysyła cron Workera (email).

## Troubleshooting

- **Failed to fetch** – zły adres Workera albo `ALLOWED_ORIGIN` nie zawiera adresu strony.
- **Nieprawidlowy token dostepu** – token w dashboardzie ≠ `ACCESS_TOKEN`.
- **Partnerize API 401/403** – złe `PZ_APP_KEY` / `PZ_API_KEY` / `PZ_PUBLISHER_ID`.
- Podgląd logów Workera: `npx wrangler tail`.
