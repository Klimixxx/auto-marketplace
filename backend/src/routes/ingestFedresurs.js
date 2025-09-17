const express = require('express');
const router = express.Router();
const { parseFedresursTrades } = require('../services/parserClient');
const { upsertTradeFromParsedObject } = require('../services/tradeStore');

// Простая защита: токен
function auth(req, res, next) {
  const token = req.get('x-ingest-token');
  if (!process.env.INGEST_TOKEN || token === process.env.INGEST_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// POST /admin/ingest/fedresurs?search=vin&limit=15&only_available=true
router.post('/admin/ingest/fedresurs', auth, async (req, res) => {
  try {
    const {
      search = 'vin',
      start_date,
      end_date,
      limit = 15,
      offset = 0
    } = Object.assign({}, req.query, req.body);

    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 15;
    const safeOffset = Number.isFinite(offsetNum) && offsetNum >= 0 ? offsetNum : 0;

    const { items, meta } = await parseFedresursTrades({
      search_string: search,
      start_date,
      end_date,
      limit: safeLimit,
      offset: safeOffset,
    });

    let inserted = 0;
    for (const item of items) {
      try {
        await upsertTradeFromParsedObject(item);
        inserted++;
      } catch (e) {
        console.error('UPSERT_ERROR', e?.message, { item: item?.parsed_data?.fedresurs_id || item?.fedresurs_data?.guid });
      }
    }

    return res.json({
      ok: true,
      received: items.length,
      upserted: inserted,
      offset: safeOffset,
      limit: safeLimit,
      parser_meta: meta,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'ingest failed' });
  }
});

module.exports = router;
