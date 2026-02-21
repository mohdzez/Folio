# Folio — Personal Task Manager PWA

A beautiful, fast, offline-capable todo app with optional push notifications.

```text
folio-pwa/
├── index.html                  ← App shell
├── manifest.json               ← PWA manifest
├── sw.js                       ← Service worker (caching + push)
├── css/
│   ├── main.css                ← Layout & base styles
│   └── components.css          ← All UI components
├── js/
│   ├── app.js                  ← Entry point, navigation, event delegation
│   ├── db.js                   ← Data layer (localStorage + IDB sync)
│   ├── render.js               ← All DOM rendering
│   ├── tasks.js                ← Task CRUD + modal wiring
│   ├── categories.js           ← Category CRUD + modal wiring
│   ├── notifications.js        ← Push notification layer
│   ├── modal.js                ← Modal open/close helpers
│   └── utils.js                ← Date, DOM, ID helpers
├── assets/
│   └── icons/
│       ├── icon.svg            ← Scalable app icon
│       ├── icon-192.png        ← (generate from icon.svg — see below)
│       └── icon-512.png        ← (generate from icon.svg — see below)
├── cloudflare-worker/
│   ├── worker.js               ← Cloudflare Worker (cron + push sender)
│   └── wrangler.toml           ← Cloudflare config
└── README.md
```

---

## Quick Start (works immediately, no backend)

1. **Serve the folder over HTTPS** — required for PWA + notifications.

   The easiest free options:
   - **GitHub Pages**: push to a repo → Settings → Pages → deploy from `main`
   - **Cloudflare Pages**: connect your GitHub repo in the Cloudflare dashboard
   - **Local dev**: `npx serve .` or `python3 -m http.server 8080` (use ngrok
     for HTTPS if testing notifications locally)

2. Open the URL in Chrome or Safari, and the app works instantly.
   - Data is saved in `localStorage`
   - Works offline after first load (service worker cache)
   - Install as PWA via browser menu → "Add to Home Screen"

---

## Generate PNG Icons

The manifest requires 192×192 and 512×512 PNG icons. You can generate them from
`assets/icons/icon.svg` using any of:

```bash
# Using Inkscape
inkscape icon.svg -w 192 -h 192 -o icon-192.png
inkscape icon.svg -w 512 -h 512 -o icon-512.png

# Using ImageMagick
convert -background none icon.svg -resize 192x192 icon-192.png
convert -background none icon.svg -resize 512x512 icon-512.png

# Or use: https://realfavicongenerator.net
```

---

## Enable Push Notifications

### Mode 1 — Local only (simplest, no backend)

This mode uses the **Periodic Background Sync API** (Chrome on Android) or a
service worker fallback. No server needed.

1. Open `js/notifications.js`
2. Confirm `PUSH_MODE: 'local'` (it's already the default)
3. Click "Enable Notifications" in the app sidebar
4. Done — the SW will fire reminders when tasks are due within the hour

> **Note**: On desktop, the tab must be open (minimised is fine). On Android
> Chrome, it works fully in the background.

---

### Mode 2 — Full background push via Cloudflare Worker + Firebase

This sends notifications even when the browser is completely closed.

#### Step 1 — Firebase setup (5 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project (free Spark plan)
3. Project Settings → Cloud Messaging
4. Under "Web Push certificates" → Generate a key pair
5. Copy the **VAPID public key** and **Server key**

#### Step 2 — Cloudflare Worker (15 min)

```bash
# Install Wrangler CLI
npm install -g wrangler
wrangler login

# Create KV namespace
wrangler kv:namespace create "FOLIO_KV"
# Copy the id from output into cloudflare-worker/wrangler.toml

# Deploy the worker
cd cloudflare-worker
wrangler deploy

# Add your Firebase Server Key as a secret
wrangler secret put FCM_SERVER_KEY
# Paste your Firebase server key when prompted
```

Your worker URL will be printed after deploy, e.g.:
`https://folio-push-worker.YOUR_SUBDOMAIN.workers.dev`

#### Step 3 — Configure the app

Open `js/notifications.js` and update the `CONFIG` block:

```js
const CONFIG = {
  PUSH_MODE: 'remote',
  VAPID_PUBLIC_KEY: 'YOUR_VAPID_PUBLIC_KEY_FROM_FIREBASE',
  WORKER_URL: 'https://folio-push-worker.YOUR_SUBDOMAIN.workers.dev',
};
```

#### Step 4 — Enable notifications in the app

Click "Enable Notifications" in the sidebar. The app will:

1. Request browser permission
2. Create a push subscription with FCM
3. Send it to your Cloudflare Worker for storage

The worker runs hourly via cron and pushes a notification for any task due
within the next hour. You can manually trigger it at:
`https://your-worker.workers.dev/trigger`

---

## Keyboard Shortcuts

| Key   | Action      |
| ----- | ----------- |
| `N`   | New task    |
| `Esc` | Close modal |

---

## Data Storage

- **Tasks:** `localStorage` (`folio_tasks`)
- **Categories:** `localStorage` (`folio_cats`)
- **SW background check:** `IndexedDB` (`folio-sw-db`) — auto-synced
- **Push subscription:** Cloudflare KV (remote mode only)

---

## Tech Stack

- **Vanilla JS (ES Modules)** — no framework, no build step
- **CSS custom properties** — full theme in `:root` variables
- **Service Worker** — offline caching + push handling
- **localStorage** — zero-latency data layer
- **IndexedDB** — SW background task checks
- **Cloudflare Workers + KV** — optional push backend (free tier)
- **Firebase Cloud Messaging** — push delivery (free tier)

---

## Customization

### Change the color theme

Edit the CSS variables in `css/main.css` `:root` block.

### Add notification timing

In `cloudflare-worker/worker.js`, change the `60 * 60 * 1000` (1 hour) to any
window you prefer, e.g. `2 * 60 * 60 * 1000` for 2 hours.

### Add more category colors

Edit `CAT_COLORS` array in `js/categories.js`.
