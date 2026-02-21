// utils.js — Shared helpers
export const todayStr  = ()  => new Date().toISOString().slice(0,10);
export const isToday   = d   => d === todayStr();
export const isOverdue = d   => d && d < todayStr();
export const isUpcoming = (d,n=7) => {
  if (!d) return false;
  const diff = (new Date(d) - new Date(todayStr()+'T00:00:00')) / 86400000;
  return diff > 0 && diff <= n;
};
export const formatDate = d => {
  if (!d) return '';
  const [,m,day] = d.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]+' '+(+day);
};
export const dayName = d => {
  if (!d) return '';
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T00:00:00').getDay()];
};
export const newId = (p='item') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
export const escHtml = s => s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

// ── MARKDOWN RENDERER ─────────────────────────
export function renderMarkdown(raw) {
  if (!raw) return '';
  let s = escHtml(raw);
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^# (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/_(.+?)_/g,       '<em>$1</em>');
  s = s.replace(/`(.+?)`/g,       '<code>$1</code>');
  s = s.replace(/^- \[x\] (.+)$/gim, '<div class="md-check done">✓ $1</div>');
  s = s.replace(/^- \[ \] (.+)$/gim,  '<div class="md-check">☐ $1</div>');
  s = s.replace(/^- (.+)$/gm,    '<div class="md-bullet">$1</div>');
  s = s.replace(/^---$/gm,        '<hr>');
  s = s.split(/\n\n+/).map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g,'<br>')}</p>`).join('\n');
  return s;
}

// ── TOAST ─────────────────────────────────────
let _toastTimer, _undoFn;

export function showToast(msg, undoCallback = null, duration = 2800) {
  const toast   = document.getElementById('toast');
  const msgEl   = document.getElementById('toast-msg');
  const undoEl  = document.getElementById('toast-undo');
  if (!toast || !msgEl) return;

  msgEl.textContent  = msg;
  _undoFn            = undoCallback;

  if (undoCallback) {
    undoEl.style.display = 'inline';
    undoEl.onclick = () => { _undoFn?.(); hideToast(); };
  } else {
    undoEl.style.display = 'none';
  }

  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, duration);
}

export function hideToast() {
  document.getElementById('toast')?.classList.remove('show');
}

// ── DOM ───────────────────────────────────────
export const qs  = (s, ctx=document) => ctx.querySelector(s);
export const qsa = (s, ctx=document) => [...ctx.querySelectorAll(s)];
