/**
 * Local notification scheduler.
 *
 * Uses ServiceWorkerRegistration.showNotification() which works even when the
 * browser tab is backgrounded (unlike `new Notification()` which Chrome blocks
 * in background tabs). Falls back to `new Notification()` if SW not available.
 *
 * - No backend / FCM required.
 * - Timers are rescheduled whenever tasks change.
 * - `notifiedMap` prevents duplicate alerts for the same (taskId, notifyAt) pair.
 */

interface Timer {
  timeoutId: ReturnType<typeof setTimeout>
}

// Active timers keyed by taskId
const timers = new Map<string, Timer>()

// taskId → last notifyAt timestamp we already fired, prevents duplicates
const notifiedMap = new Map<string, number>()

async function showNotification(taskId: string, title: string, body: string) {
  const icon = `${location.origin}/Folio/pwa-192x192.png`
  const opts: NotificationOptions = {
    body,
    icon,
    badge: icon,
    tag: `folio-${taskId}`,
    // renotify makes the notification re-ring even if tag already exists
    // @ts-ignore — `renotify` is valid but missing from older TS lib types
    renotify: true,
    data: { url: `${location.origin}/Folio/` },
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(`⏰ ${title}`, opts)
      return
    } catch {
      // SW not controlling page yet — fall through to basic Notification
    }
  }

  if (Notification.permission === 'granted') {
    new Notification(`⏰ ${title}`, opts)
  }
}

export function scheduleTaskNotification(
  taskId: string,
  taskTitle: string,
  notifyAtMs: number
) {
  // If we already fired a notification for this exact time, skip
  if (notifiedMap.get(taskId) === notifyAtMs) return

  // Cancel any existing timer for this task (e.g. task was edited)
  cancelTaskNotification(taskId)

  const delay = notifyAtMs - Date.now()

  // Skip if more than 1 minute in the past (already missed significantly)
  if (delay < -60_000) return

  const actualDelay = Math.max(0, delay)

  const timeoutId = setTimeout(async () => {
    timers.delete(taskId)
    notifiedMap.set(taskId, notifyAtMs)
    await showNotification(taskId, taskTitle, 'Task reminder')
  }, actualDelay)

  timers.set(taskId, { timeoutId })
}

export function cancelTaskNotification(taskId: string) {
  const t = timers.get(taskId)
  if (t) {
    clearTimeout(t.timeoutId)
    timers.delete(taskId)
  }
}

/** Call when a task is updated so the next scheduleTaskNotification re-fires */
export function resetNotifiedStatus(taskId: string) {
  notifiedMap.delete(taskId)
}

export function clearAllScheduled() {
  for (const { timeoutId } of timers.values()) clearTimeout(timeoutId)
  timers.clear()
}
