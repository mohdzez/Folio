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
  { label: 'Weekend', offset: -1 },
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

// Format a Date to the value format required by datetime-local input
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AddTask({ isOpen, onClose, onAdd, activeList, uid }: Props) {
  const [value, setValue] = useState('')
  const [list, setList] = useState<Exclude<ListId, 'today'>>(activeList)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [manualDate, setManualDate] = useState<string>('') // datetime-local string
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseTaskInput(value)

  // Resolved due date: manual picker takes priority over NL parsed
  const resolvedDate: Date | null = manualDate
    ? new Date(manualDate)
    : parsed.dueDate

  useEffect(() => {
    if (isOpen) {
      setList(activeList)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setValue('')
      setManualDate('')
      setShowDatePicker(false)
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
      dueDate: resolvedDate ? resolvedDate.getTime() : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setValue('')
    setManualDate('')
    setShowDatePicker(false)
    onClose()
  }

  const applyQuickDate = (label: string, offset: number) => {
    const d = getQuickDate(offset, label)
    setManualDate(toDatetimeLocal(d))
    setShowDatePicker(true)
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
        {resolvedDate ? (
          <span className="parsed-date">
            {resolvedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}
            {resolvedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : value.length > 2 ? (
          <span className="parsed-hint">no date detected — pick one below</span>
        ) : (
          <span className="parsed-hint">type naturally — dates auto-detected</span>
        )}
      </div>

      {/* Quick date chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {QUICK_DATES.map(({ label, offset }) => (
          <button
            key={label}
            className={`list-tab${manualDate && resolvedDate ? '' : ''}`}
            style={{ fontSize: 10 }}
            onClick={() => applyQuickDate(label, offset)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Manual datetime picker */}
      <div className="add-task-datetime">
        <button
          className={`datetime-toggle${showDatePicker ? ' active' : ''}`}
          onClick={() => setShowDatePicker((s) => !s)}
        >
          <span>{showDatePicker ? '▾' : '▸'}</span>
          Pick date & time manually
        </button>
        {showDatePicker && (
          <div className="datetime-input-row">
            <input
              type="datetime-local"
              className="datetime-native"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            {manualDate && (
              <button className="datetime-clear" onClick={() => setManualDate('')} title="Clear date">
                ✕
              </button>
            )}
          </div>
        )}
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

        <button className="add-task-cancel" onClick={onClose}>
          Cancel
        </button>

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
