// swipe.js — Swipe gestures on task items
// Swipe right → mark done (green)
// Swipe left  → archive (revealed action)

const THRESHOLD = 72;   // px to trigger action
const REVEAL    = 80;   // px to show action hint

export function initSwipe(container, { onDone, onArchive }) {
  let startX, startY, el, wrap, dragging = false;

  container.addEventListener('touchstart', e => {
    const item = e.target.closest('.task-item');
    if (!item) return;
    wrap   = item.closest('.task-item-wrap');
    el     = item;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = false;
  }, { passive:true });

  container.addEventListener('touchmove', e => {
    if (!el || !wrap) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Vertical scroll takes priority
    if (!dragging && Math.abs(dy) > Math.abs(dx)) { el = null; return; }
    dragging = true;

    e.preventDefault();
    const clamped = Math.max(-REVEAL, Math.min(REVEAL, dx));
    el.style.transform = `translateX(${clamped}px)`;

    // Show hint backgrounds
    const rightBg = wrap.querySelector('.swipe-bg-right');
    const leftBg  = wrap.querySelector('.swipe-bg-left');
    if (rightBg) rightBg.style.opacity = Math.min(1, dx / THRESHOLD);
    if (leftBg)  leftBg.style.opacity  = Math.min(1, -dx / THRESHOLD);
  }, { passive:false });

  container.addEventListener('touchend', e => {
    if (!el || !wrap) return;
    const dx = e.changedTouches[0].clientX - startX;

    resetItem(el, wrap);

    if (dx > THRESHOLD) {
      const taskId = el.closest('[data-task-id]')?.dataset.taskId;
      if (taskId) onDone(taskId);
    } else if (dx < -THRESHOLD) {
      const taskId = el.closest('[data-task-id]')?.dataset.taskId;
      if (taskId) onArchive(taskId);
    }

    el = null; wrap = null; dragging = false;
  }, { passive:true });
}

function resetItem(el, wrap) {
  el.style.transition = 'transform .25s ease';
  el.style.transform  = 'translateX(0)';
  setTimeout(() => { if (el) el.style.transition = ''; }, 260);
  const r = wrap.querySelector('.swipe-bg-right');
  const l = wrap.querySelector('.swipe-bg-left');
  if (r) r.style.opacity = 0;
  if (l) l.style.opacity = 0;
}

// ── LONG PRESS → context menu ─────────────────
export function initLongPress(container, onLongPress) {
  let timer, startEl;

  container.addEventListener('touchstart', e => {
    startEl = e.target.closest('[data-task-id]');
    if (!startEl) return;
    timer = setTimeout(() => {
      onLongPress(startEl.dataset.taskId, startEl);
      // Haptic if available
      if (navigator.vibrate) navigator.vibrate(40);
    }, 500);
  }, { passive:true });

  container.addEventListener('touchmove',  () => clearTimeout(timer), { passive:true });
  container.addEventListener('touchend',   () => clearTimeout(timer), { passive:true });
  container.addEventListener('touchcancel',() => clearTimeout(timer), { passive:true });
}
