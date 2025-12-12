// backend/src/services/parserClient.js

const BASE_URL =
  process.env.PARSER_BASE_URL || 'http://5.129.250.178:8000';

const DEFAULT_TIMEOUT_MS = 40 * 60 * 1000; // 40 минут
const FETCH_TIMEOUT_MS = (() => {
  const value = Number(process.env.PARSER_FETCH_TIMEOUT_MS);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return DEFAULT_TIMEOUT_MS;
})();

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
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value
        .filter((entry) => entry !== undefined && entry !== null && entry !== '')
        .forEach((entry) => {
          url.searchParams.append(key, String(entry));
        });
      return;
    }

    if (value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Parser request timed out'));
  }, FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Parser request timed out');
      err.status = 504;
      throw err;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const responseText = await response.text();

  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(`Parser request failed with status ${response.status}`);
    err.status = response.status;
    err.payload = data ?? responseText;
    throw err;
  }

  if (data == null) {
    return { results: [], total_found: 0 };
  }

  return data;
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
  region_codes,
  only_available = true,
}) {
  const params = { search_string, start_date, end_date, limit, only_available };
  if (Array.isArray(region_codes) && region_codes.length) {
    params.region_codes = region_codes;
  } else if (region_code) {
    params.region_code = region_code;
  }

  const data = await fetchJson('/parse-fedresurs-trades-all', params);
  // "parse-all" в adminParser ожидает "сырые" данные
  return data;
}

const parserClient = {
  parseFedresursTrades,
  normalizeParserPayload,
  parseFedresursTradesAll,
};

export default parserClient;
