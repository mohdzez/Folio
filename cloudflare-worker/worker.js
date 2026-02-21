// ─────────────────────────────────────────────
//  Cloudflare Worker — folio-push-worker
//
//  Routes:
//    POST /subscribe    — save push subscription
//    POST /sync-tasks   — update stored tasks
//    POST /unsubscribe  — remove subscription
//    GET  /health       — debug readiness snapshot
//
//  Cron:  every hour — check tasks, send pushes
//
//  Required KV namespace: FOLIO_KV
//  Required secrets:      FCM_SERVER_KEY
// ─────────────────────────────────────────────

export default {
  // ── HTTP ROUTES ────────────────────────────
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS pre-flight
    if (method === 'OPTIONS') return corsResponse(null, 204);

    if (method === 'POST' && url.pathname === '/subscribe') {
      return handleSubscribe(request, env);
    }
    if (method === 'POST' && url.pathname === '/sync-tasks') {
      return handleSyncTasks(request, env);
    }
    if (method === 'POST' && url.pathname === '/unsubscribe') {
      return handleUnsubscribe(request, env);
    }

    if (method === 'GET' && url.pathname === '/health') {
      return handleHealth(env);
    }

    // Manual test trigger
    if (method === 'GET' && url.pathname === '/trigger') {
      await checkAndPush(env);
      return corsResponse({ ok: true, message: 'Push check triggered' });
    }

    return corsResponse({ error: 'Not found' }, 404);
  },

  // ── CRON TRIGGER ───────────────────────────
  async scheduled(_event, env) {
    await checkAndPush(env);
  },
};

// ── SUBSCRIBE ─────────────────────────────────

async function handleSubscribe(request, env) {
  try {
    const { subscription } = await request.json();
    if (!subscription?.endpoint) throw new Error('Invalid subscription');

    await env.FOLIO_KV.put('push_subscription', JSON.stringify(subscription));
    return corsResponse({ ok: true });
  } catch (err) {
    return corsResponse({ error: err.message }, 400);
  }
}

// ── SYNC TASKS ────────────────────────────────

async function handleSyncTasks(request, env) {
  try {
    const { tasks } = await request.json();
    if (!Array.isArray(tasks)) throw new Error('tasks must be an array');

    await env.FOLIO_KV.put('tasks', JSON.stringify(tasks));
    return corsResponse({ ok: true, count: tasks.length });
  } catch (err) {
    return corsResponse({ error: err.message }, 400);
  }
}

// ── UNSUBSCRIBE ───────────────────────────────

async function handleUnsubscribe(_request, env) {
  await env.FOLIO_KV.delete('push_subscription');
  return corsResponse({ ok: true });
}

// ── HEALTH / DEBUG ───────────────────────────

async function handleHealth(env) {
  const [subRaw, tasksRaw] = await Promise.all([
    env.FOLIO_KV.get('push_subscription'),
    env.FOLIO_KV.get('tasks'),
  ]);

  const hasSubscription = Boolean(subRaw);
  const hasTasks = Boolean(tasksRaw);
  const fcmConfigured = Boolean(env.FCM_SERVER_KEY);

  let taskCount = 0;
  let dueSoonCount = 0;
  if (tasksRaw) {
    try {
      const tasks = JSON.parse(tasksRaw);
      if (Array.isArray(tasks)) {
        taskCount = tasks.length;
        const now = Date.now();
        dueSoonCount = tasks.filter((task) => {
          if (task.done || !task.due) return false;
          const dueMs = new Date(task.due + 'T09:00:00').getTime();
          return dueMs > now && dueMs - now <= 60 * 60 * 1000;
        }).length;
      }
    } catch {
      // Keep default counts when payload is malformed.
    }
  }

  const pushReady = hasSubscription && hasTasks && fcmConfigured;

  return corsResponse({
    ok: true,
    pushReady,
    checks: {
      hasSubscription,
      hasTasks,
      fcmConfigured,
    },
    metrics: {
      taskCount,
      dueSoonCount,
    },
    now: new Date().toISOString(),
  });
}

// ── CRON: CHECK TASKS + SEND PUSH ─────────────

async function checkAndPush(env) {
  const [subRaw, tasksRaw] = await Promise.all([
    env.FOLIO_KV.get('push_subscription'),
    env.FOLIO_KV.get('tasks'),
  ]);

  if (!subRaw || !tasksRaw) {
    console.log('[Worker] No subscription or tasks found.');
    return;
  }

  const subscription = JSON.parse(subRaw);
  const tasks = JSON.parse(tasksRaw);

  const now = Date.now();
  const dueSoon = tasks.filter((task) => {
    if (task.done || !task.due) return false;
    // Fire if task is due within the next hour
    const dueMs = new Date(task.due + 'T09:00:00').getTime();
    return dueMs > now && dueMs - now <= 60 * 60 * 1000;
  });

  console.log(`[Worker] ${dueSoon.length} task(s) due soon.`);

  for (const task of dueSoon) {
    await sendWebPush(
      subscription,
      {
        title: '⏰ Task due soon — Folio',
        body: task.title,
        tag: `folio-${task.id}`,
        taskId: task.id,
        url: '/?page=today',
      },
      env.FCM_SERVER_KEY,
    );
  }
}

// ── WEB PUSH VIA FCM ──────────────────────────
// Uses the Web Push Protocol with FCM as the push service.
// For non-FCM endpoints (Firefox, etc.) you'd use the
// standard web-push library. For personal use, FCM covers
// Chrome on all platforms.

async function sendWebPush(subscription, payload, serverKey) {
  const body = JSON.stringify({
    notification: {
      title: payload.title,
      body: payload.body,
      icon: '/assets/icons/icon-192.png',
      tag: payload.tag,
      data: { taskId: payload.taskId, url: payload.url },
      actions: [
        { action: 'done', title: '✓ Mark Done' },
        { action: 'snooze', title: '⏰ Snooze 1h' },
      ],
    },
  });

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
      TTL: '86400',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Worker] Push failed:', response.status, text);
  } else {
    console.log('[Worker] Push sent for task:', payload.taskId);
  }
}

// ── CORS HELPERS ──────────────────────────────

function corsResponse(body, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  return new Response(body !== null ? JSON.stringify(body) : null, {
    status,
    headers,
  });
}
