// backend/src/routes/adminParser.js
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { upsertParserTrade } = require('../services/parserStore');
const axios = require('axios');

// мидлвары аутентификации / админа — возьми из твоего index.js
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    // тут используй твой jwt.verify(...)
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function requireAdmin(req, res, next) {
  // тут вызов в БД и проверка role === 'admin'
  return next();
}

// 1) Список объявлений из parser_trades
router.get('/api/admin/parser-trades', auth, requireAdmin, async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ilike $${params.length} or region ilike $${params.length} or brand ilike $${params.length} or model ilike $${params.length} or vin ilike $${params.length})`);
  }
  const pageNum = Math.max(1, parseInt(page));
  const size = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * size;

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const totalSql = `select count(*)::int c from parser_trades ${whereSql}`;
  const listSql = `
    select id, title, region, category, brand, model, year, vin, start_price,
           date_finish, trade_place, source_url, created_at
      from parser_trades
    ${whereSql}
    order by created_at desc
    limit $${params.length+1} offset $${params.length+2}
  `;

  const [{ rows: [{ c: total }] }, { rows: items }] = await Promise.all([
    query(totalSql, params),
    query(listSql, [...params, size, offset]),
  ]);
  res.json({ items, total, page: pageNum, pageCount: Math.max(1, Math.ceil(total / size)) });
});

// 2) Детальная карточка из parser_trades
router.get('/api/admin/parser-trades/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(`select * from parser_trades where id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// 3) Спарсить (дергаем наш парсер и складываем в parser_trades)
router.post('/api/admin/actions/ingest', auth, requireAdmin, async (req, res) => {
  try {
    const { search = 'vin', start_date, end_date, limit = 50, offset = 0 } = req.body || {};
    const client = axios.create({
      baseURL: process.env.PARSER_BASE_URL || 'http://91.135.156.232:8000',
      timeout: Number(process.env.PARSER_API_TIMEOUT || 300000),
    });
    const { data } = await client.get('/parse-fedresurs-trades', {
      params: { search_string: search, start_date, end_date, limit, offset },
    });
    if (!Array.isArray(data)) return res.status(502).json({ error: 'Unexpected parser payload', sample: data });

    let upserted = 0;
    for (const item of data) {
      try {
        await upsertParserTrade(item);
        upserted++;
      } catch (e) {
        console.error('UPSERT parser_trades error:', e?.message);
      }
    }
    res.json({ ok: true, received: data.length, upserted, limit, offset });
  } catch (e) {
    console.error('ingest proxy error:', e);
    res.status(500).json({ error: 'parser call failed' });
  }
});

// 4) Публикация: создать/обновить запись в listings и поставить published=true
router.post('/api/admin/parser-trades/:id/publish', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(`select * from parser_trades where id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const t = rows[0];

  // маппим поля в listings
  const currency = 'RUB';
  const currentPrice = Array.isArray(t.prices) && t.prices.length
    ? Number(String(t.prices[t.prices.length - 1]?.price ?? t.prices[t.prices.length - 1]?.currentPrice ?? '').replace(/\s/g,'').replace(',','.')) || t.start_price
    : t.start_price;

  const details = {
    lot_details: t.lot_details || null,
    debtor_details: t.debtor_details || null,
    contact_details: t.contact_details || null,
    prices: t.prices || null,
    documents: t.documents || null,
    fedresurs_meta: t.raw_payload?.fedresurs_data || null,
  };

  const source_id = t.fedresurs_id || t.bidding_number || t.id;

  // insert/update в listings, published=true
  await query(`
    insert into listings
      (source_id, title, description, asset_type, region, currency, start_price,
       current_price, status, end_date, source_url, details, published)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
    on conflict (source_id) do update set
      title=excluded.title,
      description=excluded.description,
      asset_type=excluded.asset_type,
      region=excluded.region,
      currency=excluded.currency,
      start_price=excluded.start_price,
      current_price=excluded.current_price,
      status=excluded.status,
      end_date=excluded.end_date,
      source_url=excluded.source_url,
      details=excluded.details,
      published=true,
      updated_at=now()
  `, [
    source_id,
    t.title || [t.brand, t.model, t.year].filter(Boolean).join(' ') || 'Лот',
    t.lot_details?.description || null,
    t.category || 'vehicle',
    t.region || null,
    currency,
    t.start_price || null,
    currentPrice || null,
    null, // статус, если нужен — подставь из raw_payload.fedresurs_data
    t.date_finish || null,
    t.source_url || null,
    details,
  ]);

  res.json({ ok: true });
});

module.exports = router;
