# EmailJS Template Configuration

## Krok 1: Utwórz Email Service

1. Zaloguj się na https://emailjs.com
2. Idź do **Email Services**
3. Kliknij **Add New Service**
4. Wybierz provider (Gmail / Outlook / Yahoo)
5. Połącz swoje konto email
6. Skopiuj **Service ID** (np. `service_abc123`)

---

## Krok 2: Utwórz Email Template

1. Idź do **Email Templates**
2. Kliknij **Create New Template**
3. Wklej poniższy template:

### Subject Line:
```
{{platform}} - Wykryto zmiany prowizji
```

### Content (Body):
```html
<p>Witaj!</p>

<p>Wykryto zmiany w <strong>{{platform}}</strong>:</p>

{{changes_html}}

<p style="color: #666; font-size: 14px;">
Czas wykrycia: {{timestamp}}
</p>

<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

<p style="color: #999; font-size: 12px;">
To automatyczne powiadomienie z Affiliate Dashboard.<br>
Aby przestać otrzymywać powiadomienia, zmień ustawienia w dashboardzie.
</p>
```

### Template Variables (do sprawdzenia):
- `{{platform}}` - nazwa platformy (Partnerize)
- `{{changes_html}}` - HTML lista zmian
- `{{timestamp}}` - czas wykrycia zmian

### To Email:
```
{{to_email}}
```

4. Kliknij **Save**
5. Skopiuj **Template ID** (np. `template_xyz789`)

---

## Krok 3: Pobierz Public Key

1. Idź do **Account** (prawy górny róg)
2. W sekcji **General** znajdziesz **Public Key**
3. Skopiuj klucz (np. `abcXYZ123_456def`)

---

## Krok 4: Wpisz do Dashboardu

W formularzu setup wpisz:
- **EmailJS Service ID**: `service_abc123`
- **EmailJS Template ID**: `template_xyz789`
- **EmailJS Public Key**: `abcXYZ123_456def`
- **Twój Email**: `twoj@email.com`

---

## Przykład Emaila

Po wykryciu zmian dostaniesz email:

```
Subject: Partnerize - Wykryto zmiany prowizji

Witaj!

Wykryto zmiany w Partnerize:

• Zatwierdzone GBP: £50,000.00 → £55,000.00 (+£5,000.00)
• Dostępne GBP: £10,000.00 → £12,500.00 (+£2,500.00)

Czas wykrycia: 18.02.2026, 15:30:45
```

---

## Testowanie

Po skonfigurowaniu:
1. Połącz dashboard
2. Ręcznie zmień wartość w localStorage (Console):
   ```js
   localStorage.setItem('pz_prev', '[]')
   ```
3. Odśwież dashboard ręcznie
4. Powinien wykryć "zmiany" i wysłać testowy email!

---

## Troubleshooting

### Email nie przychodzi
- Sprawdź **spam folder**
- Upewnij się że **Service** jest połączony
- Sprawdź **EmailJS Dashboard → Logs** - tam zobaczysz czy email został wysłany
- Sprawdź Console (F12) czy są błędy

### "Failed to send email"
- Sprawdź czy Public Key jest poprawny
- Upewnij się że **EmailJS library** się załadowało
- Sprawdź czy Template ID się zgadza

### Otrzymuję emaile ale są puste
- Upewnij się że używasz `{{changes_html}}` w template (z podwójnymi nawiasami)
- Sprawdź czy template variables są poprawnie nazwane

---

## Rate Limits

**Darmowy plan EmailJS**:
- 200 emaili/miesiąc
- To wystarczy dla auto-refresh co 15 minut z kilkoma zmianami dziennie

**Płatny plan** (jeśli potrzebujesz więcej):
- $15/miesiąc = 5000 emaili
- $50/miesiąc = 50000 emaili

---

## Personalizacja

### Dodaj logo swojej firmy

W template (HTML):
```html
<img src="https://twoja-strona.com/logo.png" alt="Logo" style="max-width: 150px;">

<p>Witaj!</p>
...
```

### Zmień kolory

```html
<p style="background: #ffa726; color: #000; padding: 10px; border-radius: 5px;">
  Wykryto zmiany w <strong>{{platform}}</strong>
</p>
```

### Dodaj bezpośredni link do dashboardu

```html
<a href="https://[username].github.io/[repo]/" 
   style="background: #ffa726; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
  Otwórz Dashboard
</a>
```

---

## Security

- **Public Key** jest bezpieczny do użycia w kodzie frontend
- **Service ID** i **Template ID** są też publiczne
- EmailJS **nie wymaga** backend API keys w kodzie
- Wszystko działa przez ich CDN

---

Gotowe! 📧🎉
