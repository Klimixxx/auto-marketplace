// lib/tradePricing.js

export const DEFAULT_DEPOSIT_PERCENT = 10;

const LOT_PRICE_FIELDS = [
  'current_price',
  'start_price',
  'min_price',
  'max_price',
  'price',
  'amount',
  'lot_price',
  'lotPrice',
];

const LOT_PRICE_DETAIL_KEYS = [
  'current_price', 'currentPrice', 'current_price_number',
  'start_price', 'startPrice', 'starting_price', 'startingPrice',
  'min_price', 'minPrice', 'minimal_price', 'minimalPrice',
  'max_price', 'maxPrice', 'maximum_price', 'maximumPrice',
  'price', 'amount', 'value', 'sum', 'lot_price', 'lotPrice',
  'assessment_price', 'appraised_price', 'appraised_value',
];

const DEPOSIT_FIELDS = [
  'deposit',
  'deposit_amount',
  'depositAmount',
  'guarantee_deposit',
  'guaranteeDeposit',
  'guarantee_deposit_amount',
  'guaranteeDepositAmount',
];

const DEPOSIT_DETAIL_KEYS = [
  'deposit',
  'deposit_amount',
  'depositAmount',
  'guarantee_deposit',
  'guaranteeDeposit',
  'guarantee_deposit_amount',
  'guaranteeDepositAmount',
];

const LOT_PRICE_DETAIL_KEYS_SET = new Set(LOT_PRICE_DETAIL_KEYS);
const DEPOSIT_DETAIL_KEYS_SET = new Set(DEPOSIT_DETAIL_KEYS);

export function parseMoneyLike(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;

  const cleaned = String(value)
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectDetailCandidates(details, allowedKeys) {
  if (!details || typeof details !== 'object') return [];
  const stack = [details];
  const candidates = [];
  const seen = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    Object.keys(current).forEach((key) => {
      const value = current[key];
      if (value && typeof value === 'object') {
        stack.push(value);
      }
      if (!allowedKeys || allowedKeys.has(key)) {
        candidates.push(value);
      }
    });
  }

  return candidates;
}

function findNumeric(values) {
  for (const value of values) {
    const numeric = parseMoneyLike(value);
    if (numeric != null && Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
}

export function estimateLotPrice(listing) {
  if (!listing || typeof listing !== 'object') return null;
  

  const candidates = [];
  for (const field of LOT_PRICE_FIELDS) {
    if (listing[field] !== undefined) {
      candidates.push(listing[field]);
    }
  }

  if (listing.details) {
    candidates.push(...collectDetailCandidates(listing.details, LOT_PRICE_DETAIL_KEYS_SET));
  }

  return findNumeric(candidates);
}

function resolveDeposit(listing) {
  if (!listing || typeof listing !== 'object') return null;

  const candidates = [];

  for (const field of DEPOSIT_FIELDS) {
    if (listing[field] !== undefined) {
      candidates.push(listing[field]);
    }
  }

  if (listing.details) {
    candidates.push(...collectDetailCandidates(listing.details, DEPOSIT_DETAIL_KEYS_SET));
  }

  return findNumeric(candidates);
}

function normalizeDepositPercent(value, fallback = DEFAULT_DEPOSIT_PERCENT) {
  const numeric = parseMoneyLike(value);
  if (numeric == null || !Number.isFinite(numeric)) return fallback;
  const bounded = Math.min(100, Math.max(0, numeric));
  return Math.round(bounded * 100) / 100;
}

function formatPercentLabel(value) {
  if (!Number.isFinite(value)) return '0%';
  const normalized = Math.round(value * 100) / 100;
  if (Number.isInteger(normalized)) {
    return `${normalized}%`;
  }

  return `${normalized}`.replace(/\.0+$/, '') + '%';
}

export function computeTradeOrderPrice(listing, {
  subscriptionStatus = 'free',
  proDiscountPercent = 30,
  depositPercent = DEFAULT_DEPOSIT_PERCENT,
} = {}) {
  const lotPrice = estimateLotPrice(listing);
  const depositRaw = resolveDeposit(listing);
  const depositAmount = depositRaw != null && Number.isFinite(depositRaw) && depositRaw > 0
    ? Math.round(depositRaw)
    : 0;

  const normalizedDepositPercent = normalizeDepositPercent(depositPercent);
  const serviceFeeBeforeDiscount = Math.round((depositAmount * normalizedDepositPercent) / 100);

  const normalizedSubscription = String(subscriptionStatus || 'free').trim().toLowerCase();
  const normalizedProDiscount = Number.isFinite(proDiscountPercent) ? proDiscountPercent : 0;
  const discountPercent = normalizedSubscription === 'pro' ? normalizedProDiscount : 0;
  const serviceFeeAfterDiscount = Math.max(
    0,
    Math.round((serviceFeeBeforeDiscount * (100 - discountPercent)) / 100)
  );

  const basePrice = depositAmount + serviceFeeBeforeDiscount;
  const finalAmount = depositAmount + serviceFeeAfterDiscount;

  return {
    basePrice,
    depositAmount,
    depositPercent: normalizedDepositPercent,
    serviceFeeBeforeDiscount,
    serviceFeeAfterDiscount,
    discountPercent,
    finalAmount,
    tierLabel: `Задаток + ${formatPercentLabel(normalizedDepositPercent)}`,
    lotPrice: lotPrice != null && Number.isFinite(lotPrice) ? Math.round(lotPrice) : null,
  };
}

// Никакого export { PRICE_TIERS } — такой константы нет и не нужна.
