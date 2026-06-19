<p align="center">
  <img src="docs/images/banner.svg" alt="folio. — task management PWA" width="100%"/>
</p>

<p align="center">
  <a href="https://munimx.github.io/Folio/"><strong>→ Live App</strong></a>
  &nbsp;·&nbsp;
  <a href="#quick-start">Setup</a>
  &nbsp;·&nbsp;
  <a href="#architecture">Architecture</a>
  &nbsp;·&nbsp;
  <a href="#features">Features</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-installable-d4a853?style=flat-square&logo=pwa&logoColor=black" alt="PWA"/>
  <img src="https://img.shields.io/badge/offline--first-✓-d4a853?style=flat-square" alt="Offline"/>
  <img src="https://img.shields.io/badge/hosting-free-d4a853?style=flat-square" alt="Free hosting"/>
  <img src="https://img.shields.io/badge/React-TypeScript-d4a853?style=flat-square&logo=react&logoColor=black" alt="React TypeScript"/>
  <img src="https://img.shields.io/badge/Firebase-Firestore-d4a853?style=flat-square&logo=firebase&logoColor=black" alt="Firebase"/>
  <img src="https://img.shields.io/badge/Postgres-optional-d4a853?style=flat-square&logo=postgresql&logoColor=black" alt="Optional Postgres"/>
</p>

---

## Screenshots

<p align="center">
  <img src="docs/images/screenshot-main.svg" width="200" alt="Task list view"/>
  &nbsp;&nbsp;&nbsp;
  <img src="docs/images/screenshot-addtask.svg" width="200" alt="Add task with NL parsing"/>
</p>

<p align="center">
  <sub>Dark theme · Natural language date parsing · Swipe gestures · Push notifications</sub>
</p>

---

## What It Is

**folio.** is a speed-first, offline-capable personal task manager built as a PWA. No account required, installs on any home screen, works without internet, syncs across devices when online.

> *The default view should look almost empty. Power lives one tap beneath the surface.*

The core interaction: open the app, type `"Call dentist thursday 9am remind 15min before"` — folio parses the date, sets the reminder, and gets out of your way in under 3 seconds.

---

## Features

| | Feature | Detail |
|---|---|---|
| ⚡ | **Natural language input** | `"Buy groceries tomorrow 6pm"` → parsed automatically via chrono-node |
| 👆 | **Swipe gestures** | Right to complete · Left to delete · Hold to snooze |
| 📋 | **Multiple lists** | Personal · Work · Errands — switchable from tab bar |
| 🔍 | **Smart views** | Today · Upcoming · Overdue filters |
| 🔔 | **Push notifications** | Works when app is closed (Cloudflare Worker + FCM v1 API) |
| 📝 | **Rich notes** | Per-task notes with headings, bullets, checklists |
| 🔄 | **Recurring tasks** | Daily / weekly auto-creates next occurrence on completion |
| 📅 | **Custom reminders** | Set reminder at specific date & time per task |
| 📴 | **Offline-first** | Full functionality without internet; syncs on reconnect |
| 🔁 | **Firestore sync** | Real-time cross-device sync via Firebase |
| 🔓 | **No account required** | Anonymous auth by default; optional Google sign-in |
| 🌗 | **Dark / Light mode** | Follows system preference or manual toggle |
| 📲 | **PWA installable** | Add to home screen on Android & iOS |
| ⭐ | **Starred tasks** | Priority flag, always visible |
| ↩️ | **Double-tap to add** | Anywhere on the screen opens the add panel |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React + TypeScript + Vite PWA                               │
│    Mobile-first installable app                              │
│    Desktop-compatible web layout                             │
│    Service Worker: Workbox precache + FCM background push    │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   ┌──────▼──────┐         ┌────────▼────────┐
   │  Static PWA │         │  Server mode    │
   │  GitHub     │         │  Express + pg   │
   │  Pages      │         │  DATABASE_URL   │
   │  Firebase   │         │  Postgres tasks │
   └──────┬──────┘         └────────┬────────┘
          │                         │
   ┌──────▼──────┐         ┌────────▼────────┐
   │  Firestore  │         │  Liftoff canvas │
   │  + FCM      │         │  DB injection   │
   └─────────────┘         └─────────────────┘
```

```
src/
├── components/
│   ├── TaskItem.tsx        Swipeable task row with gesture detection
│   ├── TaskList.tsx        Grouped/sectioned task list
│   ├── AddTask.tsx         Bottom-sheet input with NL date parsing
│   ├── ListSwitcher.tsx    Tab bar (Personal/Work/Errands/Today)
│   ├── FilterBar.tsx       All/Today/Upcoming/Overdue filters
│   ├── NoteEditor.tsx      Rich notes editor (headings, bullets, checklists)
│   ├── DateTimePicker.tsx  Custom date & time picker
│   └── Settings.tsx        Settings drawer
├── hooks/
│   ├── useAuth.ts          Firebase Auth (anonymous + Google sign-in)
│   └── useTasks.ts         Postgres API or Firestore CRUD + optimistic updates
├── lib/
│   ├── firebase.ts         Firebase init with persistent local cache
│   ├── firestore.ts        Firestore helpers
│   ├── postgresApi.ts      Same-origin API client for server mode
│   ├── parseDate.ts        chrono-node NL date parsing
│   └── scheduler.ts        Dual-mode notification scheduler (local + Worker)
├── types/index.ts          Shared TypeScript types
├── sw.ts                   Service worker (Workbox + FCM push handler)
└── App.tsx                 Root component
server/
└── index.js                Express static server + optional Postgres task API
workers/
└── notifier/               Cloudflare Worker — FCM v1 push when app is closed
    └── src/index.ts        KV task store · cron every minute · REST endpoints
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/munimx/Folio.git
cd Folio
npm install
```

### 2. Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Deploy Firestore rules & indexes
firebase use folio-munimx   # or your project ID
firebase deploy --only firestore:rules,firestore:indexes
```

Go to **Firebase Console → Project Settings → Your apps → Add web app** and copy your config.

### 3. Environment Variables

Create `.env` in the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_WORKER_URL=https://your-worker.workers.dev
VITE_WORKER_API_KEY=your-api-key
```

**VAPID key:** Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair

### 4. Run Locally

```bash
npm run dev
# → http://localhost:5173/Folio/
```

### 5. Optional Postgres / Liftoff Mode

Folio remains a mobile-first PWA, but it can also run as a desktop-friendly website with an Express API. If `DATABASE_URL` is present, the app stores tasks in Postgres. Without it, Folio falls back to Firebase/Firestore.

```bash
npm run build
DATABASE_URL=postgres://user:password@localhost:5432/folio npm start
# → http://localhost:3000/
```

The server exposes `GET /api/health`; it returns `storage: "postgres"` when the database connection is active.

For a Liftoff canvas test, deploy the repo as a Docker-backed service, add a Postgres database node, connect it to the Folio service, and let Liftoff inject the DB connection. Folio reads the injected connection from `DATABASE_URL`.

### 6. Deploy to GitHub Pages (Free)

1. Push repo to GitHub
2. **Settings → Secrets → Actions** — add all `VITE_FIREBASE_*` secrets
3. **Settings → Pages** → Source: **GitHub Actions**
4. Push to `main` — deploys automatically

Live at: `https://yourusername.github.io/Folio/`

### 7. Cloudflare Worker (Push notifications when app is closed)

```bash
cd workers/notifier
npm install

# Set secrets
wrangler secret put API_KEY
wrangler secret put FIREBASE_CLIENT_EMAIL
wrangler secret put FIREBASE_PRIVATE_KEY
wrangler secret put FIREBASE_PROJECT_ID

# Deploy
wrangler deploy
```

---

## Design

**Obsidian Canvas** — Near-black `#0c0c0c` background, warm amber `#d4a853` accent, Georgia serif logotype, JetBrains Mono for data. The UI has one rule: *the default view should look almost empty*. The amber `+` button is the only colored element on a fresh screen.

Every advanced feature — reminders, notes, recurrence, subtasks — is one tap away and invisible until needed.

---

## Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Hosting | GitHub Pages | Free |
| Auth | Firebase Auth (anonymous + Google) | Free tier |
| Database | Firestore (offline-persistent) or injected Postgres | Free tier / deployment-provided |
| Push | Firebase Cloud Messaging v1 API | Free |
| Background push | Cloudflare Worker + KV + cron | Free tier |
| Build | Vite + vite-plugin-pwa | — |
| Parsing | chrono-node (NL dates) | — |

**Total hosting cost: $0**

---

<p align="center">
  <sub>Built with ♥ · MIT License</sub>
</p>
