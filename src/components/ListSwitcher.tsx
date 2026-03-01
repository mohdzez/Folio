import type { Task } from '../types'
import { TODAY_LIST_ID } from '../types'

interface Props {
  active: string
  tasks: Task[]
  activeLists: string[]
  onChange: (list: string) => void
  calendarMode: boolean
  onCalendarToggle: () => void
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function ListSwitcher({ active, tasks, activeLists, onChange, calendarMode, onCalendarToggle }: Props) {
  const countForList = (id: string) => {
    if (id === TODAY_LIST_ID) {
      const now = new Date()
      return tasks.filter(
        (t) => !t.done && t.dueDate && new Date(t.dueDate).toDateString() === now.toDateString()
      ).length
    }
    return tasks.filter((t) => t.listId === id && !t.done).length
  }

  const allLists = [TODAY_LIST_ID, ...activeLists]

  return (
    <nav className="list-switcher" aria-label="Task lists">
      {/* Scrollable tabs area */}
      <div className="list-tabs-scroll">
        {allLists.map((id) => {
          const count = countForList(id)
          return (
            <button
              key={id}
              className={`list-tab${active === id && !calendarMode ? ' active' : ''}`}
              onClick={() => { if (calendarMode) onCalendarToggle(); onChange(id) }}
              aria-current={active === id && !calendarMode ? 'page' : undefined}
            >
              {capitalize(id)}
              {count > 0 && <span className="count">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Calendar toggle — pinned to the right, never scrolls away */}
      <button
        className={`list-tab calendar-tab${calendarMode ? ' active' : ''}`}
        onClick={onCalendarToggle}
        aria-label="Calendar view"
        title="Calendar view"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <rect x="3.5" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
          <rect x="6.5" y="8" width="2" height="2" rx="0.5" fill="currentColor"/>
        </svg>
      </button>
    </nav>
  )
}
