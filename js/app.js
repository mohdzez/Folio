// app.js — Entry point: navigation, event delegation, boot
import {
  seedDemo,
  getTasks,
  getCategories,
  toggleDone,
  deleteTask,
  archiveTask,
  updateTask,
  exportData,
  importData,
  getPrefs,
  savePrefs,
} from './db.js';
import {
  renderPage,
  renderCategories,
  renderHeaderDate,
  updateNavCounts,
  renderSearch,
  renderAll,
} from './render.js';
import {
  openAddTask,
  openEditTask,
  handleToggle,
  handleDelete,
  handleArchive,
  initTaskSheet,
} from './tasks.js';
import {
  openCatModal,
  initCatSheet,
  handleDeleteCategory,
} from './categories.js';
import { openNotesPanel, initNotesPanel } from './notes.js';
import {
  openSchedulerModal,
  closeSchedulerModal,
  initScheduler,
  scheduleDailyDigest,
} from './scheduler.js';
import { updateNotifButton, initMessageListener } from './notifications.js';
import { initFilterSheet } from './filters.js';
import { initSwipe, initLongPress } from './swipe.js';
import { initFocusMode, openFocusMode } from './focus.js';
import { showToast } from './utils.js';

// ── STATE ─────────────────────────────────────
let page = 'today';
let catId = null;
let bulkSel = new Set();
let bulkMode = false;

const PAGE_TITLES = {
  today: 'Today',
  upcoming: 'Upcoming',
  all: 'All Tasks',
  categories: 'Categories',
  'cat-detail': () =>
    getCategories().find((c) => c.id === catId)?.name ?? 'Category',
  archive: 'Archive',
  search: 'Search',
};

// ── NAVIGATION ────────────────────────────────
function navigate(newPage, opts = {}) {
  page = newPage;
  catId = opts.catId ?? null;

  document
    .querySelectorAll('.page-view')
    .forEach((v) => v.classList.remove('active'));
  document
    .querySelectorAll('.nav-tab[data-page]')
    .forEach((t) => t.classList.toggle('active', t.dataset.page === newPage));
  document.getElementById(`page-${newPage}`)?.classList.add('active');

  const t = PAGE_TITLES[newPage];
  document.getElementById('header-title').textContent =
    typeof t === 'function' ? t() : t;

  renderPage(newPage, { catId });
  renderCategories();
  exitBulkMode();
}

function refresh() {
  renderPage(page, { catId });
  renderCategories();
  updateNavCounts();
}

// ── SWIPE GESTURES ────────────────────────────
const content = document.getElementById('content');

initSwipe(content, {
  onDone: (id) => {
    handleToggle(id, refresh);
  },
  onArchive: (id) => {
    handleArchive(id, refresh);
  },
});

initLongPress(content, (taskId, el) => {
  if (!bulkMode) enterBulkMode();
  toggleBulkSelect(taskId);
});

// ── EVENT DELEGATION ──────────────────────────
content.addEventListener('click', (e) => {
  // In bulk mode, task clicks toggle selection
  if (bulkMode) {
    const wrap = e.target.closest('[data-task-id]');
    if (wrap) {
      toggleBulkSelect(wrap.dataset.taskId);
      return;
    }
  }

  // Toggle done
  const toggleEl = e.target.closest('[data-toggle]');
  if (toggleEl) {
    handleToggle(toggleEl.dataset.toggle, refresh);
    return;
  }

  // Open notes
  const notesEl = e.target.closest('[data-notes]');
  if (notesEl) {
    openNotesPanel(notesEl.dataset.notes, refresh);
    return;
  }

  // Category card
  const catCard = e.target.closest('.cat-card[data-cat-id]');
  if (catCard && !e.target.closest('[data-delete-cat]')) {
    navigate('cat-detail', { catId: catCard.dataset.catId });
    return;
  }

  // Delete category
  const delCat = e.target.closest('[data-delete-cat]');
  if (delCat) {
    e.stopPropagation();
    const cat = getCategories().find((c) => c.id === delCat.dataset.deleteCat);
    handleDeleteCategory(delCat.dataset.deleteCat, cat?.name ?? '', refresh);
    return;
  }

  // Clear archive
  if (e.target.id === 'clear-archive-btn') {
    if (!confirm('Remove all archived tasks?')) return;
    const archived = getTasks().filter((t) => t.archived);
    archived.forEach((t) => deleteTask(t.id));
    refresh();
    return;
  }
});

// ── NAV TABS ──────────────────────────────────
document.querySelectorAll('.nav-tab[data-page]').forEach((tab) => {
  tab.addEventListener('click', () => navigate(tab.dataset.page));
});

document
  .getElementById('fab-btn')
  ?.addEventListener('click', () => openAddTask());

// ── HEADER BUTTONS ────────────────────────────
document.getElementById('settings-btn')?.addEventListener('click', () => {
  document.getElementById('settings-sheet-overlay').classList.add('open');
});
document
  .getElementById('settings-sheet-overlay')
  ?.addEventListener('click', (e) => {
    if (e.target.id === 'settings-sheet-overlay')
      document
        .getElementById('settings-sheet-overlay')
        .classList.remove('open');
  });

// Search button → navigate to search page
document.getElementById('filter-btn')?.addEventListener('click', () => {
  // handled by initFilterSheet
});

// ── SEARCH ────────────────────────────────────
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

// Navigate to search on focus (if not already there)
searchInput?.addEventListener('focus', () => {
  if (page !== 'search') navigate('search');
});
searchInput?.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'block' : 'none';
  renderSearch(q);
});
searchClear?.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  renderSearch('');
  searchInput.focus();
});

// Search button navigates to search
document.getElementById('search-nav-btn')?.addEventListener('click', () => {
  navigate('search');
  setTimeout(() => searchInput?.focus(), 200);
});

// ── MODULE INITS ──────────────────────────────
initTaskSheet(refresh);
initCatSheet(refresh);
initNotesPanel(refresh);
initScheduler();
initFilterSheet(refresh);
initFocusMode({
  onClose: refresh,
  onEdit: (id) => openEditTask(id),
  onSched: (id) => openSchedulerModal(id),
  onDone: (id) => {
    handleToggle(id, () => {});
    refresh();
  },
});

// ── CATEGORIES BUTTON ─────────────────────────
document.getElementById('add-cat-btn')?.addEventListener('click', openCatModal);

// ── ESCAPE CLOSE ALL SHEETS ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  [
    'task-sheet-overlay',
    'cat-sheet-overlay',
    'filter-sheet-overlay',
    'sched-sheet-overlay',
    'settings-sheet-overlay',
  ].forEach((id) => {
    document.getElementById(id)?.classList.remove('open');
  });
});

// ── BULK ACTIONS ──────────────────────────────
function enterBulkMode() {
  bulkMode = true;
  bulkSel.clear();
  document.getElementById('bulk-bar').style.display = 'flex';
}
function exitBulkMode() {
  bulkMode = false;
  bulkSel.clear();
  document.getElementById('bulk-bar').style.display = 'none';
  document
    .querySelectorAll('.task-item.selected')
    .forEach((el) => el.classList.remove('selected'));
}
function toggleBulkSelect(taskId) {
  const wrap = document.querySelector(`[data-task-id="${taskId}"] .task-item`);
  if (bulkSel.has(taskId)) {
    bulkSel.delete(taskId);
    wrap?.classList.remove('selected');
  } else {
    bulkSel.add(taskId);
    wrap?.classList.add('selected');
  }
  document.getElementById('bulk-count').textContent =
    `${bulkSel.size} selected`;
  if (bulkSel.size === 0) exitBulkMode();
}

document.getElementById('bulk-done-btn')?.addEventListener('click', () => {
  bulkSel.forEach((id) => toggleDone(id));
  showToast(`${bulkSel.size} tasks marked done`);
  exitBulkMode();
  refresh();
});
document.getElementById('bulk-archive-btn')?.addEventListener('click', () => {
  bulkSel.forEach((id) => archiveTask(id));
  showToast(`${bulkSel.size} tasks archived`);
  exitBulkMode();
  refresh();
});
document.getElementById('bulk-delete-btn')?.addEventListener('click', () => {
  const ids = [...bulkSel];
  const deleted = ids
    .map((id) => getTasks().find((t) => t.id === id))
    .filter(Boolean);
  ids.forEach((id) => deleteTask(id));
  showToast(`${ids.length} deleted`, () => {
    deleted.forEach((t) => {
      import('./db.js').then((m) => {
        m.addTask(t);
        refresh();
      });
    });
  });
  exitBulkMode();
  refresh();
});
document
  .getElementById('bulk-cancel-btn')
  ?.addEventListener('click', exitBulkMode);

// ── EXPORT / IMPORT ───────────────────────────
document.getElementById('export-btn')?.addEventListener('click', () => {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `folio-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById('settings-sheet-overlay').classList.remove('open');
  showToast('Exported ✓');
});

document.getElementById('import-btn')?.addEventListener('click', () => {
  document.getElementById('import-file').click();
});
document
  .getElementById('import-file')
  ?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importData(text);
      showToast('Import successful ✓');
      refresh();
    } catch (err) {
      showToast('Import failed: ' + err.message);
    }
    e.target.value = '';
    document.getElementById('settings-sheet-overlay').classList.remove('open');
  });

// ── DAILY DIGEST TOGGLE ───────────────────────
const digestToggle = document.getElementById('daily-digest-toggle');
if (digestToggle) {
  const prefs = getPrefs();
  digestToggle.checked = prefs.dailyDigest ?? false;
  digestToggle.addEventListener('change', async (e) => {
    const on = e.target.checked;
    savePrefs({ ...getPrefs(), dailyDigest: on });
    if (on) {
      try {
        if (Notification.permission !== 'granted')
          await Notification.requestPermission();
        scheduleDailyDigest();
        showToast('Daily digest enabled ✓');
      } catch {
        digestToggle.checked = false;
      }
    } else {
      showToast('Daily digest disabled');
    }
  });
}

// ── SW MESSAGES ───────────────────────────────
initMessageListener({
  onMarkDone: (id) => {
    handleToggle(id, refresh);
  },
});

// ── SW REGISTRATION ───────────────────────────
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js', { scope: './' });
  } catch (e) {
    console.warn('[SW]', e);
  }
}

// ── BOOT ─────────────────────────────────────
async function boot() {
  seedDemo();
  renderHeaderDate();
  navigate('today');
  await registerSW();
  await updateNotifButton();

  // Resume daily digest if was enabled
  const prefs = getPrefs();
  if (prefs.dailyDigest && Notification.permission === 'granted')
    scheduleDailyDigest();

  // URL param shortcuts
  const params = new URLSearchParams(location.search);
  if (params.get('page')) navigate(params.get('page'));
  if (params.get('action') === 'add') openAddTask();
}

boot();
