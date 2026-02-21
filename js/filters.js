// filters.js — Filter/Sort state + bottom sheet
import { getPrefs, savePrefs, getCategories, getAllTags } from './db.js';

let _state = null;

export function getFilters() {
  if (!_state) _state = { ...getPrefs() };
  return _state;
}

export function applyFilters(tasks) {
  const f = getFilters();
  let out = [...tasks];

  if (f.filterPri?.length)  out = out.filter(t => f.filterPri.includes(t.priority));
  if (f.filterCats?.length) out = out.filter(t => f.filterCats.includes(t.cat));
  if (f.filterTags?.length) out = out.filter(t => (t.tags||[]).some(tag => f.filterTags.includes(tag)));

  out.sort((a, b) => {
    switch (f.sortBy) {
      case 'priority': {
        const w = { high:0, med:1, low:2, none:3 };
        return (w[a.priority]??3) - (w[b.priority]??3);
      }
      case 'alpha':    return a.title.localeCompare(b.title);
      case 'created':  return (b.created||0) - (a.created||0);
      default:         return (a.due||'9999') < (b.due||'9999') ? -1 : 1;
    }
  });

  return out;
}

export function isCompact() { return getFilters().compact === true; }
export function hasActiveFilters() {
  const f = getFilters();
  return (f.filterPri?.length || f.filterCats?.length || f.filterTags?.length);
}

// ── INIT FILTER SHEET ─────────────────────────
export function initFilterSheet(onApply) {
  const openBtn  = document.getElementById('filter-btn');
  const overlay  = document.getElementById('filter-sheet-overlay');
  const cancelBtn = document.getElementById('filter-cancel-btn');
  const applyBtn  = document.getElementById('filter-apply-btn');
  const resetBtn  = document.getElementById('filter-reset-btn');

  openBtn?.addEventListener('click', () => {
    populateFilterSheet();
    overlay.classList.add('open');
  });

  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  cancelBtn?.addEventListener('click', () => overlay.classList.remove('open'));

  applyBtn?.addEventListener('click', () => {
    collectFilterSheet();
    overlay.classList.remove('open');
    onApply();
  });

  resetBtn?.addEventListener('click', () => {
    _state = { sortBy:'due', filterPri:[], filterCats:[], filterTags:[], compact:false };
    savePrefs(_state);
    populateFilterSheet();
    overlay.classList.remove('open');
    onApply();
  });

  // Density toggle
  document.getElementById('density-toggle')?.addEventListener('change', e => {
    _state = { ...getFilters(), compact: e.target.checked };
    savePrefs(_state);
  });
}

function populateFilterSheet() {
  const f    = getFilters();
  const cats = getCategories();
  const tags = getAllTags();

  // Sort seg
  document.querySelectorAll('#sort-seg .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === f.sortBy);
    btn.onclick = () => {
      document.querySelectorAll('#sort-seg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  // Priority checks
  document.querySelectorAll('#filter-pri-checks input').forEach(cb => {
    cb.checked = f.filterPri?.includes(cb.value) ?? false;
  });

  // Cat checks
  const catEl = document.getElementById('filter-cat-checks');
  if (catEl) {
    catEl.innerHTML = cats.map(c =>
      `<label class="check-pill">
        <input type="checkbox" value="${c.id}" ${f.filterCats?.includes(c.id)?'checked':''}> ${escHtml(c.name)}
      </label>`
    ).join('');
  }

  // Tag checks
  const tagEl = document.getElementById('filter-tag-checks');
  if (tagEl) {
    tagEl.innerHTML = tags.length
      ? tags.map(tag =>
          `<label class="check-pill">
            <input type="checkbox" value="${tag}" ${f.filterTags?.includes(tag)?'checked':''}> #${escHtml(tag)}
          </label>`
        ).join('')
      : '<span style="font-size:12px;color:var(--text-dim)">No tags yet</span>';
  }

  // Density toggle
  const dt = document.getElementById('density-toggle');
  if (dt) dt.checked = f.compact === true;
}

function collectFilterSheet() {
  const sortBtn = document.querySelector('#sort-seg .seg-btn.active');
  _state = {
    ...getFilters(),
    sortBy:     sortBtn?.dataset.val ?? 'due',
    filterPri:  [...document.querySelectorAll('#filter-pri-checks input:checked')].map(i => i.value),
    filterCats: [...document.querySelectorAll('#filter-cat-checks input:checked')].map(i => i.value),
    filterTags: [...document.querySelectorAll('#filter-tag-checks input:checked')].map(i => i.value),
    compact:    document.getElementById('density-toggle')?.checked ?? false,
  };
  savePrefs(_state);
}

function escHtml(s) { return s?.replace(/&/g,'&amp;').replace(/</g,'&lt;') ?? ''; }
