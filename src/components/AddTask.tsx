import { useState, useRef, useEffect } from 'react'
import type { Task } from '../types'
import { parseTaskInput } from '../lib/parseDate'
import { DateTimePicker } from './DateTimePicker'
import { NoteEditor } from './NoteEditor'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdd: (task: Omit<Task, 'id'>) => void
  activeList: string
  uid: string
  defaultReminderLeadTime: number
  activeLists: string[]
}

const REMINDER_OPTIONS = [
  { label: 'Use default', value: -1 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1 day', value: 1440 },
]

export function AddTask({ isOpen, onClose, onAdd, activeList, uid, defaultReminderLeadTime, activeLists }: Props) {
  const [value, setValue]             = useState('')
  const [note, setNote]               = useState('')
  const [list, setList]               = useState<string>(activeList)
  const [dueDate, setDueDate]         = useState<Date | null>(null)
  const [reminderMins, setReminderMins] = useState<number>(-1)
  const [reminderMode, setReminderMode] = useState<'before' | 'at'>('before')
  const [reminderAt, setReminderAt]   = useState<Date | null>(null)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [recurring, setRecurring]     = useState<'daily' | 'weekly' | null>(null)
  const [showPicker, setShowPicker]   = useState(false)
  const [showNote, setShowNote]       = useState(false)
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseTaskInput(value)

  // Resolved due: manual picker takes priority over NL-parsed
  const resolvedDate = dueDate ?? parsed.dueDate

  // Resolved reminder: NL-parsed takes priority; then mode-based
  const resolvedReminder =
    parsed.reminderLeadTime !== null ? parsed.reminderLeadTime
    : reminderMode === 'before' && reminderMins === -1 ? null
    : reminderMode === 'before' ? reminderMins
    : null // 'at' mode uses reminderAt instead

  useEffect(() => {
    if (isOpen) {
      setList(activeList)
      // Focus after panel animation starts (100ms) — bottom is already keyboard-aware
      // so the keyboard will open at the correct position
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setValue('')
      setNote('')
      setDueDate(null)
      setReminderMins(-1)
      setReminderMode('before')
      setReminderAt(null)
      setShowReminderPicker(false)
      setRecurring(null)
      setShowNote(false)
      setNoteEditorOpen(false)
      setShowPicker(false)
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
      reminderLeadTime: resolvedReminder ?? undefined,
      reminderAt: reminderMode === 'at' && reminderAt ? reminderAt.getTime() : undefined,
      recurring: recurring ?? undefined,
      note: note.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    })
    onClose()
  }

  const reminderLabel = parsed.reminderLeadTime !== null
    ? `${parsed.reminderLeadTime} min (from text)`
    : reminderMins === -1
    ? `default (${defaultReminderLeadTime} min)`
    : null

  return (
    <>
      <div
        className={`add-task-panel${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="panel-handle" />

        {/* Main task input */}
        <input
          ref={inputRef}
          className="add-task-input"
          placeholder='"Call dentist Thursday 9am, 15 min before"'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSubmit()
            if (e.key === 'Escape') onClose()
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Note button — opens full-screen NoteEditor */}
        {(showNote || note) && (
          <button
            className="note-open-btn"
            onClick={() => setNoteEditorOpen(true)}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 6.5h7M2 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {note ? (
              <span className="note-preview-snippet">{note.slice(0, 60)}{note.length > 60 ? '…' : ''}</span>
            ) : (
              'Write note…'
            )}
            <span className="note-open-arrow">↗</span>
          </button>
        )}

        {/* Due date display + picker trigger */}
        <div className="add-task-parsed" style={{ marginTop: 10 }}>
          {resolvedDate ? (
            <button
              className="parsed-date"
              style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
              onClick={() => setShowPicker(true)}
            >
              {resolvedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              {' '}
              {resolvedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 9 }}>▾</span>
            </button>
          ) : (
            <button
              className="datetime-toggle"
              onClick={() => setShowPicker(true)}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              {parsed.dueDate ? 'Parsed: override date' : 'Set date & time'}
            </button>
          )}
          {resolvedDate && (
            <button
              className="datetime-clear"
              style={{ marginLeft: 6 }}
              onClick={() => { setDueDate(null) }}
              title="Clear date"
            >
              ✕
            </button>
          )}
        </div>

        {/* Reminder section — always visible */}
        <div className="reminder-section">
          <div className="reminder-row">
            <span className="reminder-label">Remind</span>
            {parsed.reminderLeadTime !== null ? (
              <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                {parsed.reminderLeadTime} min before (from text)
              </span>
            ) : (
              <div className="reminder-mode-toggle">
                <button
                  className={`reminder-mode-btn${reminderMode === 'before' ? ' active' : ''}`}
                  onClick={() => { setReminderMode('before'); setShowReminderPicker(false) }}
                >
                  Before due
                </button>
                <button
                  className={`reminder-mode-btn${reminderMode === 'at' ? ' active' : ''}`}
                  onClick={() => setReminderMode('at')}
                >
                  Specific time
                </button>
              </div>
            )}
          </div>

          {parsed.reminderLeadTime === null && reminderMode === 'before' && (
            <select
              className="reminder-select reminder-select-full"
              value={reminderMins}
              onChange={(e) => setReminderMins(Number(e.target.value))}
            >
              <option value={-1}>No reminder</option>
              {REMINDER_OPTIONS.filter(o => o.value !== -1).map(o => (
                <option key={o.value} value={o.value}>
                  {resolvedDate
                    ? `${o.label} before (${new Date(resolvedDate.getTime() - o.value * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    : o.label}
                </option>
              ))}
              <option value={defaultReminderLeadTime}>Default ({defaultReminderLeadTime} min)</option>
            </select>
          )}

          {parsed.reminderLeadTime === null && reminderMode === 'at' && (
            <div className="reminder-at-row">
              <button
                className={`reminder-at-btn${showReminderPicker ? ' active' : ''}`}
                onClick={() => setShowReminderPicker(s => !s)}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {reminderAt
                  ? reminderAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Pick date & time'}
              </button>
              {reminderAt && (
                <button
                  className="reminder-clear-btn"
                  onClick={() => { setReminderAt(null); setShowReminderPicker(false) }}
                  title="Clear reminder"
                >✕</button>
              )}
            </div>
          )}

          {showReminderPicker && reminderMode === 'at' && (
            <DateTimePicker
              value={reminderAt}
              onChange={(d) => { setReminderAt(d); setShowReminderPicker(false) }}
              onClose={() => setShowReminderPicker(false)}
            />
          )}
        </div>

        {/* Spacer */}
        <div style={{ height: 14 }} />

        {/* Actions row */}
        <div className="add-task-actions">
          <select
            className="add-task-list-select"
            value={list}
            onChange={(e) => setList(e.target.value)}
          >
            {activeLists.map((id) => (
              <option key={id} value={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</option>
            ))}
          </select>

          <select
            className="reminder-select"
            value={recurring ?? 'none'}
            onChange={(e) => setRecurring(e.target.value === 'none' ? null : e.target.value as 'daily' | 'weekly')}
            title="Recurring"
          >
            <option value="none">Once</option>
            <option value="daily">↻ Daily</option>
            <option value="weekly">↻ Weekly</option>
          </select>

          <button
            className={`datetime-toggle${showNote || note ? ' active' : ''}`}
            onClick={() => { setShowNote(s => !s); if (!showNote && !note) setNoteEditorOpen(true) }}
            title="Add note"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 6.5h7M2 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Note
          </button>

          <button className="add-task-cancel" onClick={onClose}>Cancel</button>

          <button
            className="add-task-submit"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Custom themed date/time picker */}
      {showPicker && (
        <DateTimePicker
          value={resolvedDate}
          onChange={(d) => { setDueDate(d); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Full-screen note editor */}
      <NoteEditor
        isOpen={noteEditorOpen}
        value={note}
        onChange={setNote}
        onClose={() => setNoteEditorOpen(false)}
        taskTitle={parsed.text || undefined}
      />
    </>
  )
}
