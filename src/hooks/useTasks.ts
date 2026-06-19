import { useState, useEffect, useCallback } from 'react'
import type { Task, FilterView } from '../types'
import {
  subscribeTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../lib/firestore'
import {
  createPostgresTask,
  deletePostgresTask,
  getPostgresHealth,
  listPostgresTasks,
  updatePostgresTask,
} from '../lib/postgresApi'
import { isToday, isOverdue, isUpcoming } from '../lib/parseDate'
import type { StorageBackend } from '../types'

const QUEUE_KEY = 'folio_offline_queue'
const CACHE_PREFIX = 'folio_tasks_cache'

function cacheKey(uid: string, listId: string): string {
  return `${CACHE_PREFIX}:${uid}:${listId}`
}

function readTaskCache(uid: string, listId: string): Task[] {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(uid, listId)) || '[]') as Task[]
  } catch {
    return []
  }
}

function writeTaskCache(uid: string, listId: string, tasks: Task[]): void {
  localStorage.setItem(cacheKey(uid, listId), JSON.stringify(tasks))
}

export function useTasks(uid: string | null, listId: string, filter: FilterView, onError?: (msg: string) => void) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [backend, setBackend] = useState<StorageBackend>('checking')

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    let cancelled = false
    setLoading(true)

    getPostgresHealth()
      .then((health) => {
        if (cancelled) return
        setBackend(health.postgres ? 'postgres' : 'firestore')
      })
      .catch(() => {
        if (!cancelled) setBackend('firestore')
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    if (!uid || backend === 'checking') return

    if (backend === 'postgres') {
      let cancelled = false
      const queryListId = listId === 'today' ? null : listId
      const cacheListId = queryListId ?? 'all'

      const load = async () => {
        try {
          const nextTasks = await listPostgresTasks(uid, queryListId)
          if (cancelled) return
          setTasks(nextTasks)
          writeTaskCache(uid, cacheListId, nextTasks)
          setLoading(false)
        } catch (e: any) {
          if (cancelled) return
          console.error('Postgres task load failed:', e)
          const cached = readTaskCache(uid, cacheListId)
          if (cached.length > 0) setTasks(cached)
          onError?.(`Postgres sync error: ${e?.message ?? 'offline'}`)
          setLoading(false)
        }
      }

      setLoading(true)
      void load()
      const interval = window.setInterval(load, 15000)
      return () => {
        cancelled = true
        window.clearInterval(interval)
      }
    }

    const unsub = subscribeTasks(
      uid,
      listId === 'today' ? null : listId,
      (t) => { setTasks(t); setLoading(false) },
      (err) => {
        console.error('Firestore subscription error:', err)
        onError?.(`Sync error: ${err.code ?? err.message}`)
        setLoading(false)
      }
    )
    // Fallback: if Firestore never responds (offline, error), stop loading after 5s
    const timeout = setTimeout(() => setLoading(false), 5000)
    return () => { unsub(); clearTimeout(timeout) }
  }, [uid, listId, backend])

  const filteredTasks = tasks.filter((t) => {
    if (t.done) return false
    if (filter === 'today')    return !!(t.dueDate && isToday(t.dueDate))
    if (filter === 'overdue')  return !!(t.dueDate && isOverdue(t.dueDate))
    if (filter === 'upcoming') return !!(t.dueDate && isUpcoming(t.dueDate))
    // 'all' — show everything in the current list subscription
    return true
  })

  const addTask = useCallback(
    async (task: Omit<Task, 'id'>) => {
      if (!uid) return
      const tempId = `temp_${Date.now()}`
      setTasks((prev) => [{ ...task, id: tempId }, ...prev])
      try {
        if (backend === 'postgres') {
          const created = await createPostgresTask(uid, task)
          setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)))
        } else {
          const id = await createTask(uid, task)
          setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id } : t)))
        }
      } catch (e: any) {
        console.error('Failed to save task:', e)
        onError?.(`Save failed: ${e?.code ?? e?.message ?? 'unknown error'}`)
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
        queue.push({ backend, task })
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
      }
    },
    [uid, backend]
  )

  const toggleDone = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const nextDone = !task.done
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t)))
      if (backend === 'postgres') {
        await updatePostgresTask(uid, taskId, { done: nextDone })
      } else {
        await updateTask(uid, taskId, { done: nextDone })
      }

      // If completing a recurring task, auto-create the next occurrence
      if (nextDone && task.recurring && task.dueDate) {
        const nextDue = new Date(task.dueDate)
        if (task.recurring === 'daily')  nextDue.setDate(nextDue.getDate() + 1)
        if (task.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
        const { id: _id, ...rest } = task
        const nextTask = {
          ...rest,
          done: false,
          dueDate: nextDue.getTime(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        if (backend === 'postgres') void createPostgresTask(uid, nextTask)
        else void createTask(uid, nextTask)
      }
    },
    [uid, tasks, backend]
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (backend === 'postgres') await deletePostgresTask(uid, taskId)
      else await deleteTask(uid, taskId)
    },
    [uid, backend]
  )

  const toggleStar = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const starred = !task.starred
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, starred } : t)))
      if (backend === 'postgres') await updatePostgresTask(uid, taskId, { starred })
      else await updateTask(uid, taskId, { starred })
    },
    [uid, tasks, backend]
  )

  const snoozeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return
      const snoozeUntil = Date.now() + 60 * 60 * 1000 // +1 hour
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, dueDate: snoozeUntil } : t))
      )
      const patch = { dueDate: snoozeUntil, snoozedUntil: snoozeUntil }
      if (backend === 'postgres') await updatePostgresTask(uid, taskId, patch)
      else await updateTask(uid, taskId, patch)
    },
    [uid, backend]
  )

  const patchTask = useCallback(
    async (taskId: string, patch: Partial<Task>) => {
      if (!uid) return
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
      if (backend === 'postgres') await updatePostgresTask(uid, taskId, patch)
      else await updateTask(uid, taskId, patch)
    },
    [uid, backend]
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
    backend,
  }
}
