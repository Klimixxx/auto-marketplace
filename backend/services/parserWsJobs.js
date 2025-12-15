import WebSocket from 'ws';
import { upsertParserTrade } from './parserTrades.js';

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';
const STOP_GRACE_MS = 30_000;

const activeSessions = new Map();

function toWsUrl(url) {
  const next = new URL(url);
  next.protocol = next.protocol === 'https:' ? 'wss:' : 'ws:';
  return next.toString();
}

async function startUpstreamJob(params = {}) {
  const upstreamUrl = new URL('/parse-fedresurs-trades-all-stream/start', PARSER_BASE_URL);
  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.jobId) {
    const detail = data?.detail || data?.error || 'failed to start upstream job';
    throw new Error(detail);
  }
  return data.jobId;
}

async function stopUpstreamJob(jobId) {
  if (!jobId) return;
  const upstreamUrl = new URL(`/parse-fedresurs-trades-all-stream/${encodeURIComponent(jobId)}/stop`, PARSER_BASE_URL);
  try {
    await fetch(upstreamUrl, { method: 'POST', headers: { Accept: 'application/json' } });
  } catch (error) {
    console.error('Failed to stop upstream job:', error?.message || error);
  }
}

function broadcast(session, event, payload) {
  for (const client of Array.from(session.clients)) {
    try {
      client.emit(event, payload);
    } catch (error) {
      console.error('Failed to emit parser event to client:', error?.message || error);
      session.clients.delete(client);
    }
  }
}

function scheduleIdleStop(session) {
  if (session.stopTimer) clearTimeout(session.stopTimer);
  if (session.clients.size > 0) return;
  session.stopTimer = setTimeout(() => {
    session.stopRequested = true;
    if (session.ws) {
      try { session.ws.close(); } catch {}
    }
  }, STOP_GRACE_MS);
}

function ensureSession(jobId, { lastEventId } = {}) {
  if (activeSessions.has(jobId)) {
    const existing = activeSessions.get(jobId);
    if (Number.isFinite(lastEventId) && (existing.lastEventId || 0) < lastEventId) {
      existing.lastEventId = lastEventId;
    }
    return existing;
  }

  const session = {
    jobId,
    ws: null,
    clients: new Set(),
    reconnectDelay: 1_000,
    lastEventId: Number.isFinite(lastEventId) ? lastEventId : 0,
    stopRequested: false,
    stopTimer: null,
  };

  const connect = () => {
    if (session.stopRequested) return;
    const upstreamUrl = new URL(`/parse-fedresurs-trades-all-ws/${encodeURIComponent(jobId)}`, PARSER_BASE_URL);
    if (session.lastEventId) {
      upstreamUrl.searchParams.set('lastEventId', String(session.lastEventId));
    }
    const ws = new WebSocket(toWsUrl(upstreamUrl.toString()));
    session.ws = ws;

    ws.on('open', () => {
      session.reconnectDelay = 1_000;
    });

    ws.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload?.id != null && Number.isFinite(Number(payload.id))) {
          session.lastEventId = Number(payload.id);
        }
        const eventName = payload?.event || 'message';
        const data = payload?.data;

        if (eventName === 'item' && data?.item) {
          try {
            await upsertParserTrade(data.item);
          } catch (error) {
            console.error('Failed to persist parsed item:', error?.message || error);
          }
        }

        broadcast(session, 'parser:fedresurs:event', { jobId, event: eventName, data, id: payload?.id ?? null });

        if (eventName === 'done' || eventName === 'error' || eventName === 'stopped') {
          session.stopRequested = true;
          try { ws.close(); } catch {}
        }
      } catch (error) {
        console.error('Failed to handle parser WS message:', error?.message || error);
      }
    });

    ws.on('close', () => {
      session.ws = null;
      if (session.stopRequested) {
        activeSessions.delete(jobId);
        return;
      }
      session.reconnectDelay = Math.min(session.reconnectDelay * 2, 30_000);
      setTimeout(connect, session.reconnectDelay);
    });

    ws.on('error', (error) => {
      console.error('Parser WS error:', error?.message || error);
      try { ws.close(); } catch {}
    });
  };

  connect();
  activeSessions.set(jobId, session);
  return session;
}

export async function startParserJobForClient(socket, params = {}) {
  const jobId = await startUpstreamJob(params);
  const session = ensureSession(jobId, {});
  session.clients.add(socket);
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = null;
  }
  return jobId;
}

export function subscribeParserJob(socket, { jobId, lastEventId } = {}) {
  if (!jobId) throw new Error('jobId is required');
  const session = ensureSession(jobId, { lastEventId });
  session.clients.add(socket);
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = null;
  }
  return session;
}

export async function stopParserJob(jobId, reason = 'Stopped by user') {
  if (!jobId) return;
  const session = activeSessions.get(jobId);
  if (session) {
    session.stopRequested = true;
    if (session.ws) {
      try { session.ws.send(JSON.stringify({ action: 'stop' })); } catch {}
      try { session.ws.close(); } catch {}
    }
    if (session.stopTimer) clearTimeout(session.stopTimer);
    activeSessions.delete(jobId);
  }
  await stopUpstreamJob(jobId);
}

export function releaseClient(socket) {
  for (const session of activeSessions.values()) {
    session.clients.delete(socket);
    scheduleIdleStop(session);
  }
}
