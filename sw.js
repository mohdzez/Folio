// Folio Service Worker v2 — caching + push + scheduled notifs

const CACHE  = 'folio-v3';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/css/main.css', '/css/components.css',
  '/js/app.js', '/js/db.js', '/js/render.js', '/js/tasks.js',
  '/js/categories.js', '/js/notifications.js', '/js/notes.js',
  '/js/scheduler.js', '/js/filters.js', '/js/swipe.js', '/js/focus.js',
  '/js/utils.js', '/assets/icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
      .then(() => restorePersistedSchedules())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── PUSH ─────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title:'Folio', body:'You have a task due soon.' };
  try { if (e.data) data = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body:data.body, icon:'/assets/icons/icon-192.png',
    tag:data.tag||'folio-task', data:{ taskId:data.taskId, url:data.url||'/' },
    actions:[{action:'done',title:'✓ Done'},{action:'snooze',title:'⏰ 1h'}],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { action } = e;
  const { taskId, url } = e.notification.data||{};
  if (action === 'done' && taskId) {
    clients.matchAll({type:'window'}).then(ws => ws.forEach(w => w.postMessage({type:'MARK_DONE',taskId})));
    return;
  }
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(ws => {
      const w = ws.find(x => x.url.includes(self.location.origin));
      if (w) { w.focus(); w.postMessage({type:'NAVIGATE',url}); }
      else clients.openWindow(url||'/');
    })
  );
});

// ── SCHEDULED NOTIFS ─────────────────────────
const _timers = new Map();

self.addEventListener('message', e => {
  const { type } = e.data||{};
  if (type === 'SYNC_TASKS')     syncTasksToDB(e.data.tasks);
  if (type === 'SCHEDULE_NOTIF') { armTimer(e.data.schedule); persistSched(e.data.schedule); }
  if (type === 'CANCEL_NOTIF')   { clearTimeout(_timers.get(e.data.schedId)); _timers.delete(e.data.schedId); removeSched(e.data.schedId); }
});

function armTimer(s) {
  const delay = s.fireAt - Date.now();
  if (delay <= 0) return;
  const tid = setTimeout(async () => {
    _timers.delete(s.id); removeSched(s.id);
    await self.registration.showNotification('🔔 Folio Reminder', {
      body:s.message||s.taskTitle, icon:'/assets/icons/icon-192.png',
      tag:`sched-${s.id}`, data:{taskId:s.taskId, url:'/?page=today'},
      actions:[{action:'done',title:'✓ Done'},{action:'snooze',title:'⏰ 1h'}],
    });
  }, Math.min(delay, 24*60*60*1000));
  _timers.set(s.id, tid);
}

// ── IDB HELPERS ───────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('folio-sw-db', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tasks'))     db.createObjectStore('tasks',     {keyPath:'id'});
      if (!db.objectStoreNames.contains('schedules')) db.createObjectStore('schedules', {keyPath:'id'});
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function syncTasksToDB(tasks) {
  const db = await openDB();
  const tx = db.transaction('tasks','readwrite');
  const st = tx.objectStore('tasks');
  st.clear(); tasks.forEach(t => st.put(t));
}

async function persistSched(s) {
  const db = await openDB();
  db.transaction('schedules','readwrite').objectStore('schedules').put(s);
}

async function removeSched(id) {
  const db = await openDB();
  db.transaction('schedules','readwrite').objectStore('schedules').delete(id);
}

async function restorePersistedSchedules() {
  const db  = await openDB();
  const req = db.transaction('schedules','readonly').objectStore('schedules').getAll();
  req.onsuccess = e => {
    const now = Date.now();
    e.target.result.forEach(s => {
      if (s.fireAt > now) armTimer(s);
      else removeSched(s.id);
    });
  };
}

// ── PERIODIC SYNC ─────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'folio-check-tasks') e.waitUntil(checkDueTasks());
});

async function checkDueTasks() {
  const db    = await openDB();
  const tasks = await new Promise((res,rej) => { const r=db.transaction('tasks','readonly').objectStore('tasks').getAll(); r.onsuccess=e=>res(e.target.result); r.onerror=e=>rej(e.target.error); });
  const now   = Date.now();
  tasks.filter(t => !t.done && !t.archived && t.due).forEach(async t => {
    const dueMs = new Date(t.due+'T09:00:00').getTime();
    if (dueMs > now && dueMs - now < 60*60*1000) {
      await self.registration.showNotification('⏰ Due soon — Folio', {
        body:t.title, icon:'/assets/icons/icon-192.png',
        tag:'folio-'+t.id, data:{taskId:t.id, url:'/?page=today'},
      });
    }
  });
}
