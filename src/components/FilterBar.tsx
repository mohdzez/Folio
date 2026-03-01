import type { FilterView, Task } from '../types'
import { isOverdue } from '../lib/parseDate'

interface Props {
  active: FilterView
  tasks: Task[]
  onChange: (f: FilterView) => void
}

const FILTERS: { id: FilterView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
]

export function FilterBar({ active, tasks, onChange }: Props) {
  const overdueCount = tasks.filter((t) => !t.done && t.dueDate && isOverdue(t.dueDate)).length

  return (
    <div className="filter-bar" role="tablist">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          className={`filter-btn${active === id ? ' active' : ''}`}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
        >
          {label}
          {id === 'overdue' && overdueCount > 0 && (
            <span className="overdue-dot" title={`${overdueCount} overdue`} />
          )}
        </button>
      ))}
    </div>
  )
}
