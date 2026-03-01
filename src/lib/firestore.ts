import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Task, AppSettings } from '../types'

// ── Tasks ──────────────────────────────────────────────────────────────────

export function subscribeTasks(
  uid: string,
  listId: string | null,
  callback: (tasks: Task[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const ref = collection(db, 'users', uid, 'tasks')
  const q =
    listId && listId !== 'today'
      ? query(ref, where('listId', '==', listId), orderBy('createdAt', 'desc'))
      : query(ref, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
      callback(tasks)
    },
    (error) => {
      console.error('Firestore tasks subscription error:', error)
      onError?.(error)
    }
  )
}

// Strip undefined values — Firestore throws invalid-argument on undefined fields
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}

export async function createTask(uid: string, task: Omit<Task, 'id'>): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'tasks'))
  await setDoc(ref, clean({ ...task, createdAt: Date.now(), updatedAt: Date.now() }))
  return ref.id
}

export async function updateTask(uid: string, taskId: string, patch: Partial<Task>): Promise<void> {
  const ref = doc(db, 'users', uid, 'tasks', taskId)
  await updateDoc(ref, clean({ ...patch, updatedAt: serverTimestamp() }) as any)
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'tasks', taskId))
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function saveSettings(uid: string, settings: Partial<AppSettings>): Promise<void> {
  const ref = doc(db, 'users', uid, 'meta', 'settings')
  await setDoc(ref, settings, { merge: true })
}

export function subscribeSettings(
  uid: string,
  callback: (s: AppSettings) => void
): Unsubscribe {
  const ref = doc(db, 'users', uid, 'meta', 'settings')
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback(snap.data() as AppSettings)
  })
}
