import { useDrag } from '@use-gesture/react'
import { useRef, useState } from 'react'
import type { Task } from '../types'
import { formatDue, isOverdue, isToday } from '../lib/parseDate'

interface Props {
  task: Task
  showList?: boolean
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onStar: (id: string) => void
  onSnooze?: (id: string) => void
  index?: number
}

const SWIPE_THRESHOLD = 80
const TRAY_WIDTH = 160 // enough for two action buttons

export function TaskItem({ task, showList, onToggleDone, onDelete, onStar, onSnooze, index = 0 }: Props) {
  const [x, setX] = useState(0)
  const [removing, setRemoving] = useState<'done' | 'delete' | null>(null)
  const [showTray, setShowTray] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  const taskOverdue = !!(task.dueDate && isOverdue(task.dueDate) && !task.done)

  const resetTray = () => { setShowTray(false); setX(0) }

  const bind = useDrag(
    ({ movement: [mx], last, cancel, velocity: [vx] }) => {
      if (removing) { cancel(); return }

      // If tray is open, only allow right swipe to dismiss
      if (showTray) {
        if (last && mx > 30) resetTray()
        return
      }

      const clamped = Math.max(-TRAY_WIDTH, Math.min(150, mx))
      setX(clamped)

      if (last) {
        const shouldComplete = mx > SWIPE_THRESHOLD || (mx > 40 && vx > 0.5)
        const shouldAction   = mx < -SWIPE_THRESHOLD || (mx < -40 && vx > 0.5)

        if (shouldComplete) {
          setRemoving('done')
          setTimeout(() => onToggleDone(task.id), 280)
        } else if (shouldAction) {
          if (taskOverdue) {
            // Reveal tray with Delete + Snooze options
            setShowTray(true)
            setX(-TRAY_WIDTH)
          } else {
            // Not overdue — just delete immediately
            setRemoving('delete')
            setTimeout(() => onDelete(task.id), 280)
          }
        } else {
          setX(0)
        }
      }
    },
    { axis: 'x', filterTaps: true }
  )

  const handleDelete = () => {
    setRemoving('delete')
    setTimeout(() => onDelete(task.id), 280)
  }

  const handleSnooze = () => {
    resetTray()
    onSnooze?.(task.id)
  }

  const dueClass = task.dueDate
    ? isOverdue(task.dueDate) && !task.done ? 'overdue'
    : isToday(task.dueDate) ? 'today'
    : ''
    : ''

  return (
    <div
      className={`task-item-wrapper animate-in`}
      style={{ '--index': index } as React.CSSProperties}
      ref={wrapRef}
    >
      {/* Left swipe bg: complete */}
      <div className={`task-action-bg left${x > 40 ? ' reveal' : ''}`}>
        <span className="task-action-icon">✓</span>
      </div>

      {/* Right swipe bg: action tray */}
      <div className={`task-action-bg right${(x < -40 || showTray) ? ' reveal' : ''}${showTray ? ' tray-open' : ''}`}>
        {showTray ? (
          <div className="task-tray-btns">
            {taskOverdue && onSnooze && (
              <button className="tray-btn snooze" onClick={handleSnooze}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                +1h
              </button>
            )}
            <button className="tray-btn del" onClick={handleDelete}>
              <svg width="11" height="13" viewBox="0 0 12 14" fill="none">
                <path d="M1 3h10M4 3V2h4v1M2 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Delete
            </button>
          </div>
        ) : (
          <span className="task-action-icon">✕</span>
        )}
      </div>

      {/* Task row */}
      <div
        {...bind()}
        className={`task-item${removing === 'done' ? ' done-anim' : removing === 'delete' ? ' delete-anim' : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: x === 0 && !showTray ? 'transform 0.25s' : showTray ? 'transform 0.2s' : undefined }}
        onDoubleClick={(e) => { e.stopPropagation(); onToggleDone(task.id) }}
        onClick={() => { if (showTray) { resetTray(); return }; if (x === 0) setExpanded((e) => !e) }}
      >
        {/* Checkbox */}
        <div
          className={`task-check${task.done ? ' checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleDone(task.id) }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Content */}
        <div className="task-body">
          <div className={`task-text${task.done ? ' done' : ''}`}>{task.text}</div>
          <div className="task-meta">
            {task.dueDate && (
              <span className={`task-due ${dueClass}`}>
                {formatDue(task.dueDate)}
              </span>
            )}
            {task.recurring && (
              <span className="task-recurring-badge">
                {task.recurring === 'daily' ? '↻ daily' : '↻ weekly'}
              </span>
            )}
            {showList && (
              <span className="task-list-badge">{task.listId}</span>
            )}
          </div>
        </div>

        {/* Star */}
        <button
          className={`task-star${task.starred ? ' starred' : ''}`}
          onClick={(e) => { e.stopPropagation(); onStar(task.id) }}
          aria-label="Star task"
        >
          {task.starred ? '★' : '☆'}
        </button>
      </div>

      {/* Subtasks */}
      {expanded && task.subtasks && task.subtasks.length > 0 && (
        <div className="task-subtasks">
          {task.subtasks.map((st) => (
            <div key={st.id} className="subtask-row">
              <div className={`subtask-check${st.done ? ' checked' : ''}`} />
              <span style={{ textDecoration: st.done ? 'line-through' : undefined }}>{st.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Note */}
      {expanded && task.note && (
        <div className="task-note">{task.note}</div>
      )}
    </div>
  )
}
