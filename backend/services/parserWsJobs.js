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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

function sendStop(session, reason = 'Stopped') {
  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    try {
      session.ws.send(JSON.stringify({ action: 'stop', reason }));
    } catch (error) {
      console.error('Failed to send stop to upstream parser:', error?.message || error);
    }
  }
}

function scheduleIdleStop(session) {
  if (session.stopTimer) clearTimeout(session.stopTimer);
  if (session.clients.size > 0) return;
  session.stopTimer = setTimeout(() => {
    session.stopRequested = true;
    sendStop(session, 'Idle timeout');
    try { session.ws?.close(); } catch {}
    if (session.jobId) activeSessions.delete(session.jobId);
  }, STOP_GRACE_MS);
}

function buildInitPayload(session) {
  if (session.startParams) {
    return { action: 'start', ...session.startParams };
  }
  const payload = { action: 'subscribe', jobId: session.jobId };
  if (session.lastEventId) payload.lastEventId = session.lastEventId;
  return payload;
}

function attachWebSocket(session) {
  if (session.stopRequested) return;
  const upstreamUrl = new URL('/parse-fedresurs-trades-all-live', PARSER_BASE_URL);
  const ws = new WebSocket(toWsUrl(upstreamUrl.toString()));
  session.ws = ws;

  const sendInit = () => {
    try {
      const initPayload = buildInitPayload(session);
      ws.send(JSON.stringify(initPayload));
    } catch (error) {
      console.error('Failed to send init payload to parser WS:', error?.message || error);
    }
  };

  ws.on('open', () => {
    session.reconnectDelay = 1_000;
    sendInit();
  });

  ws.on('message', async (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const eventName = payload?.event || 'message';
    const data = payload?.data;
    const id = payload?.id;

    if (id != null && Number.isFinite(Number(id))) {
      session.lastEventId = Number(id);
    }

    if (eventName === 'started' && data?.jobId) {
      if (!session.jobId) {
        session.jobId = data.jobId;
        activeSessions.set(session.jobId, session);
      }
      session.started = true;
      session.startDeferred.resolve?.(session.jobId);
      return;
    }

    if (!session.jobId) {
      // Cannot broadcast without a job id
      if (eventName === 'error' && !session.started) {
        session.startDeferred.reject?.(new Error(data?.detail || 'Failed to start parser job'));
      }
      return;
    }

    if (eventName === 'item' && data?.item) {
      try {
        await upsertParserTrade(data.item);
      } catch (error) {
        console.error('Failed to persist parsed item:', error?.message || error);
      }
    }

    broadcast(session, 'parser:fedresurs:event', {
      jobId: session.jobId,
      event: eventName,
      data,
      id: payload?.id ?? null,
    });

    if (eventName === 'done' || eventName === 'error' || eventName === 'stopped') {
      session.stopRequested = true;
      try { ws.close(); } catch {}
    }
  });

  ws.on('close', () => {
    session.ws = null;

    if (!session.started && !session.stopRequested) {
      session.startDeferred.reject?.(new Error('Upstream socket closed before start'));
      return;
    }

    if (session.stopRequested) {
      if (session.jobId) activeSessions.delete(session.jobId);
      return;
    }

    session.reconnectDelay = Math.min(session.reconnectDelay * 2, 30_000);
    setTimeout(() => attachWebSocket(session), session.reconnectDelay);
  });

  ws.on('error', (error) => {
    console.error('Parser WS error:', error?.message || error);
    try { ws.close(); } catch {}
  });
}

function createStartSession(params = {}) {
  const session = {
    jobId: null,
    startParams: params,
    ws: null,
    clients: new Set(),
    reconnectDelay: 1_000,
    lastEventId: 0,
    stopRequested: false,
    stopTimer: null,
    startDeferred: createDeferred(),
    started: false,
  };
  attachWebSocket(session);
  return session;
}

function ensureSession(jobId, { lastEventId } = {}) {
  if (activeSessions.has(jobId)) {
    const existing = activeSessions.get(jobId);
    if (Number.isFinite(lastEventId) && lastEventId > (existing.lastEventId || 0)) {
      existing.lastEventId = lastEventId;
    }
    return existing;
  }

  const session = {
    jobId,
    startParams: null,
    ws: null,
    clients: new Set(),
    reconnectDelay: 1_000,
    lastEventId: Number.isFinite(lastEventId) ? lastEventId : 0,
    stopRequested: false,
    stopTimer: null,
    startDeferred: createDeferred(),
    started: false,
  };

  // For subscribe flow we already know the jobId; resolve immediately.
  session.startDeferred.resolve(jobId);
  activeSessions.set(jobId, session);
  attachWebSocket(session);
  return session;
}

export async function startParserJobForClient(socket, params = {}) {
  const session = createStartSession(params);
  session.clients.add(socket);
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = null;
  }

  const jobId = await session.startDeferred.promise;
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
    sendStop(session, reason);
    try { session.ws?.close(); } catch {}
    if (session.stopTimer) clearTimeout(session.stopTimer);
    activeSessions.delete(jobId);
  }
}

export function releaseClient(socket) {
  for (const session of activeSessions.values()) {
    session.clients.delete(socket);
    scheduleIdleStop(session);
  }
}
