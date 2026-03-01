import * as chrono from 'chrono-node'

export interface ParsedTask {
  text: string
  dueDate: Date | null
  reminderLeadTime: number | null // minutes before due
}

// Patterns for "remind me X before" type phrases
const REMINDER_PATTERNS: Array<{ re: RegExp; minutes: number }> = [
  { re: /\b(remind\s+me\s+)?(\d+)\s*min(ute)?s?\s+before\b/i, minutes: -1 }, // dynamic
  { re: /\b(remind\s+me\s+)?(\d+)\s*hour?s?\s+before\b/i, minutes: -2 },     // dynamic hours
  { re: /\bremind\s+me\s+(\d+)\s*min(ute)?s?\b/i, minutes: -1 },
  { re: /\bremind\s+me\s+(\d+)\s*hour?s?\b/i, minutes: -2 },
  { re: /\b(\d+)\s*min(ute)?\s+(reminder|alert|notify|notification)\b/i, minutes: -1 },
  { re: /\b(\d+)\s*hour?\s+(reminder|alert|notify|notification)\b/i, minutes: -2 },
  // Fixed shorthands
  { re: /\b(remind\s+me\s+)?(1\s*day|day)\s+before\b/i, minutes: 1440 },
  { re: /\b(remind\s+me\s+)?(1\s*hour?|an?\s*hour?)\s+before\b/i, minutes: 60 },
  { re: /\b(remind\s+me\s+)?30\s*min(ute)?s?\s+before\b/i, minutes: 30 },
  { re: /\b(remind\s+me\s+)?15\s*min(ute)?s?\s+before\b/i, minutes: 15 },
]

function extractReminder(raw: string): { text: string; reminderLeadTime: number | null } {
  for (const { re, minutes } of REMINDER_PATTERNS) {
    const m = raw.match(re)
    if (!m) continue

    let lead = minutes
    if (minutes === -1) {
      // Extract dynamic minutes value
      const numMatch = m[0].match(/(\d+)\s*min/)
      lead = numMatch ? parseInt(numMatch[1]) : 15
    } else if (minutes === -2) {
      // Extract dynamic hours value
      const numMatch = m[0].match(/(\d+)\s*hour/)
      lead = numMatch ? parseInt(numMatch[1]) * 60 : 60
    }

    const cleaned = raw.replace(m[0], '').replace(/\s{2,}/g, ' ').trim()
    return { text: cleaned, reminderLeadTime: lead }
  }
  return { text: raw, reminderLeadTime: null }
}

export function parseTaskInput(raw: string): ParsedTask {
  // First strip reminder phrases
  const { text: afterReminder, reminderLeadTime } = extractReminder(raw)

  // Then parse dates from the remainder
  const results = chrono.parse(afterReminder)
  if (results.length === 0) return { text: afterReminder.trim(), dueDate: null, reminderLeadTime }

  const match = results[0]
  const dueDate = match.date()
  const cleaned = (afterReminder.slice(0, match.index) + afterReminder.slice(match.index + match.text.length))
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { text: cleaned || afterReminder.trim(), dueDate, reminderLeadTime }
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
