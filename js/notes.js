// notes.js — Notes panel with markdown preview
import { getTasks, getCategories, updateTask } from './db.js';
import { formatDate, isToday, isOverdue, escHtml, renderMarkdown } from './utils.js';

let _taskId   = null;
let _onClose  = null;
let _dirty    = false;
let _timer    = null;
let _preview  = false;

export function openNotesPanel(taskId, onClose) {
  const task = getTasks().find(t => t.id === taskId);
  if (!task) return;
  _taskId  = taskId;
  _onClose = onClose;
  _dirty   = false;
  _preview = false;

  renderHeader(task);
  const ta = document.getElementById('notes-textarea');
  if (ta) ta.value = task.notes || '';
  updateCounts(task.notes || '');
  setSaveStatus('saved');
  showEditor();

  document.getElementById('notes-overlay').classList.add('open');
  setTimeout(() => ta?.focus(), 300);
}

export function closeNotesPanel() {
  if (_dirty) flush();
  document.getElementById('notes-overlay').classList.remove('open');
  setTimeout(() => { _onClose?.(); }, 300);
  _taskId = null;
  clearTimeout(_timer);
}

function renderHeader(task) {
  const cat     = getCategories().find(c => c.id === task.cat);
  document.getElementById('notes-task-title').textContent = task.title;

  const dueClass = isOverdue(task.due) && !task.done ? 'overdue' : isToday(task.due) ? 'today' : '';
  const dueHtml  = task.due ? `<span class="notes-badge notes-due ${dueClass}">${isToday(task.due)?'Today':formatDate(task.due)}</span>` : '';
  const catHtml  = cat ? `<span class="notes-badge" style="background:${cat.color}22;color:${cat.color}">${escHtml(cat.name)}</span>` : '';
  const doneHtml = task.done ? `<span class="notes-badge notes-done-badge">✓ Done</span>` : '';
  document.getElementById('notes-meta').innerHTML = [doneHtml, catHtml, dueHtml].filter(Boolean).join('');
}

export function initNotesPanel(onClose) {
  _onClose = onClose;

  document.getElementById('notes-close-btn')?.addEventListener('click', closeNotesPanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _taskId) closeNotesPanel();
  });

  // Textarea auto-save
  document.getElementById('notes-textarea')?.addEventListener('input', e => {
    _dirty = true;
    setSaveStatus('unsaved');
    updateCounts(e.target.value);
    updatePreview(e.target.value);
    schedule(e.target.value);
  });

  // Tab → 2 spaces
  document.getElementById('notes-textarea')?.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target, s = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0,s)+'  '+ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = s+2;
      _dirty = true; schedule(ta.value);
    }
    if ((e.metaKey||e.ctrlKey) && e.key==='s') { e.preventDefault(); flush(); }
  });

  // Toolbar
  document.getElementById('notes-toolbar')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-fmt]');
    if (btn) applyFmt(btn.dataset.fmt);
  });

  // Preview toggle
  document.getElementById('notes-preview-btn')?.addEventListener('click', () => {
    _preview = !_preview;
    const ta = document.getElementById('notes-textarea');
    if (_preview) {
      updatePreview(ta?.value || '');
      showPreview();
    } else {
      showEditor();
    }
    document.getElementById('notes-preview-btn')?.classList.toggle('active', _preview);
  });
}

function schedule(val) { clearTimeout(_timer); _timer = setTimeout(() => doSave(val), 600); }
function flush()       { clearTimeout(_timer); const ta=document.getElementById('notes-textarea'); if(ta&&_dirty) doSave(ta.value); }
function doSave(notes) { if(!_taskId) return; updateTask(_taskId,{notes,updatedAt:Date.now()}); _dirty=false; setSaveStatus('saved'); }

function updatePreview(text) {
  const el = document.getElementById('notes-preview');
  if (el) el.innerHTML = renderMarkdown(text) || '<span style="color:var(--text-dim);font-size:13px">Nothing to preview yet.</span>';
}
function showEditor()  { const ta=document.getElementById('notes-textarea'); const pr=document.getElementById('notes-preview'); if(ta) ta.style.display=''; if(pr) pr.style.display='none'; }
function showPreview() { const ta=document.getElementById('notes-textarea'); const pr=document.getElementById('notes-preview'); if(ta) ta.style.display='none'; if(pr) pr.style.display=''; }

const FMTS = {
  bold:    { wrap:'**' }, italic:  { wrap:'_' }, code: { wrap:'`' },
  heading: { prefix:'## ' }, bullet: { prefix:'- ' }, checkbox: { prefix:'- [ ] ' },
  hr:      { insert:'\n---\n' },
};
function applyFmt(fmt) {
  const ta = document.getElementById('notes-textarea');
  if (!ta) return;
  const def = FMTS[fmt]; if (!def) return;
  const s=ta.selectionStart, e=ta.selectionEnd, sel=ta.value.slice(s,e);
  let nv, ns, ne;
  if (def.insert) { nv=ta.value.slice(0,s)+def.insert+ta.value.slice(e); ns=ne=s+def.insert.length; }
  else if (def.wrap) { const w=`${def.wrap}${sel||'text'}${def.wrap}`; nv=ta.value.slice(0,s)+w+ta.value.slice(e); ns=s+def.wrap.length; ne=ns+(sel||'text').length; }
  else if (def.prefix) { const ls=ta.value.lastIndexOf('\n',s-1)+1; nv=ta.value.slice(0,ls)+def.prefix+ta.value.slice(ls); ns=ne=s+def.prefix.length; }
  ta.value=nv; ta.selectionStart=ns; ta.selectionEnd=ne; ta.focus();
  _dirty=true; schedule(nv); updateCounts(nv); setSaveStatus('unsaved');
}

function updateCounts(text) {
  const words = text.trim()?text.trim().split(/\s+/).length:0;
  const el=document.getElementById('notes-count'); if(el) el.textContent=`${words}w · ${text.length}c`;
}
function setSaveStatus(s) {
  const el=document.getElementById('notes-save-status'); if(!el) return;
  el.textContent=s==='saved'?'✓ Saved':'● Saving…'; el.className='notes-save-status '+s;
}
