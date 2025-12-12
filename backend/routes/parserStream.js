import express from 'express';
import { upsertParserTrade } from '../services/parserTrades.js';

const router = express.Router();

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';

/**
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

router.get('/fedresurs/all/stream', async (req, res) => {
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
      try {
        session.currentAbortController?.abort();
      } catch {}
      try {
        await session.currentReader?.cancel();
      } catch {}
      clearUpstreamWatchdog();
      session.currentAbortController = null;
      session.currentReader = null;
    };

    const resetUpstreamWatchdog = () => {
      clearUpstreamWatchdog();
      const upstreamInactivityMs = 45_000;
      session.upstreamActivityTimer = setTimeout(() => {
        // если upstream “завис” — рвём и уходим в reconnect
        stopUpstream().catch(() => {});
      }, upstreamInactivityMs);
    };

    const connectAndPipeStream = async () => {
      const abortController = new AbortController();
      session.currentAbortController = abortController;
      let reader = null;

      const cleanup = async () => {
        try {
          abortController.abort();
        } catch {}
        try {
          await reader?.cancel();
        } catch {}
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
            // попробуем “допарсить” хвост
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

      // финальная остановка
      await stopUpstream();

      // если сессия завершилась — закрываем клиентов
      for (const client of Array.from(session.clients)) {
        try {
          client.cleanup();
        } catch {}
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

  const clientRef = {
    res,
    cleanup: null,
  };

  const cleanupClient = () => {
    clearInterval(heartbeatTimer);

    // убираем клиента
    session.clients.delete(clientRef);

    // закрываем соединение
    try {
      res.end();
    } catch {}

    // если клиентов нет — через 30 сек стопаем upstream
    if (session.clients.size === 0 && !session.stopTimeout) {
      session.stopTimeout = setTimeout(() => {
        session.stopRequested = true;
        session.stopTimeout = null;
      }, 30_000);
    }
  };

  clientRef.cleanup = cleanupClient;

  // добавляем клиента в сессию
  session.clients.add(clientRef);

  // если уже был запланирован stop — отменяем
  if (session.stopTimeout) {
    clearTimeout(session.stopTimeout);
    session.stopTimeout = null;
    session.stopRequested = false;
  }

  // закрытие вкладки/соединения
  req.on('close', cleanupClient);
});

export default router;
