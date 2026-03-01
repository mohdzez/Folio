# Personal To-Do PWA — App Summary & Desirables

## What It Is

A **Progressive Web App (PWA)** to-do list built for personal use, prioritizing
speed and clarity above all else. Installable on mobile like a native app, works
offline, and syncs seamlessly via Firebase. Hosted for free on GitHub Pages with
Cloudflare in front for caching and HTTPS.

---

## How It Works (Core Flow)

The app opens instantly to a **single clean list view** — no dashboard, no
onboarding, no friction. The user sees their tasks and nothing else. Every
action is reachable in one or two taps from this screen.

**Adding a task** is the most critical interaction. A persistent `+` button in
the thumb zone opens an inline input (not a new screen). The user types
naturally — _"Call dentist Thursday 9am"_ — and the app parses the date and time
automatically. Tap confirm, done. The whole flow takes under 3 seconds.

**Completing a task** is a swipe right or double-tap. **Deleting** is a swipe
left or long-press. No extra confirmation screens for routine actions.

Tasks live in **flat lists** (e.g., Personal, Work, Errands) switchable from a
bottom tab or side drawer. No nested folders, no project hierarchies.

**Push notifications** fire before due tasks using the Web Push API via Firebase
Cloud Messaging (FCM). The user sets a reminder lead time (e.g., 15 min, 1 hour
before) per task or globally in settings. Notifications work even when the app
isn't open, since it's a PWA with a service worker registered.

---

## Technical Architecture

| Layer              | Tool                       | Role                                    |
| ------------------ | -------------------------- | --------------------------------------- |
| Hosting            | GitHub Pages               | Static file hosting, free               |
| CDN / HTTPS        | Cloudflare                 | Caching, SSL, custom domain             |
| Auth               | Firebase Auth              | Anonymous or Google sign-in             |
| Database           | Firestore                  | Real-time sync across devices           |
| Push Notifications | Firebase Cloud Messaging   | Background reminders via service worker |
| Offline            | Service Worker + Cache API | Full offline-first capability           |

The app is a static build (React or vanilla JS) deployed to GitHub Pages.
Cloudflare sits in front for SSL and performance. All data lives in Firestore,
so syncing between phone and desktop is automatic and real-time.

---

## Feature List (Priority Order)

### Must-Have

- **Instant task capture** with natural language date/time parsing
- **Push notifications** via FCM for task reminders (customizable lead time,
  works when app is closed)
- **PWA installable** on Android and iOS home screen with service worker for
  offline use
- **Swipe gestures** — right to complete, left to delete/snooze
- **Multiple flat lists** (Personal, Work, Errands, etc.)
- **Due dates + recurring tasks** (daily, weekly, custom) with simple toggles
- **Today / Upcoming / Overdue** smart filter views
- **Light and dark mode**
- **Offline-first** — tasks created offline sync when connection returns
- **Cross-device sync** via Firestore

### Should-Have

- **Subtasks and notes** — hidden by default, expandable with one tap
- **Home screen widget** (Android PWA supports this via Shortcuts API)
- **Calendar view** — a simple monthly view showing days with tasks, no full
  planner
- **Snooze on notifications** — "remind me in 1 hour" from the notification
  itself
- **Presets when setting due dates** — Today, Tomorrow, This Weekend, Next Week
  buttons

### Nice-to-Have (one tap away, never in the way)

- **Focus / Pomodoro mode** — hides everything except the current task, runs a
  25-minute timer
- **Location-based reminders** — "remind me when near supermarket" via
  Geolocation API
- **Smart task suggestions** — surface incomplete tasks from yesterday at the
  top of Today view
- **Minimal AI input assist** — auto-categorize tasks by keyword (e.g., "email"
  → Work list)

---

## What to Avoid

- No ads, ever
- No mandatory account creation on first launch (allow anonymous use, prompt to
  save later)
- No onboarding slideshow — show the app immediately
- No gamification (streaks, points, badges)
- No social or sharing features
- No complex priority systems (P1/P2/P3 matrices) — at most a single
  "starred/important" toggle
- No heavy animations that slow down the feel of speed
- Advanced features must be **hidden by default**, accessible only when the user
  looks for them

---

## The One-Line Design Rule

> **The default view should look almost empty. Power lives one tap beneath the
> surface.**
