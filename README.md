# TQ Statistics — Setup Guide

Your complete website lives in this folder as 5 files:

```
login.html       ← Users land here first
index.html       ← Main statistics dashboard (login-protected)
style.css        ← All visual styles (login page + dashboard)
script.js        ← All dashboard logic
apps-script.gs   ← Paste this into Google Apps Script
```

---

## Step 1 — Set up your Google Sheet

1. Open your existing Google Sheet (or create a new one).
2. Make sure you have a sheet tab named **Stats** — this is where your data lives.
   - If it doesn't exist yet: click the **+** at the bottom → rename it `Stats`.
3. Add a second sheet tab named **Users** — this is your login database.
   - Click **+** at the bottom → rename it `Users`.
4. In the **Users** sheet, set up the header row and add your login:

| A (Username) | B (Password) | C (Name)   |
|-------------|--------------|------------|
| trevor      | mypassword   | Trevor Lee |

   - **Username**: what you type at login (not case-sensitive)
   - **Password**: plain text — keep this sheet private
   - **Name**: shown in the app header after login
   - Add more rows to give other people access

---

## Step 2 — Add the Apps Script

1. In your Google Sheet: **Extensions → Apps Script**
2. Delete all the existing code in the editor.
3. Open `apps-script.gs` from this folder, copy everything, and paste it in.
4. Click **Save** (the floppy disk icon).

---

## Step 3 — Deploy the Apps Script

1. Click **Deploy → New Deployment**
2. Click the gear icon next to "Type" → select **Web App**
3. Fill in:
   - **Description**: TQ Statistics (or anything)
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

> **Every time you edit the Apps Script code**, you must create a **New Deployment** (not update the existing one) to apply the changes. Updating keeps the old version live.

---

## Step 4 — Connect the URL to your app

You have two ways to do this:

**Option A — Enter it in the app (easiest)**
- Open `login.html` in your browser
- Log in
- On the dashboard, click the ⚙ gear icon → paste your Web App URL → Save

**Option B — Hard-code it (so you never have to enter it again)**
- Open `login.html` in a text editor
- Find this line near the top of the `<script>` block:
  ```js
  var SCRIPT_URL = localStorage.getItem('tq_script_url') || '';
  ```
- Change it to:
  ```js
  var SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_URL_HERE/exec';
  ```
- Do the same in `script.js` — find the `getConfiguredScriptUrl` function and set a default URL.

---

## Step 5 — Upload to your hosting platform

Upload all 5 files to the **same folder** on your host:
- `login.html`
- `index.html`
- `style.css`
- `script.js`
- `apps-script.gs` ← you don't need to upload this one, it only runs in Google

Set `login.html` as your homepage (or share that URL with users).

Works on any static host: **Netlify, GitHub Pages, Vercel, cPanel, any web server**.

---

## How the login works

- Usernames and passwords are stored in your **Users** sheet.
- When someone logs in, the app sends their credentials to your Apps Script.
- The script checks the sheet — if it matches, it returns a token.
- That token is saved in the browser for **8 hours** (then they log in again).
- Closing the browser does NOT log them out — the session persists.

To **change the session duration**, open `login.html` and edit:
```js
var SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
```
Change `8` to however many hours you want.

---

## How to add / remove users

Just edit the **Users** sheet in Google Sheets:
- **Add a row** = add a user
- **Delete a row** = remove a user
- **Change Column B** = change that user's password

Changes take effect immediately — no redeployment needed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No Users sheet found" | Create a sheet tab named exactly `Users` (capital U) |
| "Incorrect username or password" | Double-check the spelling in the Users sheet — passwords are case-sensitive |
| Login succeeds but data doesn't load | The Script URL is wrong — re-enter it in Settings (⚙) |
| After editing the Apps Script, old behaviour persists | You must create a **New Deployment** — editing code does not update an existing deployment |
| CORS error in browser console | Make sure "Who has access" is set to **Anyone** when deploying |
| App asks me to log in again | Session expired (8 hours) — just log in again |

---

## Files you can safely edit

| File | What you can change |
|------|---------------------|
| `style.css` | Colors, fonts, spacing, layout |
| `login.html` | Login page text, session duration, hard-coded Script URL |
| `index.html` | Page structure, add/remove sections |
| `script.js` | Categories list (top of file), Notebook URL, chart colours |
| `apps-script.gs` | Sheet names, column layout, add new data endpoints |

---

## Changing the category buttons

Open `script.js` and find the `CATEGORIES` array at the very top:

```js
const CATEGORIES = [
  { key: 'ql',  label: 'Qualified Leads',  color: '#22c55e' },
  { key: 'snr', label: 'Silence/No Response/Voicemail', color: '#8b5cf6' },
  // ... more rows
];
```

- **label**: the button title shown in the app
- **color**: the number colour (hex code)
- **key**: the column it maps to in your Stats sheet — don't change these unless you also update the Apps Script and sheet columns

---

That's it. Questions? Edit the files directly — they're plain HTML, CSS, and JS with comments throughout.
