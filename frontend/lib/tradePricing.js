const PRICE_TIERS = [
  { max: 500_000, amount: 15000, label: 'Лот до 500 000 ₽' },
  { max: 1_500_000, amount: 25000, label: 'Лот до 1 500 000 ₽' },
  { max: 3_000_000, amount: 35000, label: 'Лот до 3 000 000 ₽' },
  { max: Number.POSITIVE_INFINITY, amount: 50000, label: 'Лот свыше 3 000 000 ₽' },
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

export function resolvePriceTier(listing) {
  const lotPrice = estimateLotPrice(listing);
  let tier = PRICE_TIERS[PRICE_TIERS.length - 1];

  if (lotPrice != null && Number.isFinite(lotPrice)) {
    for (const option of PRICE_TIERS) {
      if (lotPrice <= option.max) {
        tier = option;
        break;
      }
    }
  } else {
    tier = PRICE_TIERS[1] || PRICE_TIERS[0];
  }

  return { ...tier, lotPrice };
}

export function computeTradeOrderPrice(listing, { subscriptionStatus = 'free', proDiscountPercent = 30 } = {}) {
  const tier = resolvePriceTier(listing);
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
