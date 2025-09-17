import express from 'express';
import { query } from '../db.js';

const router = express.Router();

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const PARSER_FALLBACK_BASE = 'http://91.135.156.232:8000';

function toNumberSafe(value) {
  if (value == null) return null;
  const num = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function toFinite(value) {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function pickResultsArray(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.list)) return payload.list;
  return null;
}

function normalizeParserResponse(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, meta: { total_found: payload.length } };
  }

  if (payload && typeof payload === 'object') {
    const items = pickResultsArray(payload);
    if (!items) {
      throw new Error('Parser response has no results array');
    }

    const meta = {};
    const total = toFinite(payload.total_found ?? payload.total ?? payload.count ?? payload.totalCount);
    if (total !== undefined) meta.total_found = total;
    const limit = toFinite(payload.limit ?? payload.page_size ?? payload.per_page ?? payload.size);
    if (limit !== undefined) meta.limit = limit;
    const offset = toFinite(payload.offset ?? payload.page ?? payload.page_number ?? payload.start);
    if (offset !== undefined) meta.offset = offset;
    if (typeof payload.has_more === 'boolean') meta.has_more = payload.has_more;

    if (meta.total_found === undefined) meta.total_found = items.length;

    return { items, meta };
  }

  throw new Error(`Unexpected parser payload type: ${typeof payload}`);
}

async function upsertParserTrade(item) {
  const fedresurs = item?.fedresurs_data || {};
  const parsed = item?.parsed_data || item || {};
  const lot = parsed.lot_details || {};
  const debtor = parsed.debtor_details || {};
  const contact = parsed.contact_details || {};
  const prices = Array.isArray(parsed.prices) ? parsed.prices : [];
  const documents = Array.isArray(parsed.documents) ? parsed.documents : [];

  const fedresursId = parsed.fedresurs_id || fedresurs.guid || fedresurs.number || parsed.bidding_number || null;
  const biddingNumber = parsed.bidding_number || null;

  const params = {
    fedresurs_id: fedresursId,
    bidding_number: biddingNumber,
    title: parsed.title || [lot.brand, lot.model, lot.year].filter(Boolean).join(' ') || 'Лот',
    applications_count: parsed.applications_count ?? null,
    lot_details: lot,
    debtor_details: debtor,
    contact_details: contact,
    prices,
    documents,
    raw_payload: { fedresurs_data: fedresurs, parsed_data: parsed },
    category: lot.category || null,
    region: lot.region || null,
    brand: lot.brand || null,
    model: lot.model || null,
    year: lot.year || null,
    vin: lot.vin || null,
    start_price: toNumberSafe(lot.start_price),
    date_start: fedresurs.dateStart ? new Date(fedresurs.dateStart) : null,
    date_finish: fedresurs.dateFinish ? new Date(fedresurs.dateFinish) : null,
    trade_place: fedresurs.tradePlace?.name || null,
    source_url: fedresurs.possible_url || parsed.trade_platform_url || null,
  };

  const sql = `
    insert into parser_trades
      (fedresurs_id, bidding_number, title, applications_count,
       lot_details, debtor_details, contact_details, prices, documents, raw_payload,
       category, region, brand, model, year, vin, start_price,
       date_start, date_finish, trade_place, source_url)
    values
      ($1,$2,$3,$4,
       $5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,
       $18,$19,$20,$21)
    on conflict (fedresurs_id) do update set
      bidding_number     = excluded.bidding_number,
      title              = excluded.title,
      applications_count = excluded.applications_count,
      lot_details        = excluded.lot_details,
      debtor_details     = excluded.debtor_details,
      contact_details    = excluded.contact_details,
      prices             = excluded.prices,
      documents          = excluded.documents,
      raw_payload        = excluded.raw_payload,
      category           = excluded.category,
      region             = excluded.region,
      brand              = excluded.brand,
      model              = excluded.model,
      year               = excluded.year,
      vin                = excluded.vin,
      start_price        = excluded.start_price,
      date_start         = excluded.date_start,
      date_finish        = excluded.date_finish,
      trade_place        = excluded.trade_place,
      source_url         = excluded.source_url
    returning id
  `;

  const values = [
    params.fedresurs_id, params.bidding_number, params.title, params.applications_count,
    params.lot_details, params.debtor_details, params.contact_details, JSON.stringify(params.prices),
    JSON.stringify(params.documents), params.raw_payload,
    params.category, params.region, params.brand, params.model, params.year, params.vin, params.start_price,
    params.date_start, params.date_finish, params.trade_place, params.source_url,
  ];

  const { rows } = await query(sql, values);
  return rows[0]?.id;
}

router.get('/parser-trades', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const filters = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(title ilike $${params.length} or region ilike $${params.length} or brand ilike $${params.length} or model ilike $${params.length} or vin ilike $${params.length})`);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * pageSize;

    const whereSql = filters.length ? `where ${filters.join(' and ')}` : '';
    const totalSql = `select count(*)::int as c from parser_trades ${whereSql}`;
    const listSql = `
      select id, title, region, category, brand, model, year, vin, start_price,
             date_finish, trade_place, source_url, created_at
        from parser_trades
      ${whereSql}
      order by created_at desc
      limit $${params.length + 1} offset $${params.length + 2}
    `;

    const [{ rows: [{ c: total }] }, { rows: items }] = await Promise.all([
      query(totalSql, params),
      query(listSql, [...params, pageSize, offset]),
    ]);

    res.json({ items, total, page: pageNum, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error('admin parser-trades list error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

router.get('/parser-trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('select * from parser_trades where id = $1', [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'not found' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error('admin parser-trade detail error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/actions/ingest', async (req, res) => {
  try {
    const { search = 'vin', start_date, end_date, limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = req.body || {};

    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : DEFAULT_LIMIT;
    const safeOffset = Number.isFinite(offsetNum) && offsetNum >= 0 ? offsetNum : DEFAULT_OFFSET;

    const baseUrl = process.env.PARSER_BASE_URL || PARSER_FALLBACK_BASE;
    const url = new URL('/parse-fedresurs-trades', baseUrl);
    url.searchParams.set('search_string', String(search));
    if (start_date) url.searchParams.set('start_date', String(start_date));
    if (end_date) url.searchParams.set('end_date', String(end_date));
    url.searchParams.set('limit', String(safeLimit));
    url.searchParams.set('offset', String(safeOffset));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || data == null) {
      return res.status(502).json({ error: 'parser failed', status: response.status, sample: data });
    }

    let parsed;
    try {
      parsed = normalizeParserResponse(data);
    } catch (error) {
      console.error('normalize parser payload failed:', error?.message);
      return res.status(502).json({ error: 'parser failed', status: response.status, reason: error?.message, sample: data });
    }

    const { items, meta } = parsed;

    let upserted = 0;
    for (const item of items) {
      try {
        await upsertParserTrade(item);
        upserted += 1;
      } catch (error) {
        console.error('UPSERT parser_trades error:', error?.message);
      }
    }

    return res.json({
      ok: true,
      received: items.length,
      upserted,
      limit: safeLimit,
      offset: safeOffset,
      parser_meta: meta,
    });
  } catch (error) {
    console.error('ingest call error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/parser-trades/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('select * from parser_trades where id = $1', [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'not found' });
    }

    const trade = rows[0];
    const currency = 'RUB';
    const prices = Array.isArray(trade.prices) ? trade.prices : [];
    const lastPrice = prices.length
      ? Number(String(prices[prices.length - 1]?.price ?? prices[prices.length - 1]?.currentPrice ?? prices[prices.length - 1]?.current_price ?? '').replace(/\s/g, '').replace(',', '.'))
      : null;
    const currentPrice = lastPrice || trade.start_price || null;

    const details = {
      lot_details: trade.lot_details || null,
      debtor_details: trade.debtor_details || null,
      contact_details: trade.contact_details || null,
      prices: prices.length ? prices : null,
      documents: Array.isArray(trade.documents) ? trade.documents : null,
      fedresurs_meta: trade.raw_payload?.fedresurs_data || null,
    };

    const sourceId = trade.fedresurs_id || trade.bidding_number || trade.id;

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
      sourceId,
      trade.title || [trade.brand, trade.model, trade.year].filter(Boolean).join(' ') || 'Лот',
      trade.lot_details?.description || null,
      trade.category || 'vehicle',
      trade.region || null,
      currency,
      trade.start_price || null,
      currentPrice,
      null,
      trade.date_finish || null,
      trade.source_url || null,
      details,
    ]);

    return res.json({ ok: true });
  } catch (error) {
    console.error('publish error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
