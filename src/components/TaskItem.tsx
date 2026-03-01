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
  index?: number
}

const SWIPE_THRESHOLD = 80

export function TaskItem({ task, showList, onToggleDone, onDelete, onStar, index = 0 }: Props) {
  const [x, setX] = useState(0)
  const [removing, setRemoving] = useState<'done' | 'delete' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  const bind = useDrag(
    ({ movement: [mx], last, cancel, velocity: [vx] }) => {
      if (removing) { cancel(); return }
      const clamped = Math.max(-150, Math.min(150, mx))
      setX(clamped)
      if (last) {
        const shouldComplete = mx > SWIPE_THRESHOLD || (mx > 40 && vx > 0.5)
        const shouldDelete = mx < -SWIPE_THRESHOLD || (mx < -40 && vx > 0.5)
        if (shouldComplete) {
          setRemoving('done')
          setTimeout(() => onToggleDone(task.id), 280)
        } else if (shouldDelete) {
          setRemoving('delete')
          setTimeout(() => onDelete(task.id), 280)
        } else {
          setX(0)
        }
      }
    },
    { axis: 'x', filterTaps: true }
  )

  const dueClass = task.dueDate
    ? isOverdue(task.dueDate) && !task.done
      ? 'overdue'
      : isToday(task.dueDate)
      ? 'today'
      : ''
    : ''

  return (
    <div
      className={`task-item-wrapper animate-in${removing ? '' : ''}`}
      style={{ '--index': index } as React.CSSProperties}
      ref={wrapRef}
    >
      {/* Swipe action backgrounds */}
      <div className={`task-action-bg left${x > 40 ? ' reveal' : ''}`}>
        <span className="task-action-icon">✓</span>
      </div>
      <div className={`task-action-bg right${x < -40 ? ' reveal' : ''}`}>
        <span className="task-action-icon">✕</span>
      </div>

      {/* Task row */}
      <div
        {...bind()}
        className={`task-item${removing === 'done' ? ' done-anim' : removing === 'delete' ? ' delete-anim' : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: x === 0 ? 'transform 0.25s' : undefined }}
        onDoubleClick={() => onToggleDone(task.id)}
        onClick={() => x === 0 && setExpanded((e) => !e)}
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
