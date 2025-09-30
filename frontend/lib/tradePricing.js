export const DEFAULT_TRADE_PRICE_TIERS = [
  { id: null, label: 'Лот до 500 000 ₽', max: 500_000, amount: 15000, sortOrder: 10 },
  { id: null, label: 'Лот до 1 500 000 ₽', max: 1_500_000, amount: 25000, sortOrder: 20 },
  { id: null, label: 'Лот до 3 000 000 ₽', max: 3_000_000, amount: 35000, sortOrder: 30 },
  { id: null, label: 'Лот свыше 3 000 000 ₽', max: Number.POSITIVE_INFINITY, amount: 50000, sortOrder: 40 },
];

const PRICE_DETAIL_KEYS = [
  'current_price', 'currentPrice', 'current_price_number',
  'start_price', 'startPrice', 'starting_price', 'startingPrice',
  'min_price', 'minPrice', 'minimal_price', 'minimalPrice',
  'max_price', 'maxPrice', 'maximum_price', 'maximumPrice',
  'price', 'amount', 'value', 'sum', 'lot_price', 'lotPrice',
  'assessment_price', 'appraised_price', 'appraised_value',
  'deposit', 'deposit_amount', 'depositAmount', 'guarantee_deposit', 'guaranteeDeposit',
];

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

function collectDetailCandidates(details) {
  if (!details || typeof details !== 'object') return [];
  const stack = [details];
  const candidates = [];
  const seen = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    Object.entries(current).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
      if (PRICE_DETAIL_KEYS.includes(key)) {
        candidates.push(value);
      }
    });
  }

  return candidates;
}

export function estimateLotPrice(listing) {
  if (!listing || typeof listing !== 'object') return null;
  const candidates = [];
  const fields = [
    'current_price',
    'start_price',
    'min_price',
    'max_price',
    'price',
    'amount',
    'lot_price',
    'lotPrice',
  ];

  fields.forEach((field) => {
    if (listing[field] !== undefined) candidates.push(listing[field]);
  });

  if (listing.details) {
    candidates.push(...collectDetailCandidates(listing.details));
  }

  for (const value of candidates) {
    const numeric = parseMoneyLike(value);
    if (numeric != null && Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
}

function parseSortOrder(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTier(tier) {
  if (!tier) return null;
  const label = String(tier.label || '').trim();
  if (!label) return null;
  const amount = parseMoneyLike(tier.amount ?? tier.price ?? tier.baseAmount);
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null;
  const maxSource = tier.max ?? tier.maxAmount ?? tier.limit;
  const maxParsed = parseMoneyLike(maxSource);
  const max = maxParsed != null && Number.isFinite(maxParsed) && maxParsed > 0
    ? Math.round(maxParsed)
    : Number.POSITIVE_INFINITY;
  const sortOrder = parseSortOrder(tier.sortOrder ?? tier.sort_order);

  return {
    id: tier.id ?? null,
    label,
    amount: Math.round(amount),
    max,
    sortOrder,
  };
}

export function prepareTradePriceTiers(tiers) {
  const normalized = Array.isArray(tiers)
    ? tiers.map(normalizeTier).filter(Boolean)
    : [];

  const base = normalized.length
    ? normalized
    : DEFAULT_TRADE_PRICE_TIERS.map((tier) => ({ ...tier }));

  const hasInfinity = base.some((tier) => !Number.isFinite(tier.max) || tier.max === Number.POSITIVE_INFINITY);
  const result = [...base];

  if (!hasInfinity) {
    const fallback = DEFAULT_TRADE_PRICE_TIERS[DEFAULT_TRADE_PRICE_TIERS.length - 1];
    result.push({ ...fallback });
  }

  return result.sort((a, b) => {
    const orderA = a.sortOrder;
    const orderB = b.sortOrder;
    if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
    if (orderA != null && orderB == null) return -1;
    if (orderA == null && orderB != null) return 1;
    const maxA = Number.isFinite(a.max) ? a.max : Number.POSITIVE_INFINITY;
    const maxB = Number.isFinite(b.max) ? b.max : Number.POSITIVE_INFINITY;
    if (maxA !== maxB) {
      if (!Number.isFinite(maxA)) return 1;
      if (!Number.isFinite(maxB)) return -1;
      return maxA - maxB;
    }
    return a.amount - b.amount;
  });
}

export function resolvePriceTier(listing, tiers = DEFAULT_TRADE_PRICE_TIERS) {
  const prepared = prepareTradePriceTiers(tiers);
  const lotPrice = estimateLotPrice(listing);
  let tier = PRICE_TIERS[PRICE_TIERS.length - 1];

  if (lotPrice != null && Number.isFinite(lotPrice)) {
    for (const option of prepared) {
      const limit = Number.isFinite(option.max) ? option.max : Number.POSITIVE_INFINITY;
      if (lotPrice <= limit) {
        tier = option;
        break;
      }
    }
  } else if (prepared.length > 1) {
    tier = prepared[1] || prepared[0];
  } else if (prepared.length === 1) {
    tier = prepared[0];
  }

  return { ...tier, lotPrice };
}

export function computeTradeOrderPrice(listing, {
  subscriptionStatus = 'free',
  proDiscountPercent = 30,
  tiers = DEFAULT_TRADE_PRICE_TIERS,
} = {}) {
  const tier = resolvePriceTier(listing, tiers);
  const normalizedSubscription = String(subscriptionStatus || 'free').trim().toLowerCase();
  const discountPercent = normalizedSubscription === 'pro' ? proDiscountPercent : 0;
  const finalAmount = Math.max(0, Math.round((tier.amount * (100 - discountPercent)) / 100));

  return {
    baseAmount: tier.amount,
    discountPercent,
    finalAmount,
    tierLabel: tier.label,
    lotPrice: tier.lotPrice,
  };
}

export { PRICE_TIERS };
