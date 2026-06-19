import type { Task } from '../types'

export interface PostgresHealth {
  ok: boolean
  storage: 'postgres' | 'firebase'
  postgres: boolean
}

const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function apiUrl(path: string): string {
  return `${API_ROOT}${path}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `${response.status} ${response.statusText}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function getPostgresHealth(): Promise<PostgresHealth> {
  return request<PostgresHealth>('/api/health')
}

export async function listPostgresTasks(uid: string, listId: string | null): Promise<Task[]> {
  const params = new URLSearchParams({ uid })
  if (listId) params.set('listId', listId)
  const result = await request<{ tasks: Task[] }>(`/api/tasks?${params.toString()}`)
  return result.tasks
}

export async function createPostgresTask(uid: string, task: Omit<Task, 'id'>): Promise<Task> {
  const result = await request<{ task: Task }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ uid, task }),
  })
  return result.task
}

export async function updatePostgresTask(
  uid: string,
  taskId: string,
  patch: Partial<Task>,
): Promise<Task> {
  const result = await request<{ task: Task }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ uid, patch }),
  })
  return result.task
}

export async function deletePostgresTask(uid: string, taskId: string): Promise<void> {
  await request<void>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ uid }),
  })
}
