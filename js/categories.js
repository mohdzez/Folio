// categories.js
import { addCategory, deleteCategory, getCategories } from './db.js';
import { newId, showToast } from './utils.js';

const CAT_COLORS = ['#c9a84c','#c0614a','#6a9e6f','#5b8fa8','#8b6fa8','#a86f8b','#7a9e6f','#a8896f','#6fa89e','#a06f6f'];
let _selectedColor = CAT_COLORS[0];
export { CAT_COLORS };

export function openCatModal() {
  document.getElementById('c-name').value = '';
  _selectedColor = CAT_COLORS[0];
  renderColorOpts();
  document.getElementById('cat-sheet-overlay').classList.add('open');
  setTimeout(() => document.getElementById('c-name')?.focus(), 300);
}

export function initCatSheet(onSave) {
  document.getElementById('cat-save-btn')?.addEventListener('click', () => {
    const name = document.getElementById('c-name')?.value.trim();
    if (!name) { document.getElementById('c-name')?.focus(); return; }
    addCategory({ id:newId('cat'), name, color:_selectedColor });
    document.getElementById('cat-sheet-overlay').classList.remove('open');
    showToast('Category created');
    onSave();
  });
  document.getElementById('cat-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('cat-sheet-overlay').classList.remove('open');
  });
  document.getElementById('color-opts')?.addEventListener('click', e => {
    const opt = e.target.closest('.color-opt');
    if (!opt) return;
    _selectedColor = opt.dataset.color;
    renderColorOpts();
  });
  document.getElementById('cat-sheet-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'cat-sheet-overlay') document.getElementById('cat-sheet-overlay').classList.remove('open');
  });
}

function renderColorOpts() {
  const el = document.getElementById('color-opts');
  if (!el) return;
  el.innerHTML = CAT_COLORS.map(c =>
    `<div class="color-opt ${c===_selectedColor?'selected':''}" data-color="${c}" style="background:${c}"></div>`
  ).join('');
}

export function handleDeleteCategory(id, catName, onRefresh) {
  if (!confirm(`Delete "${catName}"? Tasks keep their data but lose this category.`)) return;
  deleteCategory(id);
  showToast('Category deleted');
  onRefresh();
}
