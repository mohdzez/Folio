// tasks.js — Task CRUD + bottom sheet wiring
import {
  getTasks,
  getCategories,
  addTask,
  updateTask,
  deleteTask,
  archiveTask,
  toggleDone,
  toggleSubtask,
} from './db.js';
import { newId, showToast, todayStr } from './utils.js';

const OVERLAY = 'task-sheet-overlay';
let _editingId = null;
let _tags = [];
let _priority = 'none';
let _cat = '';
let _recur = 'none';
let _subtasks = [];

// ── OPEN ──────────────────────────────────────
export function openAddTask(defaults = {}) {
  _editingId = null;
  _tags = [];
  _priority = 'none';
  _cat = defaults.cat || '';
  _recur = 'none';
  _subtasks = [];

  setText('task-sheet-title', 'New Task');
  setVal('t-title', defaults.title || '');
  setVal('t-due', defaults.due || todayStr());

  renderPriSeg('none');
  renderRecurSeg('none');
  renderCatPills('');
  renderTagPills([]);
  renderSubtaskList([]);

  openSheet();
  setTimeout(() => document.getElementById('t-title')?.focus(), 300);
}

export function openEditTask(id) {
  const task = getTasks().find((t) => t.id === id);
  if (!task) return;
  _editingId = id;
  _tags = [...(task.tags || [])];
  _priority = task.priority || 'none';
  _cat = task.cat || '';
  _recur = task.recur || 'none';
  _subtasks = (task.subtasks || []).map((s) => ({ ...s }));

  setText('task-sheet-title', 'Edit Task');
  setVal('t-title', task.title);
  setVal('t-due', task.due || '');

  renderPriSeg(_priority);
  renderRecurSeg(_recur);
  renderCatPills(_cat);
  renderTagPills(_tags);
  renderSubtaskList(_subtasks);

  openSheet();
}

// ── SAVE ─────────────────────────────────────
export function saveTask() {
  const title = document.getElementById('t-title')?.value.trim();
  if (!title) {
    document.getElementById('t-title')?.focus();
    return false;
  }

  const payload = {
    title,
    priority: _priority,
    cat: _cat,
    recur: _recur,
    tags: [..._tags],
    subtasks: [..._subtasks],
    due: document.getElementById('t-due')?.value || '',
  };

  if (_editingId) {
    updateTask(_editingId, payload);
    showToast('Task updated');
  } else {
    addTask({
      id: newId('task'),
      ...payload,
      notes: '',
      done: false,
      archived: false,
      created: Date.now(),
    });
    showToast('Task added ✓');
  }
  closeSheet();
  return true;
}

// ── TOGGLE / DELETE / ARCHIVE ─────────────────
export function handleToggle(id, onRefresh) {
  const task = toggleDone(id);
  const msg = task?.done ? '✓ Done' : 'Marked incomplete';
  showToast(msg, task?.done ? null : null);
  onRefresh();
}

export function handleDelete(id, onRefresh) {
  const task = getTasks().find((t) => t.id === id);
  if (!task) return;
  deleteTask(id);
  showToast('Deleted', () => {
    addTask(task);
    onRefresh();
  });
  onRefresh();
}

export function handleArchive(id, onRefresh) {
  archiveTask(id);
  showToast('Archived', () => {
    updateTask(id, { archived: false });
    onRefresh();
  });
  onRefresh();
}

// ── INIT SHEET INTERACTIONS ───────────────────
export function initTaskSheet(onSave) {
  document.getElementById('task-save-btn')?.addEventListener('click', () => {
    if (saveTask()) onSave();
  });
  document
    .getElementById('task-cancel-btn')
    ?.addEventListener('click', closeSheet);

  // Priority seg
  document.getElementById('t-priority-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn[data-val]');
    if (!btn) return;
    _priority = btn.dataset.val;
    renderPriSeg(_priority);
  });

  // Recur seg
  document.getElementById('t-recur-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn[data-val]');
    if (!btn) return;
    _recur = btn.dataset.val;
    renderRecurSeg(_recur);
  });

  // Cat pills
  document.getElementById('t-cat-pills')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill[data-cat-id]');
    if (!pill) return;
    _cat = _cat === pill.dataset.catId ? '' : pill.dataset.catId;
    renderCatPills(_cat);
  });

  // Tag input
  const tagInput = document.getElementById('t-tag-input');
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim().replace(/,/g, '').toLowerCase();
      if (val && !_tags.includes(val)) {
        _tags.push(val);
        renderTagPills(_tags);
      }
      tagInput.value = '';
    }
    if (e.key === 'Backspace' && !tagInput.value && _tags.length) {
      _tags.pop();
      renderTagPills(_tags);
    }
  });

  // Tag pill delete
  document.getElementById('t-tag-pills')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-pill-x')) {
      const tag = e.target.dataset.tag;
      _tags = _tags.filter((t) => t !== tag);
      renderTagPills(_tags);
    }
  });

  // Subtask add
  document
    .getElementById('subtask-add-btn')
    ?.addEventListener('click', addSubtask);
  document.getElementById('subtask-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  });

  // Subtask list interactions
  document.getElementById('subtask-list')?.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.subtask-del');
    const checkBtn = e.target.closest('.subtask-check');
    if (delBtn) {
      const idx = +delBtn.dataset.idx;
      _subtasks.splice(idx, 1);
      renderSubtaskList(_subtasks);
    }
    if (checkBtn) {
      const idx = +checkBtn.dataset.idx;
      _subtasks[idx].done = !_subtasks[idx].done;
      renderSubtaskList(_subtasks);
    }
  });

  // Overlay click-to-close
  document.getElementById(OVERLAY)?.addEventListener('click', (e) => {
    if (e.target.id === OVERLAY) closeSheet();
  });
}

// ── RENDER HELPERS ────────────────────────────
function renderPriSeg(val) {
  document
    .querySelectorAll('#t-priority-seg .seg-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.val === val));
  _priority = val;
}

function renderRecurSeg(val) {
  document
    .querySelectorAll('#t-recur-seg .seg-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.val === val));
  _recur = val;
}

function renderCatPills(selected) {
  const cats = getCategories();
  document.getElementById('t-cat-pills').innerHTML = cats
    .map(
      (c) => `
    <div class="cat-pill ${selected === c.id ? 'selected' : ''}" data-cat-id="${c.id}"
      style="${selected === c.id ? `color:${c.color};border-color:${c.color};background:${c.color}22` : ''}"
    >${escHtml(c.name)}</div>
  `,
    )
    .join('');
}

function renderTagPills(tags) {
  const container = document.getElementById('t-tag-pills');
  if (!container) return;
  container.innerHTML = tags
    .map(
      (t) =>
        `<span class="tag-pill">#${escHtml(t)}<button class="tag-pill-x" data-tag="${escHtml(t)}">✕</button></span>`,
    )
    .join('');
}

function renderSubtaskList(subs) {
  const el = document.getElementById('subtask-list');
  if (!el) return;
  el.innerHTML = subs
    .map(
      (s, i) => `
    <div class="subtask-item">
      <div class="subtask-check ${s.done ? 'done' : ''}" data-idx="${i}">${s.done ? '✓' : ''}</div>
      <span class="subtask-text ${s.done ? 'done' : ''}">${escHtml(s.title)}</span>
      <button class="subtask-del" data-idx="${i}">✕</button>
    </div>
  `,
    )
    .join('');
}

function addSubtask() {
  const input = document.getElementById('subtask-input');
  const val = input?.value.trim();
  if (!val) return;
  _subtasks.push({ id: newId('sub'), title: val, done: false });
  renderSubtaskList(_subtasks);
  input.value = '';
  input.focus();
}

// ── SHEET OPEN/CLOSE ──────────────────────────
function openSheet() {
  document.getElementById(OVERLAY)?.classList.add('open');
}
function closeSheet() {
  document.getElementById(OVERLAY)?.classList.remove('open');
  _editingId = null;
}

function setVal(id, v) {
  const e = document.getElementById(id);
  if (e) e.value = v;
}
function setText(id, t) {
  const e = document.getElementById(id);
  if (e) e.textContent = t;
}
function escHtml(s) {
  return (
    s?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? ''
  );
}
