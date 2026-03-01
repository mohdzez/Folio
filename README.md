# folio.

> A minimal offline-first personal task PWA. Speed over everything.

**Stack:** React + TypeScript + Vite · Firebase Auth/Firestore/FCM · GitHub Pages · Cloudflare CDN

---

## Quick Start

### 1. Firebase Project Setup

```bash
# Install Firebase CLI (already installed if you have it)
npm install -g firebase-tools

# Login
firebase login

# Create a new project (or use existing)
firebase projects:create folio-pwa-yourname

# Initialize (select Firestore + Hosting)
firebase use folio-pwa-yourname
firebase init firestore
firebase deploy --only firestore:rules,firestore:indexes
```

Then go to **Firebase Console → Project Settings → Your apps → Add web app** and copy your config values.

### 2. Environment Variables

```bash
cp .env.example .env.local
# Fill in all VITE_FIREBASE_* values from your Firebase web app config
```

**FCM VAPID Key:** Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair

### 3. Local Development

```bash
npm install
npm run dev
```

### 4. Deploy to GitHub Pages (Free)

1. Push this repo to GitHub
2. Go to **Settings → Secrets and variables → Actions** and add all `VITE_FIREBASE_*` secrets
3. Go to **Settings → Pages** → Source: **GitHub Actions**
4. Push to `main` — the workflow deploys automatically

Your app will be live at: `https://yourusername.github.io/folio-pwa/`

### 5. Cloudflare CDN (Free)

**Option A: Cloudflare Pages (recommended — replaces GitHub Pages)**
```bash
# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=folio-pwa
```
Then in Cloudflare Dashboard: Pages → folio-pwa → Settings → Environment variables → add all secrets.

**Option B: Cloudflare in front of GitHub Pages**
1. Add your domain to Cloudflare
2. Point CNAME to `yourusername.github.io`
3. Enable SSL/TLS: Full (strict)
4. Add Page Rule: `yourdomain.com/folio-pwa/*` → Cache Level: Standard

---

## Architecture

```
src/
├── components/
│   ├── TaskItem.tsx      # Swipeable task row
│   ├── TaskList.tsx      # Grouped task list
│   ├── AddTask.tsx       # Bottom sheet with NL date parsing
│   ├── ListSwitcher.tsx  # Tab bar for Personal/Work/Errands/Today
│   ├── FilterBar.tsx     # All/Today/Upcoming/Overdue filters
│   └── Settings.tsx      # Settings drawer
├── hooks/
│   ├── useAuth.ts        # Firebase Auth (anonymous + Google)
│   ├── useTasks.ts       # Firestore CRUD + optimistic updates
│   └── useNotifications.ts # FCM push permission + foreground handler
├── lib/
│   ├── firebase.ts       # Firebase app init
│   ├── firestore.ts      # Firestore helpers
│   └── parseDate.ts      # chrono-node NL date parsing
├── types/index.ts        # Shared TypeScript types
├── sw.ts                 # Custom service worker (Workbox + FCM)
└── App.tsx               # Root component
```

## Features

| Feature | Status |
|---|---|
| Add tasks with natural language dates | ✅ |
| Swipe right to complete | ✅ |
| Swipe left to delete | ✅ |
| Personal / Work / Errands lists | ✅ |
| Today / Upcoming / Overdue views | ✅ |
| Dark / Light mode | ✅ |
| Offline-first (service worker) | ✅ |
| Firebase Firestore sync | ✅ |
| Anonymous auth (no sign-in required) | ✅ |
| Google sign-in (optional) | ✅ |
| PWA installable (Android + iOS) | ✅ |
| Push notifications via FCM | ✅ |
| Starred tasks | ✅ |
| Quick date presets (Today/Tomorrow/Weekend) | ✅ |
| Subtasks (expandable) | ✅ |

## Design

**Obsidian Canvas** — Near-black background, warm amber accent, JetBrains Mono typeface. The default view is almost empty. Power lives one tap beneath the surface.

> The `+` button is the only colored element you'll see on a fresh screen.
