const axios = require('axios');

const client = axios.create({
  baseURL: process.env.PARSER_BASE_URL,
  timeout: Number(process.env.PARSER_API_TIMEOUT || 30000),
});

function toFiniteNumber(value) {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeParserPayload(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, meta: { total_found: payload.length } };
  }

  if (payload && typeof payload === 'object') {
    const results = Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
          ? payload.data
          : null;

    if (!results) {
      throw new Error('Parser payload does not contain a results array');
    }

    const meta = {};
    const total = toFiniteNumber(payload.total_found ?? payload.total ?? payload.count ?? payload.totalCount);
    if (total !== undefined) meta.total_found = total;
    const limit = toFiniteNumber(payload.limit ?? payload.page_size ?? payload.per_page);
    if (limit !== undefined) meta.limit = limit;
    const offset = toFiniteNumber(payload.offset ?? payload.page ?? payload.page_number);
    if (offset !== undefined) meta.offset = offset;
    if (typeof payload.has_more === 'boolean') meta.has_more = payload.has_more;

    if (meta.total_found === undefined) {
      meta.total_found = results.length;
    }

    return { items: results, meta };
  }

  throw new Error(`Unexpected parser payload type: ${typeof payload}`);
}

async function parseFedresursTrades({ search_string = 'vin', start_date, end_date, limit = 15, offset = 0 }) {
  const params = { search_string, start_date, end_date, limit, offset };
  const { data } = await client.get('/parse-fedresurs-trades', { params });
  return normalizeParserPayload(data);
}

module.exports = { parseFedresursTrades, normalizeParserPayload };
