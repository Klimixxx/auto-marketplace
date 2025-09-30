import { query } from '../db.js';

export const PRO_DISCOUNT_PERCENT = 30;

export const DEFAULT_TRADE_PRICE_TIERS = [
  { id: null, label: 'Лот до 500 000 ₽', maxAmount: 500_000, amount: 15_000, sortOrder: 10 },
  { id: null, label: 'Лот до 1 500 000 ₽', maxAmount: 1_500_000, amount: 25_000, sortOrder: 20 },
  { id: null, label: 'Лот до 3 000 000 ₽', maxAmount: 3_000_000, amount: 35_000, sortOrder: 30 },
  { id: null, label: 'Лот свыше 3 000 000 ₽', maxAmount: null, amount: 50_000, sortOrder: 40 },
];

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTier(row, fallbackSort = 0) {
  if (!row) return null;
  const label = String(row.label || '').trim();
  if (!label) return null;
  const amount = parseNumeric(row.amount);
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null;
  const maxAmountRaw = parseNumeric(row.max_amount);
  const sortOrder = normalizeSortOrder(row.sort_order, fallbackSort);

  return {
    id: row.id ?? null,
    label,
    amount: Math.round(amount),
    maxAmount: maxAmountRaw != null && Number.isFinite(maxAmountRaw) && maxAmountRaw > 0
      ? Math.round(maxAmountRaw)
      : null,
    sortOrder,
  };
}

function dedupeAndSortTiers(list) {
  const map = new Map();
  for (const item of list) {
    if (!item) continue;
    const key = `${item.sortOrder}|${item.maxAmount ?? 'inf'}|${item.label}`;
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.maxAmount == null && b.maxAmount == null) return 0;
    if (a.maxAmount == null) return 1;
    if (b.maxAmount == null) return -1;
    if (a.maxAmount !== b.maxAmount) return a.maxAmount - b.maxAmount;
    return a.amount - b.amount;
  });
}

function ensureFallbackTier(tiers) {
  const hasInfinity = tiers.some((tier) => tier.maxAmount == null);
  if (hasInfinity) return tiers;
  const fallback = DEFAULT_TRADE_PRICE_TIERS.find((tier) => tier.maxAmount == null);
  if (!fallback) return tiers;
  const maxSort = tiers.reduce((acc, tier) => Math.max(acc, tier.sortOrder ?? 0), 0);
  return [...tiers, { ...fallback, sortOrder: maxSort + 10 }];
}

export async function loadTradePriceTiers(client) {
  try {
    const result = client
      ? await client.query('SELECT * FROM trade_pricing_tiers ORDER BY sort_order ASC, max_amount ASC NULLS LAST, id ASC')
      : await query('SELECT * FROM trade_pricing_tiers ORDER BY sort_order ASC, max_amount ASC NULLS LAST, id ASC');
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const normalized = rows.map((row, index) => normalizeTier(row, (index + 1) * 10)).filter(Boolean);
    if (!normalized.length) {
      return dedupeAndSortTiers(DEFAULT_TRADE_PRICE_TIERS.map((tier) => ({ ...tier })));
    }
    const tiersWithFallback = ensureFallbackTier(normalized);
    return dedupeAndSortTiers(tiersWithFallback);
  } catch (error) {
    console.error('loadTradePriceTiers error:', error);
    return dedupeAndSortTiers(DEFAULT_TRADE_PRICE_TIERS.map((tier) => ({ ...tier })));
  }
}

export function tierToPublicShape(tier) {
  if (!tier) return null;
  return {
    id: tier.id,
    label: tier.label,
    amount: tier.amount,
    maxAmount: tier.maxAmount,
    sortOrder: tier.sortOrder,
  };
}

export function prepareTierForComputation(tier) {
  if (!tier) return null;
  return {
    id: tier.id,
    label: tier.label,
    amount: tier.amount,
    max: tier.maxAmount == null ? Number.POSITIVE_INFINITY : tier.maxAmount,
  };
}
