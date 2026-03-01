import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: Date | null
  onChange: (d: Date | null) => void
  onClose: () => void
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function DateTimePicker({ value, onChange, onClose }: Props) {
  const now = value ?? new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selDay, setSelDay]       = useState<number | null>(value ? value.getDate() : null)
  const [hour, setHour]           = useState(value ? value.getHours() : 9)
  const [minute, setMinute]       = useState(value ? Math.floor(value.getMinutes() / 5) * 5 : 0)
  const [tab, setTab]             = useState<'date' | 'time'>('date')

  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = daysInMonth(viewYear, viewMonth)
  const today = new Date()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (d: number) => {
    setSelDay(d)
    setTab('time')
  }

  const handleConfirm = () => {
    if (selDay === null) { onChange(null); onClose(); return }
    const d = new Date(viewYear, viewMonth, selDay, hour, minute, 0, 0)
    onChange(d)
    onClose()
  }

  const handleClear = () => { onChange(null); onClose() }

  const isSelected = (d: number) =>
    selDay === d && viewYear === (value?.getFullYear() ?? -1) &&
    viewMonth === (value?.getMonth() ?? -1)

  const isToday = (d: number) =>
    d === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear()

  // Build cells: blanks + day numbers
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let i = 1; i <= totalDays; i++) cells.push(i)

  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const MINS  = Array.from({ length: 12 }, (_, i) => i * 5)

  const selLabel = selDay
    ? `${MONTHS[viewMonth]} ${selDay}, ${viewYear}  ${pad(hour)}:${pad(minute)}`
    : 'No date'

  return createPortal(
    <div className="dtp-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dtp-panel" ref={ref}>

        {/* Tabs */}
        <div className="dtp-tabs">
          <button className={`dtp-tab${tab === 'date' ? ' active' : ''}`} onClick={() => setTab('date')}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Date
          </button>
          <button className={`dtp-tab${tab === 'time' ? ' active' : ''}`} onClick={() => setTab('time')}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Time
          </button>
        </div>

        {tab === 'date' && (
          <div className="dtp-calendar">
            {/* Month nav */}
            <div className="dtp-month-nav">
              <button className="dtp-nav-btn" onClick={prevMonth}>‹</button>
              <span className="dtp-month-label">{MONTHS[viewMonth]} {viewYear}</span>
              <button className="dtp-nav-btn" onClick={nextMonth}>›</button>
            </div>

            {/* Day-of-week headers */}
            <div className="dtp-dow-row">
              {DAYS.map(d => <div key={d} className="dtp-dow">{d}</div>)}
            </div>

            {/* Day grid */}
            <div className="dtp-grid">
              {cells.map((d, i) => (
                <button
                  key={i}
                  className={`dtp-day${d === null ? ' empty' : ''}${d !== null && isToday(d) ? ' today' : ''}${d !== null && d === selDay && viewYear === (value?.getFullYear() ?? viewYear) && viewMonth === (value?.getMonth() ?? viewMonth) ? ' selected' : ''}${d !== null && d === selDay ? ' sel' : ''}`}
                  onClick={() => d !== null && selectDay(d)}
                  disabled={d === null}
                >
                  {d ?? ''}
                </button>
              ))}
            </div>

            {/* Quick buttons */}
            <div className="dtp-quick-row">
              {[
                { label: 'Today', fn: () => { const t = new Date(); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()); setSelDay(t.getDate()); setTab('time') } },
                { label: 'Tomorrow', fn: () => { const t = new Date(); t.setDate(t.getDate()+1); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()); setSelDay(t.getDate()); setTab('time') } },
                { label: 'Weekend', fn: () => { const t = new Date(); const d=t.getDay(); t.setDate(t.getDate()+(6-d+7)%7||7); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()); setSelDay(t.getDate()); setTab('time') } },
              ].map(({ label, fn }) => (
                <button key={label} className="dtp-quick" onClick={fn}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {tab === 'time' && (
          <div className="dtp-time">
            <div className="dtp-time-label">
              {selDay ? `${MONTHS[viewMonth]} ${selDay}` : 'Pick a date first'}
            </div>
            <div className="dtp-time-row">
              {/* Hour scroll */}
              <div className="dtp-time-col">
                <div className="dtp-time-col-label">Hour</div>
                <div className="dtp-scroll-list">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      className={`dtp-scroll-item${h === hour ? ' sel' : ''}`}
                      onClick={() => setHour(h)}
                    >
                      {pad(h)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dtp-time-sep">:</div>
              {/* Minute scroll */}
              <div className="dtp-time-col">
                <div className="dtp-time-col-label">Min</div>
                <div className="dtp-scroll-list">
                  {MINS.map(m => (
                    <button
                      key={m}
                      className={`dtp-scroll-item${m === minute ? ' sel' : ''}`}
                      onClick={() => setMinute(m)}
                    >
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="dtp-time-display">{pad(hour)}:{pad(minute)}</div>
          </div>
        )}

        {/* Footer */}
        <div className="dtp-footer">
          <div className="dtp-sel-label">{selLabel}</div>
          <div className="dtp-footer-btns">
            <button className="dtp-btn-clear" onClick={handleClear}>Clear</button>
            <button className="dtp-btn-confirm" onClick={handleConfirm} disabled={selDay === null}>Set</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
