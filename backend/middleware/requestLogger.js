// Simple request logging middleware
export default function requestLogger(req, res, next) {
  const start = Date.now();
  const ip = String((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')).split(',')[0].trim();

  function safeStringify(value, max = 1000) {
    try {
      const s = typeof value === 'string' ? value : JSON.stringify(value);
      return s.length > max ? s.slice(0, max) + '...' : s;
    } catch (err) {
      return '[unserializable]';
    }
  }

  // Redact sensitive headers
  const headers = { ...req.headers };
  if (headers.authorization) headers.authorization = '[REDACTED]';

  console.info(`[REQ START] ${new Date().toISOString()} ${req.method} ${req.originalUrl} ip:${ip}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const bodyPreview = safeStringify(req.body, 2000);
    const queryPreview = safeStringify(req.query, 1000);
    console.info(
      `[REQ END] ${new Date().toISOString()} ${req.method} ${req.originalUrl} status:${res.statusCode} ${duration}ms ip:${ip} user:${req.userId || req.user?.sub || '-'} body:${bodyPreview} query:${queryPreview}`
    );
  });

  next();
}
