import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Block model ─────────────────────────────────────────────────────────────

export type BlockType = 'para' | 'h1' | 'h2' | 'h3' | 'bullet' | 'check' | 'check-done' | 'hr'

export interface Block {
  id: string
  type: BlockType
  content: string // plain text, no markdown prefixes
}

let _uid = 0
function uid() { return `b${++_uid}` }

// ─── Markdown ↔ Blocks ───────────────────────────────────────────────────────

export function mdToBlocks(md: string): Block[] {
  if (!md.trim()) return [{ id: uid(), type: 'para', content: '' }]
  const blocks: Block[] = []
  for (const line of md.split('\n')) {
    if (/^---+$/.test(line.trim())) { blocks.push({ id: uid(), type: 'hr', content: '' }); continue }
    const h3 = line.match(/^### (.*)$/); if (h3) { blocks.push({ id: uid(), type: 'h3', content: h3[1] }); continue }
    const h2 = line.match(/^## (.*)$/);  if (h2) { blocks.push({ id: uid(), type: 'h2', content: h2[1] }); continue }
    const h1 = line.match(/^# (.*)$/);   if (h1) { blocks.push({ id: uid(), type: 'h1', content: h1[1] }); continue }
    const cx = line.match(/^- \[x\] (.*)$/i); if (cx) { blocks.push({ id: uid(), type: 'check-done', content: cx[1] }); continue }
    const co = line.match(/^- \[ \] (.*)$/);   if (co) { blocks.push({ id: uid(), type: 'check', content: co[1] }); continue }
    const bl = line.match(/^[-*+] (.*)$/);      if (bl) { blocks.push({ id: uid(), type: 'bullet', content: bl[1] }); continue }
    blocks.push({ id: uid(), type: 'para', content: line })
  }
  return blocks.length ? blocks : [{ id: uid(), type: 'para', content: '' }]
}

export function blocksToMd(blocks: Block[]): string {
  return blocks.map(b => {
    if (b.type === 'h1')       return `# ${b.content}`
    if (b.type === 'h2')       return `## ${b.content}`
    if (b.type === 'h3')       return `### ${b.content}`
    if (b.type === 'bullet')   return `- ${b.content}`
    if (b.type === 'check')    return `- [ ] ${b.content}`
    if (b.type === 'check-done') return `- [x] ${b.content}`
    if (b.type === 'hr')       return '---'
    return b.content
  }).join('\n')
}

// ─── Block Editor Line ────────────────────────────────────────────────────────

interface LineProps {
  block: Block
  isFocused: boolean
  onChange: (id: string, content: string) => void
  onFocus: (id: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>, id: string) => void
  onCheckToggle: (id: string) => void
}

function BlockLine({ block, isFocused, onChange, onFocus, onKeyDown, onCheckToggle }: LineProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus()
    }
  }, [isFocused])

  if (block.type === 'hr') {
    return (
      <div
        className="ne-block ne-hr-wrap"
        tabIndex={0}
        onFocus={() => onFocus(block.id)}
      >
        <hr className="ne-hr" />
      </div>
    )
  }

  const isCheck = block.type === 'check' || block.type === 'check-done'
  const checked = block.type === 'check-done'

  return (
    <div className={`ne-block ne-block-${block.type}${isFocused ? ' focused' : ''}`}>
      {/* Bullet glyph */}
      {block.type === 'bullet' && <span className="ne-bullet-glyph">·</span>}

      {/* Checkbox */}
      {isCheck && (
        <span
          className={`ne-checkbox${checked ? ' checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onCheckToggle(block.id) }}
          role="checkbox"
          aria-checked={checked}
        >
          {checked ? '✓' : ''}
        </span>
      )}

      {/* Editable content */}
      <input
        ref={ref}
        type="text"
        className={`ne-input ne-input-${block.type}`}
        value={block.content}
        placeholder={
          block.type === 'h1' ? 'Heading 1' :
          block.type === 'h2' ? 'Heading 2' :
          block.type === 'h3' ? 'Heading 3' :
          block.type === 'bullet' ? 'List item' :
          isCheck ? 'To-do item' :
          'Write something…'
        }
        onChange={(e) => onChange(block.id, e.target.value)}
        onFocus={() => onFocus(block.id)}
        onKeyDown={(e) => onKeyDown(e, block.id)}
      />
    </div>
  )
}

// ─── NoteEditor ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  value: string
  onChange: (v: string) => void
  onClose: () => void
  taskTitle?: string
}

const BLOCK_TYPES: { label: string; type: BlockType; title: string }[] = [
  { label: 'H1', type: 'h1',        title: 'Heading 1' },
  { label: 'H2', type: 'h2',        title: 'Heading 2' },
  { label: 'H3', type: 'h3',        title: 'Heading 3' },
  { label: '•',  type: 'bullet',    title: 'Bullet list' },
  { label: '☐',  type: 'check',     title: 'Checklist' },
  { label: '─',  type: 'hr',        title: 'Divider' },
]

export function NoteEditor({ isOpen, value, onChange, onClose, taskTitle }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => mdToBlocks(value))
  const [focusId, setFocusId] = useState<string | null>(null)
  const nextFocusRef = useRef<string | null>(null)

  // Reset when opened with new value
  useEffect(() => {
    if (isOpen) setBlocks(mdToBlocks(value))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Propagate changes up as markdown
  const update = useCallback((next: Block[]) => {
    setBlocks(next)
    onChange(blocksToMd(next))
  }, [onChange])

  // ── Apply block type from toolbar ─────────────────────────────────────────
  const applyType = useCallback((type: BlockType) => {
    if (!focusId) {
      // No focus — append a new block
      const b: Block = { id: uid(), type, content: '' }
      setBlocks(prev => {
        const next = [...prev, b]
        onChange(blocksToMd(next))
        return next
      })
      nextFocusRef.current = b.id
      return
    }
    setBlocks(prev => {
      const next: Block[] = prev.map(b => {
        if (b.id !== focusId) return b
        if (type === 'hr') return { ...b, type }
        // Toggle: if already this type, revert to para
        if (b.type === type) return { ...b, type: 'para' as BlockType }
        return { ...b, type }
      })
      onChange(blocksToMd(next))
      return next
    })
  }, [focusId, onChange])

  // ── Input change ─────────────────────────────────────────────────────────
  const handleChange = useCallback((id: string, content: string) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, content } : b)
      onChange(blocksToMd(next))
      return next
    })
  }, [onChange])

  // ── Keyboard: Enter, Backspace ────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newBlock: Block = { id: uid(), type: 'para', content: '' }
      // If on a list/check block, new block continues that type
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === id)
        const cur = prev[idx]
        let nextType: BlockType = 'para'
        if (cur.type === 'bullet') nextType = 'bullet'
        if (cur.type === 'check' || cur.type === 'check-done') nextType = 'check'
        if (cur.type === 'h1' || cur.type === 'h2' || cur.type === 'h3') nextType = 'para'
        const nb: Block = { ...newBlock, type: nextType }
        const next = [...prev.slice(0, idx + 1), nb, ...prev.slice(idx + 1)]
        nextFocusRef.current = nb.id
        onChange(blocksToMd(next))
        return next
      })
    }
    if (e.key === 'Backspace') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === id)
        const cur = prev[idx]
        if (cur.content === '' && prev.length > 1) {
          e.preventDefault()
          const next = prev.filter(b => b.id !== id)
          nextFocusRef.current = prev[Math.max(0, idx - 1)].id
          onChange(blocksToMd(next))
          return next
        }
        return prev
      })
    }
  }, [onChange])

  // ── Checkbox toggle ───────────────────────────────────────────────────────
  const handleCheckToggle = useCallback((id: string) => {
    setBlocks(prev => {
      const next: Block[] = prev.map(b => {
        if (b.id !== id) return b
        return { ...b, type: (b.type === 'check' ? 'check-done' : 'check') as BlockType }
      })
      onChange(blocksToMd(next))
      return next
    })
  }, [onChange])

  // Apply deferred focus
  useEffect(() => {
    if (nextFocusRef.current) {
      setFocusId(nextFocusRef.current)
      nextFocusRef.current = null
    }
  }, [blocks])

  if (!isOpen) return null

  const focusedBlock = blocks.find(b => b.id === focusId)

  return createPortal(
    <div className="note-editor-overlay open">
      {/* Header */}
      <div className="note-editor-header">
        <button className="note-editor-back" onClick={onClose} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="note-editor-title">{taskTitle ? taskTitle : 'Note'}</div>
      </div>

      {/* Toolbar */}
      <div className="note-toolbar">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.type}
            className={`note-tool-btn${focusedBlock?.type === t.type ? ' active' : ''}`}
            title={t.title}
            onMouseDown={(e) => { e.preventDefault(); applyType(t.type) }}
            onTouchEnd={(e) => { e.preventDefault(); applyType(t.type) }}
          >
            {t.label}
          </button>
        ))}
        <span className="note-toolbar-hint">tap to apply style to current line</span>
      </div>

      {/* Block editor */}
      <div
        className="note-editor-body"
        onClick={(e) => {
          // Clicking empty area below blocks → focus last block
          if ((e.target as HTMLElement).classList.contains('note-editor-body')) {
            const last = blocks[blocks.length - 1]
            if (last) setFocusId(last.id)
          }
        }}
      >
        {blocks.map((block) => (
          <BlockLine
            key={block.id}
            block={block}
            isFocused={focusId === block.id}
            onChange={handleChange}
            onFocus={setFocusId}
            onKeyDown={handleKeyDown}
            onCheckToggle={handleCheckToggle}
          />
        ))}
        {/* Tap-target padding area */}
        <div style={{ minHeight: 120 }} onClick={() => {
          const last = blocks[blocks.length - 1]
          if (last?.type !== 'para' || last.content) {
            const nb: Block = { id: uid(), type: 'para', content: '' }
            setBlocks(prev => { const n = [...prev, nb]; onChange(blocksToMd(n)); return n })
            nextFocusRef.current = blocks[blocks.length - 1]?.id
          } else {
            setFocusId(last.id)
          }
        }} />
      </div>
    </div>,
    document.body
  )
}
