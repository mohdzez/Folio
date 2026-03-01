import * as chrono from 'chrono-node'

export interface ParsedTask {
  text: string
  dueDate: Date | null
}

export function parseTaskInput(raw: string): ParsedTask {
  const results = chrono.parse(raw)
  if (results.length === 0) return { text: raw.trim(), dueDate: null }

  const match = results[0]
  const dueDate = match.date()

  // Strip the date text from the task title
  const cleaned = (raw.slice(0, match.index) + raw.slice(match.index + match.text.length))
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { text: cleaned || raw.trim(), dueDate }
}

export function formatDue(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (taskDay.getTime() - today.getTime()) / 86_400_000

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (diff === 0) return `Today ${time}`
  if (diff === 1) return `Tomorrow ${time}`
  if (diff === -1) return `Yesterday ${time}`
  if (diff > 1 && diff < 7)
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`
}

export function isOverdue(ms: number): boolean {
  return ms < Date.now()
}

export function isToday(ms: number): boolean {
  const d = new Date(ms)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

export function isUpcoming(ms: number): boolean {
  return ms > Date.now() && !isToday(ms)
}
