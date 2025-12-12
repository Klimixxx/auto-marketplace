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

  const startUrl = new URL('/parse-fedresurs-trades-all-stream/start', BASE_URL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Parser request timed out'));
  }, FETCH_TIMEOUT_MS);

  try {
    const startResponse = await fetch(startUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const startPayload = (await startResponse.json().catch(() => ({}))) || {};
    if (!startResponse.ok) {
      const err = new Error('Parser job start failed');
      err.status = startResponse.status;
      err.payload = startPayload;
      throw err;
    }

    const { jobId } = startPayload;
    if (!jobId) {
      throw new Error('Parser jobId is missing in response');
    }

    const streamUrl = new URL(`/parse-fedresurs-trades-all-stream/${jobId}`, BASE_URL);
    const streamResponse = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
      },
      signal: controller.signal,
    });

    if (!streamResponse.ok || !streamResponse.body) {
      const err = new Error(`Parser stream failed with status ${streamResponse.status}`);
      err.status = streamResponse.status;
      throw err;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const items = [];
    let totalFound;
    let parsed;
    let donePayload = null;

    for await (const chunk of streamResponse.body) {
      buffer += decoder.decode(chunk, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line);

        if (!lines.length || lines[0].startsWith(':')) continue;

        let eventName = 'message';
        const dataLines = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.replace('event:', '').trim() || 'message';
          } else if (line.startsWith('data:')) {
            dataLines.push(line.replace('data:', '').trim());
          }
        }

        let payload = null;
        const dataStr = dataLines.join('\n');
        if (dataStr) {
          try {
            payload = JSON.parse(dataStr);
          } catch (error) {
            payload = dataStr;
          }
        }

        if (eventName === 'error') {
          const err = new Error(payload?.detail || 'Parser stream error');
          err.status = 502;
          throw err;
        }

        if (eventName === 'meta' && payload?.stage === 'collected') {
          totalFound = payload.total_found ?? totalFound;
        }

        if (eventName === 'item' && payload?.item) {
          items.push(payload.item);
          parsed = payload.parsed ?? parsed;
          totalFound = payload.total_found ?? totalFound;
        }

        if (eventName === 'done') {
          donePayload = typeof payload === 'object' && payload !== null ? payload : null;
          parsed = payload?.parsed ?? parsed;
          totalFound = payload?.total_found ?? totalFound;
          buffer = '';
          break;
        }
      }

      if (donePayload) break;
    }

    const summary = {
      results: items,
      total_found: totalFound ?? items.length,
      parsed: parsed ?? items.length,
    };

    if (donePayload) {
      return { ...donePayload, ...summary };
    }

    return summary;
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
}

const parserClient = {
  parseFedresursTrades,
  normalizeParserPayload,
  parseFedresursTradesAll,
};

export default parserClient;
