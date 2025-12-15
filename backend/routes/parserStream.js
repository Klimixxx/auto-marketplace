import express from 'express';
import { upsertParserTrade } from '../services/parserTrades.js';

const router = express.Router();

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';

/**
 * LEGACY sessions (old mode without jobId):
 * sessions: key -> {
 *   key, url, clients:Set<{res, cleanup}>,
 *   stopRequested, stopTimeout,
 *   upstreamActivityTimer,
 *   currentAbortController, currentReader,
 *   reconnectDelayMs,
 *   startPromise
 * }
 */
const activeSessions = new Map();

function isAbortLikeError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('aborted') || message.includes('abort');
}

/**
 * NEW: start job in FastAPI (jobId model)
 * POST /api/parser/fedresurs/all/start
 * Body: { search_string, start_date, end_date, limit, region_code, region_codes, only_available }
 * Returns: { jobId }
 */
router.post('/fedresurs/all/start', express.json(), async (req, res) => {
  try {
    const upstreamUrl = new URL('/parse-fedresurs-trades-all-stream/start', PARSER_BASE_URL);

    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok || !data) {
      return res.status(upstream.status || 500).json({
        error: data?.detail || data?.error || 'start failed',
      });
    }

    if (!data?.jobId) {
      return res.status(502).json({ error: 'jobId missing from parser response' });
    }

    return res.json(data);
  } catch (error) {
    console.error('start job proxy error:', error?.message || error);
    return res.status(500).json({ error: 'start job proxy error' });
  }
});

/**
 * Optional: stop job in FastAPI
 * POST /api/parser/fedresurs/all/:jobId/stop
 */
router.post('/fedresurs/all/:jobId/stop', async (req, res) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const upstreamUrl = new URL(`/parse-fedresurs-trades-all-stream/${encodeURIComponent(jobId)}/stop`, PARSER_BASE_URL);

    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return res.status(upstream.status || 500).json({
        error: data?.detail || data?.error || 'stop failed',
      });
    }

    return res.json(data || { ok: true });
  } catch (error) {
    console.error('stop job proxy error:', error?.message || error);
    return res.status(500).json({ error: 'stop job proxy error' });
  }
});

/**
 * STREAM endpoint:
 * - If jobId is provided: proxy FastAPI job stream (recommended).
 * - Else: legacy mode (your current multiplexer by query).
 */
router.get('/fedresurs/all/stream', async (req, res) => {
  // ===== NEW MODE (jobId) =====
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
  if (jobId) {
    const upstreamUrl = new URL(
      `/parse-fedresurs-trades-all-stream/${encodeURIComponent(jobId)}`,
      PARSER_BASE_URL,
    );
    const lastEventIdParam = req.query.lastEventId;
    const parsedLastEventId = Array.isArray(lastEventIdParam)
      ? Number.parseInt(lastEventIdParam[0], 10)
      : Number.parseInt(String(lastEventIdParam ?? ''), 10);
    const lastEventId = Number.isFinite(parsedLastEventId) ? parsedLastEventId : null;

    const abortController = new AbortController();
    let reader = null;

    req.on('close', async () => {
      try { abortController.abort(); } catch {}
      try { await reader?.cancel(); } catch {}
    });

    // SSE headers клиенту
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      const headers = { accept: 'text/event-stream' };

      // Resume support: пробрасываем Last-Event-ID в FastAPI
      const lastEventIdHeader = req.headers['last-event-id'] || (lastEventId != null ? String(lastEventId) : '');
      if (lastEventIdHeader) headers['last-event-id'] = String(lastEventIdHeader);

      const upstream = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers,
        signal: abortController.signal,
      });

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '');
        res.write(
          `event: error\ndata: ${JSON.stringify({
            detail: text || `Upstream status ${upstream.status}`,
          })}\n\n`,
        );
        res.end();
        return;
      }

      reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const bufferRef = { buffer: '' };

      const parseEventChunk = async (chunkText) => {
        bufferRef.buffer += chunkText;

        const segments = bufferRef.buffer.split(/\n\n/);
        bufferRef.buffer = segments.pop() ?? '';

        for (const segment of segments) {
          const lines = segment.split(/\n/);
          let eventName = 'message';
          const dataParts = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice('event:'.length).trim() || 'message';
            } else if (line.startsWith('data:')) {
              dataParts.push(line.slice('data:'.length).trim());
            }
          }

          const payloadRaw = dataParts.join('\n');
          if (!payloadRaw) continue;

          if (eventName === 'item') {
            try {
              const parsed = JSON.parse(payloadRaw);
              const item = parsed?.item ?? parsed;
              if (item) await upsertParserTrade(item);
            } catch (error) {
              console.error('Failed to persist streamed item:', error?.message || error);
            }
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          // просто прокидываем байты SSE дальше
          res.write(Buffer.from(value));
          res.flush?.();
          try {
            const text = decoder.decode(value, { stream: true });
            await parseEventChunk(text);
          } catch (error) {
            console.error('Failed to parse SSE chunk (jobId):', error?.message || error);
          }
        }
      }

      if (bufferRef.buffer) {
        try {
          await parseEventChunk(bufferRef.buffer);
        } catch (error) {
          console.error('Failed to flush SSE buffer (jobId):', error?.message || error);
        }
      }

      res.end();
    } catch (error) {
      if (!isAbortLikeError(error)) {
        const msg = error?.message || 'stream proxy error';
        console.error('job stream proxy error:', msg);
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ detail: msg })}\n\n`);
        } catch {}
      }
      try { res.end(); } catch {}
    }
    return; // ✅ важно: не падать в legacy режим
  }

  // ===== LEGACY MODE (no jobId) =====
  const url = new URL('/parse-fedresurs-trades-all-stream', PARSER_BASE_URL);

  // пробрасываем query как есть
  for (const [k, v] of Object.entries(req.query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }

  const sessionKey = `${url.pathname}?${url.searchParams.toString()}`;

  const attachHeartbeat = (clientRes) => {
    const heartbeatIntervalMs = 15_000;
    const sendHeartbeat = () => {
      try {
        clientRes.write(':heartbeat\n\n');
        clientRes.flush?.();
      } catch {
        // ignore
      }
    };
    return setInterval(sendHeartbeat, heartbeatIntervalMs);
  };

  const parseEventChunk = async (bufferRef, chunkText) => {
    bufferRef.buffer += chunkText;

    // SSE events разделяются пустой строкой
    const segments = bufferRef.buffer.split(/\n\n/);
    bufferRef.buffer = segments.pop() ?? '';

    for (const segment of segments) {
      const lines = segment.split(/\n/);
      let eventName = 'message';
      const dataParts = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice('event:'.length).trim() || 'message';
        } else if (line.startsWith('data:')) {
          dataParts.push(line.slice('data:'.length).trim());
        }
      }

      const payloadRaw = dataParts.join('\n');
      if (!payloadRaw) continue;

      if (eventName === 'item') {
        try {
          const parsed = JSON.parse(payloadRaw);
          const item = parsed?.item ?? parsed;
          if (item) await upsertParserTrade(item);
        } catch (error) {
          console.error('Failed to persist streamed item:', error?.message || error);
        }
      }
    }
  };

  const ensureSession = () => {
    if (activeSessions.has(sessionKey)) return activeSessions.get(sessionKey);

    const session = {
      key: sessionKey,
      url,
      clients: new Set(),
      stopRequested: false,
      stopTimeout: null,

      upstreamActivityTimer: null,
      currentAbortController: null,
      currentReader: null,

      reconnectDelayMs: 1_000,
      startPromise: null,
    };

    const broadcast = (chunk) => {
      for (const client of session.clients) {
        try {
          client.res.write(chunk);
          client.res.flush?.();
        } catch (error) {
          console.error('Failed to broadcast SSE chunk:', error?.message || error);
          client.cleanup();
        }
      }
    };

    const broadcastEvent = (eventName, data) => {
      broadcast(`event: ${eventName}\ndata: ${data}\n\n`);
    };

    const clearUpstreamWatchdog = () => {
      if (session.upstreamActivityTimer) clearTimeout(session.upstreamActivityTimer);
      session.upstreamActivityTimer = null;
    };

    const stopUpstream = async () => {
      try { session.currentAbortController?.abort(); } catch {}
      try { await session.currentReader?.cancel(); } catch {}
      clearUpstreamWatchdog();
      session.currentAbortController = null;
      session.currentReader = null;
    };

    const resetUpstreamWatchdog = () => {
      clearUpstreamWatchdog();
      const upstreamInactivityMs = 45_000;
      session.upstreamActivityTimer = setTimeout(() => {
        stopUpstream().catch(() => {});
      }, upstreamInactivityMs);
    };

    const connectAndPipeStream = async () => {
      const abortController = new AbortController();
      session.currentAbortController = abortController;
      let reader = null;

      const cleanup = async () => {
        try { abortController.abort(); } catch {}
        try { await reader?.cancel(); } catch {}
        session.currentAbortController = null;
        session.currentReader = null;
      };

      try {
        const upstream = await fetch(url.toString(), {
          method: 'GET',
          headers: { accept: 'text/event-stream' },
          signal: abortController.signal,
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '');
          throw new Error(text || `Upstream status ${upstream.status}`);
        }

        reader = upstream.body.getReader();
        session.currentReader = reader;

        const decoder = new TextDecoder();
        const bufferRef = { buffer: '' };

        resetUpstreamWatchdog();

        while (!session.stopRequested) {
          const { value, done } = await reader.read();

          if (done) {
            try {
              if (bufferRef.buffer) await parseEventChunk(bufferRef, bufferRef.buffer);
            } catch (error) {
              console.error('Failed to flush SSE buffer:', error?.message || error);
            }
            throw new Error('Upstream stream ended');
          }

          if (value) {
            resetUpstreamWatchdog();

            // транслируем клиентам “сырые” байты
            broadcast(Buffer.from(value));

            // и параллельно парсим текст для сохранения item
            try {
              const text = decoder.decode(value, { stream: true });
              await parseEventChunk(bufferRef, text);
            } catch (error) {
              console.error('Failed to parse SSE chunk:', error?.message || error);
            }
          }
        }
      } finally {
        await cleanup();
      }
    };

    const startLoop = async () => {
      while (!session.stopRequested) {
        try {
          await connectAndPipeStream();
          session.reconnectDelayMs = 1_000;
        } catch (error) {
          if (session.stopRequested) break;

          const abortLike = isAbortLikeError(error);
          if (!abortLike) {
            console.error('Upstream stream error:', error?.message || error);
            broadcastEvent('error', JSON.stringify({ detail: error?.message || 'Stream error' }));
          }

          await stopUpstream();

          // Backoff перед переподключением
          const delay = abortLike ? 0 : session.reconnectDelayMs;
          session.reconnectDelayMs = Math.min(session.reconnectDelayMs * 2, 30_000);

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      await stopUpstream();

      for (const client of Array.from(session.clients)) {
        try { client.cleanup(); } catch {}
      }

      activeSessions.delete(session.key);
    };

    session.startPromise = startLoop();
    activeSessions.set(sessionKey, session);
    return session;
  };

  const session = ensureSession();

  // --- SSE headers клиенту
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeatTimer = attachHeartbeat(res);

  const clientRef = { res, cleanup: null };

  const cleanupClient = () => {
    clearInterval(heartbeatTimer);

    session.clients.delete(clientRef);

    try { res.end(); } catch {}

    if (session.clients.size === 0 && !session.stopTimeout) {
      session.stopTimeout = setTimeout(() => {
        session.stopRequested = true;
        session.stopTimeout = null;
      }, 30_000);
    }
  };

  clientRef.cleanup = cleanupClient;

  session.clients.add(clientRef);

  if (session.stopTimeout) {
    clearTimeout(session.stopTimeout);
    session.stopTimeout = null;
    session.stopRequested = false;
  }

  req.on('close', cleanupClient);
});

export default router;
