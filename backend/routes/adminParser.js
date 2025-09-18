import express from 'express';
import { query } from '../db.js';

const router = express.Router();

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 15;
const DEFAULT_OFFSET = 0;
const PARSER_FALLBACK_BASE = 'http://91.135.156.232:8000';
const DEFAULT_SEARCH_TERM = 'vin';

function parseJson(value, label = 'value') {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn(`Failed to parse JSON field ${label}:`, error?.message);
      return null;
    }
  }
  return null;
}

function parseJsonObject(value, label = 'value') {
  const parsed = parseJson(value, label);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function parseJsonArray(value, label = 'value') {
  if (Array.isArray(value)) return value;
  const parsed = parseJson(value, label);
  return Array.isArray(parsed) ? parsed : [];
}

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

function normalizePhotoEntry(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed ? { url: trimmed } : null;
  }

  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.link || photo.download_url || photo.source || null;
    if (!url) return null;
    const title = photo.title || photo.name || photo.caption || null;
    return title ? { url, title } : { url };
  }

  return null;
}

function normalizePhotos(payload) {
  if (!payload) return [];
  const list = Array.isArray(payload) ? payload : [payload];
  const normalized = [];
  const seen = new Set();
  for (const entry of list) {
    const photo = normalizePhotoEntry(entry);
    if (photo && !seen.has(photo.url)) {
      seen.add(photo.url);
      normalized.push(photo);
    }
  }
  return normalized;
}

function parseDate(value, fieldName = 'date') {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return date;
}

function resolveSearchTerm(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || DEFAULT_SEARCH_TERM;
}

function resolveSearchKey(value) {
  return resolveSearchTerm(value).toLowerCase();
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

  const description = parsed.description || lot.description || null;
  const photos = [
    ...normalizePhotos(item?.photos),
    ...normalizePhotos(parsed.photos),
    ...normalizePhotos(lot.photos || lot.images || lot.gallery || lot.photo_urls),
  ];

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
       date_start, date_finish, trade_place, source_url, description, photos)
    values
      ($1,$2,$3,$4,
       $5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,
       $18,$19,$20,$21,$22,$23)
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
      source_url         = excluded.source_url,
      description        = excluded.description,
      photos             = excluded.photos,
      updated_at         = now()
    returning id
  `;

  const values = [
    params.fedresurs_id, params.bidding_number, params.title, params.applications_count,
    params.lot_details, params.debtor_details, params.contact_details, JSON.stringify(params.prices),
    JSON.stringify(params.documents), params.raw_payload,
    params.category, params.region, params.brand, params.model, params.year, params.vin, params.start_price,
    params.date_start, params.date_finish, params.trade_place, params.source_url, params.description,
    JSON.stringify(params.photos),
  ];

  const { rows } = await query(sql, values);
  return rows[0]?.id;
}

router.get('/parser-trades', async (req, res) => {
  try {
    const { q, page = 1, limit = 20, status } = req.query;
    const filters = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(title ilike $${params.length} or region ilike $${params.length} or brand ilike $${params.length} or model ilike $${params.length} or vin ilike $${params.length})`);
    }
    const statusRaw = typeof status === 'string' ? status.trim().toLowerCase() : '';
    let effectiveStatus = 'drafts';
    if (statusRaw === 'published') {
      filters.push('published_at is not null');
      effectiveStatus = 'published';
    } else if (statusRaw === 'all') {
      effectiveStatus = 'all';
    } else {
      filters.push('published_at is null');
    }
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * pageSize;

    const whereSql = filters.length ? `where ${filters.join(' and ')}` : '';
    const totalSql = `select count(*)::int as c from parser_trades ${whereSql}`;
    const orderSql = effectiveStatus === 'published'
      ? 'order by published_at desc nulls last, created_at desc'
      : 'order by created_at desc';
    const listSql = `
      select id, title, region, category, brand, model, year, vin, start_price,
             date_finish, trade_place, source_url, created_at, published_at
        from parser_trades
      ${whereSql}
      ${orderSql}
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

router.get('/parser-progress', async (req, res) => {
  try {
    const search = req.query.search;
    let row;
    if (typeof search === 'string' && search.trim()) {
      const searchKey = resolveSearchKey(search);
      const { rows } = await query(
        `select search_key, search_term, next_offset, last_offset, last_received, last_upserted, last_limit, total_found, has_more, updated_at
           from parser_ingest_progress
          where search_key = $1`,
        [searchKey],
      );
      row = rows[0];
    } else {
      const { rows } = await query(
        `select search_key, search_term, next_offset, last_offset, last_received, last_upserted, last_limit, total_found, has_more, updated_at
           from parser_ingest_progress
          order by updated_at desc
          limit 1`,
        [],
      );
      row = rows[0];
    }

    if (!row) {
      return res.json({
        search_key: resolveSearchKey(search),
        search_term: resolveSearchTerm(search),
        next_offset: 0,
        last_offset: 0,
        last_received: 0,
        last_upserted: 0,
        last_limit: 0,
        total_found: null,
        has_more: null,
        updated_at: null,
      });
    }

    return res.json(row);
  } catch (error) {
    console.error('parser progress fetch error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

router.post('/actions/ingest', async (req, res) => {
  try {
    const { search, start_date, end_date, limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = req.body || {};

    const searchTerm = resolveSearchTerm(search);
    const searchKey = resolveSearchKey(search);

    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const safeLimit = Number.isFinite(limitNum) && limitNum > 0
      ? Math.min(limitNum, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const safeOffset = Number.isFinite(offsetNum) && offsetNum >= 0 ? offsetNum : DEFAULT_OFFSET;

    const baseUrl = process.env.PARSER_BASE_URL || PARSER_FALLBACK_BASE;
    const url = new URL('/parse-fedresurs-trades', baseUrl);
    url.searchParams.set('search_string', searchTerm);
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

    const baseOffset = Number.isFinite(meta?.offset) ? Number(meta.offset) : safeOffset;
    const limitUsed = Number.isFinite(meta?.limit) ? Number(meta.limit) : safeLimit;
    const receivedCount = Array.isArray(items) ? items.length : 0;
    const totalFound = Number.isFinite(meta?.total_found) ? Number(meta.total_found) : null;
    const nextOffset = baseOffset + receivedCount;
    const hasMore = typeof meta?.has_more === 'boolean'
      ? meta.has_more
      : totalFound == null
        ? null
        : nextOffset < totalFound;

    await query(
      `insert into parser_ingest_progress
         (search_key, search_term, next_offset, last_offset, last_received, last_upserted, last_limit, total_found, has_more)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (search_key) do update set
         search_term   = excluded.search_term,
         next_offset   = excluded.next_offset,
         last_offset   = excluded.last_offset,
         last_received = excluded.last_received,
         last_upserted = excluded.last_upserted,
         last_limit    = excluded.last_limit,
         total_found   = excluded.total_found,
         has_more      = excluded.has_more`,
      [
        searchKey,
        searchTerm,
        nextOffset,
        baseOffset,
        receivedCount,
        upserted,
        limitUsed,
        totalFound,
        hasMore,
      ],
    );

    const { rows: [progress] } = await query(
      `select search_key, search_term, next_offset, last_offset, last_received, last_upserted, last_limit, total_found, has_more, updated_at
         from parser_ingest_progress
        where search_key = $1`,
      [searchKey],
    );

    return res.json({
      ok: true,
      received: receivedCount,
      upserted,
      limit: limitUsed,
      offset: baseOffset,
      parser_meta: meta,
      next_offset: nextOffset,
      progress: progress || null,
    });
  } catch (error) {
    console.error('ingest call error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

router.patch('/parser-trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existingRows } = await query('select * from parser_trades where id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: 'not found' });
    }

    const payload = req.body || {};
    const updates = [];
    const values = [];

    function push(column, value) {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }

    if ('title' in payload) {
      push('title', payload.title || null);
    }

    if ('bidding_number' in payload) {
      push('bidding_number', payload.bidding_number || null);
    }

    if ('description' in payload) {
      push('description', payload.description || null);
    }

    if ('region' in payload) {
      push('region', payload.region || null);
    }

    if ('category' in payload) {
      push('category', payload.category || null);
    }

    if ('brand' in payload) {
      push('brand', payload.brand || null);
    }

    if ('model' in payload) {
      push('model', payload.model || null);
    }

    if ('year' in payload) {
      push('year', payload.year || null);
    }

    if ('vin' in payload) {
      push('vin', payload.vin || null);
    }

    if ('trade_place' in payload) {
      push('trade_place', payload.trade_place || null);
    }

    if ('source_url' in payload) {
      push('source_url', payload.source_url || null);
    }

    if ('applications_count' in payload) {
      const count = toFinite(payload.applications_count);
      push('applications_count', count ?? null);
    }

    if ('start_price' in payload) {
      push('start_price', toNumberSafe(payload.start_price));
    }

    if ('date_start' in payload) {
      try {
        push('date_start', parseDate(payload.date_start, 'date_start'));
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    if ('date_finish' in payload) {
      try {
        push('date_finish', parseDate(payload.date_finish, 'date_finish'));
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    let lotDetails = existing.lot_details || null;
    let lotDetailsShouldUpdate = false;
    if ('lot_details' in payload) {
      if (payload.lot_details === null) {
        lotDetails = null;
      } else if (typeof payload.lot_details === 'object' && !Array.isArray(payload.lot_details)) {
        lotDetails = payload.lot_details;
      } else {
        return res.status(400).json({ error: 'lot_details must be an object or null' });
      }
      lotDetailsShouldUpdate = true;
    }

    if ('description' in payload) {
      lotDetailsShouldUpdate = true;
      if (lotDetails && typeof lotDetails === 'object' && !Array.isArray(lotDetails)) {
        lotDetails = { ...lotDetails, description: payload.description || null };
      } else if (payload.description) {
        lotDetails = { description: payload.description };
      }
    }

    if (lotDetailsShouldUpdate) {
      push('lot_details', lotDetails);
    }

    if ('contact_details' in payload) {
      if (payload.contact_details === null) {
        push('contact_details', null);
      } else if (typeof payload.contact_details === 'object' && !Array.isArray(payload.contact_details)) {
        push('contact_details', payload.contact_details);
      } else {
        return res.status(400).json({ error: 'contact_details must be an object or null' });
      }
    }

    if ('debtor_details' in payload) {
      if (payload.debtor_details === null) {
        push('debtor_details', null);
      } else if (typeof payload.debtor_details === 'object' && !Array.isArray(payload.debtor_details)) {
        push('debtor_details', payload.debtor_details);
      } else {
        return res.status(400).json({ error: 'debtor_details must be an object or null' });
      }
    }

    if ('prices' in payload) {
      if (payload.prices === null) {
        push('prices', null);
      } else if (Array.isArray(payload.prices)) {
        push('prices', JSON.stringify(payload.prices));
      } else {
        return res.status(400).json({ error: 'prices must be an array or null' });
      }
    }

    if ('documents' in payload) {
      if (payload.documents === null) {
        push('documents', null);
      } else if (Array.isArray(payload.documents)) {
        push('documents', JSON.stringify(payload.documents));
      } else {
        return res.status(400).json({ error: 'documents must be an array or null' });
      }
    }

    if ('photos' in payload) {
      if (payload.photos === null) {
        push('photos', null);
      } else if (Array.isArray(payload.photos) || typeof payload.photos === 'string') {
        const normalizedPhotos = normalizePhotos(payload.photos);
        push('photos', JSON.stringify(normalizedPhotos));
      } else {
        return res.status(400).json({ error: 'photos must be an array, string or null' });
      }
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'no fields provided' });
    }

    updates.push('updated_at = now()');

    values.push(id);
    const sql = `
      update parser_trades
         set ${updates.join(', ')}
       where id = $${values.length}
       returning *
    `;

    const { rows } = await query(sql, values);
    return res.json(rows[0]);
  } catch (error) {
    console.error('parser-trades update error:', error);
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
    const prices = parseJsonArray(trade.prices, 'parser_trades.prices');
    const lastPriceEntry = prices.length ? prices[prices.length - 1] : null;
    const lastPrice = lastPriceEntry
      
      ? toNumberSafe(lastPriceEntry.price ?? lastPriceEntry.currentPrice ?? lastPriceEntry.current_price)
      : null;
    const currentPrice = lastPrice ?? toNumberSafe(trade.start_price) ?? null;

    const lotDetails = parseJsonObject(trade.lot_details, 'parser_trades.lot_details');
    const debtorDetails = parseJsonObject(trade.debtor_details, 'parser_trades.debtor_details');
    const contactDetails = parseJsonObject(trade.contact_details, 'parser_trades.contact_details');
    const documents = parseJsonArray(trade.documents, 'parser_trades.documents');
    const storedPhotos = parseJsonArray(trade.photos, 'parser_trades.photos');
    const normalizedPhotos = storedPhotos.length ? normalizePhotos(storedPhotos) : [];
    const rawPayload = parseJsonObject(trade.raw_payload, 'parser_trades.raw_payload');

    const details = {
      lot_details: lotDetails,
      debtor_details: debtorDetails,
      contact_details: contactDetails,
      prices: prices.length ? prices : null,
      documents: documents.length ? documents : null,
      fedresurs_meta: rawPayload?.fedresurs_data || null,
      photos: normalizedPhotos.length ? normalizedPhotos : null,
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
      trade.description || trade.lot_details?.description || null,
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

    await query(
      'update parser_trades set published_at = now(), updated_at = now() where id = $1',
      [id],
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('publish error:', error);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
