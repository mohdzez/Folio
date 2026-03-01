export type ListId = string

// Built-in list IDs — always exist; 'personal'/'work'/'errands' are removable
export const BUILTIN_LIST_IDS = ['personal', 'work', 'errands'] as const
export const TODAY_LIST_ID = 'today'

export interface Task {
  id: string
  text: string
  listId: string
  done: boolean
  starred: boolean
  dueDate?: number // unix ms
  reminderLeadTime?: number // minutes before due (overrides global setting)
  reminderAt?: number // absolute reminder timestamp (overrides reminderLeadTime)
  recurring?: 'daily' | 'weekly' | null
  subtasks?: SubTask[]
  note?: string
  snoozedUntil?: number // unix ms — task hidden until this time
  createdAt: number
  updatedAt: number
  notifiedAt?: number
}

export interface SubTask {
  id: string
  text: string
  done: boolean
}

export type FilterView = 'all' | 'today' | 'upcoming' | 'overdue'

export interface AppSettings {
  theme: 'dark' | 'light'
  reminderLeadTime: number
  fcmToken?: string
  activeLists?: string[] // ordered list IDs shown in ListSwitcher (excludes 'today')
}
