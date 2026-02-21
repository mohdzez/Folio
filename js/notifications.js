// notifications.js
const CONFIG = {
  PUSH_MODE: 'remote',
  VAPID_PUBLIC_KEY:
    'BOuZ03D8BDOBEf-czhDiwQEfptmOfZJvlEpXPavbJZYUFLyyw4BO3rGYXab7fJ6w5yOsKvvXMNx6LNFZuJ-aY5c',
  WORKER_URL: 'https://folio-push-worker.munimahmad2.workers.dev',
};

export async function getNotifStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestAndSubscribe() {
  if (!('Notification' in window)) throw new Error('Not supported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission denied');
  if (CONFIG.PUSH_MODE === 'remote') await subscribeRemote();
  return perm;
}

async function subscribeRemote() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8(CONFIG.VAPID_PUBLIC_KEY),
  });
  const res = await fetch(`${CONFIG.WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub }),
  });
  if (!res.ok) throw new Error('Server error');
}

export async function updateNotifButton() {
  const btn = document.getElementById('notif-btn');
  const label = document.getElementById('notif-label');
  if (!btn || !label) return;
  const status = await getNotifStatus();
  if (status === 'granted') {
    label.textContent = 'Notifications on ✓';
    btn.style.color = 'var(--green)';
    btn.onclick = null;
  } else if (status === 'denied') {
    label.textContent = 'Notifications blocked';
    btn.style.opacity = '.5';
    btn.onclick = null;
  } else {
    label.textContent = 'Enable Notifications';
    btn.onclick = async () => {
      try {
        await requestAndSubscribe();
        updateNotifButton();
      } catch {
        label.textContent = 'Permission denied';
      }
    };
  }
}

export function initMessageListener(handlers = {}) {
  navigator.serviceWorker?.addEventListener('message', (e) => {
    const { type, taskId } = e.data || {};
    if (type === 'MARK_DONE') handlers.onMarkDone?.(taskId);
    if (type === 'SNOOZE_TASK') handlers.onSnooze?.(taskId, e.data.hours);
  });
}

export function syncTasksToWorker(tasks) {
  if (CONFIG.PUSH_MODE !== 'remote') return;
  navigator.serviceWorker?.ready.then((r) =>
    r.active?.postMessage({ type: 'SYNC_TASKS', tasks }),
  );
}

function urlB64ToUint8(b64) {
  const pad = b64 + (b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '');
  const raw = atob(pad.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
