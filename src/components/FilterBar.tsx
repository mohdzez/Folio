import { useDrag } from '@use-gesture/react'
import type { FilterView, Task } from '../types'
import { isOverdue } from '../lib/parseDate'

interface Props {
  active: FilterView
  tasks: Task[]
  onChange: (f: FilterView) => void
}

const FILTERS: FilterView[] = ['all', 'today', 'upcoming', 'overdue']
const FILTER_LABELS: Record<FilterView, string> = { all: 'All', today: 'Today', upcoming: 'Upcoming', overdue: 'Overdue' }

export function FilterBar({ active, tasks, onChange }: Props) {
  const overdueCount = tasks.filter((t) => !t.done && t.dueDate && isOverdue(t.dueDate)).length

  const bind = useDrag(
    ({ movement: [mx], last, velocity: [vx] }) => {
      if (!last) return
      const dist = Math.abs(mx)
      const fast = Math.abs(vx) > 0.25
      if (dist > 40 || (dist > 15 && fast)) {
        const idx = FILTERS.indexOf(active)
        const dir = mx < 0 ? 1 : -1 // swipe left → next filter, swipe right → prev
        const next = Math.max(0, Math.min(FILTERS.length - 1, idx + dir))
        if (next !== idx) onChange(FILTERS[next])
      }
    },
    { axis: 'x', filterTaps: true }
  )

  return (
    <div className="filter-bar" role="tablist" {...bind()}>
      {FILTERS.map((id) => (
        <button
          key={id}
          className={`filter-btn${active === id ? ' active' : ''}`}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
        >
          {FILTER_LABELS[id]}
          {id === 'overdue' && overdueCount > 0 && (
            <span className="overdue-dot" title={`${overdueCount} overdue`} />
          )}
        </button>
      ))}
    </div>
  )
}
