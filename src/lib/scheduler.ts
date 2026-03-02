/**
 * Local + remote notification scheduler.
 *
 * - Local path: setTimeout → ServiceWorkerRegistration.showNotification()
 *   Works when the app tab is open or recently backgrounded.
 *
 * - Remote path: POST to Cloudflare Worker which fires FCM at the right time.
 *   Works even when the app is completely closed.
 *
 * Call `setWorkerConfig()` once after the user has a valid FCM token.
 */

interface Timer {
  timeoutId: ReturnType<typeof setTimeout>
}

// Active timers keyed by taskId
const timers = new Map<string, Timer>()

// taskId → last notifyAt timestamp we already fired locally, prevents duplicates
const notifiedMap = new Map<string, number>()

// taskId → notifyAt we've already sent to the Worker
// Prevents a KV write on every Firestore snapshot update (called on every allTasks change)
const workerRegistered = new Map<string, number>()

// Cloudflare Worker config — set once from App.tsx
let workerUrl = ''
let workerApiKey = ''
let fcmToken = ''

export function setWorkerConfig(url: string, apiKey: string, token: string) {
  workerUrl = url
  workerApiKey = apiKey
  fcmToken = token
}

// ── Remote (Worker) scheduling ─────────────────────────────────────────────

async function workerSchedule(taskId: string, title: string, notifyAtMs: number) {
  if (!workerUrl || !workerApiKey || !fcmToken) return
  // Skip KV write if we've already registered this exact notifyAt for this task
  if (workerRegistered.get(taskId) === notifyAtMs) return
  try {
    await fetch(`${workerUrl}/api/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ taskId, title, notifyAt: notifyAtMs, fcmToken }),
    })
    workerRegistered.set(taskId, notifyAtMs)
  } catch {
    // Network failure — local fallback still covers the case
  }
}

async function workerCancel(taskId: string) {
  if (!workerUrl || !workerApiKey) return
  workerRegistered.delete(taskId)
  try {
    await fetch(`${workerUrl}/api/schedule/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${workerApiKey}` },
    })
  } catch { /* ignore */ }
}

// ── Local (setTimeout) scheduling ─────────────────────────────────────────

async function showLocalNotification(taskId: string, title: string, body: string) {
  const icon = `${location.origin}/Folio/pwa-192x192.png`
  const badge = `${location.origin}/Folio/badge-96x96.png` // monochrome for Android status bar
  const opts: NotificationOptions = {
    body,
    icon,
    badge,
    tag: `folio-${taskId}`,
    // @ts-ignore — `renotify` is valid but missing from older TS lib types
    renotify: true,
    data: { url: `${location.origin}/Folio/` },
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(`⏰ ${title}`, opts)
      return
    } catch { /* fall through */ }
  }

  if (Notification.permission === 'granted') {
    new Notification(`⏰ ${title}`, opts)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function scheduleTaskNotification(
  taskId: string,
  taskTitle: string,
  notifyAtMs: number
) {
  if (notifiedMap.get(taskId) === notifyAtMs) return

  cancelTaskNotification(taskId)

  const delay = notifyAtMs - Date.now()
  if (delay < -60_000) return // already missed by more than 1 minute

  const actualDelay = Math.max(0, delay)

  // Local timeout — fires if tab is still open
  const timeoutId = setTimeout(async () => {
    timers.delete(taskId)
    notifiedMap.set(taskId, notifyAtMs)
    await showLocalNotification(taskId, taskTitle, 'Task reminder')
    // Once fired locally, cancel from Worker to avoid duplicate
    workerCancel(taskId)
  }, actualDelay)

  timers.set(taskId, { timeoutId })

  // Remote Worker — fires even if app is closed
  workerSchedule(taskId, taskTitle, notifyAtMs)
}

export function cancelTaskNotification(taskId: string) {
  const t = timers.get(taskId)
  if (t) {
    clearTimeout(t.timeoutId)
    timers.delete(taskId)
  }
  workerCancel(taskId)
}

/** Call when a task is updated so the next scheduleTaskNotification re-fires */
export function resetNotifiedStatus(taskId: string) {
  notifiedMap.delete(taskId)
}

export function clearAllScheduled() {
  for (const { timeoutId } of timers.values()) clearTimeout(timeoutId)
  timers.clear()
}
