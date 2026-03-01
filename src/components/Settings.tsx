import { useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import type { AppSettings } from '../types'
import { BUILTIN_LIST_IDS } from '../types'
import { saveSettings } from '../lib/firestore'
import { useNotifications } from '../hooks/useNotifications'

const DEFAULT_ACTIVE_LISTS = [...BUILTIN_LIST_IDS]

interface Props {
  isOpen: boolean
  onClose: () => void
  user: User | null
  settings: AppSettings
  onSignInWithGoogle: () => void
  onSignOut: () => void
  onThemeToggle: () => void
}

export function Settings({ isOpen, onClose, user, settings, onSignInWithGoogle, onSignOut, onThemeToggle }: Props) {
  const { permission, requestPermission } = useNotifications(user?.uid ?? null)
  const [reminderTime, setReminderTime] = useState(settings.reminderLeadTime ?? 15)
  const [activeLists, setActiveLists]   = useState<string[]>(settings.activeLists ?? DEFAULT_ACTIVE_LISTS)
  const [newListName, setNewListName]   = useState('')

  useEffect(() => { setReminderTime(settings.reminderLeadTime ?? 15) }, [settings.reminderLeadTime])
  useEffect(() => { setActiveLists(settings.activeLists ?? DEFAULT_ACTIVE_LISTS) }, [settings.activeLists])

  const handleReminderChange = async (mins: number) => {
    setReminderTime(mins)
    if (!user) return
    try { await saveSettings(user.uid, { reminderLeadTime: mins }) }
    catch (e) { console.error('Failed to save reminder setting', e) }
  }

  const saveActiveLists = async (lists: string[]) => {
    setActiveLists(lists)
    if (!user) return
    try { await saveSettings(user.uid, { activeLists: lists }) }
    catch (e) { console.error('Failed to save lists', e) }
  }

  const handleRemoveList = (id: string) => {
    saveActiveLists(activeLists.filter((l) => l !== id))
  }

  const handleAddList = () => {
    const name = newListName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || activeLists.includes(name)) return
    setNewListName('')
    saveActiveLists([...activeLists, name])
  }

  return (
    <div className={`settings-overlay${isOpen ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <div className="settings-title">Settings</div>

        {/* Account */}
        <div className="settings-section">
          <div className="settings-label">Account</div>
          {user?.isAnonymous !== false ? (
            <div>
              <div className="settings-row">
                <span className="settings-row-label">Signed in as guest</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="settings-btn" onClick={onSignInWithGoogle}>
                  Sign in with Google →
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Redirects to Google — tasks sync across devices
              </div>
            </div>
          ) : (
            <div>
              <div className="settings-row">
                <span className="settings-row-label">{user?.email || 'Google account'}</span>
                <span style={{ fontSize: 11, color: 'var(--success)' }}>● synced</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="settings-btn"
                  style={{ color: '#e07070', borderColor: 'rgba(220,80,80,0.3)' }}
                  onClick={() => { onSignOut(); onClose() }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="settings-section">
          <div className="settings-label">Lists</div>
          <div className="settings-lists">
            {activeLists.map((id) => (
              <div key={id} className="settings-list-row">
                <span className="settings-list-name">{id}</span>
                <button
                  className="settings-list-remove"
                  onClick={() => handleRemoveList(id)}
                  title={`Remove ${id}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="settings-list-add">
            <input
              className="settings-list-input"
              placeholder="New list name…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
              maxLength={24}
            />
            <button className="settings-btn" style={{ width: 'auto', padding: '5px 14px' }} onClick={handleAddList}>
              + Add
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-label">Appearance</div>
          <div className="settings-row">
            <span className="settings-row-label">Dark mode</span>
            <button
              className={`toggle${settings.theme === 'dark' ? ' on' : ''}`}
              onClick={onThemeToggle}
              aria-label="Toggle dark mode"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <div className="settings-label">Notifications</div>
          <div className="settings-row">
            <span className="settings-row-label">Push notifications</span>
            {permission === 'granted' ? (
              <span style={{ fontSize: 11, color: 'var(--success)' }}>enabled</span>
            ) : (
              <button className="settings-btn" style={{ width: 'auto', padding: '4px 12px' }} onClick={requestPermission}>
                Enable
              </button>
            )}
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Default remind me</span>
            <select
              className="settings-select"
              value={reminderTime}
              onChange={(e) => handleReminderChange(Number(e.target.value))}
            >
              <option value={5}>5 min before</option>
              <option value={15}>15 min before</option>
              <option value={30}>30 min before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
        </div>

        {/* About */}
        <div className="settings-section">
          <div className="settings-label">About</div>
          <div className="settings-row">
            <span className="settings-row-label">Folio</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>v0.2.0</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Personal task manager. Offline-first.<br/>No ads. No tracking. No noise.
          </div>
        </div>
      </div>
    </div>
  )
}
