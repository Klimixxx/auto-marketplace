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

  const abortController = new AbortController();
  let upstream;
  try {
    upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      signal: abortController.signal,
    });
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ detail: 'Upstream unavailable' })}\n\n`);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    res.write(
      `event: error\ndata: ${JSON.stringify({ detail: text || `Upstream status ${upstream.status}` })}\n\n`,
    );
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseEventChunk = async (chunk) => {
    buffer += chunk;

    const segments = buffer.split(/\n\n/);
    buffer = segments.pop() ?? '';

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

  req.on('close', async () => {
    clearInterval(heartbeatTimer);
    try { abortController.abort(); } catch {}
    try { await reader.cancel(); } catch {}
  });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
        try {
          await parseEventChunk(decoder.decode(value, { stream: true }));
        } catch (error) {
          console.error('Failed to parse SSE chunk:', error?.message || error);
        }
      }
    }
  } catch (e) {
    // клиент мог закрыться — это нормально
  } finally {
    clearInterval(heartbeatTimer);
    try {
      await parseEventChunk(decoder.decode());
    } catch (error) {
      console.error('Failed to flush SSE buffer:', error?.message || error);
    }
    res.end();
  }
});

export default router;
