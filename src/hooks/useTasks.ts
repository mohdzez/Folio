import { useState, useEffect, useCallback } from 'react'
import type { Task, FilterView } from '../types'
import {
  subscribeTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../lib/firestore'
import { isToday, isOverdue, isUpcoming } from '../lib/parseDate'

const QUEUE_KEY = 'folio_offline_queue'

export function useTasks(uid: string | null, listId: string, filter: FilterView) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    const unsub = subscribeTasks(
      uid,
      listId === 'today' ? null : listId,
      (t) => { setTasks(t); setLoading(false) }
    )
    return unsub
  }, [uid, listId])

  const filteredTasks = tasks.filter((t) => {
    if (t.done) return false
    if (filter === 'today') return t.dueDate ? isToday(t.dueDate) : false
    if (filter === 'overdue') return t.dueDate ? isOverdue(t.dueDate) : false
    if (filter === 'upcoming') return t.dueDate ? isUpcoming(t.dueDate) : false
    if (listId === 'today') return t.dueDate ? isToday(t.dueDate) : false
    return true
  })

  const addTask = useCallback(
    async (task: Omit<Task, 'id'>) => {
      if (!uid) return
      const tempId = `temp_${Date.now()}`
      setTasks((prev) => [{ ...task, id: tempId }, ...prev])
      try {
        const id = await createTask(uid, task)
        setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id } : t)))
      } catch {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
        queue.push(task)
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
      }
    },
    [uid]
  )

  const toggleDone = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const nextDone = !task.done
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t)))
      await updateTask(uid, taskId, { done: nextDone })

      // If completing a recurring task, auto-create the next occurrence
      if (nextDone && task.recurring && task.dueDate) {
        const nextDue = new Date(task.dueDate)
        if (task.recurring === 'daily')  nextDue.setDate(nextDue.getDate() + 1)
        if (task.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
        const { id: _id, ...rest } = task
        void createTask(uid, {
          ...rest,
          done: false,
          dueDate: nextDue.getTime(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    },
    [uid, tasks]
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      await deleteTask(uid, taskId)
    },
    [uid]
  )

  const toggleStar = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      await updateTask(uid, taskId, { starred: !task.starred })
    },
    [uid, tasks]
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const snoozeUntil = Date.now() + 60 * 60 * 1000 // +1 hour
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, dueDate: snoozeUntil } : t))
      )
      await updateTask(uid, taskId, { dueDate: snoozeUntil, snoozedUntil: snoozeUntil })
    },
    [uid]
  )

  const patchTask = useCallback(
    async (taskId: string, patch: Partial<Task>) => {
      if (!uid) return
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
      await updateTask(uid, taskId, patch)
    },
    [uid]
  )

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    addTask,
    toggleDone,
    removeTask,
    toggleStar,
    snoozeTask,
    patchTask,
  }
}
