import type { ListId, Task } from '../types'

interface Props {
  active: ListId
  tasks: Task[]
  onChange: (list: ListId) => void
}

const LISTS: { id: ListId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'errands', label: 'Errands' },
]

export function ListSwitcher({ active, tasks, onChange }: Props) {
  const countForList = (id: ListId) => {
    if (id === 'today') {
      const now = new Date()
      return tasks.filter(
        (t) =>
          !t.done &&
          t.dueDate &&
          new Date(t.dueDate).toDateString() === now.toDateString()
      ).length
    }
    return tasks.filter((t) => t.listId === id && !t.done).length
  }

  return (
    <nav className="list-switcher" aria-label="Task lists">
      {LISTS.map(({ id, label }) => {
        const count = countForList(id)
        return (
          <button
            key={id}
            className={`list-tab${active === id ? ' active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
          >
            {label}
            {count > 0 && <span className="count">{count}</span>}
          </button>
        )
      })}
    </nav>
  )
}
