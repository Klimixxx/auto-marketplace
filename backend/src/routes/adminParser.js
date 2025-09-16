// backend/src/routes/adminParser.js (ESM)
import express from 'express';
import { query } from '../db.js';

const router = express.Router();

function toNumberSafe(n) {
  if (n == null) return null;
  const num = Number(String(n).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

async function upsertParserTrade(item) {
  // Поддерживаем { parsed_data, fedresurs_data } или плоский объект
  const fed = item?.fedresurs_data || {};
  const pr  = item?.parsed_data    || item || {};
  const lot = pr.lot_details || {};
  const debtor   = pr.debtor_details || {};
  const contact  = pr.contact_details || {};
  const prices   = Array.isArray(pr.prices) ? pr.prices : [];
  const documents= Array.isArray(pr.documents) ? pr.documents : [];

  const fedresursId   = pr.fedresurs_id || fed.guid || fed.number || pr.bidding_number || null;
  const biddingNumber = pr.bidding_number || null;

  const params = {
    fedresurs_id: fedresursId,
    bidding_number: biddingNumber,
    title: pr.title || [lot.brand, lot.model, lot.year].filter(Boolean).join(' ') || 'Лот',
    applications_count: pr.applications_count ?? null,
    lot_details: lot,
    debtor_details: debtor,
    contact_details: contact,
    prices,
    documents,
    raw_payload: { fedresurs_data: fed, parsed_data: pr },

    category: lot.category || null,
    region: lot.region || null,
    brand: lot.brand || null,
    model: lot.model || null,
    year: lot.year || null,
    vin: lot.vin || null,
    start_price: toNumberSafe(lot.start_price),

    date_start: fed.dateStart ? new Date(fed.dateStart) : null,
    date_finish: fed.dateFinish ? new Date(fed.dateFinish) : null,
    trade_place: fed.tradePlace?.name || null,
    source_url: fed.possible_url || pr.trade_platform_url || null,
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

// 1) Список объявлений из parser_trades
router.get('/parser-trades', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(title ilike $${params.length} or region ilike $${params.length} or brand ilike $${params.length} or model ilike $${params.length} or vin ilike $${params.length})`);
    }

    const pageNum = Math.max(1, parseInt(page));
    const size    = Math.min(100, Math.max(1, parseInt(limit)));
    const offset  = (pageNum - 1) * size;

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const totalSql = `select count(*)::int c from parser_trades ${whereSql}`;
    const listSql  = `
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
  } catch (e) {
    console.error('admin parser-trades list error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// 2) Детальная карточка из parser_trades
router.get('/parser-trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`select * from parser_trades where id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('admin parser-trade detail error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// 3) Кнопка «Спарсить»: дергаем парсер -> сохраняем в parser_trades
router.post('/actions/ingest', async (req, res) => {
  try {
    const { search = 'vin', start_date, end_date, limit = 50, offset = 0 } = req.body || {};
    const base = process.env.PARSER_BASE_URL || 'http://91.135.156.232:8000';
    const url  = new URL('/parse-fedresurs-trades', base);
    url.searchParams.set('search_string', String(search));
    if (start_date) url.searchParams.set('start_date', String(start_date));
    if (end_date)   url.searchParams.set('end_date',   String(end_date));
    url.searchParams.set('limit',  String(limit));
    url.searchParams.set('offset', String(offset));

    const r = await fetch(url.toString(), { method: 'GET', headers: { 'accept': 'application/json' }, cache: 'no-store' });
    const data = await r.json().catch(()=>null);
    if (!r.ok || !Array.isArray(data)) {
      return res.status(502).json({ error: 'parser failed', status: r.status, sample: data });
    }

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
    console.error('ingest call error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// 4) «Выложить»: перенос/обновление в listings (published=true)
router.post('/parser-trades/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`select * from parser_trades where id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    const t = rows[0];

    const currency = 'RUB';
    const prices = Array.isArray(t.prices) ? t.prices : [];
    const lastPrice = prices.length
      ? Number(String(prices[prices.length - 1]?.price ?? prices[prices.length - 1]?.currentPrice ?? prices[prices.length - 1]?.current_price ?? '').replace(/\s/g,'').replace(',','.'))
      : null;
    const currentPrice = lastPrice || t.start_price || null;

    const details = {
      lot_details: t.lot_details || null,
      debtor_details: t.debtor_details || null,
      contact_details: t.contact_details || null,
      prices: prices.length ? prices : null,
      documents: Array.isArray(t.documents) ? t.documents : null,
      fedresurs_meta: t.raw_payload?.fedresurs_data || null,
    };

    const source_id = t.fedresurs_id || t.bidding_number || t.id;

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
      currentPrice,
      null, // статус можно подтянуть из raw_payload при желании
      t.date_finish || null,
      t.source_url || null,
      details,
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('publish error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
