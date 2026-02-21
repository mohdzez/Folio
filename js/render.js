// render.js — All DOM rendering
import { getTasks, getCategories } from './db.js';
import { applyFilters, isCompact, getFilters } from './filters.js';
import { getSchedulesForTask } from './scheduler.js';
import { isToday, isOverdue, isUpcoming, formatDate, dayName, escHtml } from './utils.js';

export function renderPage(page, opts={}) {
  const fns = {
    today:       renderToday,
    upcoming:    renderUpcoming,
    all:         renderAll,
    categories:  renderCategories,
    'cat-detail':() => renderCatDetail(opts.catId),
    archive:     renderArchive,
    search:      () => {},
  };
  fns[page]?.();
  updateNavCounts();
}

// ── TODAY ─────────────────────────────────────
function renderToday() {
  const all     = getTasks().filter(t => !t.archived);
  const today   = applyFilters(all.filter(t => isToday(t.due)));
  const overdue = applyFilters(all.filter(t => isOverdue(t.due) && !t.done));
  const done    = today.filter(t => t.done).length;
  const total   = today.length;
  const pct     = total ? Math.round(done/total*100) : 0;

  // Ring
  const ring = document.getElementById('ring');
  if (ring) ring.style.strokeDashoffset = 138.2 - (pct/100)*138.2;
  setText('ring-pct',       pct+'%');
  setText('progress-title', pct===100&&total?'All done! ✦':total?'Keep going!':'All clear!');
  setText('progress-sub',   total?`${done} of ${total} done`:'No tasks due today');

  let html = '';
  if (overdue.length) html += buildSection('Overdue', overdue);
  html += buildSection('Today', today);
  if (!overdue.length && !today.length) html = emptyState('◈','All clear!','No tasks due today.');
  setHtml('today-tasks', html);
}

// ── UPCOMING ──────────────────────────────────
function renderUpcoming() {
  const tasks   = applyFilters(getTasks().filter(t => isUpcoming(t.due) && !t.archived));
  const grouped = {};
  tasks.forEach(t => { grouped[t.due] = grouped[t.due]||[]; grouped[t.due].push(t); });
  const dates = Object.keys(grouped).sort();

  setHtml('upcoming-stats', statsHtml([
    { label:'upcoming', count:tasks.length, cls:'' },
    { label:'done',     count:tasks.filter(t=>t.done).length, cls:'done' },
  ]));

  if (!dates.length) { setHtml('upcoming-tasks', emptyState('◷','Nothing soon','No tasks in the next 7 days.')); return; }
  setHtml('upcoming-tasks', dates.map(d => buildSection(`${dayName(d)}, ${formatDate(d)}`, grouped[d])).join(''));
}

// ── ALL ───────────────────────────────────────
export function renderAll(query='') {
  let tasks = getTasks().filter(t => !t.archived);
  if (query) {
    const q = query.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.notes||'').toLowerCase().includes(q) ||
      (t.tags||[]).some(tag => tag.includes(q))
    );
  }
  tasks = applyFilters(tasks);
  const active  = tasks.filter(t => !t.done);
  const done    = tasks.filter(t =>  t.done);
  const overdue = tasks.filter(t => isOverdue(t.due) && !t.done);

  setHtml('all-stats', statsHtml([
    { label:'active',  count:active.length,  cls:'' },
    { label:'done',    count:done.length,     cls:'done' },
    ...(overdue.length?[{ label:'overdue', count:overdue.length, cls:'overdue' }]:[]),
  ]));

  let html = '';
  if (active.length) html += buildSection('Active', active);
  if (done.length)   html += buildSection('Completed', done);
  if (!tasks.length) html = emptyState('▤', query?'No results':'No tasks yet', query?`Nothing for "${escHtml(query)}"` : 'Tap ＋ to add your first task.');
  setHtml('all-tasks', html);
}

// ── SEARCH ────────────────────────────────────
export function renderSearch(query) {
  if (!query) { setHtml('search-results', emptyState('⌕','Search tasks','Type above to find anything.')); return; }
  const q     = query.toLowerCase();
  const tasks = getTasks().filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.notes||'').toLowerCase().includes(q) ||
    (t.tags||[]).some(tag => tag.includes(q))
  );
  setHtml('search-results', tasks.length
    ? buildSection(`${tasks.length} result${tasks.length!==1?'s':''}`, tasks)
    : emptyState('⌕','No results',`Nothing matching "${escHtml(query)}"`)
  );
}

// ── CATEGORIES ────────────────────────────────
export function renderCategories() {
  const tasks = getTasks().filter(t => !t.archived);
  const cats  = getCategories();
  setHtml('cat-grid', cats.map(cat => {
    const ct   = tasks.filter(t => t.cat === cat.id);
    const done = ct.filter(t => t.done).length;
    const pct  = ct.length ? Math.round(done/ct.length*100) : 0;
    return `
      <div class="cat-card" data-cat-id="${cat.id}">
        <div class="cat-card-accent" style="background:${cat.color}"></div>
        <div class="cat-card-header">
          <div class="cat-card-name" style="color:${cat.color}">${escHtml(cat.name)}</div>
          <button class="cat-delete-btn" data-delete-cat="${cat.id}">✕</button>
        </div>
        <div class="cat-card-count">${ct.length} task${ct.length!==1?'s':''} · ${done} done</div>
        <div class="cat-card-bar"><div class="cat-card-fill" style="width:${pct}%;background:${cat.color}"></div></div>
      </div>`;
  }).join(''));
}

function renderCatDetail(catId) {
  const cat   = getCategories().find(c => c.id === catId);
  if (!cat) return;
  const tasks  = applyFilters(getTasks().filter(t => t.cat === catId && !t.archived));
  const active = tasks.filter(t => !t.done);
  const done   = tasks.filter(t =>  t.done);
  let html = '';
  if (active.length) html += buildSection('Active', active);
  if (done.length)   html += buildSection('Completed', done);
  if (!tasks.length) html = emptyState('⊞',`No tasks in ${escHtml(cat.name)}`,'Add a task in this category.');
  setHtml('cat-detail-tasks', html);
}

// ── ARCHIVE ───────────────────────────────────
function renderArchive() {
  const tasks = getTasks().filter(t => t.archived || (t.done && t.doneAt && Date.now() - t.doneAt > 7*86400000));
  if (!tasks.length) { setHtml('archive-tasks', emptyState('◫','Archive empty','Completed tasks appear here.')); return; }
  setHtml('archive-tasks', buildSection('Archived', tasks, { noSwipe:true }));
}

// ── NAV COUNTS ────────────────────────────────
export function updateNavCounts() {
  const tasks    = getTasks().filter(t => !t.archived);
  const today    = tasks.filter(t => isToday(t.due) && !t.done).length;
  const upcoming = tasks.filter(t => isUpcoming(t.due) && !t.done).length;
  setCount('count-today',    today);
  setCount('count-upcoming', upcoming);
}

export function renderHeaderDate() {
  setText('header-date', new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}));
}

// ── BUILD SECTION ─────────────────────────────
function buildSection(title, tasks, opts={}) {
  return `
    <div class="task-section">
      <div class="section-header">
        <span class="section-title">${title}</span>
        <span class="section-line"></span>
        <span class="section-count">${tasks.length}</span>
      </div>
      ${tasks.length
        ? tasks.map(t => buildTaskItem(t, opts)).join('')
        : `<div style="padding:10px 0;font-size:12px;color:var(--text-dim)">Nothing here.</div>`}
    </div>`;
}

// ── BUILD TASK ITEM ───────────────────────────
function buildTaskItem(task, opts={}) {
  const cat      = getCategories().find(c => c.id === task.cat);
  const compact  = isCompact();
  const scheds   = getSchedulesForTask(task.id).filter(s => s.fireAt > Date.now());

  const catBadge = cat ? `<span class="task-cat-badge" style="background:${cat.color}22;color:${cat.color}">${escHtml(cat.name)}</span>` : '';
  const dueClass = isOverdue(task.due) && !task.done ? 'overdue' : isToday(task.due) ? 'today' : '';
  const dueLabel = isToday(task.due) ? 'Today' : (isOverdue(task.due) && !task.done ? `⚠ ${formatDate(task.due)}` : formatDate(task.due));
  const dueHtml  = task.due ? `<span class="task-due ${dueClass}">${dueLabel}</span>` : '';
  const priMap   = { high:'⬤ HIGH', med:'⬤ MED', low:'⬤ LOW', none:'' };
  const priCls   = { high:'p-high',  med:'p-med',  low:'p-low',  none:'' };
  const priHtml  = task.priority !== 'none' ? `<span class="task-priority ${priCls[task.priority]}">${priMap[task.priority]}</span>` : '';

  const hasMeta = catBadge || dueHtml || priHtml;
  const tags    = (task.tags||[]).length ? `<div class="task-tags">${task.tags.map(t=>`<span class="task-tag">#${escHtml(t)}</span>`).join('')}</div>` : '';
  const recurBadge = task.recur && task.recur !== 'none' ? `<span class="recur-icon" title="Repeats ${task.recur}">↻</span>` : '';
  const schedBadge = scheds.length ? `<span class="task-sched-badge" title="${scheds.length} reminder">🔔</span>` : '';

  // Subtasks progress bar
  const subs     = task.subtasks || [];
  const subsDone = subs.filter(s => s.done).length;
  const subsBar  = subs.length && !compact ? `
    <div class="task-subtask-bar">
      <div class="subtask-progress">${subsDone}/${subs.length} subtasks</div>
      <div class="subtask-track"><div class="subtask-fill" style="width:${Math.round(subsDone/subs.length*100)}%"></div></div>
    </div>` : '';

  // Notes preview
  const notePreview = task.notes && !compact
    ? `<div class="task-notes-preview">${escHtml((task.notes.split('\n').find(l=>l.trim())||'').slice(0,70))}</div>`
    : '';

  const swipeBgs = opts.noSwipe ? '' : `
    <div class="swipe-bg-right">✓</div>
    <div class="swipe-bg-left">◫</div>`;

  return `
    <div class="task-item-wrap" data-task-id="${task.id}">
      ${swipeBgs}
      <div class="task-item ${task.done?'done':''} ${compact?'compact':''}" data-task-id="${task.id}">
        <div class="task-check" data-toggle="${task.id}">
          ${task.done?'<span class="check-mark">✓</span>':''}
        </div>
        <div class="task-body" data-notes="${task.id}">
          <div class="task-title">
            <span class="task-title-text">${escHtml(task.title)}</span>
            ${recurBadge}${schedBadge}
          </div>
          ${hasMeta?`<div class="task-meta">${catBadge}${dueHtml}${priHtml}</div>`:''}
          ${tags}${notePreview}${subsBar}
        </div>
      </div>
    </div>`;
}

// ── HELPERS ───────────────────────────────────
function statsHtml(items) {
  return items.map(({label,count,cls})=>`<div class="stat-pill"><span class="dot ${cls}"></span><strong>${count}</strong> ${label}</div>`).join('');
}
function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}
function setHtml(id, html) { const e=document.getElementById(id); if(e) e.innerHTML=html; }
function setText(id, text) { const e=document.getElementById(id); if(e) e.textContent=text; }
function setCount(id, n)   { const e=document.getElementById(id); if(e) e.textContent=n||''; }
