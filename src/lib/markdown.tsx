import React from 'react'

// ─── Inline renderer ─────────────────────────────────────────────────────────

function renderInline(text: string, key?: string | number): React.ReactNode {
  // Bold + Italic: **...** / *...*
  const parts: React.ReactNode[] = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}><em>{m[2]}</em></strong>)
    else if (m[3]) parts.push(<strong key={m.index}>{m[3]}</strong>)
    else if (m[4]) parts.push(<em key={m.index}>{m[4]}</em>)
    else if (m[5]) parts.push(<code key={m.index} className="md-inline-code">{m[5]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <React.Fragment key={key}>{parts}</React.Fragment>
}

// ─── Block renderer ───────────────────────────────────────────────────────────

export function renderMarkdown(
  md: string,
  onCheckToggle?: (lineIndex: number, checked: boolean) => void
): React.ReactNode[] {
  const lines = md.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      nodes.push(<hr key={i} className="md-hr" />)
      i++; continue
    }

    // Headings
    const hm = line.match(/^(#{1,3})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      nodes.push(<Tag key={i} className={`md-h${level}`}>{renderInline(hm[2])}</Tag>)
      i++; continue
    }

    // Collect consecutive list items (bullets / checklists)
    const listItems: React.ReactNode[] = []
    while (i < lines.length) {
      const l = lines[i]

      // Checklist: - [ ] or - [x]
      const clm = l.match(/^(\s*)- \[([ xX])\] (.*)$/)
      if (clm) {
        const checked = clm[2].toLowerCase() === 'x'
        const lineIdx = i
        listItems.push(
          <li key={i} className="md-check-item" data-checked={checked}>
            <span
              className={`md-checkbox${checked ? ' checked' : ''}`}
              role="checkbox"
              aria-checked={checked}
              onClick={() => onCheckToggle?.(lineIdx, !checked)}
            >
              {checked ? '✓' : ''}
            </span>
            <span className={checked ? 'md-check-done' : ''}>{renderInline(clm[3], i)}</span>
          </li>
        )
        i++; continue
      }

      // Bullet: - item or * item
      const bm = l.match(/^(\s*)[-*+]\s+(.+)$/)
      if (bm) {
        listItems.push(<li key={i} className="md-bullet">{renderInline(bm[2], i)}</li>)
        i++; continue
      }

      break
    }

    if (listItems.length > 0) {
      nodes.push(<ul key={`ul-${i}`} className="md-list">{listItems}</ul>)
      continue
    }

    // Blank line → skip
    if (line.trim() === '') { i++; continue }

    // Paragraph
    nodes.push(<p key={i} className="md-p">{renderInline(line)}</p>)
    i++
  }

  return nodes
}
