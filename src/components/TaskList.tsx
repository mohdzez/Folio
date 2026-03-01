import type { Task, FilterView } from '../types'
import { TaskItem } from './TaskItem'
import { isOverdue, isToday } from '../lib/parseDate'

interface Props {
  tasks: Task[]
  filter: FilterView
  loading: boolean
  showList?: boolean
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onStar: (id: string) => void
  onSnooze: (id: string) => void
  onDoubleClick?: () => void
}

const EMPTY_LABELS: Record<FilterView, string> = {
  all: 'clear',
  today: 'open',
  upcoming: 'quiet',
  overdue: 'good',
}

export function TaskList({ tasks, filter, loading, showList, onToggleDone, onDelete, onStar, onSnooze, onDoubleClick }: Props) {
  if (loading) {
    return (
      <div className="task-list-empty">
        <div className="empty-label" style={{ animationDuration: '1.5s' }}>—</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="task-list-empty" onDoubleClick={onDoubleClick}>
        <div className="empty-glyph">∅</div>
        <div className="empty-label">all {EMPTY_LABELS[filter]}</div>
      </div>
    )
  }

  const starred = tasks.filter((t) => t.starred && !t.done)
  const overdue = tasks.filter((t) => !t.starred && t.dueDate && isOverdue(t.dueDate) && !t.done)
  const today   = tasks.filter((t) => !t.starred && t.dueDate && isToday(t.dueDate) && !isOverdue(t.dueDate) && !t.done)
  const rest    = tasks.filter((t) => !t.starred && !(t.dueDate && isOverdue(t.dueDate)) && !(t.dueDate && isToday(t.dueDate)) && !t.done)
  const done    = tasks.filter((t) => t.done)

  let idx = 0
  const renderGroup = (label: string | null, items: Task[]) => {
    if (items.length === 0) return null
    return (
      <>
        {label && <div className="task-group-label">{label}</div>}
        {items.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            showList={showList}
            onToggleDone={onToggleDone}
            onDelete={onDelete}
            onStar={onStar}
            onSnooze={onSnooze}
            index={idx++}
          />
        ))}
      </>
    )
  }

  return (
    <div className="task-list-scroll" onDoubleClick={onDoubleClick}>
      {renderGroup(starred.length > 0 ? '★ starred' : null, starred)}
      {renderGroup(overdue.length > 0 ? '⚠ overdue' : null, overdue)}
      {renderGroup(today.length > 0 ? '◎ today' : null, today)}
      {renderGroup(null, rest)}
      {done.length > 0 && renderGroup('✓ completed', done)}
    </div>
  )
}
