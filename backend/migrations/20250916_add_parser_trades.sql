// backend/src/services/parserStore.js
const { pool } = require('../db'); // если у тебя ESM, замени на import/exports

function toNumberSafe(n) {
  if (n == null) return null;
  const num = Number(String(n).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

async function upsertParserTrade(item) {
  // поддерживаем варианты: {parsed_data, fedresurs_data} или плоский
  const fed = item?.fedresurs_data || {};
  const pr  = item?.parsed_data    || item || {};
  const lot = pr.lot_details || {};
  const debtor   = pr.debtor_details || {};
  const contact  = pr.contact_details || {};
  const prices   = pr.prices || [];
  const documents= pr.documents || [];

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
    photos: Array.isArray(pr.photos) ? pr.photos : [], // если парсер отдает photos отдельно
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
      bidding_number = excluded.bidding_number,
      title          = excluded.title,
      applications_count = excluded.applications_count,
      lot_details    = excluded.lot_details,
      debtor_details = excluded.debtor_details,
      contact_details= excluded.contact_details,
      prices         = excluded.prices,
      documents      = excluded.documents,
      raw_payload    = excluded.raw_payload,
      category       = excluded.category,
      region         = excluded.region,
      brand          = excluded.brand,
      model          = excluded.model,
      year           = excluded.year,
      vin            = excluded.vin,
      start_price    = excluded.start_price,
      date_start     = excluded.date_start,
      date_finish    = excluded.date_finish,
      trade_place    = excluded.trade_place,
      source_url     = excluded.source_url
    returning id
  `;

  const values = [
    params.fedresurs_id, params.bidding_number, params.title, params.applications_count,
    params.lot_details, params.debtor_details, params.contact_details, JSON.stringify(params.prices),
    JSON.stringify(params.documents), params.raw_payload,
    params.category, params.region, params.brand, params.model, params.year, params.vin, params.start_price,
    params.date_start, params.date_finish, params.trade_place, params.source_url,
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0]?.id;
}

module.exports = { upsertParserTrade };
