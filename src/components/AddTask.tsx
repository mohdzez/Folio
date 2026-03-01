import { useState, useRef, useEffect } from 'react'
import type { ListId, Task } from '../types'
import { parseTaskInput } from '../lib/parseDate'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdd: (task: Omit<Task, 'id'>) => void
  activeList: Exclude<ListId, 'today'>
  uid: string
}

const QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Weekend', offset: -1 }, // computed below
  { label: 'Next week', offset: 7 },
]

function getQuickDate(offset: number, label: string): Date {
  const d = new Date()
  if (label === 'Weekend') {
    const day = d.getDay()
    const daysUntilSat = (6 - day + 7) % 7 || 7
    d.setDate(d.getDate() + daysUntilSat)
    d.setHours(10, 0, 0, 0)
    return d
  }
  d.setDate(d.getDate() + offset)
  d.setHours(offset === 0 ? Math.max(d.getHours() + 1, 9) : 9, 0, 0, 0)
  return d
}

export function AddTask({ isOpen, onClose, onAdd, activeList, uid }: Props) {
  const [value, setValue] = useState('')
  const [list, setList] = useState<Exclude<ListId, 'today'>>(activeList)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseTaskInput(value)

  useEffect(() => {
    if (isOpen) {
      setList(activeList)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setValue('')
    }
  }, [isOpen, activeList])

  const handleSubmit = () => {
    if (!value.trim()) return
    const now = Date.now()
    onAdd({
      text: parsed.text,
      listId: list,
      done: false,
      starred: false,
      dueDate: parsed.dueDate ? parsed.dueDate.getTime() : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setValue('')
    onClose()
  }

  const applyQuickDate = (label: string, offset: number) => {
    const d = getQuickDate(offset, label)
    const formatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    setValue((v) => {
      const base = parseTaskInput(v).text
      return `${base} ${label.toLowerCase()}`
    })
    inputRef.current?.focus()
  }

  return (
    <div className={`add-task-panel${isOpen ? ' open' : ''}`} role="dialog" aria-modal="true">
      <div className="panel-handle" />

      <input
        ref={inputRef}
        className="add-task-input"
        placeholder='e.g. "Call dentist Thursday 9am"'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') onClose()
        }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Parsed date preview */}
      <div className="add-task-parsed">
        {parsed.dueDate ? (
          <span className="parsed-date">
            {parsed.dueDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}
            {parsed.dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : value.length > 2 ? (
          <span className="parsed-hint">no date detected</span>
        ) : (
          <span className="parsed-hint">type naturally — dates auto-detected</span>
        )}
      </div>

      {/* Quick date chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {QUICK_DATES.map(({ label, offset }) => (
          <button
            key={label}
            className="list-tab"
            style={{ fontSize: 10 }}
            onClick={() => applyQuickDate(label, offset)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Actions row */}
      <div className="add-task-actions">
        <select
          className="add-task-list-select"
          value={list}
          onChange={(e) => setList(e.target.value as Exclude<ListId, 'today'>)}
        >
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="errands">Errands</option>
        </select>

        <button
          className="add-task-submit"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          Add
        </button>
      </div>
    </div>
  )
}
