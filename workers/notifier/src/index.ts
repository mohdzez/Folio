/**
 * Folio Notification Worker — FCM v1 API via service account JWT
 *
 * Stores task reminders in KV, fires them via FCM HTTP v1 on a cron every minute.
 *
 * Required secrets:
 *   FIREBASE_CLIENT_EMAIL  — service account email
 *   FIREBASE_PRIVATE_KEY   — RSA private key PEM (-----BEGIN PRIVATE KEY-----)
 *   FIREBASE_PROJECT_ID    — e.g. folio-munimx
 *   API_KEY                — shared secret (VITE_WORKER_API_KEY in PWA)
 */

export interface Env {
  FOLIO_KV: KVNamespace
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  FIREBASE_PROJECT_ID: string
  API_KEY: string
}

interface StoredTask {
  title: string
  notifyAt: number
  fcmToken: string
}

const ALLOWED_ORIGINS = [
  'https://munimx.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function b64u(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof data === 'string') bytes = new TextEncoder().encode(data)
  else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data)
  else bytes = data
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

// Cache the OAuth2 token in KV so it survives across stateless Worker invocations.
// NOTE: KV has eventual consistency (~60s propagation). The token read is placed
// AFTER the task list check so we never touch the token unless there are due tasks.
// When the app is unused (empty KV), the cron only does 1 list read/tick and returns.
const TOKEN_KV_KEY = '_oauth_token'

async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Try KV cache — may miss due to eventual consistency, that's acceptable
  const cached = await env.FOLIO_KV.get(TOKEN_KV_KEY, 'json') as { token: string; exp: number } | null
  if (cached && now < cached.exp - 60) return cached.token

  // Cache miss — sign a new JWT and exchange for OAuth2 access token
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64u(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }))

  const signingInput = `${header}.${claims}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBuffer(env.FIREBASE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${b64u(sig)}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  if (!resp.ok) throw new Error(`OAuth2 error: ${await resp.text()}`)

  const { access_token, expires_in } = await resp.json() as { access_token: string; expires_in: number }

  // Best-effort cache: write may not be visible to next invocation (KV eventual consistency)
  // but that's fine — we only reach here when there are due tasks, so extra writes are rare
  await env.FOLIO_KV.put(TOKEN_KV_KEY, JSON.stringify({ token: access_token, exp: now + expires_in }), {
    expirationTtl: expires_in - 60,
  })

  return access_token
}

async function sendFCM(env: Env, fcmToken: string, title: string, body: string): Promise<'ok' | 'invalid' | 'error'> {
  try {
    const token = await getAccessToken(env)
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            webpush: {
              notification: {
                title, body,
                icon: 'https://munimx.github.io/Folio/pwa-192x192.png',
                badge: 'https://munimx.github.io/Folio/pwa-192x192.png',
                requireInteraction: true,
              },
              fcm_options: { link: 'https://munimx.github.io/Folio/' },
            },
          },
        }),
      }
    )
    if (resp.ok) return 'ok'
    const text = await resp.text()
    console.error('FCM v1 error:', text)
    if (text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) return 'invalid'
    return 'error'
  } catch (e) {
    console.error('FCM send exception:', e)
    return 'error'
  }
}

async function firedue(env: Env): Promise<void> {
  const now = Date.now()

  // 1 KV list read — the ONLY operation when no tasks are scheduled.
  // If this returns empty (app unused), we return immediately with zero
  // token reads or writes. This is the fix for the KV write limit exhaustion:
  // the OAuth token was being read/written every cron tick even when idle.
  const { keys } = await env.FOLIO_KV.list({ prefix: 'task:' })
  if (keys.length === 0) return

  // Read all task payloads, find due ones
  const entries = await Promise.all(
    keys.map(async (key) => {
      const raw = await env.FOLIO_KV.get(key.name)
      if (!raw) return null
      return { key: key.name, task: JSON.parse(raw) as StoredTask }
    })
  )
  const due = entries.filter((e): e is { key: string; task: StoredTask } =>
    e !== null && e.task.notifyAt <= now
  )

  // Only fetch the OAuth2 token if there are tasks that are actually due right now.
  // This prevents token KV reads/writes on every cron tick when tasks exist but aren't due yet.
  if (due.length === 0) return

  await Promise.all(due.map(async ({ key, task }) => {
    const result = await sendFCM(env, task.fcmToken, `⏰ ${task.title}`, 'Task reminder')
    if (result !== 'error') await env.FOLIO_KV.delete(key)
  }))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const cors = corsHeaders(origin)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 })
    const auth = request.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${env.API_KEY}`) return new Response('Unauthorized', { status: 401, headers: cors })

    const url = new URL(request.url)
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' } })

    if (request.method === 'POST' && url.pathname === '/api/schedule') {
      const b = await request.json() as { taskId: string; title: string; notifyAt: number; fcmToken: string }
      if (!b.taskId || !b.notifyAt || !b.fcmToken) return new Response('Bad request', { status: 400, headers: cors })
      const ttl = Math.max(60, Math.ceil((b.notifyAt - Date.now()) / 1000) + 7 * 86400)
      await env.FOLIO_KV.put(`task:${b.taskId}`, JSON.stringify({ title: b.title, notifyAt: b.notifyAt, fcmToken: b.fcmToken }), { expirationTtl: ttl })
      return json({ ok: true })
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/schedule/')) {
      await env.FOLIO_KV.delete(`task:${url.pathname.replace('/api/schedule/', '')}`)
      return json({ ok: true })
    }

    return new Response('Not found', { status: 404, headers: cors })
  },

  async scheduled(_: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(firedue(env))
  },
}
