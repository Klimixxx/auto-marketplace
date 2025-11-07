import { query } from '../db.js';

export const DEFAULT_INSPECTION_PRICE = 12000;
const SETTINGS_KEY = 'default';

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

export function normalizeInspectionPrice(value, fallback = DEFAULT_INSPECTION_PRICE) {
  const parsed = parsePriceValue(value);
  if (parsed == null) return fallback;
  return Math.max(0, parsed);
}

function resolveExecutor(client) {
  if (client && typeof client.query === 'function') {
    return client;
  }
  return { query };
}

export async function loadInspectionSettings(client) {
  try {
    const executor = resolveExecutor(client);
    const res = await executor.query(
      'SELECT price FROM inspection_settings WHERE settings_key = $1 LIMIT 1',
      [SETTINGS_KEY],
    );
    const price = normalizeInspectionPrice(res?.rows?.[0]?.price, DEFAULT_INSPECTION_PRICE);
    return { price };
  } catch (error) {
    console.error('loadInspectionSettings error:', error);
    return { price: DEFAULT_INSPECTION_PRICE };
  }
}

export async function saveInspectionPrice(price, client) {
  const normalized = normalizeInspectionPrice(price);
  const executor = resolveExecutor(client);
  const res = await executor.query(
    `
    INSERT INTO inspection_settings (settings_key, price, created_at, updated_at)
    VALUES ($1, $2, now(), now())
    ON CONFLICT (settings_key)
    DO UPDATE SET price = EXCLUDED.price, updated_at = now()
    RETURNING price
  `,
    [SETTINGS_KEY, normalized],
  );
  const saved = normalizeInspectionPrice(res?.rows?.[0]?.price, normalized);
  return { price: saved };
}
