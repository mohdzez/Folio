// focus.js — Focus mode full-screen overlay
import { getTasks, getCategories, toggleSubtask } from './db.js';
import {
  isToday,
  isOverdue,
  formatDate,
  renderMarkdown,
  escHtml,
  showToast,
} from './utils.js';

let _taskId = null;
let _onClose = null;
let _onEdit = null;
let _onSched = null;
let _onDone = null;

export function openFocusMode(
  taskId,
  { onClose, onEdit, onSched, onDone } = {},
) {
  _taskId = taskId;
  _onClose = onClose ?? _onClose;
  _onEdit = onEdit ?? _onEdit;
  _onSched = onSched ?? _onSched;
  _onDone = onDone ?? _onDone;
  renderFocus();
  document.getElementById('focus-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeFocusMode() {
  document.getElementById('focus-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _onClose?.();
  _taskId = null;
}

function renderFocus() {
  const task = getTasks().find((t) => t.id === _taskId);
  if (!task) {
    closeFocusMode();
    return;
  }
  const cat = getCategories().find((c) => c.id === task.cat);

  // Cat badge
  const catEl = document.getElementById('focus-cat-badge');
  catEl.innerHTML = cat
    ? `<span style="font-size:12px;padding:5px 14px;border-radius:999px;background:${cat.color}22;color:${cat.color}">${escHtml(cat.name)}</span>`
    : '';

  // Title
  document.getElementById('focus-title').textContent = task.title;

  // Meta row
  const dueClass =
    isOverdue(task.due) && !task.done
      ? 'overdue'
      : isToday(task.due)
        ? 'today'
        : '';
  const dueLabel = task.due
    ? isToday(task.due)
      ? 'Today'
      : formatDate(task.due)
    : '';
  const priLabels = {
    high: '⬤ High priority',
    med: '⬤ Medium',
    low: '⬤ Low',
    none: '',
  };
  const priColors = {
    high: 'var(--red)',
    med: 'var(--gold)',
    low: 'var(--text-muted)',
    none: '',
  };
  const recurLabel =
    task.recur && task.recur !== 'none' ? `↻ ${task.recur}` : '';

  document.getElementById('focus-meta-row').innerHTML = [
    dueLabel
      ? `<span class="focus-meta-badge task-due ${dueClass}">◷ ${dueLabel}</span>`
      : '',
    task.priority !== 'none'
      ? `<span class="focus-meta-badge" style="color:${priColors[task.priority]}">${priLabels[task.priority]}</span>`
      : '',
    recurLabel
      ? `<span class="focus-meta-badge" style="color:var(--blue)">${recurLabel}</span>`
      : '',
    ...(task.tags || []).map(
      (tag) => `<span class="focus-meta-badge">#${escHtml(tag)}</span>`,
    ),
  ]
    .filter(Boolean)
    .join('');

  // Subtasks
  const subs = task.subtasks || [];
  document.getElementById('focus-subtasks').innerHTML = subs
    .map(
      (s) => `
    <div class="focus-subtask-item" data-sub-id="${s.id}">
      <div class="focus-subtask-check ${s.done ? 'done' : ''}">${s.done ? '✓' : ''}</div>
      <span class="focus-subtask-text ${s.done ? 'done' : ''}">${escHtml(s.title)}</span>
    </div>
  `,
    )
    .join('');

  // Notes
  document.getElementById('focus-notes-preview').innerHTML = task.notes
    ? renderMarkdown(task.notes)
    : '';

  // Done button state
  const doneBtn = document.getElementById('focus-done-btn');
  doneBtn.textContent = task.done ? '↩ Mark Incomplete' : '✓ Complete';
  doneBtn.style.background = task.done ? 'var(--text-dim)' : 'var(--green)';
}

export function initFocusMode(callbacks = {}) {
  // accept callbacks object from app.js
  if (callbacks.onClose) _onClose = callbacks.onClose;
  if (callbacks.onEdit) _onEdit = callbacks.onEdit;
  if (callbacks.onSched) _onSched = callbacks.onSched;
  if (callbacks.onDone) _onDone = callbacks.onDone;
  document
    .getElementById('focus-close-btn')
    ?.addEventListener('click', closeFocusMode);

  document.getElementById('focus-done-btn')?.addEventListener('click', () => {
    if (_taskId) {
      _onDone?.(_taskId);
      renderFocus();
    }
  });

  document.getElementById('focus-edit-btn')?.addEventListener('click', () => {
    if (_taskId) {
      _onEdit?.(_taskId);
    }
  });

  document.getElementById('focus-sched-btn')?.addEventListener('click', () => {
    if (_taskId) {
      _onSched?.(_taskId);
    }
  });

  // Subtask tap
  document.getElementById('focus-subtasks')?.addEventListener('click', (e) => {
    const item = e.target.closest('.focus-subtask-item');
    if (!item || !_taskId) return;
    toggleSubtask(_taskId, item.dataset.subId);
    renderFocus();
  });

  // Focus launch from today page
  document.getElementById('focus-launch-btn')?.addEventListener('click', () => {
    const tasks = getTasks().filter((t) => t.due && !t.done && !t.archived);
    // Pick first due today or first overdue
    const target =
      tasks.find((t) => isToday(t.due)) ||
      tasks.find((t) => isOverdue(t.due)) ||
      tasks[0];
    if (target) openFocusMode(target.id, {});
    else showToast('No active tasks to focus on');
  });
}
