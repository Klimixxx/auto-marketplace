import { query } from '../db.js';

export const PRO_DISCOUNT_PERCENT = 30;
export const DEFAULT_DEPOSIT_PERCENT = 10;

/** Универсальный парсер чисел из строк/значений */
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

/** Нормализация процента залога в пределах [0,100] c округлением до сотых */
export function normalizeDepositPercent(value, fallback = DEFAULT_DEPOSIT_PERCENT) {
  const numeric = parseNumeric(value);
  if (numeric == null || !Number.isFinite(numeric)) return fallback;
  const bounded = Math.min(100, Math.max(0, numeric));
  return Math.round(bounded * 100) / 100;
}

/** Загрузка настроек ценообразования (deposit_percent) */
export async function loadTradePricingSettings(client) {
  try {
    const sql = 'SELECT deposit_percent FROM trade_pricing_settings WHERE settings_key = $1 LIMIT 1';
    const params = ['default'];

    const result = client
      ? await client.query(sql, params)
      : await query(sql, params);

    const depositPercent = normalizeDepositPercent(result?.rows?.[0]?.deposit_percent);
    return { depositPercent };
  } catch (error) {
    console.error('loadTradePricingSettings error:', error);
    return { depositPercent: DEFAULT_DEPOSIT_PERCENT };
  }
}

/** Сохранение настроек ценообразования (deposit_percent) */
export async function saveTradePricingSettings(depositPercent, client) {
  const normalized = normalizeDepositPercent(depositPercent);

  const sql = `
    INSERT INTO trade_pricing_settings (settings_key, deposit_percent, created_at, updated_at)
    VALUES ('default', $1, now(), now())
    ON CONFLICT (settings_key)
    DO UPDATE SET deposit_percent = EXCLUDED.deposit_percent, updated_at = now()
    RETURNING deposit_percent
  `;

  const result = client
    ? await client.query(sql, [normalized])
    : await query(sql, [normalized]);

  const savedPercent = normalizeDepositPercent(result?.rows?.[0]?.deposit_percent, normalized);
  return { depositPercent: savedPercent };
}
