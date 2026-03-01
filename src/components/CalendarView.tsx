import { useState } from 'react'
import type { Task } from '../types'
import { formatDue, isOverdue } from '../lib/parseDate'

interface Props {
  tasks: Task[]
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onSnooze: (id: string) => void
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

function pad(n: number) { return String(n).padStart(2, '0') }

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function CalendarView({ tasks, onToggleDone, onDelete, onSnooze }: Props) {
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selDay, setSelDay]       = useState<Date>(new Date(now.getFullYear(), now.getMonth(), now.getDate()))

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate()

  // Build grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let i = 1; i <= totalDays; i++) cells.push(i)

  // Task dots per day
  const tasksOnDay = (day: number) =>
    tasks.filter((t) => {
      if (!t.dueDate) return false
      const d = new Date(t.dueDate)
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day
    })

  // Tasks for selected day
  const selTasks = tasks.filter((t) => {
    if (!t.dueDate) return false
    return sameDay(new Date(t.dueDate), selDay)
  })

  const isSelDay  = (d: number) => sameDay(new Date(viewYear, viewMonth, d), selDay)
  const isTodayDay = (d: number) => sameDay(new Date(viewYear, viewMonth, d), now)

  return (
    <div className="calendar-view">
      {/* Month nav */}
      <div className="cal-month-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-label">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-dow-row">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-dow">{d}</div>)}
      </div>

      {/* Day grid */}
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="cal-cell empty" />
          const dayTasks = tasksOnDay(day)
          const hasOverdue = dayTasks.some((t) => !t.done && isOverdue(t.dueDate!))
          const hasPending = dayTasks.some((t) => !t.done)
          return (
            <div
              key={day}
              className={`cal-cell${isTodayDay(day) ? ' today' : ''}${isSelDay(day) ? ' sel' : ''}`}
              onClick={() => setSelDay(new Date(viewYear, viewMonth, day))}
            >
              <span className="cal-day-num">{day}</span>
              {dayTasks.length > 0 && (
                <div className="cal-dots">
                  <span className={`cal-dot${hasOverdue ? ' overdue' : hasPending ? ' pending' : ' done'}`} />
                  {dayTasks.length > 1 && <span className="cal-dot-count">{dayTasks.length}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day task list */}
      <div className="cal-day-tasks">
        <div className="cal-day-heading">
          {sameDay(selDay, now) ? 'Today' : selDay.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          <span className="cal-day-count">{selTasks.length} task{selTasks.length !== 1 ? 's' : ''}</span>
        </div>
        {selTasks.length === 0 ? (
          <div className="cal-day-empty">no tasks scheduled</div>
        ) : (
          <div className="cal-task-list">
            {selTasks.map((t) => {
              const over = !t.done && isOverdue(t.dueDate!)
              return (
                <div key={t.id} className={`cal-task-row${t.done ? ' done' : ''}${over ? ' overdue' : ''}`}>
                  <div
                    className={`task-check${t.done ? ' checked' : ''}`}
                    style={{ flexShrink: 0 }}
                    onClick={() => onToggleDone(t.id)}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="cal-task-body">
                    <div className={`task-text${t.done ? ' done' : ''}`}>{t.text}</div>
                    <div className="task-meta">
                      {t.dueDate && <span className={`task-due${over ? ' overdue' : ''}`}>{formatDue(t.dueDate)}</span>}
                      <span className="task-list-badge">{t.listId}</span>
                    </div>
                  </div>
                  <div className="cal-task-actions">
                    {over && (
                      <button className="cal-action-btn snooze" onClick={() => onSnooze(t.id)} title="Snooze 1h">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                    <button className="cal-action-btn del" onClick={() => onDelete(t.id)} title="Delete">
                      <svg width="10" height="12" viewBox="0 0 12 14" fill="none">
                        <path d="M1 3h10M4 3V2h4v1M2 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
