import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../data/avito-brands.json');
const AVITO_BRANDS_URL = 'https://www.avito.ru/web/1/force/params?categoryId=9';

let cachedBrands = null;

function normalizeBrandName(value) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : String(value);
  const trimmed = text.trim();
  return trimmed || null;
}

function uniqueSorted(list = []) {
  const seen = new Set();
  const normalized = [];
  list.forEach((entry) => {
    const name = normalizeBrandName(entry);
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    normalized.push(name);
  });
  return normalized.sort((a, b) => a.localeCompare(b, 'ru'));
}

async function readCachedFile() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? uniqueSorted(parsed) : [];
  } catch {
    return [];
  }
}

function extractBrandsFromPayload(payload) {
  const collected = [];

  function visit(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === 'string' || typeof node === 'number') {
      collected.push(node);
      return;
    }
    if (typeof node !== 'object') return;

    Object.entries(node).forEach(([key, value]) => {
      if (key.toLowerCase().includes('brand')) {
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else {
          collected.push(value);
        }
      }
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        visit(value);
      }
    });
  }

  visit(payload);
  return uniqueSorted(collected);
}

async function fetchBrandsFromAvito() {
  try {
    const response = await fetch(AVITO_BRANDS_URL, {
      headers: {
        'user-agent': 'auto-marketplace-bot/1.0',
        accept: 'application/json, text/plain, */*',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const extracted = extractBrandsFromPayload(data);
    if (extracted.length) {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, JSON.stringify(extracted, null, 2), 'utf8');
    }
    return extracted;
  } catch (error) {
    console.warn('Failed to fetch Avito brands, using cache.', error.message || error);
    return [];
  }
}

export async function loadAvitoBrands(options = {}) {
  const { refresh = false } = options;

  if (!refresh && Array.isArray(cachedBrands) && cachedBrands.length) {
    return cachedBrands;
  }

  const cached = await readCachedFile();
  if (cached.length && !refresh) {
    cachedBrands = cached;
  }

  const fetched = await fetchBrandsFromAvito();
  if (fetched.length) {
    cachedBrands = fetched;
    return fetched;
  }

  if (cachedBrands?.length) return cachedBrands;
  return cached;
}
