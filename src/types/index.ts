export type ListId = 'personal' | 'work' | 'errands' | 'today'

export interface Task {
  id: string
  text: string
  listId: Exclude<ListId, 'today'>
  done: boolean
  starred: boolean
  dueDate?: number // unix ms
  recurring?: 'daily' | 'weekly' | null
  subtasks?: SubTask[]
  note?: string
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
  reminderLeadTime: number // minutes before due
  fcmToken?: string
}
