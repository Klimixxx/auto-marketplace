import express from 'express';

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

  let upstream;
  try {
    upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
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

  req.on('close', async () => {
    try { await reader.cancel(); } catch {}
  });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch (e) {
    // клиент мог закрыться — это нормально
  } finally {
    res.end();
  }
});

export default router;
