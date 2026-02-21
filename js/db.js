// db.js — Data layer: localStorage + IDB sync
const KEYS = { TASKS:'folio_tasks', CATS:'folio_cats', PREFS:'folio_prefs' };

const DEFAULT_CATS = [
  { id:'personal', name:'Personal', color:'#5b8fa8' },
  { id:'work',     name:'Work',     color:'#c9a84c' },
  { id:'health',   name:'Health',   color:'#6a9e6f' },
];

// ── READ ──────────────────────────────────────
export const getTasks      = () => tryParse(KEYS.TASKS, []);
export const getCategories = () => tryParse(KEYS.CATS, DEFAULT_CATS);
export const getPrefs      = () => tryParse(KEYS.PREFS, { sortBy:'due', filterPri:[], filterCats:[], filterTags:[], compact:false, dailyDigest:false });
export const getTaskById   = id => getTasks().find(t => t.id === id) ?? null;

function tryParse(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

// ── WRITE ─────────────────────────────────────
export function saveTasks(tasks)  { localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)); syncSW(tasks); }
export function saveCats(cats)    { localStorage.setItem(KEYS.CATS,  JSON.stringify(cats)); }
export function savePrefs(prefs)  { localStorage.setItem(KEYS.PREFS, JSON.stringify(prefs)); }

function syncSW(tasks) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(r => r.active?.postMessage({ type:'SYNC_TASKS', tasks }));
}

// ── TASK CRUD ─────────────────────────────────
export function addTask(task)           { const t = getTasks(); t.push(task); saveTasks(t); }
export function deleteTask(id)          { saveTasks(getTasks().filter(t => t.id !== id)); }
export function archiveTask(id)         { updateTask(id, { archived:true, archivedAt:Date.now() }); }
export function unarchiveTask(id)       { updateTask(id, { archived:false }); }

export function updateTask(id, patch) {
  const tasks = getTasks();
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch };
  saveTasks(tasks);
  return tasks[idx];
}

export function toggleDone(id) {
  const task = getTaskById(id);
  if (!task) return null;
  const done = !task.done;
  updateTask(id, { done, doneAt: done ? Date.now() : null });

  // Spawn next recurrence
  if (done && task.recur && task.recur !== 'none' && task.due) {
    const next = nextDue(task.due, task.recur);
    const newTask = { ...task, id:`task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, done:false, doneAt:null, due:next, created:Date.now() };
    addTask(newTask);
  }
  return getTaskById(id);
}

function nextDue(dueDateStr, recur) {
  const d = new Date(dueDateStr + 'T00:00:00');
  if (recur === 'daily')   d.setDate(d.getDate() + 1);
  if (recur === 'weekly')  d.setDate(d.getDate() + 7);
  if (recur === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function toggleSubtask(taskId, subtaskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  const subs = (task.subtasks || []).map(s =>
    s.id === subtaskId ? { ...s, done: !s.done } : s
  );
  updateTask(taskId, { subtasks: subs });
}

// ── CATEGORY CRUD ─────────────────────────────
export function addCategory(cat)      { const c = getCategories(); c.push(cat); saveCats(c); }
export function deleteCategory(id)    {
  saveCats(getCategories().filter(c => c.id !== id));
  saveTasks(getTasks().map(t => t.cat === id ? { ...t, cat:'' } : t));
}

// ── EXPORT / IMPORT ───────────────────────────
export function exportData() {
  return JSON.stringify({ tasks:getTasks(), categories:getCategories(), exported:new Date().toISOString() }, null, 2);
}

export function importData(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (!Array.isArray(data.tasks)) throw new Error('Invalid format: missing tasks array');
  if (data.categories) saveCats(data.categories);
  saveTasks(data.tasks);
}

// ── ALL TAGS ──────────────────────────────────
export function getAllTags() {
  return [...new Set(getTasks().flatMap(t => t.tags || []))].sort();
}

// ── SEED ─────────────────────────────────────
export function seedDemo() {
  if (getTasks().length > 0) return;
  const fmt = d => d.toISOString().slice(0,10);
  const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return fmt(d); };
  const now = fmt(new Date());
  saveTasks([
    { id:'d1', title:'Review project proposal', notes:'Check Q2 objectives and budget breakdown', due:now, priority:'high', cat:'work', tags:['q2','review'], recur:'none', subtasks:[{id:'s1',title:'Read exec summary',done:true},{id:'s2',title:'Review budget',done:false}], done:false, archived:false, created:Date.now() },
    { id:'d2', title:'Morning workout',          notes:'',    due:now,    priority:'med',  cat:'health', tags:['fitness'],    recur:'daily',   subtasks:[], done:true,  archived:false, created:Date.now() },
    { id:'d3', title:'Buy groceries',            notes:'Milk, eggs, coffee, bread', due:now, priority:'low', cat:'personal', tags:[], recur:'none', subtasks:[{id:'s3',title:'Milk',done:false},{id:'s4',title:'Coffee',done:false}], done:false, archived:false, created:Date.now() },
    { id:'d4', title:'Submit expense report',    notes:'',    due:add(-1), priority:'high', cat:'work',    tags:['admin'],   recur:'none',   subtasks:[], done:false, archived:false, created:Date.now() },
    { id:'d5', title:'Read 30 pages',            notes:'',    due:add(1),  priority:'low',  cat:'personal',tags:['reading'], recur:'daily',   subtasks:[], done:false, archived:false, created:Date.now() },
    { id:'d6', title:'Team standup',             notes:'Prepare updates for the week', due:add(2), priority:'med', cat:'work', tags:['meetings'], recur:'weekly', subtasks:[], done:false, archived:false, created:Date.now() },
  ]);
}
