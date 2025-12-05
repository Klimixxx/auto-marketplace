// backend/src/services/parserClient.js

const BASE_URL =
  process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';
const TIMEOUT_MS = Number(process.env.PARSER_API_TIMEOUT || 30000);

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

export function normalizeParserPayload(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, meta: { total_found: payload.length } };
  }

  if (payload && typeof payload === 'object') {
    const items = pickResultsArray(payload);
    if (!items) {
      throw new Error('Parser payload does not contain a results array');
    }

    const meta = {};
    const total = toFinite(
      payload.total_found ??
        payload.total ??
        payload.count ??
        payload.totalCount,
    );
    if (total !== undefined) meta.total_found = total;
    const limit = toFinite(
      payload.limit ??
        payload.page_size ??
        payload.per_page ??
        payload.size,
    );
    if (limit !== undefined) meta.limit = limit;
    const offset = toFinite(
      payload.offset ??
        payload.page ??
        payload.page_number ??
        payload.start,
    );
    if (offset !== undefined) meta.offset = offset;
    if (typeof payload.has_more === 'boolean') {
      meta.has_more = payload.has_more;
    }

    if (meta.total_found === undefined) meta.total_found = items.length;

    return { items, meta };
  }

  throw new Error(`Unexpected parser payload type: ${typeof payload}`);
}

async function fetchJson(path, params = {}) {
  const url = new URL(path, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const err = new Error(`Parser request failed with status ${response.status}`);
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    if (data == null) {
      throw new Error('Parser returned empty response');
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseFedresursTrades({
  search_string = 'vin',
  start_date,
  end_date,
  limit = 15,
  offset = 0,
  region_code,
}) {
  const params = { search_string, start_date, end_date, limit, offset };
  if (region_code) {
    params.region_code = region_code;
  }

  const data = await fetchJson('/parse-fedresurs-trades', params);
  return normalizeParserPayload(data);
}

export async function parseFedresursTradesAll({
  search_string = 'vin',
  start_date,
  end_date,
  limit = 15,
  region_code,
  only_available = true,
}) {
  const params = { search_string, start_date, end_date, limit, only_available };
  if (region_code) {
    params.region_code = region_code;
  }

  const data = await fetchJson('/parse-fedresurs-trades-all', params);
  // тут возвращаем «сырые» данные, как и раньше
  return data;
}

const parserClient = {
  parseFedresursTrades,
  normalizeParserPayload,
  parseFedresursTradesAll,
};

export default parserClient;
