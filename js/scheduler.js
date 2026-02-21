// scheduler.js — Per-task notification scheduling
import { getTasks } from './db.js';
import { escHtml, showToast } from './utils.js';

const STORE_KEY = 'folio_schedules';

export const loadSchedules       = ()    => tryParse(STORE_KEY, []);
export const saveSchedules       = list  => localStorage.setItem(STORE_KEY, JSON.stringify(list));
export const getSchedulesForTask = id    => loadSchedules().filter(s => s.taskId === id);
const removeSchedule             = sid  => saveSchedules(loadSchedules().filter(s => s.id !== sid));
const addSchedule                = sched => { const l=loadSchedules(); l.push(sched); saveSchedules(l); };
function tryParse(k,f) { try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;} }

let _taskId = null;

// ── OPEN SHEET ────────────────────────────────
export function openSchedulerModal(taskId) {
  const task = getTasks().find(t => t.id === taskId);
  if (!task) return;
  _taskId = taskId;
  document.getElementById('sched-task-name').textContent = task.title;
  const def = defaultDT();
  setVal('sched-date', def.date);
  setVal('sched-time', def.time);
  setVal('sched-message', '');
  renderSchedList(taskId);
  document.getElementById('sched-sheet-overlay').classList.add('open');
}

export function closeSchedulerModal() {
  document.getElementById('sched-sheet-overlay')?.classList.remove('open');
  _taskId = null;
}

// ── SAVE ─────────────────────────────────────
export function saveSchedule() {
  const date = document.getElementById('sched-date')?.value;
  const time = document.getElementById('sched-time')?.value;
  const msg  = document.getElementById('sched-message')?.value.trim();
  if (!date || !time) { showToast('Pick a date and time'); return; }
  const fireAt = new Date(`${date}T${time}:00`).getTime();
  if (fireAt <= Date.now()) { showToast('Choose a future time'); return; }
  const task = getTasks().find(t => t.id === _taskId);
  if (!task) return;
  const sched = { id:`sched_${Date.now()}`, taskId:_taskId, fireAt, message:msg||task.title, created:Date.now() };
  addSchedule(sched);
  armSched(sched, task);
  showToast(`🔔 Reminder set for ${fmtDT(new Date(fireAt))}`);
  renderSchedList(_taskId);
  const def = defaultDT();
  setVal('sched-date', def.date);
  setVal('sched-time', def.time);
  setVal('sched-message', '');
}

// ── RENDER LIST ───────────────────────────────
function renderSchedList(taskId) {
  const list = getSchedulesForTask(taskId);
  const el   = document.getElementById('sched-list');
  if (!el) return;
  if (!list.length) { el.innerHTML='<div class="sched-empty">No reminders scheduled.</div>'; return; }
  el.innerHTML = list.map(s => {
    const past = s.fireAt < Date.now();
    return `<div class="sched-item ${past?'past':''}" data-sched-id="${s.id}">
      <div class="sched-item-left">
        <span>${past?'✓':'🔔'}</span>
        <div><div class="sched-item-time">${fmtDT(new Date(s.fireAt))}</div>${s.message?`<div class="sched-item-msg">${escHtml(s.message)}</div>`:''}</div>
      </div>
      <button class="sched-delete-btn" data-remove="${s.id}">✕</button>
    </div>`;
  }).join('');
}

// ── PRESET HELPERS ────────────────────────────
function applyPreset(preset) {
  const now = new Date();
  const target = new Date(now);
  if (preset==='1h')  { target.setHours(target.getHours()+1); }
  else if (preset==='3h') { target.setHours(target.getHours()+3); }
  else if (preset==='tonight') { target.setHours(21,0,0,0); if(target<=now) target.setDate(target.getDate()+1); }
  else if (preset==='tomorrow-morning') { target.setDate(target.getDate()+1); target.setHours(9,0,0,0); }
  else if (preset==='tomorrow-evening') { target.setDate(target.getDate()+1); target.setHours(18,0,0,0); }
  else if (preset==='next-week') { target.setDate(target.getDate()+7); target.setHours(9,0,0,0); }
  setVal('sched-date', target.toISOString().slice(0,10));
  setVal('sched-time', target.toTimeString().slice(0,5));
}

// ── ARM ───────────────────────────────────────
function armSched(s, task) {
  const delay = s.fireAt - Date.now();
  if (delay <= 0) return;
  if (delay < 24*60*60*1000) setTimeout(async () => {
    if (!loadSchedules().find(x => x.id===s.id)) return;
    removeSchedule(s.id);
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('🔔 Folio Reminder', {
        body:s.message, icon:'/assets/icons/icon-192.png', tag:`sched-${s.id}`,
        data:{taskId:s.taskId, url:'/?page=today'},
        actions:[{action:'done',title:'✓ Done'},{action:'snooze',title:'⏰ 1h'}],
      });
    } catch { new Notification('🔔 Folio Reminder',{body:s.message}); }
  }, delay);

  navigator.serviceWorker?.ready.then(r =>
    r.active?.postMessage({ type:'SCHEDULE_NOTIF', schedule:{...s, taskTitle:task.title} })
  );
}

// ── INIT ─────────────────────────────────────
export function initScheduler() {
  document.getElementById('sched-save-btn')?.addEventListener('click', saveSchedule);
  document.getElementById('sched-cancel-btn')?.addEventListener('click', closeSchedulerModal);
  document.getElementById('sched-sheet-overlay')?.addEventListener('click', e => {
    if (e.target.id==='sched-sheet-overlay') closeSchedulerModal();
  });

  document.getElementById('sched-presets')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-preset]');
    if (btn) applyPreset(btn.dataset.preset);
  });

  document.getElementById('sched-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    removeSchedule(btn.dataset.remove);
    navigator.serviceWorker?.ready.then(r => r.active?.postMessage({type:'CANCEL_NOTIF',schedId:btn.dataset.remove}));
    renderSchedList(_taskId);
    showToast('Reminder removed');
  });

  restoreSchedules();
}

export function restoreSchedules() {
  const list  = loadSchedules();
  const tasks = getTasks();
  const now   = Date.now();
  const future = list.filter(s => s.fireAt > now);
  if (future.length !== list.length) saveSchedules(future);
  future.forEach(s => {
    const task = tasks.find(t => t.id === s.taskId);
    if (task) armSched(s, task);
  });
}

// ── DAILY DIGEST ─────────────────────────────
export function scheduleDailyDigest() {
  const now    = new Date();
  const target = new Date(now);
  target.setHours(8, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - Date.now();
  setTimeout(async () => {
    const todayStr = new Date().toISOString().slice(0,10);
    const todays   = getTasks().filter(t => t.due === todayStr && !t.done && !t.archived);
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('☀️ Folio Daily Digest', {
        body:  todays.length ? `${todays.length} task${todays.length>1?'s':''} due today` : 'No tasks due today — enjoy your day!',
        icon:  '/assets/icons/icon-192.png',
        tag:   'folio-daily',
        data:  { url:'/?page=today' },
      });
    } catch {}
    scheduleDailyDigest(); // reschedule for next day
  }, delay);
}

// ── HELPERS ───────────────────────────────────
function defaultDT() {
  const d = new Date(Date.now() + 60*60*1000);
  d.setMinutes(Math.ceil(d.getMinutes()/15)*15, 0, 0);
  return { date:d.toISOString().slice(0,10), time:d.toTimeString().slice(0,5) };
}
function fmtDT(dt) {
  const now=new Date(), t=dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
  if (dt.toDateString()===now.toDateString()) return `Today ${t}`;
  const tom=new Date(now); tom.setDate(tom.getDate()+1);
  if (dt.toDateString()===tom.toDateString()) return `Tomorrow ${t}`;
  return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+' '+t;
}
function setVal(id, v) { const e=document.getElementById(id); if(e) e.value=v; }
