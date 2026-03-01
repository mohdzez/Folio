import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { renderMarkdown } from '../lib/markdown'

interface Props {
  isOpen: boolean
  value: string
  onChange: (v: string) => void
  onClose: () => void
  taskTitle?: string
}

type ToolAction =
  | { type: 'prefix'; prefix: string }
  | { type: 'wrap'; before: string; after: string }
  | { type: 'insert'; text: string }

const TOOLBAR: { label: string; title: string; action: ToolAction }[] = [
  { label: 'H1', title: 'Heading 1', action: { type: 'prefix', prefix: '# ' } },
  { label: 'H2', title: 'Heading 2', action: { type: 'prefix', prefix: '## ' } },
  { label: 'H3', title: 'Heading 3', action: { type: 'prefix', prefix: '### ' } },
  { label: 'B',  title: 'Bold',      action: { type: 'wrap', before: '**', after: '**' } },
  { label: 'I',  title: 'Italic',    action: { type: 'wrap', before: '*', after: '*' } },
  { label: '`',  title: 'Code',      action: { type: 'wrap', before: '`', after: '`' } },
  { label: '•',  title: 'Bullet',    action: { type: 'prefix', prefix: '- ' } },
  { label: '☐',  title: 'Checklist', action: { type: 'prefix', prefix: '- [ ] ' } },
  { label: '─',  title: 'Divider',   action: { type: 'insert', text: '\n---\n' } },
]

export function NoteEditor({ isOpen, value, onChange, onClose, taskTitle }: Props) {
  const [mode, setMode]     = useState<'edit' | 'preview'>('edit')
  const [draft, setDraft]   = useState(value)
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

  // Sync draft when opened
  useEffect(() => {
    if (isOpen) {
      setDraft(value)
      setMode('edit')
    }
  }, [isOpen, value])

  // Propagate changes up
  useEffect(() => {
    if (isOpen) onChange(draft)
  }, [draft])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toolbar action ────────────────────────────────────────────────────────
  const applyAction = useCallback((action: ToolAction) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const text  = draft

    let next = text
    let newStart = start
    let newEnd   = end

    if (action.type === 'wrap') {
      const selected = text.slice(start, end)
      const inserted = action.before + (selected || 'text') + action.after
      next = text.slice(0, start) + inserted + text.slice(end)
      newStart = start + action.before.length
      newEnd   = newStart + (selected || 'text').length
    } else if (action.type === 'prefix') {
      // Apply to each selected line
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const lineEnd   = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end)
      const block = text.slice(lineStart, lineEnd)
      const toggled = block.startsWith(action.prefix)
        ? block.replace(new RegExp('^' + action.prefix.replace(/[[\]()]/g, '\\$&'), 'm'), '')
        : block.split('\n').map(l => l === '' ? l : action.prefix + l).join('\n')
      next = text.slice(0, lineStart) + toggled + text.slice(lineEnd)
      newStart = lineStart
      newEnd   = lineStart + toggled.length
    } else if (action.type === 'insert') {
      next = text.slice(0, start) + action.text + text.slice(end)
      newStart = newEnd = start + action.text.length
    }

    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newStart, newEnd)
    })
  }, [draft])

  // ── Smart Enter key ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    if (e.key === 'Enter') {
      const pos = ta.selectionStart
      const text = draft
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1
      const currentLine = text.slice(lineStart, pos)

      // Continue checklist
      const clm = currentLine.match(/^(\s*)- \[([ x])\] /)
      if (clm) {
        e.preventDefault()
        const indent = clm[1]
        const insert = `\n${indent}- [ ] `
        setDraft(d => d.slice(0, pos) + insert + d.slice(pos))
        requestAnimationFrame(() => ta.setSelectionRange(pos + insert.length, pos + insert.length))
        return
      }
      // Continue bullet
      const bm = currentLine.match(/^(\s*)[-*+] /)
      if (bm) {
        e.preventDefault()
        const indent = bm[1]
        const insert = `\n${indent}- `
        setDraft(d => d.slice(0, pos) + insert + d.slice(pos))
        requestAnimationFrame(() => ta.setSelectionRange(pos + insert.length, pos + insert.length))
        return
      }
    }
    // Tab → indent
    if (e.key === 'Tab') {
      e.preventDefault()
      const pos = ta.selectionStart
      const insert = '  '
      setDraft(d => d.slice(0, pos) + insert + d.slice(pos))
      requestAnimationFrame(() => ta.setSelectionRange(pos + 2, pos + 2))
    }
  }, [draft])

  // ── Checklist toggle from preview ─────────────────────────────────────────
  const handleCheckToggle = useCallback((lineIdx: number, checked: boolean) => {
    const lines = draft.split('\n')
    lines[lineIdx] = lines[lineIdx]
      .replace(/- \[[ xX]\]/, checked ? '- [x]' : '- [ ]')
    setDraft(lines.join('\n'))
  }, [draft])

  if (!isOpen) return null

  return createPortal(
    <div className={`note-editor-overlay${isOpen ? ' open' : ''}`}>
      {/* Header */}
      <div className="note-editor-header">
        <button className="note-editor-back" onClick={onClose} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="note-editor-title">{taskTitle ? `Note · ${taskTitle}` : 'Note'}</div>
        <div className="note-mode-toggle">
          <button
            className={`note-mode-btn${mode === 'edit' ? ' active' : ''}`}
            onClick={() => setMode('edit')}
          >Edit</button>
          <button
            className={`note-mode-btn${mode === 'preview' ? ' active' : ''}`}
            onClick={() => setMode('preview')}
          >Preview</button>
        </div>
      </div>

      {/* Toolbar — only in edit mode */}
      {mode === 'edit' && (
        <div className="note-toolbar">
          {TOOLBAR.map((t) => (
            <button
              key={t.label}
              className="note-tool-btn"
              title={t.title}
              onMouseDown={(e) => { e.preventDefault(); applyAction(t.action) }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="note-editor-body">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="note-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'# Heading\n\n- bullet point\n- [ ] checklist item\n\n---\n\nWrite your note here…'}
            spellCheck
            autoFocus
          />
        ) : (
          <div className="note-preview">
            {draft.trim()
              ? renderMarkdown(draft, handleCheckToggle)
              : <span className="note-preview-empty">Nothing to preview yet.</span>
            }
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
