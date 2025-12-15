'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import FilterBar from '../../../components/FilterBar';
import computeTradeTiming from '../../../lib/tradeTiming';
import { formatTradeTypeLabel, normalizeTradeTypeCode } from '../../../lib/tradeTypes';
import { resolveSocketUrl } from '../../../lib/api';

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeBase(value) {
  if (!value) return '';
  let result = value;
  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  if (result === '/') return '';
  return result;
}

const API_BASE = normalizeBase(RAW_API_BASE);
const PAGE_SIZE = 20;
const PARSER_PAGE_SIZE = 50;
const MAX_STREAM_ITEMS = 200;
const DEFAULT_SEARCH_TERM = 'vin';
const DASH = 'вЂ”';
const ARROW_LEFT = 'в†ђ';
const ARROW_RIGHT = 'в†’';
const FILTER_STORAGE_KEY = 'adminListingsFilters';
const PARSE_STREAM_STORAGE_KEY = 'adminParseStreamState';
const PARSE_STREAM_STATE_TTL_MS = 10 * 60 * 1000;
const PARSE_JOB_ID_KEY = 'fedresurs_parse_job_id';

function readToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

function readStoredParseStreamState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PARSE_STREAM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to read stored parse stream state', error);
    return null;
  }
}

function persistParseStreamState(nextState) {
  if (typeof window === 'undefined') return;
  try {
    if (!nextState) {
      window.localStorage.removeItem(PARSE_STREAM_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PARSE_STREAM_STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn('Failed to persist parse stream state', error);
  }
}

function formatCurrency(value, currency = 'RUB') {
  if (value == null || value === '') return DASH;

  let numeric = null;
  if (typeof value === 'number') {
    numeric = Number.isFinite(value) ? value : null;
  } else if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    numeric = Number.isFinite(parsed) ? parsed : null;
  }

  if (numeric == null) return String(value);

  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

function formatDate(value) {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function formatTradeType(value) {
  const normalized = normalizeTradeTypeCode(value);
  return (
    formatTradeTypeLabel(normalized)
    || formatTradeTypeLabel(value)
    || normalized
    || value
    || DASH
  );
}

function pickFirstText(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return null;
}

function formatCreatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU');
}

function resolveSearchTerm(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || DEFAULT_SEARCH_TERM;
}

function cleanFilters(input = {}) {
  const result = {};
  Object.entries(input || {}).forEach(([key, rawValue]) => {
    if (rawValue == null) return;
    if (Array.isArray(rawValue)) {
      const normalized = rawValue
        .map((entry) => {
          if (entry == null) return null;
          const text = typeof entry === 'string' ? entry.trim() : String(entry);
          return text === '' ? null : text;
        })
        .filter(Boolean);
      if (!normalized.length) return;
      result[key] = Array.from(new Set(normalized));
      return;
    }
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (value === '') return;
    result[key] = value;
  });
  return result;
}

function pickPrimaryRegionCode(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry == null) continue;
      const text = typeof entry === 'string' ? entry.trim() : String(entry);
      if (text) return text;
    }
    return '';
  }
  if (typeof value === 'string') return value.trim();
  const text = String(value);
  return text === 'undefined' ? '' : text;
}

function extractRegionCodes(value) {
  const result = [];
  const seen = new Set();
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  list
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .forEach((entry) => {
      if (entry == null) return;
      const text = typeof entry === 'string' ? entry.trim() : String(entry);
      if (!text || seen.has(text)) return;
      seen.add(text);
      result.push(text);
    });
  return result;
}

function formatNumber(value) {
  if (value == null) return DASH;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    try {
      return new Intl.NumberFormat('ru-RU').format(numeric);
    } catch {
      return String(numeric);
    }
  }
  return String(value);
}

function safeJsonParse(payload) {
  try {
    return JSON.parse(payload);
  } catch (error) {
    console.warn('Failed to parse SSE payload', error);
    return null;
  }
}

function normalizeStreamItem(item) {
  const parsed = item?.parsed_data ?? {};
  const fedresurs = item?.fedresurs_data ?? {};

  const idBase = parsed.id || parsed.guid || fedresurs.id || fedresurs.guid || fedresurs.number || Date.now();
  const title = pickFirstText(parsed.title, parsed.name, fedresurs.title, fedresurs.name, 'Р›РѕС‚');
  const region = pickFirstText(parsed.region, parsed.region_name, fedresurs.region, fedresurs.region_code);
  const tradeType = pickFirstText(
    parsed.trade_type,
    parsed.tradeType,
    parsed.trade_type_code,
    fedresurs.trade_type,
    fedresurs.tradeType,
  );
  const startPrice =
    parsed.start_price
    ?? parsed.price
    ?? parsed.price_start
    ?? parsed.startPrice
    ?? fedresurs.start_price
    ?? fedresurs.price
    ?? fedresurs.price_start;
  const finishDate = pickFirstText(
    parsed.date_finish,
    parsed.finish_date,
    parsed.dateEnd,
    parsed.close_date,
    fedresurs.date_finish,
    fedresurs.dateEnd,
  );
  const sourceUrl = pickFirstText(
    parsed.source_url,
    parsed.url,
    parsed.lot_url,
    fedresurs.source_url,
    fedresurs.url,
    fedresurs.lot_href,
  );

  return {
    id: `stream-${idBase}`,
    title,
    region,
    trade_type: tradeType,
    start_price: startPrice,
    date_finish: finishDate,
    trade_place: parsed.trade_place || parsed.site || fedresurs.trade_place,
    source_url: sourceUrl,
    currency: parsed.currency || fedresurs.currency || 'RUB',
    created_at: parsed.created_at || parsed.createdAt || new Date().toISOString(),
    parsed_data: parsed,
    fedresurs_data: fedresurs,
  };
}

function loadStoredFilters() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return cleanFilters(parsed);
  } catch (error) {
    console.warn('Failed to read admin filters from storage', error);
    return {};
  }
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РїСЂРёРєСЂРµРїР»РµРЅРёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ SSE
// WS parse event handler
function handleParserEvent(
  payload,
  {
    setParseJobId,
    setParseStreamError,
    setParsingAll,
    setParseStreamMeta,
    setParseStreamProgress,
    setLastEventId,
    setItems,
    stopParseStream,
    loadPage,
    persistStreamState,
    parseStreamProgressRef,
    parseStreamLastEventIdRef,
  },
) {
  const eventId = payload?.id;
  const eventName = payload?.event || 'message';
  const data = payload?.data;

  if (eventId != null) {
    setLastEventId(eventId);
    if (parseStreamLastEventIdRef) {
      parseStreamLastEventIdRef.current = eventId;
    }
    persistStreamState({ last_event_id: eventId, active: true });
  }

  if (eventName === 'meta' && data) {
    setParseStreamError(null);
    setParsingAll(true);
    setParseStreamMeta(data);
    setParseStreamProgress((prev) => ({
      ...prev,
      stage: data.stage || prev?.stage,
      total_found: data.total_found ?? prev?.total_found,
    }));
    persistStreamState({ meta: data, active: true, error: null });
    return;
  }

  if (eventName === 'progress' && data) {
    setParseStreamError(null);
    setParsingAll(true);
    setParseStreamProgress(data);
    persistStreamState({ progress: data, active: true, error: null });
    return;
  }

  if (eventName === 'item' && data?.item) {
    setParseStreamError(null);
    setParsingAll(true);
    setParseStreamProgress((prev) => ({
      ...prev,
      stage: data.stage || prev?.stage,
      parsed: data.parsed ?? ((prev?.parsed ?? 0) + 1),
      total_found: data.total_found ?? prev?.total_found,
    }));

    persistStreamState({
      progress: {
        ...data,
        parsed: data.parsed ?? ((parseStreamProgressRef.current?.parsed ?? 0) + 1),
      },
      active: true,
      error: null,
    });

    setItems((prev) => {
      const normalized = normalizeStreamItem(data.item);
      return [normalized, ...prev].slice(0, MAX_STREAM_ITEMS);
    });
    return;
  }

  if (eventName === 'done') {
    const payloadData = data || {};
    setParseStreamProgress((prev) => ({ ...prev, ...payloadData, stage: payloadData.stage || 'done' }));
    setParseStreamError(null);
    setParsingAll(false);
    setParseJobId(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(PARSE_JOB_ID_KEY);
    }

    stopParseStream();
    loadPage(1);

    persistStreamState({
      active: false,
      error: null,
      progress: { ...parseStreamProgressRef.current, ...payloadData, stage: payloadData.stage || 'done' },
      last_event_id: parseStreamLastEventIdRef?.current || null,
    });
    return;
  }

  if (eventName === 'error') {
    const detail = data?.detail || data?.message || 'Ошибка потока';
    setParseJobId(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(PARSE_JOB_ID_KEY);
    }

    setParseStreamError(detail);
    setParsingAll(false);
    stopParseStream();
    persistStreamState({ error: detail, active: false, last_event_id: parseStreamLastEventIdRef?.current || null });
  }
}
export default function AdminParserTradesPage() {
  const router = useRouter();
  const initialStreamState = useMemo(() => readStoredParseStreamState(), []);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(() => loadStoredFilters());
  const filtersRef = useRef(filters);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [parsingAll, setParsingAll] = useState(Boolean(initialStreamState?.active));
  const [publishingId, setPublishingId] = useState(null);
  const [waitingId, setWaitingId] = useState(null);
  const [unpublishingId, setUnpublishingId] = useState(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [lastIngest, setLastIngest] = useState(null);
  const [progressSearchTerm, setProgressSearchTerm] = useState(DEFAULT_SEARCH_TERM);
  const [view, setView] = useState('drafts');
  const queryView = router.query?.view;
  const parseSocketRef = useRef(null);
  const [parseJobId, setParseJobId] = useState(
    typeof window !== 'undefined' ? localStorage.getItem(PARSE_JOB_ID_KEY) : null,
  );
  const parseJobIdRef = useRef(parseJobId);
  const parserSocketReadyRef = useRef(false);
  const [parseStreamMeta, setParseStreamMeta] = useState(initialStreamState?.meta || null);
  const [parseStreamProgress, setParseStreamProgress] = useState(initialStreamState?.progress || null);
  const [parseStreamError, setParseStreamError] = useState(initialStreamState?.error || null);
  const [parseStreamLastEventId, setParseStreamLastEventId] = useState(initialStreamState?.last_event_id || null);
  const parseStreamMetaRef = useRef(parseStreamMeta);
  const parseStreamProgressRef = useRef(parseStreamProgress);
  const parseStreamErrorRef = useRef(parseStreamError);
  const parseStreamLastEventIdRef = useRef(parseStreamLastEventId);
  const parsingAllRef = useRef(parsingAll);

  useEffect(() => {
    if (!router.isReady) return;
    const rawView = queryView;
    const viewParam = Array.isArray(rawView) ? rawView[0] : rawView;
    const normalized = viewParam === 'published' || viewParam === 'waiting' ? viewParam : 'drafts';
    setView((prev) => (prev === normalized ? prev : normalized));
  }, [router.isReady, queryView]);

  useEffect(() => {
    parseStreamMetaRef.current = parseStreamMeta;
  }, [parseStreamMeta]);

  useEffect(() => {
    parseStreamProgressRef.current = parseStreamProgress;
  }, [parseStreamProgress]);

  useEffect(() => {
    parseStreamErrorRef.current = parseStreamError;
  }, [parseStreamError]);

  useEffect(() => {
    parseStreamLastEventIdRef.current = parseStreamLastEventId;
  }, [parseStreamLastEventId]);

  useEffect(() => {
    parseJobIdRef.current = parseJobId;
  }, [parseJobId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (parseJobId) {
      localStorage.setItem(PARSE_JOB_ID_KEY, parseJobId);
    } else {
      localStorage.removeItem(PARSE_JOB_ID_KEY);
    }
  }, [parseJobId]);

  useEffect(() => {
    parsingAllRef.current = parsingAll;
  }, [parsingAll]);

  const persistStreamState = useCallback(
    (overrides = {}) => {
      const meta = overrides.meta !== undefined ? overrides.meta : parseStreamMetaRef.current;
      const progress = overrides.progress !== undefined ? overrides.progress : parseStreamProgressRef.current;
      const error = overrides.error !== undefined ? overrides.error : parseStreamErrorRef.current;
      const active = overrides.active !== undefined ? overrides.active : parsingAllRef.current;
      const lastEventId = overrides.last_event_id !== undefined
        ? overrides.last_event_id
        : parseStreamLastEventIdRef.current;

      if (!meta && !progress && !error && !active && !lastEventId) {
        persistParseStreamState(null);
        return;
      }

      persistParseStreamState({
        meta,
        progress,
        error,
        active,
        last_event_id: lastEventId,
        updated_at: new Date().toISOString(),
      });
    },
    [],
  );

  const stopParseStream = useCallback(() => {
    const socket = parseSocketRef.current;
    const jobId = parseJobIdRef.current;
    if (socket && jobId) {
      socket.emit('parser:fedresurs:stop', { jobId });
    }
  }, []);

  const subscribeToParserJob = useCallback(
    (jobId, lastEventId = null) => {
      if (!jobId) return;
      const payload = { jobId };
      if (lastEventId) payload.lastEventId = lastEventId;

      const socket = parseSocketRef.current;
      if (!socket || !parserSocketReadyRef.current) return;

      socket.emit('parser:fedresurs:subscribe', payload, (resp = {}) => {
        if (!resp.ok) {
          setParseStreamError(resp.error || 'Не удалось подписаться на поток парсера');
        }
      });
    },
    [setParseStreamError],
  );

  const startParserJob = useCallback(
    async (params) => new Promise((resolve, reject) => {
      const socket = parseSocketRef.current;
      if (!socket) {
        reject(new Error('Нет соединения с сокетом парсера'));
        return;
      }

      const sendStart = () => {
        socket.emit('parser:fedresurs:start', params, (resp = {}) => {
          if (resp.ok && resp.jobId) {
            resolve(resp.jobId);
          } else {
            reject(new Error(resp.error || 'Не удалось запустить парсер'));
          }
        });
      };

      if (parserSocketReadyRef.current || socket.connected) {
        sendStart();
        return;
      }

      const timeout = setTimeout(() => {
        socket.off('connect', onConnect);
        reject(new Error('Не удалось подключиться к сокету парсера'));
      }, 7000);

      const onConnect = () => {
        clearTimeout(timeout);
        sendStart();
      };

      socket.once('connect', onConnect);
    }),
    [],
  );

  useEffect(() => {
    persistStreamState();
  }, [parseStreamMeta, parseStreamProgress, parseStreamError, parsingAll, persistStreamState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (event) => {
      if (event.key && event.key !== PARSE_STREAM_STORAGE_KEY) return;
      const stored = readStoredParseStreamState();
      setParsingAll(Boolean(stored?.active));
      setParseStreamMeta(stored?.meta || null);
      setParseStreamProgress(stored?.progress || null);
      setParseStreamError(stored?.error || null);
      setParseStreamLastEventId(stored?.last_event_id || null);
      setParseJobId(typeof window !== 'undefined' ? localStorage.getItem(PARSE_JOB_ID_KEY) : null);
      const jobId = typeof window !== 'undefined' ? localStorage.getItem(PARSE_JOB_ID_KEY) : null;
      if (jobId && parserSocketReadyRef.current) {
        subscribeToParserJob(jobId, stored?.last_event_id || null);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [subscribeToParserJob]);

  // РђРІС‚РѕРїРѕРґРєР»СЋС‡РµРЅРёРµ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё СЃС‚СЂР°РЅРёС†С‹
  // автоподнятие активной подписки после перезагрузки
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const token = readToken();
    if (!token) return undefined;

    const socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token },
    });

    parseSocketRef.current = socket;

    const onEvent = (payload) =>
      handleParserEvent(payload, {
        setParseJobId,
        setParseStreamError,
        setParsingAll,
        setParseStreamMeta,
        setParseStreamProgress,
        setLastEventId: setParseStreamLastEventId,
        setItems,
        stopParseStream,
        loadPage,
        persistStreamState,
        parseStreamProgressRef,
        parseStreamLastEventIdRef,
      });

    socket.on('parser:fedresurs:event', onEvent);

    socket.on('connect', () => {
      parserSocketReadyRef.current = true;
      const currentJobId = parseJobIdRef.current;
      if (currentJobId) {
        subscribeToParserJob(currentJobId, parseStreamLastEventIdRef.current || null);
      }
    });

    socket.on('disconnect', () => {
      parserSocketReadyRef.current = false;
    });

    return () => {
      socket.off('parser:fedresurs:event', onEvent);
      socket.disconnect();
      parseSocketRef.current = null;
      parserSocketReadyRef.current = false;
    };
  }, [
    loadPage,
    persistStreamState,
    setItems,
    setParsingAll,
    setParseJobId,
    setParseStreamError,
    setParseStreamMeta,
    setParseStreamProgress,
    setParseStreamLastEventId,
    stopParseStream,
    subscribeToParserJob,
  ]);

  // восстановление состояния стрима из localStorage
  useEffect(() => {
    const jobId = typeof window !== 'undefined' ? localStorage.getItem(PARSE_JOB_ID_KEY) : null;
    if (!jobId) return;

    const storedState = readStoredParseStreamState();
    if (!storedState?.active) return;

    const resumeLastEventId = storedState?.last_event_id || null;
    setParseJobId(jobId);
    setParseStreamLastEventId(resumeLastEventId);
    parseStreamLastEventIdRef.current = resumeLastEventId;
    setParsingAll(true);
    setParseStreamMeta(storedState?.meta || null);
    setParseStreamProgress(storedState?.progress || null);
    setParseStreamError(storedState?.error || null);

    const payload = { jobId };
    if (resumeLastEventId) payload.lastEventId = resumeLastEventId;

    subscribeToParserJob(payload.jobId, payload.lastEventId || null);
  }, [subscribeToParserJob]);
  const changeView = useCallback(
    (nextView) => {
      setView(nextView);
      setItems([]);
      setPage(1);
      setPageCount(1);
      setPublishingId(null);
      setWaitingId(null);
      setUnpublishingId(null);
      setListLoading(true);
      setIngesting(false);
      if (!router.isReady) return;
      const nextQuery = { ...router.query };
      if (nextView === 'published') {
        nextQuery.view = 'published';
      } else if (nextView === 'waiting') {
        nextQuery.view = 'waiting';
      } else {
        delete nextQuery.view;
      }
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    },
    [router],
  );

  const applyProgress = useCallback((progress) => {
    if (!progress || typeof progress !== 'object') {
      setProgressSearchTerm(DEFAULT_SEARCH_TERM);
      setNextOffset(0);
      setLastIngest(null);
      return;
    }

    const toInt = (value, fallback = 0) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const searchTerm =
      typeof progress.search_term === 'string' && progress.search_term.trim()
        ? progress.search_term
        : DEFAULT_SEARCH_TERM;
    setProgressSearchTerm(searchTerm);

    const next = toInt(progress.next_offset, 0);
    setNextOffset(next);

    const lastOffset = toInt(progress.last_offset, 0);
    const received = toInt(progress.last_received, 0);
    const upserted = toInt(progress.last_upserted, 0);
    const limit = toInt(progress.last_limit, PARSER_PAGE_SIZE);
    const totalFoundRaw = progress.total_found;
    const totalFound = totalFoundRaw === null || totalFoundRaw === undefined ? null : toInt(totalFoundRaw, null);

    let hasMore = null;
    if (typeof progress.has_more === 'boolean') {
      hasMore = progress.has_more;
    } else if (totalFound != null) {
      hasMore = next < totalFound;
    }

    const updatedAt = progress.updated_at || null;
    const hasHistory = Boolean(
      updatedAt || received > 0 || upserted > 0 || lastOffset > 0 || (totalFound != null && totalFound > 0),
    );

    setLastIngest(
      hasHistory
        ? {
            offset: lastOffset,
            received,
            upserted,
            limit,
            nextOffset: next,
            totalFound,
            hasMore,
            updatedAt,
            searchTerm,
          }
        : null,
    );
  }, []);

  const fetchProgress = useCallback(
    async (searchTerm, regionCode) => {
      if (!API_BASE) {
        console.warn('NEXT_PUBLIC_API_BASE is not configured.');
        return;
      }

      const token = readToken();
      if (!token) {
        console.warn('No admin token found. Skip progress fetch.');
        return;
      }

      const params = new URLSearchParams();
      const normalizedSearch = typeof searchTerm === 'string' ? searchTerm.trim() : '';
      if (normalizedSearch) {
        params.set('search', resolveSearchTerm(normalizedSearch));
      }
      const normalizedRegion = pickPrimaryRegionCode(regionCode);
      if (normalizedRegion) {
        params.set('region_code', normalizedRegion);
      }

      const qs = params.toString();
      const url = qs ? `${API_BASE}/api/admin/parser-progress?${qs}` : `${API_BASE}/api/admin/parser-progress`;

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'failed');
        }
        applyProgress(data);
      } catch (error) {
        console.error('fetchProgress error:', error);
      }
    },
    [applyProgress],
  );

  const loadPage = useCallback(
    async (nextPage = 1, filtersOverride) => {
      if (!API_BASE) {
        console.warn('NEXT_PUBLIC_API_BASE is not configured.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Р”Р»СЏ РґРѕСЃС‚СѓРїР° РІ СЂР°Р·РґРµР» Р°РІС‚РѕСЂРёР·СѓР№С‚РµСЃСЊ РїРѕРґ Р°РґРјРёРЅ-Р°РєРєР°СѓРЅС‚РѕРј.');
        return;
      }

      const params = new URLSearchParams();
      const activeFilters = cleanFilters(filtersOverride ?? filtersRef.current);
      if (activeFilters.q) params.set('q', activeFilters.q);
      if (activeFilters.region_code) {
        const regionFilter = activeFilters.region_code;
        if (Array.isArray(regionFilter)) {
          regionFilter.forEach((code) => {
            if (code) params.append('region_code', code);
          });
        } else {
          params.set('region_code', regionFilter);
        }
      } else if (activeFilters.region) {
        params.set('region_code', activeFilters.region);
      }
      if (activeFilters.city) params.set('city', activeFilters.city);
      if (activeFilters.brand) params.set('brand', activeFilters.brand);
      if (activeFilters.trade_type) params.set('trade_type', activeFilters.trade_type);
      if (activeFilters.minPrice) params.set('minPrice', activeFilters.minPrice);
      if (activeFilters.maxPrice) params.set('maxPrice', activeFilters.maxPrice);
      params.set('page', String(nextPage));
      params.set('limit', String(PAGE_SIZE));
      const status = view === 'published' ? 'published' : view === 'waiting' ? 'waiting' : 'drafts';
      params.set('status', status);

      setListLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РѕР±СЉСЏРІР»РµРЅРёР№');
        }

        setItems(Array.isArray(data.items) ? data.items : []);
        setPage(data.page || nextPage);
        setPageCount(data.pageCount || 1);
        setTotalCount(Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
      } catch (error) {
        console.error('loadPage error:', error);
        alert(error.message || 'РћС€РёР±РєР° Р·Р°РїСЂРѕСЃР°');
      } finally {
        setListLoading(false);
      }
    },
    [view],
  );

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to persist admin filters', error);
    }
  }, [filters]);

  const resetParseStreamState = useCallback(() => {
    setParsingAll(false);
    setParseStreamMeta(null);
    setParseStreamProgress(null);
    setParseStreamError(null);
    setParseStreamLastEventId(null);
    parseStreamLastEventIdRef.current = null;
    stopParseStream();
    setParseJobId(null);
    persistParseStreamState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PARSE_JOB_ID_KEY);
    }
  }, [stopParseStream, persistParseStreamState]);
  useEffect(() => () => {
    stopParseStream();
  }, [stopParseStream]);

  useEffect(() => {
    if (view === 'drafts') {
      const searchTerm = filters.q || '';
      const primaryRegionCode = pickPrimaryRegionCode(filters.region_code);
      fetchProgress(searchTerm, primaryRegionCode);
    } else {
      applyProgress(null);
    }
  }, [view, fetchProgress, applyProgress, filters.q, filters.region_code]);

  useEffect(() => {
    if (!initialStreamState?.active) return;

    const updatedAtMs = initialStreamState?.updated_at ? Date.parse(initialStreamState.updated_at) : NaN;
    const isStale = Number.isFinite(updatedAtMs)
      ? Date.now() - updatedAtMs > PARSE_STREAM_STATE_TTL_MS
      : false;

    if (isStale) {
      resetParseStreamState();
    }
  }, [initialStreamState, resetParseStreamState]);

  const handleFilterSearch = useCallback(
    (nextFilters) => {
      const cleaned = cleanFilters(nextFilters);
      setFilters(cleaned);
      filtersRef.current = cleaned;
      setPage(1);
      loadPage(1, cleaned);
    },
    [loadPage],
  );

  const runParseAll = useCallback(async () => {
    if (view !== 'drafts') return;
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не указан. Укажите его для работы кнопки.');
      return;
    }

    const token = readToken();
    if (!token) {
      alert('Для запуска парсера нужен вход в систему.');
      return;
    }

    const searchTerm = resolveSearchTerm(filters.q || '');
    let selectedRegions = extractRegionCodes(filters.region_code);
    if (!selectedRegions.length && filters.region) {
      selectedRegions = extractRegionCodes(filters.region);
    }

    if (!selectedRegions.length) {
      alert('Укажите хотя бы один регион перед запуском парсинга.');
      return;
    }

    setParsingAll(true);
    setParseStreamError(null);
    setParseStreamMeta(null);
    setParseStreamProgress(null);
    setParseStreamLastEventId(null);
    parseStreamLastEventIdRef.current = null;
    stopParseStream();
    setParseJobId(null);

    try {
      const jobId = await startParserJob({
        search_string: searchTerm,
        limit: PARSER_PAGE_SIZE,
        only_available: true,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null,
        region_codes: selectedRegions,
        region_code: selectedRegions.length === 1 ? selectedRegions[0] : null,
      });

      setParseJobId(jobId);
      persistStreamState({ active: true, last_event_id: null, meta: null, progress: null, error: null });
      subscribeToParserJob(jobId, null);
    } catch (error) {
      console.error('Failed to start parse job:', error);
      setParseStreamError('Не удалось запустить парсер');
      setParsingAll(false);
      setParseStreamLastEventId(null);
      parseStreamLastEventIdRef.current = null;
      setParseJobId(null);
      persistStreamState({ error: 'Не удалось запустить парсер', active: false, last_event_id: null });
    }
  }, [filters, view, persistStreamState, startParserJob, stopParseStream, subscribeToParserJob]);
  const runIngest = useCallback(
    async ({ reset = false } = {}) => {
      if (view !== 'drafts') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE РЅРµ Р·Р°РґР°РЅ. РќРµРІРѕР·РјРѕР¶РЅРѕ РІС‹Р·РІР°С‚СЊ РїР°СЂСЃРµСЂ.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ Р°РґРјРёРЅ-Р°РєРєР°СѓРЅС‚.');
        return;
      }

      const searchTerm = resolveSearchTerm(filters.q || '');
      let selectedRegions = extractRegionCodes(filters.region_code);
      if (!selectedRegions.length && filters.region) {
        selectedRegions = extractRegionCodes(filters.region);
      }
      if (!selectedRegions.length) {
        alert('Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ СЂРµРіРёРѕРЅ РїРµСЂРµРґ Р·Р°РїСѓСЃРєРѕРј РїР°СЂСЃРёРЅРіР°.');
        return;
      }
      const primaryRegionCode = pickPrimaryRegionCode(selectedRegions);
      const offsetToUse = reset ? 0 : nextOffset;

      const payload = {
        search: searchTerm,
        limit: PARSER_PAGE_SIZE,
        reset: Boolean(reset),
        region_codes: selectedRegions,
      };

      if (selectedRegions.length === 1) {
        payload.region_code = selectedRegions[0];
      }

      if (!reset) {
        const offsetsMap = {};
        if (primaryRegionCode && Number.isFinite(Number(offsetToUse))) {
          offsetsMap[primaryRegionCode] = Number(offsetToUse);
        }
        if (Object.keys(offsetsMap).length) {
          payload.offset_map = offsetsMap;
        }
        if (selectedRegions.length === 1 && Number.isFinite(Number(offsetToUse))) {
          payload.offset = Number(offsetToUse);
        }
      } else if (selectedRegions.length === 1) {
        payload.offset = 0;
      }

      setIngesting(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/actions/ingest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ РїР°СЂСЃРµСЂ');
        }
        const regionsResult = Array.isArray(data.regions) ? data.regions : [];
        const targetRegion = regionsResult.find((entry) => entry.region_code === primaryRegionCode)
          || regionsResult[0]
          || null;

        if (targetRegion && targetRegion.ok && targetRegion.progress) {
          applyProgress(targetRegion.progress);
        } else if (data.progress) {
          applyProgress(data.progress);
        } else if (targetRegion && targetRegion.progress) {
          applyProgress(targetRegion.progress);
        }

        if (regionsResult.length) {
          const summaryLines = regionsResult.map((entry) => {
            const label = entry.region || entry.region_code || 'Р РµРіРёРѕРЅ';
            if (!entry.ok) {
              const message = entry.error?.message || data.error || 'РћС€РёР±РєР° РїР°СЂСЃРёРЅРіР°';
              return `вљ пёЏ ${label}: ${message}`;
            }
            const receivedCount = Number.isFinite(Number(entry.received)) ? Number(entry.received) : 0;
            const upsertedCount = Number.isFinite(Number(entry.upserted)) ? Number(entry.upserted) : 0;
            const nextValue = Number.isFinite(Number(entry.next_offset))
              ? Number(entry.next_offset)
              : entry.next_offset ?? 'вЂ”';
            return `вЂў ${label}: РїРѕР»СѓС‡РµРЅРѕ ${receivedCount}, СЃРѕС…СЂР°РЅРµРЅРѕ ${upsertedCount}, СЃР»РµРґСѓСЋС‰РёР№ offset ${nextValue}`;
          });
          const header = data.ok === false ? 'РџР°СЂСЃРµСЂ Р·Р°РІРµСЂС€С‘РЅ СЃ РѕС€РёР±РєР°РјРё:' : 'РџР°СЂСЃРµСЂ Р·Р°РІРµСЂС€С‘РЅ:';
          alert(`${header}\n${summaryLines.join('\n')}`);
        } else {
          const baseOffset = Number.isFinite(Number(data.offset)) ? Number(data.offset) : offsetToUse;
          const receivedCount = Number.isFinite(Number(data.received)) ? Number(data.received) : 0;
          const limitUsed = Number.isFinite(Number(data.limit)) ? Number(data.limit) : PARSER_PAGE_SIZE;
          const upsertedCount = Number.isFinite(Number(data.upserted)) ? Number(data.upserted) : 0;
          const fallbackProgress = {
            search_term: searchTerm,
            region_code: primaryRegionCode,
            next_offset: Number.isFinite(Number(data.next_offset))
              ? Number(data.next_offset)
              : baseOffset + (receivedCount || limitUsed),
            last_offset: baseOffset,
            last_received: receivedCount,
            last_upserted: upsertedCount,
            last_limit: limitUsed,
            total_found: data.parser_meta?.total_found ?? null,
            has_more: data.parser_meta?.has_more ?? null,
            updated_at: new Date().toISOString(),
          };
          applyProgress(fallbackProgress);
          alert(
            `РџРѕР»СѓС‡РµРЅРѕ: ${receivedCount}, СЃРѕС…СЂР°РЅРµРЅРѕ/РѕР±РЅРѕРІР»РµРЅРѕ: ${upsertedCount}. `
              + `РўРµРєСѓС‰РёР№ offset: ${baseOffset}, СЃР»РµРґСѓСЋС‰РёР№: ${Number(data.next_offset) || nextOffset}.`,
          );
        }

        await loadPage(1);
        if (primaryRegionCode) {
          await fetchProgress(searchTerm, primaryRegionCode);
        }
      } catch (error) {
        console.error('ingest error:', error);
        alert(`РћС€РёР±РєР°: ${error.message || 'ingest failed'}`);
      } finally {
        setIngesting(false);
      }
    },
    [filters, loadPage, nextOffset, applyProgress, fetchProgress, view],
  );

  const publish = useCallback(
    async (id) => {
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE РЅРµ Р·Р°РґР°РЅ. РќРµРІРѕР·РјРѕР¶РЅРѕ РѕРїСѓР±Р»РёРєРѕРІР°С‚СЊ РѕР±СЉСЏРІР»РµРЅРёРµ.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ Р°РґРјРёРЅ-Р°РєРєР°СѓРЅС‚.');
        return;
      }

      setPublishingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/publish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        alert('РћР±СЉСЏРІР»РµРЅРёРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅРѕ РЅР° СЃР°Р№С‚Рµ.');
        await loadPage(page);
      } catch (error) {
        console.error('publish error:', error);
        alert(`РћС€РёР±РєР° РїСѓР±Р»РёРєР°С†РёРё: ${error.message || 'failed'}`);
      } finally {
        setPublishingId(null);
      }
    },
    [page, loadPage],
  );

  const addToWaiting = useCallback(
    async (id) => {
      if (view === 'published') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE РЅРµ Р·Р°РґР°РЅ. РќРµРІРѕР·РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РѕР±СЉСЏРІР»РµРЅРёРµ РІ РѕР¶РёРґР°РЅРёРµ.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ Р°РґРјРёРЅ-Р°РєРєР°СѓРЅС‚.');
        return;
      }

      setWaitingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/wait`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        alert('РћР±СЉСЏРІР»РµРЅРёРµ РґРѕР±Р°РІР»РµРЅРѕ РІ СЂР°Р·РґРµР» РѕР¶РёРґР°РЅРёСЏ РїСѓР±Р»РёРєР°С†РёРё.');
        await loadPage(page);
      } catch (error) {
        console.error('waiting error:', error);
        alert(`РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё РІ РѕР¶РёРґР°РЅРёРµ: ${error.message || 'failed'}`);
      } finally {
        setWaitingId(null);
      }
    },
    [page, loadPage, view],
  );

  const unpublish = useCallback(
    async (id) => {
      if (view !== 'published') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE РЅРµ Р·Р°РґР°РЅ. РќРµРІРѕР·РјРѕР¶РЅРѕ СЃРЅСЏС‚СЊ РѕР±СЉСЏРІР»РµРЅРёРµ СЃ РїСѓР±Р»РёРєР°С†РёРё.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ Р°РґРјРёРЅ-Р°РєРєР°СѓРЅС‚.');
        return;
      }

      if (typeof window !== 'undefined') {
        const confirmed = window.confirm('РЎРЅСЏС‚СЊ РѕР±СЉСЏРІР»РµРЅРёРµ СЃ РїСѓР±Р»РёРєР°С†РёРё? РћРЅРѕ РёСЃС‡РµР·РЅРµС‚ РёР· СЂР°Р·РґРµР»Р° /trades.');
        if (!confirmed) return;
      }

      setUnpublishingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/unpublish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        alert('РћР±СЉСЏРІР»РµРЅРёРµ СЃРЅСЏС‚Рѕ СЃ РїСѓР±Р»РёРєР°С†РёРё Рё СЃРєСЂС‹С‚Рѕ РёР· СЂР°Р·РґРµР»Р° /trades.');
        await loadPage(page);
      } catch (error) {
        console.error('unpublish error:', error);
        alert(`РћС€РёР±РєР° СЃРЅСЏС‚РёСЏ СЃ РїСѓР±Р»РёРєР°С†РёРё: ${error.message || 'failed'}`);
      } finally {
        setUnpublishingId(null);
      }
    },
    [page, loadPage, view],
  );

  const isPublishedView = view === 'published';
  const isWaitingView = view === 'waiting';
  const isDraftsView = !isPublishedView && !isWaitingView;
  const pageTitle = isPublishedView
    ? 'РђРґРјРёРЅРєР° вЂ” РћРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ РѕР±СЉСЏРІР»РµРЅРёСЏ'
    : isWaitingView
      ? 'РђРґРјРёРЅРєР° вЂ” РћР±СЉСЏРІР»РµРЅРёСЏ РІ РѕР¶РёРґР°РЅРёРё'
      : 'РђРґРјРёРЅРєР° вЂ” РћР±СЉСЏРІР»РµРЅРёСЏ (РёР· РїР°СЂСЃРµСЂР°)';
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;
  const ingestPrimaryLabel = ingesting ? 'Р—Р°РіСЂСѓР¶Р°РµРјвЂ¦' : 'РџРѕР»СѓС‡РёС‚СЊ РЅРѕРІС‹Рµ СЃ Р¤РµРґСЂРµСЃСѓСЂСЃР°';
  const ingestMoreLabel = ingesting ? 'Р—Р°РіСЂСѓР¶Р°РµРјвЂ¦' : 'РџРѕР»СѓС‡РёС‚СЊ РµС‰С‘ СЃ РїР°СЂСЃРµСЂР°';
  const parseAllLabel = parsingAll ? 'РџР°СЂСЃРёРј РІСЃРµвЂ¦' : 'РЎРџРђР РЎРРўР¬ Р’РЎР•';
  const ingestDisabled = ingesting || parsingAll;
  const streamStage = parseStreamProgress?.stage || parseStreamMeta?.stage;
  const streamParsed = Number.isFinite(Number(parseStreamProgress?.parsed))
    ? Number(parseStreamProgress.parsed)
    : null;
  const streamTotalFound = Number.isFinite(Number(parseStreamProgress?.total_found))
    ? Number(parseStreamProgress.total_found)
    : Number.isFinite(Number(parseStreamMeta?.total_found))
      ? Number(parseStreamMeta.total_found)
      : null;
  const streamCollected = Number.isFinite(Number(parseStreamProgress?.collected))
    ? Number(parseStreamProgress.collected)
    : null;
  const streamOffset = Number.isFinite(Number(parseStreamProgress?.offset))
    ? Number(parseStreamProgress.offset)
    : null;
  const streamRegions = Array.isArray(parseStreamMeta?.region_codes)
    ? parseStreamMeta.region_codes
    : parseStreamMeta?.region_code
      ? [parseStreamMeta.region_code]
      : null;
  const filterInitial = useMemo(() => ({ ...filters }), [filters]);

  return (
    <div className="container">
      <div className="admin-page">
        <div style={{ marginBottom: 12 }}>
          <Link
            href="/admin"
            className="link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span aria-hidden="true">в†ђ</span>
            <span>РђРґРјРёРЅ-РїР°РЅРµР»СЊ</span>
          </Link>
        </div>
        <div className="admin-page__header">
          <h1 className="admin-page__title">{pageTitle}</h1>
          <p className="admin-page__subtitle">
            {isPublishedView
              ? 'Р РµРґР°РєС‚РёСЂСѓР№С‚Рµ РѕР±СЉСЏРІР»РµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ РѕРїСѓР±Р»РёРєРѕРІР°РЅС‹ РЅР° СЃР°Р№С‚Рµ.'
              : isWaitingView
                ? 'РџРѕРґРіРѕС‚РѕРІР»РµРЅРЅС‹Рµ РѕР±СЉСЏРІР»РµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ РѕР¶РёРґР°СЋС‚ С„РёРЅР°Р»СЊРЅРѕР№ РїСЂРѕРІРµСЂРєРё РїРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№.'
                : 'РћС‚СЃР»РµР¶РёРІР°Р№С‚Рµ СЃРІРµР¶РёРµ РѕР±СЉСЏРІР»РµРЅРёСЏ РёР· РїР°СЂСЃРµСЂР° Рё РіРѕС‚РѕРІСЊС‚Рµ РёС… Рє РїСѓР±Р»РёРєР°С†РёРё.'}
          </p>
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-segment ${isDraftsView ? 'is-active' : ''}`}
            onClick={() => changeView('drafts')}
            disabled={view === 'drafts'}
          >
            РќРµРѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ
          </button>
          <button
            type="button"
            className={`admin-segment ${isWaitingView ? 'is-active' : ''}`}
            onClick={() => changeView('waiting')}
            disabled={view === 'waiting'}
          >
            РћР¶РёРґР°РЅРёРµ
          </button>
          <button
            type="button"
            className={`admin-segment ${isPublishedView ? 'is-active' : ''}`}
            onClick={() => changeView('published')}
            disabled={view === 'published'}
          >
            РћРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <FilterBar
            onSearch={handleFilterSearch}
            initial={filterInitial}
            favoritesCount={0}
            showFavoritesLink={false}
            showCityFilter={false}
          />
        </div>

        {isDraftsView ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 12,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="button button-small button-outline"
              onClick={() => runIngest({ reset: true })}
              disabled={ingestDisabled}
            >
              {ingestPrimaryLabel}
            </button>
            <button
              type="button"
              className="button button-small button-outline"
              onClick={() => runIngest({ reset: false })}
              disabled={ingestDisabled}
            >
              {ingestMoreLabel}
            </button>
            <button
              type="button"
              className="button button-small button-outline"
              onClick={runParseAll}
              disabled={ingestDisabled}
            >
              {parseAllLabel}
            </button>
          </div>
        ) : null}

        {isDraftsView && (parseStreamMeta || parseStreamProgress || parseStreamError) ? (
          <div className="admin-hint-card" style={{ marginTop: 12 }}>
            <div
              className="admin-hint-card__title"
              style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}
            >
              <span>{parsingAll ? 'РРґС‘С‚ РїРѕС‚РѕРєРѕРІС‹Р№ РїР°СЂСЃРёРЅРівЂ¦' : 'РџРѕСЃР»РµРґРЅРёР№ РїРѕС‚РѕРєРѕРІС‹Р№ РїР°СЂСЃРёРЅРі'}</span>
              <button type="button" className="button button-small button-ghost" onClick={resetParseStreamState}>
                РЎР±СЂРѕСЃРёС‚СЊ СЃС‚Р°С‚СѓСЃ
              </button>
            </div>
            <div className="admin-hint-card__meta" style={{ display: 'grid', gap: 6 }}>
              <span>
                Р—Р°РїСЂРѕСЃ: <strong>{parseStreamMeta?.search_string || progressSearchTerm}</strong>
              </span>
              {streamRegions ? (
                <span>
                  Р РµРіРёРѕРЅС‹: <strong>{streamRegions.join(', ')}</strong>
                </span>
              ) : null}
              {streamStage ? (
                <span>
                  РЎС‚Р°РґРёСЏ: <strong>{streamStage}</strong>
                </span>
              ) : null}
              {streamCollected != null ? (
                <span>
                  РЎРѕР±СЂР°РЅРѕ: <strong>{formatNumber(streamCollected)}</strong>
                </span>
              ) : null}
              {streamOffset != null ? (
                <span>
                  РўРµРєСѓС‰РёР№ offset: <strong>{formatNumber(streamOffset)}</strong>
                </span>
              ) : null}
              {streamTotalFound != null ? (
                <span>
                  РќР°Р№РґРµРЅРѕ РІСЃРµРіРѕ: <strong>{formatNumber(streamTotalFound)}</strong>
                </span>
              ) : null}
              {streamParsed != null ? (
                <span>
                  Р Р°СЃРїР°СЂСЃРµРЅРѕ: <strong>{formatNumber(streamParsed)}</strong>
                </span>
              ) : null}
            </div>
            {parseStreamError ? (
              <div className="admin-hint-card__meta" style={{ color: '#b91c1c' }}>
                РћС€РёР±РєР°: {parseStreamError}
              </div>
            ) : null}
          </div>
        ) : null}

        {isPublishedView ? (
          <div className="admin-hint-card">
            <div className="admin-hint-card__title">РћРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ РѕР±СЉСЏРІР»РµРЅРёСЏ</div>
            <p className="admin-hint-card__text">
              Р—РґРµСЃСЊ СЃРѕР±СЂР°РЅС‹ РѕР±СЉСЏРІР»РµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ РІРёРґСЏС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»Рё СЃР°Р№С‚Р°. Р’С‹ РјРѕР¶РµС‚Рµ РѕР±РЅРѕРІРёС‚СЊ РґР°РЅРЅС‹Рµ РёР»Рё СЃРЅСЏС‚СЊ Р»РѕС‚ РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё.
            </p>
          </div>
        ) : isWaitingView ? (
          <div className="admin-hint-card">
            <div className="admin-hint-card__title">РћР¶РёРґР°СЋС‰РёРµ РїСѓР±Р»РёРєР°С†РёРё</div>
            <p className="admin-hint-card__text">
              Р­С‚Рё РѕР±СЉСЏРІР»РµРЅРёСЏ РїСЂРѕС€Р»Рё РїРѕРґРіРѕС‚РѕРІРєСѓ Рё Р¶РґСѓС‚ С„РёРЅР°Р»СЊРЅРѕР№ Р·Р°РіСЂСѓР·РєРё С„РѕС‚РѕРіСЂР°С„РёР№ РёР»Рё РґРѕРєСѓРјРµРЅС‚РѕРІ. РџРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё РѕРїСѓР±Р»РёРєСѓР№С‚Рµ РёС… РЅР° СЃР°Р№С‚Рµ.
            </p>
          </div>
        ) : (
          <div className="admin-hint-card">
            <div className="admin-hint-card__title">РЎС‚Р°С‚СѓСЃ Р·Р°РіСЂСѓР·РєРё РїР°СЂСЃРµСЂР°</div>
            <div className="admin-hint-card__meta" style={{ display: 'grid', gap: 8 }}>
              <span>
                РћР±СЊСЏРІР»РµРЅРёР№ РІ Р±Р°Р·Рµ РїР°СЂСЃРµСЂР°: <strong>{formatNumber(lastIngest?.totalFound ?? totalCount ?? 0)}</strong>
              </span>
              <span>
                РћР±СЊСЏРІР»РµРЅРёР№ РІ РєР°С‚РµРіРѕСЂРёРё В«РќРµРїРѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹РµВ»: <strong>{formatNumber(totalCount)}</strong>
              </span>
              <span>
                РћР±РЅРѕРІР»РµРЅРѕ: {lastIngest?.updatedAt ? formatCreatedAt(lastIngest.updatedAt) || lastIngest.updatedAt : DASH}
              </span>
            </div>
            <div className="admin-hint-card__note">
              РўРµРєСѓС‰РёР№ Р·Р°РїСЂРѕСЃ: <strong>{progressSearchTerm}</strong>. РЎР»РµРґСѓСЋС‰РёР№ offset <strong>{nextOffset}</strong>.
            </div>
            {!lastIngest ? (
              <div className="admin-hint-card__footer">
                РСЃРїРѕР»СЊР·СѓР№С‚Рµ РєРЅРѕРїРєРё РІС‹С€Рµ, С‡С‚РѕР±С‹ Р·Р°РіСЂСѓР·РёС‚СЊ Р°РєС‚СѓР°Р»СЊРЅС‹Рµ РѕР±СЉСЏРІР»РµРЅРёСЏ РїРѕ РІС‹Р±СЂР°РЅРЅРѕРјСѓ С„РёР»СЊС‚СЂСѓ.
              </div>
            ) : null}
          </div>
        )}

        <div className="admin-table-card">
          <div className="admin-table-card__scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Р—Р°РіРѕР»РѕРІРѕРє</th>
                  <th>Р РµРіРёРѕРЅ</th>
                  <th>РўРёРї РѕР±СЉСЏРІР»РµРЅРёСЏ</th>
                  <th>РќР°С‡Р°Р»СЊРЅР°СЏ С†РµРЅР°</th>
                  <th>РћРєРѕРЅС‡Р°РЅРёРµ</th>
                  <th>Р”РµР№СЃС‚РІРёСЏ</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="admin-table__empty" colSpan={6}>
                      {listLoading ? 'Р—Р°РіСЂСѓР·РєР°вЂ¦' : 'Р—Р°РїРёСЃРµР№ РїРѕРєР° РЅРµС‚.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const createdAt = formatCreatedAt(item.created_at);
                    const publishedAt = formatCreatedAt(item.published_at);
                    const waitingAt = formatCreatedAt(item.waiting_at);
                    const isPublishing = publishingId === item.id;
                    const isWaiting = waitingId === item.id;
                    const isUnpublishing = unpublishingId === item.id;
                    const detailHref = {
                      pathname: '/admin/listings/[id]',
                      query: isPublishedView
                        ? { id: item.id, view: 'published' }
                        : isWaitingView
                          ? { id: item.id, view: 'waiting' }
                          : { id: item.id },
                    };
                    const tradeTypeLabel =
                      pickFirstText(
                        item.trade_type_label,
                        item.resolved_trade_type_label,
                        item?.lot_details?.trade_type_label,
                        item?.details?.trade_type_label,
                      );
                    const tradeTypeValue =
                      pickFirstText(
                        item.trade_type_resolved,
                        item.resolved_trade_type,
                        item.normalized_trade_type,
                        item.trade_type,
                        item.tradeType,
                        item?.lot_details?.trade_type,
                        item?.details?.trade_type,
                        tradeTypeLabel,
                      );
                    const tradeTypeCode = normalizeTradeTypeCode(tradeTypeValue);
                    const tradeTypeText =
                      tradeTypeLabel
                      || formatTradeType(tradeTypeValue)
                      || formatTradeType(tradeTypeLabel)
                      || DASH;
                    const tradeTypeCodeText = tradeTypeCode || tradeTypeValue;
                    const timing = computeTradeTiming(item);
                    const status = timing?.status;
                    const finishDateText = formatDate(timing?.finishDate || item.date_finish);
                    const statusColor = status?.color || '#334155';
                    const statusBackground = status?.color ? `${status.color}1a` : 'rgba(148,163,184,0.12)';

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="admin-table__title">{item.title || 'Р›РѕС‚'}</div>
                          <div className="admin-table__meta">
                            {item.source_url ? (
                              <a href={item.source_url} target="_blank" rel="noreferrer" className="link">
                                РСЃС‚РѕС‡РЅРёРє
                              </a>
                            ) : (
                              <span>{DASH}</span>
                            )}
                            {createdAt ? <span>РЎРѕР·РґР°РЅРѕ: {createdAt}</span> : null}
                          </div>
                          {publishedAt ? (
                            <div className="admin-table__meta">РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ: {publishedAt}</div>
                          ) : waitingAt ? (
                            <div className="admin-table__meta">Р’ РѕР¶РёРґР°РЅРёРё: {waitingAt}</div>
                          ) : null}
                        </td>
                        <td>{item.region || DASH}</td>
                        <td>
                          <div className="admin-table__value">{tradeTypeText}</div>
                          {tradeTypeCodeText && tradeTypeText !== tradeTypeCodeText ? (
                            <div className="admin-table__meta">РљРѕРґ: {tradeTypeCodeText}</div>
                          ) : null}
                        </td>
                        <td>{formatCurrency(item.start_price, item.currency || 'RUB')}</td>
                        <td>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 10px',
                              borderRadius: 999,
                              background: statusBackground,
                              color: statusColor,
                              fontWeight: 700,
                              border: `1px solid ${status?.color ? `${status.color}33` : 'rgba(148,163,184,0.35)'}`,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: statusColor,
                                display: 'inline-block',
                              }}
                            />
                            <span>{status?.label || 'РЎС‚Р°С‚СѓСЃ РЅРµ РѕРїСЂРµРґРµР»С‘РЅ'}</span>
                          </div>
                          {finishDateText ? (
                            <div className="admin-table__meta">РћРєРѕРЅС‡Р°РЅРёРµ: {finishDateText}</div>
                          ) : null}
                          {item.trade_place ? <div className="admin-table__meta">{item.trade_place}</div> : null}
                        </td>
                        <td>
                          <Link
                            href={detailHref}
                            className="button button-small button-outline"
                          >
                            РћС‚РєСЂС‹С‚СЊ
                          </Link>
                          {isPublishedView ? (
                            <button
                              type="button"
                              className="button button-small button-outline"
                              onClick={() => unpublish(item.id)}
                              disabled={isUnpublishing || listLoading}
                              style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                            >
                              {isUnpublishing ? 'РЎРЅРёРјР°РµРјвЂ¦' : 'РЎРЅСЏС‚СЊ СЃ РїСѓР±Р»РёРєР°С†РёРё'}
                            </button>
                          ) : isWaitingView ? (
                            <button
                              type="button"
                              className="button button-small"
                              onClick={() => publish(item.id)}
                              disabled={isPublishing || listLoading}
                            >
                              {isPublishing ? 'РџСѓР±Р»РёРєСѓРµРјвЂ¦' : 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button button-small"
                              onClick={() => addToWaiting(item.id)}
                              disabled={isWaiting || listLoading}
                            >
                              {isWaiting ? 'РћС‚РїСЂР°РІР»СЏРµРјвЂ¦' : 'РћР¶РёРґР°РЅРёРµ'}
                            </button>
                          )}
                          {item.source_url ? (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="button button-small button-outline"
                            >
                              РСЃС‚РѕС‡РЅРёРє
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-pagination">
          <button
            type="button"
            className="button button-small button-outline"
            onClick={() => loadPage(page - 1)}
            disabled={!canGoPrev || listLoading}
          >
            {ARROW_LEFT} РќР°Р·Р°Рґ
          </button>
          <div className="admin-pagination__info">
            РЎС‚СЂР°РЅРёС†Р° {page} РёР· {pageCount}
          </div>
          <button
            type="button"
            className="button button-small button-outline"
            onClick={() => loadPage(page + 1)}
            disabled={!canGoNext || listLoading}
          >
            Р’РїРµСЂС‘Рґ {ARROW_RIGHT}
          </button>
        </div>
      </div>
    </div>
  );
}
