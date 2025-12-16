import WebSocket from 'ws';
import { upsertParserTrade } from './parserTrades.js';

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';
const STOP_GRACE_MS = 120_000;

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
  const deadClients = [];
  const eventName = payload?.event || event;
  const eventId = payload?.id;
  
  for (const client of Array.from(session.clients)) {
    try {
      // More reliable check for Socket.IO client state
      if (client.connected === true || (client.connected !== false && client.disconnected !== true)) {
        client.emit(event, payload);
        // Log important events for debugging
        if (eventName === 'done' || eventName === 'error' || eventName === 'stopped') {
          console.log(`Broadcasted ${eventName} event (id=${eventId}) to client for jobId=${session.jobId}`);
        }
      } else {
        deadClients.push(client);
      }
    } catch (error) {
      console.error(`Failed to emit parser event ${eventName} (id=${eventId}) to client:`, error?.message || error);
      deadClients.push(client);
    }
  }
  // Clean up dead clients
  for (const client of deadClients) {
    session.clients.delete(client);
  }
  
  if (session.clients.size === 0 && (eventName === 'done' || eventName === 'error' || eventName === 'stopped')) {
    console.log(`No clients remaining for jobId=${session.jobId} after ${eventName} event`);
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
  let pingTimer = null;

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
    console.log(`Parser WS opened for jobId=${session.jobId || 'new'}`);
    sendInit();
    // keepalive to prevent intermediaries from closing idle connection
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { 
          ws.ping();
        } catch (error) {
          console.warn('Failed to send ping to parser WS:', error?.message || error);
          // If ping fails, connection might be dead - clear timer
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
        }
      } else {
        // Connection not open, clear timer
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
      }
    }, 20_000);
  });

  ws.on('message', async (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch (error) {
      console.warn('Failed to parse parser WS message:', error?.message || error);
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
        // Don't return - continue to broadcast even if persistence fails
      }
    }

    // Broadcast to clients, but don't fail if broadcast fails
    const broadcastPayload = {
      jobId: session.jobId,
      event: eventName,
      data,
      id: payload?.id ?? null,
    };
    
    try {
      broadcast(session, 'parser:fedresurs:event', broadcastPayload);
      console.log(`Processed ${eventName} event (id=${payload?.id ?? 'none'}) for jobId=${session.jobId}, clients=${session.clients.size}`);
    } catch (error) {
      console.error('Failed to broadcast parser event:', error?.message || error);
      // Continue processing even if broadcast fails
    }

    if (eventName === 'done' || eventName === 'error' || eventName === 'stopped') {
      console.log(`Received ${eventName} event for jobId=${session.jobId}, closing connection after broadcast`);
      session.stopRequested = true;
      // Give a small delay to ensure the broadcast completes before closing
      // This is especially important for the 'done' event
      setTimeout(() => {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch (error) {
          console.error('Error closing WebSocket after done/error/stopped:', error?.message || error);
        }
      }, 100);
    }
  });

  ws.on('close', (code, reason) => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    session.ws = null;

    const reasonStr = reason?.toString() || 'Unknown';
    console.log(`Parser WS closed: code=${code}, reason=${reasonStr}, jobId=${session.jobId || 'none'}, clients=${session.clients.size}, lastEventId=${session.lastEventId}`);

    if (!session.started && !session.stopRequested) {
      session.startDeferred.reject?.(new Error('Upstream socket closed before start'));
      return;
    }

    // If connection closed unexpectedly and we haven't received 'done' event,
    // try to send a synthetic 'done' event to clients if we have clients
    if (!session.stopRequested && session.jobId && session.clients.size > 0) {
      console.log(`Connection closed unexpectedly for jobId=${session.jobId}, sending synthetic done event to ${session.clients.size} clients`);
      try {
        broadcast(session, 'parser:fedresurs:event', {
          jobId: session.jobId,
          event: 'done',
          data: {
            stage: 'done',
            connection_closed: true,
            last_event_id: session.lastEventId,
          },
          id: session.lastEventId + 1,
        });
      } catch (error) {
        console.error('Failed to send synthetic done event:', error?.message || error);
      }
    }

    if (session.stopRequested) {
      if (session.jobId) activeSessions.delete(session.jobId);
      return;
    }

    // Only reconnect if we have clients
    if (session.clients.size > 0) {
      session.reconnectDelay = Math.min(session.reconnectDelay * 2, 30_000);
      console.log(`Reconnecting parser WS in ${session.reconnectDelay}ms for jobId=${session.jobId}`);
      setTimeout(() => attachWebSocket(session), session.reconnectDelay);
    } else {
      console.log(`Not reconnecting parser WS - no clients for jobId=${session.jobId}`);
      if (session.jobId) activeSessions.delete(session.jobId);
    }
  });

  ws.on('error', (error) => {
    console.error(`Parser WS error for jobId=${session.jobId || 'none'}:`, error?.message || error, error?.code || '');
    // Don't close immediately - let 'close' event handle it
    // This allows for better error recovery
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
