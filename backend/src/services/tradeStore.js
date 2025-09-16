// backend/src/services/tradeStore.js
const { pool } = require('../db');

function pickSafeNumber(n) {
  if (n == null) return null;
  const num = Number(String(n).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

async function upsertTradeFromParsedObject(item) {
  // Защитно поддержим 2 возможные формы
  const fed = item.fedresurs_data || {};
  const pr  = item.parsed_data    || item || {};

  const fedresursId     = pr.fedresurs_id || fed.guid || fed.number || pr.bidding_number || null;
  const biddingNumber   = pr.bidding_number || null;
  const title           = pr.title || null;
  const lot             = pr.lot_details || {};
  const debtor          = pr.debtor_details || {};
  const contact         = pr.contact_details || {};
  const prices          = pr.prices || [];
  const documents       = pr.documents || [];
  const region          = lot.region || null;
  const brand           = lot.brand || null;
  const model           = lot.model || null;
  const year            = lot.year || null;
  const vin             = lot.vin || null;
  const startPrice      = pickSafeNumber(lot.start_price);
  const applicationsCnt = pr.applications_count ?? null;

  const dateStart       = fed.dateStart ? new Date(fed.dateStart) : null;
  const dateFinish      = fed.dateFinish ? new Date(fed.dateFinish) : null;
  const tradePlace      = fed.tradePlace?.name || null;
  const sourceUrl       = fed.possible_url || null;

  const category        = lot.category || null;

  const rawPayload = { fedresurs_data: fed, parsed_data: pr };

  const sql = `
    insert into parser_trades
      (fedresurs_id, bidding_number, title, category, region, brand, model, year, vin,
       start_price, applications_count, date_start, date_finish, trade_place, source_url,
       lot_details, debtor_details, contact_details, prices, documents, raw_payload)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
       $16,$17,$18,$19,$20,$21)
    on conflict (fedresurs_id) do update set
      bidding_number = excluded.bidding_number,
      title          = excluded.title,
      category       = excluded.category,
      region         = excluded.region,
      brand          = excluded.brand,
      model          = excluded.model,
      year           = excluded.year,
      vin            = excluded.vin,
      start_price    = excluded.start_price,
      applications_count = excluded.applications_count,
      date_start     = excluded.date_start,
      date_finish    = excluded.date_finish,
      trade_place    = excluded.trade_place,
      source_url     = excluded.source_url,
      lot_details    = excluded.lot_details,
      debtor_details = excluded.debtor_details,
      contact_details= excluded.contact_details,
      prices         = excluded.prices,
      documents      = excluded.documents,
      raw_payload    = excluded.raw_payload
    returning id;
  `;

  const params = [
    fedresursId, biddingNumber, title, category, region, brand, model, year, vin,
    startPrice, applicationsCnt, dateStart, dateFinish, tradePlace, sourceUrl,
    lot, debtor, contact, JSON.stringify(prices), JSON.stringify(documents), rawPayload
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0]?.id;
}

module.exports = { upsertTradeFromParsedObject };
