/*
 * Utilities to derive dynamic trade status and timing info from stored listing data.
 */
import { normalizeTradeTypeCode } from './tradeTypes';

function cleanText(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return value;
}

function parseNumberLike(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value
      .replace(/\u00a0/g, '')
      .replace(/\s/g, '')
      .replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function tryParseDateFromPattern(value) {
  const cleaned = value
    .replace(/\(.*?\)/g, '')
    .replace(/\bг\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const pattern = cleaned.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!pattern) return null;
  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw] = pattern;
  const day = Number.parseInt(dayRaw, 10);
  const month = Number.parseInt(monthRaw, 10) - 1;
  let year = Number.parseInt(yearRaw, 10);
  if (year < 100) year += 2000;
  const hour = hourRaw != null ? Number.parseInt(hourRaw, 10) : 0;
  const minute = minuteRaw != null ? Number.parseInt(minuteRaw, 10) : 0;
  const second = secondRaw != null ? Number.parseInt(secondRaw, 10) : 0;
  const date = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateLike(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numericTimestamp = Number(trimmed);
  if (Number.isFinite(numericTimestamp) && trimmed.length > 5) {
    const dateFromNumeric = new Date(numericTimestamp);
    if (!Number.isNaN(dateFromNumeric.getTime())) return dateFromNumeric;
  }

  const isoCandidate = trimmed
    .replace(/\u00a0/g, ' ')
    .replace(/\s+г(?:\.|ода)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parsedIso = Date.parse(isoCandidate);
  if (!Number.isNaN(parsedIso)) {
    const dateFromIso = new Date(parsedIso);
    if (!Number.isNaN(dateFromIso.getTime())) return dateFromIso;
  }

  const spacedIso = isoCandidate.replace(' ', 'T');
  const parsedSpaced = Date.parse(spacedIso);
  if (!Number.isNaN(parsedSpaced)) {
    const dateFromSpaced = new Date(parsedSpaced);
    if (!Number.isNaN(dateFromSpaced.getTime())) return dateFromSpaced;
  }

  return tryParseDateFromPattern(isoCandidate);
}

function pickFromSources(listing, keys = []) {
  if (!listing || !keys.length) return null;
  const pools = [listing, listing?.details, listing?.details?.lot_details];
  for (const pool of pools) {
    if (!pool || typeof pool !== 'object') continue;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(pool, key)) {
        const value = pool[key];
        if (value != null && value !== '') return value;
      }
      const lowerKey = typeof key === 'string' ? key.toLowerCase() : key;
      for (const candidateKey of Object.keys(pool)) {
        if (typeof candidateKey !== 'string') continue;
        if (candidateKey.toLowerCase() === lowerKey) {
          const value = pool[candidateKey];
          if (value != null && value !== '') return value;
        }
      }
    }
  }
  return null;
}

function arrayFrom(value) {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    const possibleArrays = ['items', 'list', 'data', 'results', 'rows'];
    for (const key of possibleArrays) {
      if (Array.isArray(value[key])) return value[key];
    }
    return Object.values(value);
  }
  return [];
}

function normalizePeriodEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const startRaw = cleanText(
    entry.date_start
      ?? entry.start_date
      ?? entry.period_start
      ?? entry.dateBegin
      ?? entry.date_from
      ?? entry.begin
      ?? entry.start
      ?? entry.from
  );
  const endRaw = cleanText(
    entry.date_end
      ?? entry.end_date
      ?? entry.period_end
      ?? entry.dateFinish
      ?? entry.date_to
      ?? entry.finish
      ?? entry.end
      ?? entry.to
  );
  const priceRaw = entry.price
    ?? entry.current_price
    ?? entry.currentPrice
    ?? entry.start_price
    ?? entry.startPrice
    ?? entry.value
    ?? entry.amount
    ?? entry.cost
    ?? entry.price_min
    ?? entry.minimum_price
    ?? entry.min_price
    ?? null;
  const minPriceRaw = entry.min_price
    ?? entry.minimum_price
    ?? entry.price_min
    ?? entry.priceMin
    ?? null;
  const depositRaw = entry.deposit
    ?? entry.deposit_amount
    ?? entry.bail
    ?? entry.zadatok
    ?? entry.pledge
    ?? entry.guarantee
    ?? entry.collateral
    ?? null;

  const start = parseDateLike(startRaw);
  const end = parseDateLike(endRaw);
  const priceNumber = parseNumberLike(priceRaw);
  const minPriceNumber = parseNumberLike(minPriceRaw);
  const depositNumber = parseNumberLike(depositRaw);

  const meaningful = [start, end, priceNumber, minPriceNumber, depositNumber].some((v) => v != null);
  if (!meaningful) return null;

  return {
    id: entry.id || entry.period_id || entry.code || entry.key || `period-${index}`,
    start,
    end,
    priceRaw,
    minPriceRaw,
    depositRaw,
    priceNumber,
    minPriceNumber,
    depositNumber,
    source: entry,
    rawStart: startRaw,
    rawEnd: endRaw,
  };
}

function extractPeriodEntries(listing) {
  const details = listing?.details && typeof listing.details === 'object' ? listing.details : {};
  const lotDetails = details?.lot_details && typeof details.lot_details === 'object' ? details.lot_details : {};
  const pools = [
    lotDetails?.period_prices,
    lotDetails?.periodPrices,
    lotDetails?.price_schedule,
    lotDetails?.priceSchedule,
    lotDetails?.offer_schedule,
    lotDetails?.price_periods,
    lotDetails?.pricePeriods,
    lotDetails?.price_graph,
    lotDetails?.schedule,
    details?.period_prices,
    details?.periodPrices,
    details?.price_schedule,
    details?.priceSchedule,
    listing?.period_prices,
    listing?.periodPrices,
  ];

  const entries = [];
  let index = 0;
  const seen = new Set();
  for (const pool of pools) {
    const arr = arrayFrom(pool);
    for (const entry of arr) {
      const normalized = normalizePeriodEntry(entry, index);
      index += 1;
      if (!normalized) continue;
      const key = `${normalized.id}-${normalized.rawStart || ''}-${normalized.rawEnd || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(normalized);
    }
  }

  const sorted = entries
    .map((entry, order) => ({ ...entry, order }))
    .sort((a, b) => {
      const aStart = a.start ? a.start.getTime() : null;
      const bStart = b.start ? b.start.getTime() : null;
      if (aStart != null && bStart != null) return aStart - bStart;
      if (aStart != null) return -1;
      if (bStart != null) return 1;
      const aEnd = a.end ? a.end.getTime() : null;
      const bEnd = b.end ? b.end.getTime() : null;
      if (aEnd != null && bEnd != null) return aEnd - bEnd;
      if (aEnd != null) return -1;
      if (bEnd != null) return 1;
      return a.order - b.order;
    })
    .map((entry, indexWithOrder) => ({ ...entry, index: indexWithOrder }));

  return sorted;
}

const START_DATE_KEYS = [
  'date_start', 'dateStart', 'start_date', 'startDate', 'date_begin', 'dateBegin', 'date_from', 'dateFrom',
  'begin_date', 'beginDate', 'auction_start', 'auctionStart', 'applications_start', 'applicationsStart',
];

const END_DATE_KEYS = [
  'date_finish', 'dateFinish', 'finish_date', 'finishDate', 'date_end', 'dateEnd', 'date_to', 'dateTo', 'end_date', 'endDate',
  'auction_end', 'auctionEnd', 'trade_end', 'tradeEnd',
];

const APPLICATION_DEADLINE_KEYS = [
  'application_deadline', 'applications_deadline', 'applications_deadline_date', 'application_end_date', 'applicationEndDate',
  'applications_end_date', 'applicationsEndDate', 'application_end', 'applications_end', 'deadline', 'deadline_date',
  'deadlineDate', 'deadline_applications', 'applicationsDeadline', 'applicationsClose', 'applicationClose',
];

export function computeTradeTiming(listing, nowInput) {
  const now = nowInput instanceof Date ? nowInput : new Date();
  const tradeTypeRaw = listing?.trade_type_resolved ?? listing?.trade_type;
  const tradeType = normalizeTradeTypeCode(tradeTypeRaw);

  const periods = extractPeriodEntries(listing);
  const explicitDeadlineRaw = pickFromSources(listing, APPLICATION_DEADLINE_KEYS);
  const explicitDeadline = parseDateLike(explicitDeadlineRaw);

  const periodStartCandidates = periods
    .map((entry) => entry.start)
    .filter((date) => date instanceof Date);
  const periodEndCandidates = periods
    .map((entry) => entry.end)
    .filter((date) => date instanceof Date);

  const startRaw = pickFromSources(listing, START_DATE_KEYS);
  const finishRaw = pickFromSources(listing, END_DATE_KEYS);
  const startDate = parseDateLike(startRaw) || periodStartCandidates.reduce((earliest, date) => {
    if (!earliest) return date;
    return date.getTime() < earliest.getTime() ? date : earliest;
  }, null) || null;

  const inferredFinishFromPeriods = periodEndCandidates.reduce((latest, date) => {
    if (!latest) return date;
    return date.getTime() > latest.getTime() ? date : latest;
  }, null);
  const finishDate = parseDateLike(finishRaw) || inferredFinishFromPeriods || explicitDeadline || null;

  const applicationDeadline = explicitDeadline || inferredFinishFromPeriods || finishDate || null;

  const nowTime = now.getTime();
  let currentPeriod = null;
  let currentPeriodIndex = null;
  let upcomingPeriod = null;
  let upcomingPeriodIndex = null;

  for (const period of periods) {
    const startTime = period.start ? period.start.getTime() : null;
    const endTime = period.end ? period.end.getTime() : null;
    const hasStarted = startTime == null || nowTime >= startTime;
    const notEnded = endTime == null || nowTime < endTime;
    if (!currentPeriod && hasStarted && notEnded) {
      currentPeriod = period;
      currentPeriodIndex = period.index;
      break;
    }
    if (!hasStarted && upcomingPeriod == null) {
      upcomingPeriod = period;
      upcomingPeriodIndex = period.index;
    }
  }

  const nextChangeDate = currentPeriod?.end
    || upcomingPeriod?.start
    || applicationDeadline
    || finishDate
    || null;

  let status = null;
  if (finishDate && nowTime > finishDate.getTime()) {
    status = { key: 'finished', label: 'Торги завершены', color: '#dc2626' };
  } else if (applicationDeadline && nowTime > applicationDeadline.getTime()) {
    status = { key: 'applications_closed', label: 'Приём заявок завершён', color: '#f97316' };
  } else if (startDate && nowTime < startDate.getTime()) {
    status = { key: 'applications_not_started', label: 'Приём заявок ещё не начался', color: '#2563eb' };
  } else {
    status = { key: 'applications_open', label: 'Открыт приём заявок', color: '#16a34a' };
  }

  const periodsCount = periods.length;

  const currentPriceNumber = currentPeriod?.priceNumber ?? currentPeriod?.minPriceNumber ?? null;

  return {
    now,
    tradeType,
    startDate,
    finishDate,
    applicationDeadline,
    nextChangeDate,
    status,
    periods,
    periodsCount,
    currentPeriod,
    currentPeriodIndex,
    upcomingPeriod,
    upcomingPeriodIndex,
    currentPriceNumber,
  };
}

export { parseDateLike, parseNumberLike };

export default computeTradeTiming;
