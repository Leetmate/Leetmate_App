# Deploying Leetmate to the Chrome Web Store

**This project does not use the Firebase CLI.** We use the Firebase Web SDK (script tags) in the extension and a small Node script to inject your `.env` into the config at **build time**. No `firebase init`, `firebase deploy`, or other CLI is required.

The Chrome Web Store does not support environment variables at runtime. You upload a zip of your extension; whatever is in that package is what users get. So we apply env vars **when you build**: `npm run build:config` reads `.env` and writes `firebase-config.js` with those values. The extension you zip and upload already contains that generated file, so **after deployment the config works** because it’s baked into the package.

## One-time setup

1. Copy the example env file and add your Firebase values (from [Firebase Console](https://console.firebase.google.com) → Project settings → Your apps):
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set each variable. No Firebase CLI needed — only the values from the web console.

## Before each deployment

1. From the `Leetmate` folder, run:

   ```bash
   npm run build:config
   ```

   This reads `.env` and writes `firebase-config.js` (from `firebase-config.template.js`). The generated file is what the extension loads.

2. **Package the extension:**
   - Open `chrome://extensions`, enable **Developer mode**.
   - Click **Pack extension** and choose the `Leetmate` folder (or zip the folder yourself).
   - Upload that zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

The deployed extension will use the config from step 1; no env vars or CLI run on the store’s side.

## Firebase Auth and Firestore (for sign-up/sign-in)

- **Authorized domains:** In [Firebase Console](https://console.firebase.google.com) → Authentication → Settings → Authorized domains, add your Chrome extension origin: `chrome-extension://YOUR_EXTENSION_ID` (find the ID on `chrome://extensions` when the extension is loaded).
- **Firestore rules:** In Firestore → Rules, allow authenticated users to read/write their own document in `users`, plus any other collections you use. For **friend battles**, merge the `friendBattleInvites` and `friendPvPBattles` blocks from `firestore.rules.example` in this folder (paste them inside your existing `match /databases/{database}/documents { ... }` — do not drop your `users` / `friendRequests` rules).

## Notes

- **Do not commit `.env`** — it’s in `.gitignore`. Commit `.env.example` so others know which vars to set.
- Firebase client config (e.g. `apiKey`) is safe to ship in the extension; security is enforced by Firebase Auth and Security Rules and by authorized domains in the Firebase Console.
- For local development, run `npm run build:config` once after filling `.env` so `firebase-config.js` exists; then load the extension from the `Leetmate` folder.
