# Leetmate – Project Structure

Start page plus two screens, each in its own folder with its own CSS and JS.

---

## Flow

1. **Start page (popup)** – Opens when you click the extension icon. Two buttons:
   - **Sign up** → goes to `screens/signup/index.html`
   - **Sign in** → goes to `screens/signin/index.html`

2. **Sign up screen** – `screens/signup/`. Has its own `signup.css` and `signup.js`. "← Back" returns to the start page.

3. **Sign in screen** – `screens/signin/`. Has its own `signin.css` and `signin.js`. "← Back" returns to the start page.

---

## Folder layout

```
Leetmate/
├── popup.html              ← Start page (Sign up / Sign in buttons)
├── popup.js
├── styles/
│   └── popup.css           ← Start page only
├── screens/
│   ├── signup/
│   │   ├── index.html      ← Sign up page
│   │   ├── signup.css      ← Sign up styles only
│   │   └── signup.js       ← Sign up logic only
│   └── signin/
│       ├── index.html      ← Sign in page
│       ├── signin.css      ← Sign in styles only
│       └── signin.js       ← Sign in logic only
├── background.js
├── options.html / options.js
└── manifest.json
```

---

## Files

| File | Purpose |
|------|---------|
| **popup.html** | Start page: Sign up and Sign in buttons (links to each screen). |
| **popup.js** | Start-page logic if needed. |
| **styles/popup.css** | Styles for the start page only. |
| **screens/signup/index.html** | Sign-up screen markup. |
| **screens/signup/signup.css** | Styles for the sign-up screen only. |
| **screens/signup/signup.js** | Sign-up logic (form, validation, auth). |
| **screens/signin/index.html** | Sign-in screen markup. |
| **screens/signin/signin.css** | Styles for the sign-in screen only. |
| **screens/signin/signin.js** | Sign-in logic (form, validation, auth). |
| **background.js** | Extension background (reminders, etc.). |
| **options.html / options.js** | Extension options. |
| **manifest.json** | Extension config. |

---

## Adding more screens later

Create a new folder under `screens/`, e.g. `screens/home/` with `index.html`, `home.css`, and `home.js`. Link to it from the start page or from another screen (e.g. `screens/home/index.html`).
