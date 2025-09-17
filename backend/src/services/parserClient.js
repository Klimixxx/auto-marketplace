// backend/src/services/parserClient.js
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.PARSER_BASE_URL,
  timeout: Number(process.env.PARSER_API_TIMEOUT || 30000),
});

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

function normalizeParserPayload(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, meta: { total_found: payload.length } };
  }

  if (payload && typeof payload === 'object') {
    const items = pickResultsArray(payload);
    if (!items) {
      throw new Error('Parser payload does not contain a results array');
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

async function parseFedresursTrades({ search_string = 'vin', start_date, end_date, limit = 15, offset = 0 }) {
  const params = { search_string, start_date, end_date, limit, offset };
  const { data } = await client.get('/parse-fedresurs-trades', { params });
  return normalizeParserPayload(data);
}

module.exports = { parseFedresursTrades, normalizeParserPayload };
