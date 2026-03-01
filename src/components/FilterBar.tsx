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
    ({ swipe: [swipeX] }) => {
      if (swipeX !== 0) {
        const idx = FILTERS.indexOf(active)
        const next = Math.max(0, Math.min(FILTERS.length - 1, idx - swipeX))
        if (next !== idx) onChange(FILTERS[next])
      }
    },
    { axis: 'x', swipe: { distance: 40, velocity: [0.3, 0] } }
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
