# 💰 Complete Affiliate Dashboard
## Partnerize + Zeropark + Awin + Email & Push Notifications

Kompletny dashboard do monitorowania trzech platform affiliate z automatycznymi powiadomieniami o zmianach.

---

## ✨ Funkcje

### 📊 Trzy platformy w jednym miejscu
- **Partnerize**: Payment Summary - 5 statusów płatności (Pending, Approved, Confirmed, Available, Paid)
- **Zeropark**: Statystyki kampanii (wczoraj + ten miesiąc)
- **Awin**: Transakcje i prowizje z podziałem na statusy

### 🔔 Powiadomienia
- **Push Notifications** - natywne powiadomienia w przeglądarce/telefonie
- **Email Notifications** - automatyczne emaile przez EmailJS
- **Log Powiadomień** - historia wszystkich zmian

### ⚙️ Automatyzacja
- **Auto-refresh** - wybierz 1/5/15/30 minut
- **Change Detection** - automatyczne wykrywanie zmian kwot
- **Zapisywanie konfiguracji** - nie musisz wpisywać kluczy za każdym razem

---

## 🚀 Quick Start

### 1. Wgraj na GitHub Pages

```bash
# Zmień nazwę pliku na index.html
mv affiliate-dashboard-complete.html index.html

# Wgraj do repo
git add index.html
git commit -m "Add affiliate dashboard"
git push
```

W Settings → Pages → Enable

Dashboard dostępny pod: `https://[username].github.io/[repo]/`

---

## 🔑 Konfiguracja API Keys

### Partnerize (3 klucze)

1. Zaloguj się na [Partnerize](https://console.partnerize.com)
2. Kliknij logo → **Account Settings**
3. Znajdź:
   - **Application Key** (User Application Key)
   - **User API Key** (User API Key)
4. Kliknij **Settings** u góry → **Publisher ID** (np. `10111308478`)

### Zeropark (1 klucz)

1. Zaloguj się na [Zeropark Panel](https://panel.zeropark.com)
2. **Dashboard → My Account → Security**
3. Kliknij **"Create new API access token"**
4. Skopiuj **API Token**

### Awin (2 klucze)

1. Zaloguj się na [Awin](https://ui.awin.com)
2. Przejdź do: https://ui.awin.com/awin-api
3. Wpisz hasło → **"Show my API token"**
4. Skopiuj **OAuth2 Bearer Token**
5. **Publisher ID** - widoczny w prawym górnym rogu Awin UI

---

## 📧 Email Notifications (opcjonalne)

### Setup EmailJS

1. Zarejestruj się na [emailjs.com](https://emailjs.com)
2. Dodaj **Email Service** (Gmail/Outlook)
3. Stwórz **Email Template**:

```
Subject: {{platform}} - Zmiany wykryte

Wykryto zmiany w {{platform}}:

{{changes_html}}

Czas: {{timestamp}}
```

4. Skopiuj:
   - **Service ID** (np. `service_xxxxxxx`)
   - **Template ID** (np. `template_xxxxxxx`)
   - **Public Key** (Settings → Account)

5. Wpisz swój email w pole **"Twój Email"**

---

## 🔔 Push Notifications

### W przeglądarce (desktop/mobile)

1. Po połączeniu kliknij **"🔔 Włącz Powiadomienia Push"**
2. Przeglądarka zapyta o pozwolenie → **Zezwól**
3. Gotowe! Będziesz dostawać powiadomienia gdy kwoty się zmienią

### Na iPhone (PWA)

1. Otwórz dashboard w **Safari**
2. Kliknij **Udostępnij** → **"Dodaj do ekranu głównego"**
3. Aplikacja działa jak natywna!

---

## 📊 Jak działa dashboard?

### Partnerize Payment Summary

Dashboard pobiera endpoint: `/user/publisher/{id}/payment/summary`

Pokazuje **5 statusów płatności**:
- 💛 **Pending** - Oczekujące na zatwierdzenie
- 💚 **Approved** - Zatwierdzone przez reklamodawcę
- 💙 **Confirmed** - Potwierdzone, dostępne po opłaceniu faktury
- ✅ **Available** - Dostępne do wypłaty TERAZ
- 🔵 **Paid** - Już wypłacone

Statusy z £0.00 są **przygaszone** (opacity 0.5) z badge "Brak".

### Zeropark Stats

Dashboard pobiera: `/api/stats/campaign/all`

Pokazuje:
- **Wczoraj**: wydatki, zysk
- **Ten miesiąc**: wydatki, zysk

### Awin Transactions

Dashboard pobiera: `/publishers/{id}/transactions/`

Pokazuje prowizje z podziałem:
- **Pending** - oczekujące
- **Approved** - zatwierdzone

---

## 🔍 Wykrywanie zmian

Dashboard zapisuje poprzedni stan w `localStorage` i porównuje:

### Dla Partnerize:
Jeśli kwota dla **status_currency** się zmieni (np. `paid_GBP: £75,000 → £76,000`):
1. 🔔 Push notification
2. 📧 Email notification
3. 📝 Wpis w logu

### Dla Zeropark/Awin:
Jeśli **profit** lub **total** się zmieni:
1. 🔔 Push notification
2. 📧 Email notification
3. 📝 Wpis w logu

---

## ⚙️ Auto-Refresh

Wybierz interwał:
- **1 minuta** - dla krytycznych kampanii
- **5 minut** - standardowe monitorowanie
- **15 minut** - zalecane (default)
- **30 minut** - oszczędzanie API calls

Dashboard automatycznie pobiera dane i wykrywa zmiany w tle.

---

## 📱 Responsywność

Dashboard działa na:
- 💻 Desktop (Chrome, Firefox, Safari, Edge)
- 📱 Mobile (iOS Safari, Chrome Android)
- 📲 Jako PWA (instalowalna aplikacja)

---

## 🔒 Bezpieczeństwo

- **API keys** zapisane w `localStorage` (tylko w Twojej przeglądarce)
- **CORS Proxy** używany: `corsproxy.io`
- **Dla produkcji** zalecane własne proxy
- **EmailJS** - klucze nie są wysyłane do backendu

---

## 🎨 Customization

### Zmiana kolorów statusów

W CSS znajdź:
```css
.status-card.pending { border-left-color: #f5a623; }
.status-card.approved { border-left-color: #00e676; }
```

Zmień hex na swoje kolory!

### Zmiana interwałów auto-refresh

W HTML znajdź:
```html
<option value="60000">1 minuta</option>
```

Dodaj własne wartości (w milisekundach).

---

## 🐛 Troubleshooting

### Partnerize nie łączy się
- Sprawdź czy masz **3 klucze**: Application Key, User API Key, Publisher ID
- Otwórz Console (F12) → sprawdź czy endpoint zwraca 404
- Upewnij się że Publisher ID to liczba (np. `10111308478`)

### Zeropark nie działa
- Upewnij się że token został **skopiowany bez spacji**
- Token powinien być długi string (50+ znaków)

### Awin błąd 401
- Bearer token wygasa po czasie - wygeneruj nowy
- Sprawdź czy Publisher ID jest poprawny

### Powiadomienia nie działają
- Push: upewnij się że dałeś **pozwolenie** w przeglądarce
- Email: sprawdź czy EmailJS **Service**, **Template** i **Public Key** są poprawne
- Sprawdź Console (F12) czy są błędy

### Dashboard nie wykrywa zmian
- Auto-refresh musi być **włączony**
- Zmiany wykrywane tylko gdy kwota **faktycznie się zmieni**
- Pierwsze uruchomienie **nie wysyła** powiadomień (brak poprzedniego stanu)

---

## 📈 Rate Limits

**Partnerize**: Nie określone w dokumentacji  
**Zeropark**: Nie określone w dokumentacji  
**Awin**: **20 zapytań/minutę** (dashboard używa 2 na refresh)

Zalecane: **Auto-refresh co 15-30 minut**

---

## 🔄 Aktualizacje

Dashboard zapisuje konfigurację - po zamknięciu karty możesz:
1. Kliknąć **"Załaduj Zapisaną Konfigurację"**
2. Dashboard automatycznie wypełni wszystkie pola
3. Kliknij "Połącz" - gotowe!

---

## 💡 Pro Tips

1. **Używaj 15-minutowego auto-refresh** - zmiany statusów płatności nie następują co minutę
2. **Włącz push notifications** - będziesz wiedzieć natychmiast gdy coś się zmieni
3. **Sprawdź log powiadomień** - historia wszystkich zmian w jednym miejscu
4. **Zapisz jako PWA** na telefonie - dashboard zawsze pod ręką
5. **EmailJS darmowy plan** pozwala na 200 emaili/miesiąc - wystarczy!

---

## 📞 Support

Jeśli masz problemy:
1. Sprawdź **Console** (F12 → Console)
2. Upewnij się że API keys są poprawne
3. Sprawdź czy CORS proxy działa (odwiedź `corsproxy.io`)

---

## 🎯 Roadmap

Możliwe rozszerzenia (jeśli potrzebujesz):
- [ ] Google Sheets export
- [ ] Slack notifications
- [ ] Discord webhooks
- [ ] Custom alerting rules (np. "powiadom gdy Paid > £100k")
- [ ] Historical charts
- [ ] Multiple accounts support

---

**Zrobione z ❤️ dla affiliate marketers**
