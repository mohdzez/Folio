import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { subscribeSettings, saveSettings } from './lib/firestore'
import { TaskList } from './components/TaskList'
import { AddTask } from './components/AddTask'
import { ListSwitcher } from './components/ListSwitcher'
import { FilterBar } from './components/FilterBar'
import { Settings } from './components/Settings'
import { CalendarView } from './components/CalendarView'
import type { FilterView, AppSettings, Task } from './types'
import { BUILTIN_LIST_IDS } from './types'
import { isOverdue } from './lib/parseDate'

const DEFAULT_SETTINGS: AppSettings = { theme: 'dark', reminderLeadTime: 15 }
const DEFAULT_ACTIVE_LISTS = [...BUILTIN_LIST_IDS]

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className="toast">{message}</div>
}

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()

  const [list, setList]               = useState<string>('today')
  const [filter, setFilter]           = useState<FilterView>('all')
  const [addOpen, setAddOpen]         = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState(false)
  const [settings, setSettings]       = useState<AppSettings>(DEFAULT_SETTINGS)
  const [toasts, setToasts]           = useState<{ id: number; msg: string }[]>([])

  const lastTapRef = useRef<number>(0)

  const activeLists = settings.activeLists ?? DEFAULT_ACTIVE_LISTS
  const activeListId = list === 'today' ? activeLists[0] ?? 'personal' : list

  const { tasks, allTasks, loading, addTask, toggleDone, removeTask, toggleStar, snoozeTask, patchTask } =
    useTasks(user?.uid ?? null, list, filter)

  // Subscribe to settings
  useEffect(() => {
    if (!user) return
    const unsub = subscribeSettings(user.uid, (s) => setSettings(s))
    return unsub
  }, [user?.uid])

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // URL shortcut ?action=add
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add') {
      setAddOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const toast = useCallback((msg: string) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg }])
  }, [])

  const handleToggleDone = useCallback(
    async (id: string) => { await toggleDone(id); toast('✓ done') },
    [toggleDone, toast]
  )

  const handleDelete = useCallback(
    async (id: string) => { await removeTask(id); toast('deleted') },
    [removeTask, toast]
  )

  const handleSnooze = useCallback(
    async (id: string) => { await snoozeTask(id); toast('snoozed +1h') },
    [snoozeTask, toast]
  )

  const handlePatchNote = useCallback(
    async (id: string, note: string) => { await patchTask(id, { note }) },
    [patchTask]
  )

  // Double-tap anywhere on page (except interactive elements) → add task
  const handleDoubleTap = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const tag = (e.target as HTMLElement).closest(
      'button, a, input, textarea, select, [role=button], .task-item, .settings-drawer, .add-task-panel'
    )
    if (tag || addOpen || settingsOpen) return
    const now = Date.now()
    if (now - lastTapRef.current < 350) {
      setAddOpen(true)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [addOpen, settingsOpen])

  const handleThemeToggle = async () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    setSettings((s) => ({ ...s, theme: next }))
    if (user) await saveSettings(user.uid, { theme: next })
  }

  const handleAddTask = (task: Omit<Task, 'id'>) => {
    addTask(task)
    toast('task added')
  }

  const overdueCount = allTasks.filter((t) => !t.done && t.dueDate && isOverdue(t.dueDate)).length

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-title">folio</div>
        <div className="loading-sub">loading</div>
      </div>
    )
  }

  return (
    <div
      className="app-shell"
      onTouchStart={handleDoubleTap}
      onDoubleClick={handleDoubleTap}
    >
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title font-serif">
          folio<span>.</span>
        </h1>
        <div className="header-actions">
          <div
            className={`auth-chip${user && !user.isAnonymous ? ' signed-in' : ''}`}
            onClick={() => setSettingsOpen(true)}
            role="button"
            tabIndex={0}
          >
            <span className="dot" />
            {user && !user.isAnonymous ? 'synced' : 'guest'}
          </div>
          <button
            className={`icon-btn${settingsOpen ? ' active' : ''}`}
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            {/* Cog / settings icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.2 1.9A6.5 6.5 0 0 1 9.8 1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M6.2 14.1A6.5 6.5 0 0 0 9.8 14.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M1.9 6.2A6.5 6.5 0 0 0 1.9 9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M14.1 6.2A6.5 6.5 0 0 1 14.1 9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Overdue banner */}
      {overdueCount > 0 && filter !== 'overdue' && !calendarMode && (
        <div className="overdue-banner" onClick={() => setFilter('overdue')} style={{ cursor: 'pointer' }}>
          {overdueCount} overdue task{overdueCount > 1 ? 's' : ''} → tap to view
        </div>
      )}

      {/* List tabs + calendar toggle */}
      <ListSwitcher
        active={list}
        tasks={allTasks}
        activeLists={activeLists}
        onChange={(l) => { setList(l); setFilter(l === 'today' ? 'today' : 'all') }}
        calendarMode={calendarMode}
        onCalendarToggle={() => setCalendarMode((m) => !m)}
      />

      {calendarMode ? (
        /* Calendar view */
        <CalendarView
          tasks={allTasks}
          onToggleDone={handleToggleDone}
          onDelete={handleDelete}
          onSnooze={handleSnooze}
        />
      ) : (
        <>
          {/* Filter bar — swipe on it to change filter */}
          <FilterBar active={filter} tasks={allTasks} onChange={setFilter} />

          {/* Task list — double-tap empty area opens AddTask */}
          <TaskList
            tasks={tasks}
            filter={filter}
            loading={loading}
            showList={list === 'today'}
            onToggleDone={handleToggleDone}
            onDelete={handleDelete}
            onStar={toggleStar}
            onSnooze={handleSnooze}
            onPatchNote={handlePatchNote}
          />
        </>
      )}

      {/* FAB — hidden when panel open */}
      <button
        className={`add-task-fab${addOpen ? ' open' : ''}`}
        onClick={() => setAddOpen(true)}
        aria-label="Add task"
      >
        +
      </button>

      {/* Backdrop */}
      {addOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 98 }}
          onClick={() => setAddOpen(false)}
        />
      )}

      {/* Add task panel */}
      <AddTask
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddTask}
        activeList={activeListId}
        uid={user?.uid ?? ''}
        defaultReminderLeadTime={settings.reminderLeadTime ?? 15}
        activeLists={activeLists}
      />

      {/* Settings */}
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        settings={settings}
        onSignInWithGoogle={signInWithGoogle}
        onSignOut={signOut}
        onThemeToggle={handleThemeToggle}
      />

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(({ id, msg }) => (
          <Toast
            key={id}
            message={msg}
            onDone={() => setToasts((t) => t.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </div>
  )
}
