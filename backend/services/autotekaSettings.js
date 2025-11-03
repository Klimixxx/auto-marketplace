import { query } from '../db.js';

export const DEFAULT_AUTOTEKA_PRICE = 2500;

function parsePriceValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
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
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export function normalizeAutotekaPrice(value, fallback = DEFAULT_AUTOTEKA_PRICE) {
  const parsed = parsePriceValue(value);
  if (parsed == null) return fallback;
  const bounded = Math.max(0, parsed);
  return bounded;
}

export async function loadAutotekaSettings(client) {
  try {
    const sql = 'SELECT price FROM autoteka_settings WHERE settings_key = $1 LIMIT 1';
    const params = ['default'];
    const executor = client && typeof client.query === 'function' ? client : { query };
    const res = await executor.query(sql, params);
    const price = normalizeAutotekaPrice(res?.rows?.[0]?.price, DEFAULT_AUTOTEKA_PRICE);
    return { price };
  } catch (error) {
    console.error('loadAutotekaSettings error:', error);
    return { price: DEFAULT_AUTOTEKA_PRICE };
  }
}

export async function saveAutotekaPrice(price, client) {
  const normalized = normalizeAutotekaPrice(price);
  const sql = `
    INSERT INTO autoteka_settings (settings_key, price, created_at, updated_at)
    VALUES ('default', $1, now(), now())
    ON CONFLICT (settings_key)
    DO UPDATE SET price = EXCLUDED.price, updated_at = now()
    RETURNING price
  `;
  const executor = client && typeof client.query === 'function' ? client : { query };
  const res = await executor.query(sql, [normalized]);
  const saved = normalizeAutotekaPrice(res?.rows?.[0]?.price, normalized);
  return { price: saved };
}
