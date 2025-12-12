// backend/routes/parserJobs.js
import express from 'express';

const router = express.Router();

const PARSER_BASE_URL = process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';

function isAbortLikeError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('aborted') || message.includes('abort');
}

// START job (создать задачу в FastAPI)
router.post('/fedresurs/all/start', express.json(), async (req, res) => {
  try {
    const upstreamUrl = new URL('/jobs/fedresurs/all/start', PARSER_BASE_URL);

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
      return res.status(upstream.status || 500).json({ error: data?.detail || data?.error || 'start failed' });
    }

    return res.json(data);
  } catch (error) {
    console.error('start job proxy error:', error?.message || error);
    return res.status(500).json({ error: 'start job proxy error' });
  }
});

// STREAM job (SSE прокси)
router.get('/fedresurs/all/stream', async (req, res) => {
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const upstreamUrl = new URL(`/jobs/fedresurs/all/${encodeURIComponent(jobId)}/stream`, PARSER_BASE_URL);

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

    // Пробрасываем Last-Event-ID (для resume)
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId) headers['last-event-id'] = String(lastEventId);

    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers,
      signal: abortController.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ detail: text || `Upstream status ${upstream.status}` })}\n\n`);
      res.end();
      return;
    }

    reader = upstream.body.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
        res.flush?.();
      }
    }

    res.end();
  } catch (error) {
    if (!isAbortLikeError(error)) {
      console.error('stream proxy error:', error?.message || error);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ detail: error?.message || 'stream proxy error' })}\n\n`);
      } catch {}
    }
    try { res.end(); } catch {}
  }
});

export default router;
