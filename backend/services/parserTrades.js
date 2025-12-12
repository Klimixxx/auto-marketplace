import { query } from '../db.js';
import { getRegionNameByCode, normalizeRegionCode } from "../../shared/regions.js"

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

export function normalizePhotos(payload) {
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

export function toNumberSafe(value) {
  if (value == null) return null;
  const num = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

export async function upsertParserTrade(item) {
  const fedresurs = item?.fedresurs_data || {};
  const parsed = item?.parsed_data || item || {};
  const lotSource = parsed.lot_details && typeof parsed.lot_details === 'object' && !Array.isArray(parsed.lot_details)
    ? parsed.lot_details
    : {};
  const lot = { ...lotSource };
  const debtor = parsed.debtor_details || {};
  const contact = parsed.contact_details || {};
  const prices = Array.isArray(parsed.prices) ? parsed.prices : [];
  const documents = [];

  const regionCodeRaw =
    lot.region_code
    ?? lot.regionCode
    ?? parsed.region_code
    ?? parsed.regionCode
    ?? fedresurs.region_code
    ?? item?.region_code
    ?? null;
  const region_code = normalizeRegionCode(regionCodeRaw);
  const regionName = region_code ? getRegionNameByCode(region_code) : null;
  if (region_code) {
    lot.region_code = region_code;
    if (!lot.region && regionName) {
      lot.region = regionName;
    }
  }

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
    region: regionName || lot.region || null,
    region_code,
    brand: lot.brand || null,
    model: lot.model || null,
    year: lot.year || null,
    vin: lot.vin || null,
    start_price: toNumberSafe(lot.start_price),
    date_start: fedresurs.dateStart ? new Date(fedresurs.dateStart) : null,
    date_finish: fedresurs.dateFinish ? new Date(fedresurs.dateFinish) : null,
    trade_place: fedresurs.tradePlace?.name || null,
    source_url: fedresurs.possible_url || parsed.trade_platform_url || null,
    description,
    photos,
  };

  const sql = `
    insert into parser_trades
      (fedresurs_id, bidding_number, title, applications_count,
       lot_details, debtor_details, contact_details, prices, documents, raw_payload,
       category, region, region_code, brand, model, year, vin, start_price,
       date_start, date_finish, trade_place, source_url, description, photos)
    values
      ($1,$2,$3,$4,
       $5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,$18,
       $19,$20,$21,$22,$23,$24)
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
      region_code        = excluded.region_code,
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
    params.category, params.region, params.region_code, params.brand, params.model, params.year, params.vin, params.start_price,
    params.date_start, params.date_finish, params.trade_place, params.source_url, params.description,
    JSON.stringify(params.photos),
  ];

  const { rows } = await query(sql, values);
  return rows[0]?.id;
}

export default { upsertParserTrade, normalizePhotos, toNumberSafe };
