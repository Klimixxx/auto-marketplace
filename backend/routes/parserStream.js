import express from 'express';
import { upsertParserTrade } from '../services/parserTrades.js';

const router = express.Router();

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';

router.get('/fedresurs/all/stream', async (req, res) => {
  const url = new URL('/parse-fedresurs-trades-all-stream', PARSER_BASE_URL);

  for (const [k, v] of Object.entries(req.query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders?.();

  const heartbeatIntervalMs = 15_000;
  const sendHeartbeat = () => {
    try {
      res.write(':heartbeat\n\n');
      res.flush?.();
    } catch (e) {
      // ignore heartbeat failures
    }
  };
  const heartbeatTimer = setInterval(sendHeartbeat, heartbeatIntervalMs);

  // таймер, который принудительно перезапускает подключение к апстриму,
  // если долго нет данных (некоторые прокси/балансировщики рвут такие соединения).
  const upstreamInactivityMs = 45_000 ;
  let upstreamActivityTimer;

  let closed = false;
  let currentAbortController;
  let currentReader;

  const stopUpstream = async () => {
    try { currentAbortController?.abort(); } catch {}
    try { await currentReader?.cancel(); } catch {}
    clearTimeout (upstreamActivityTimer);
  };

  const resetUpstreamWatchdog = ( ) => {
 
    clearTimeout (upstreamActivityTimer);
    upstreamActivityTimer = setTimeout ( () => {
      // прерываем текущее подключение; внешний цикл создаст новое
      stopUpstream ();
    }, upstreamInactivityMs);
  };
  resetUpstreamWatchdog ();

  req.on('close', () => {
    closed = true;
    // отрубаем текущее подключение сразу, чтобы не ждать reader.read()
    stopUpstream();
  });

  const parseEventChunk = async (decoder, bufferRef, chunk) => {
    bufferRef.buffer += chunk;

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
          if (item) {
            await upsertParserTrade(item);
          }
        } catch (error) {
          console.error('Failed to persist streamed item:', error?.message || error);
        }
      }
    }
  };

  const connectAndPipeStream = async () => {
    const abortController = new AbortController();
    currentAbortController = abortController;
    let reader;

  const cleanup = async () => {
      try { abortController.abort(); } catch {}
      try { await reader?.cancel(); } catch {}
      currentAbortController = null;
      currentReader = null;
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
      currentReader = reader;
      const decoder = new TextDecoder();
      const bufferRef = { buffer: '' };

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) {
          try {
            await parseEventChunk(decoder, bufferRef, decoder.decode());
          } catch (error) {
            console.error('Failed to flush SSE buffer:', error?.message || error);
          }
          throw new Error('Upstream stream ended');
        }
        if (value) {
          resetUpstreamWatchdog();
          res.write(Buffer.from(value));
          try {
            await parseEventChunk(decoder, bufferRef, decoder.decode(value, { stream: true }));
          } catch (error) {
            console.error('Failed to parse SSE chunk:', error?.message || error);
          }
        }
      }
      // если вышли из цикла из-за закрытия клиента — прерываемся без попытки переподключения
      return { closedByClient: closed };
    } finally {
      await cleanup();
    }
 };

  let reconnectDelayMs = 1_000;
  while (!closed) {
    try {
      const result = await connectAndPipeStream();
      if (result?.closedByClient) break;

      // если дошли сюда — соединение разорвалось, пробуем переподключиться
      reconnectDelayMs = 1_000; // успешное подключение сбрасывает задержку
    } catch (error) {
      if (closed) break;

      console.error('Upstream stream error:', error?.message || error);
      res.write(`event: error\ndata: ${JSON.stringify({ detail: error?.message || 'Stream error' })}\n\n`);
      res.flush?.();

      // ждём перед переподключением
      const delay = reconnectDelayMs;
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  clearInterval(heartbeatTimer);
  await stopUpstream();
  res.end();
});

export default router;
