// backend/src/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import adminParserRouter from './routes/adminParser.js';
import inspectionsRouter from './routes/inspections.js';
import adminInspectionsRouter from './routes/adminInspections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




dotenv.config();

// ====== УТИЛИТЫ ======

// Нормализация телефона к виду +79XXXXXXXXX
function normalizePhone(p) {
  const digits = String(p || '').replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : '+' + digits;
}

// 6-значный код пользователя
function genUserCode() {
  return String(Math.floor(100000 + Math.random()*900000)).padStart(6, '0');
}

// Нативный fetch + таймаут через AbortController
async function fetchJSON(url, { timeoutMs = 15000, headers, method = 'GET', body } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, headers, method, body });
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text();
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ==== МИГРАЦИИ (выполнить все .sql из /backend/migrations по алфавиту) ====


async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations'); // backend/migrations
    const files = (await fs.readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const f of files) {
      const full = path.join(migrationsDir, f);
      const sql = await fs.readFile(full, 'utf8');
      if (sql && sql.trim()) {
        console.log(`Applying migration: ${f}`);
        await query(sql);
      }
    }
    console.log('Migrations applied.');
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

// ВЫПОЛНЯЕМ МИГРАЦИИ ПЕРЕД СТАРТОМ СЕРВЕРА
await runMigrations();

// CORS (расширенный: методы/заголовки/credentials + preflight)
const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// обязательно! — пропускаем preflight без авторизации
app.options('*', cors());


// Порт: Render сам задаёт process.env.PORT
const PORT = process.env.PORT || 8080;

// Диагностика окружения (увидишь в Runtime logs на Render)
console.log('Starting server with env:', {
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
  JWT_SECRET: !!process.env.JWT_SECRET,
  INGEST_TOKEN: !!process.env.INGEST_TOKEN,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  PARSER_BASE_URL: process.env.PARSER_BASE_URL || '(not set)',
});

// JWT
function signToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ===== МИДЛВАРЫ АУТЕНТИФИКАЦИИ =====

async function auth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, phone, role }

    // мгновенная проверка блокировки
    const { rows } = await query('SELECT is_blocked FROM users WHERE id = $1', [req.user.sub]);
    if (rows[0]?.is_blocked) {
      return res.status(403).json({ error: 'blocked' });
    }

    return next();
  } catch (e) {
    console.error('auth error:', e);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.user.sub]);
    if (rows[0]?.role === 'admin') return next();
    return res.status(403).json({ error: 'admin only' });
  } catch (e) {
    console.error('requireAdmin error:', e);
    return res.status(500).json({ error: 'internal' });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ===== СЛУЖЕБНОЕ =====
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Публичный трекер посещений (1 раз за сессию с фронта)
app.post('/api/track/visit', async (req, res) => {
  try {
    await query(
      `INSERT INTO visits_daily(day, cnt)
         VALUES (CURRENT_DATE, 1)
       ON CONFLICT (day)
       DO UPDATE SET cnt = visits_daily.cnt + 1, updated_at = now()`
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('track visit error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Публичная статистика платформы
app.get('/api/public-stats', async (req, res) => {
  try {
    const { rows: [{ c: users }] } = await query(`SELECT count(*)::int c FROM users`);
    res.json({ users });
  } catch (e) {
    console.error('public-stats error:', e);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ===== Phone auth (MVP) =====

app.post('/api/auth/request-code', async (req, res) => {
  try {
    const raw = req.body?.phone;
    if (!raw) return res.status(400).json({ error: 'phone required' });

    const phone = normalizePhone(raw);

    // rate-limit: не чаще 1 заявки в 30 сек
    const last = await query(
      `SELECT created_at FROM auth_codes WHERE phone=$1 ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    if (last.rows[0] && Date.now() - new Date(last.rows[0].created_at).getTime() < 30_000) {
      return res.status(429).json({ error: 'Подождите 30 секунд перед повторной отправкой' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 цифр
    await query(
      `INSERT INTO auth_codes(phone, code, created_at, is_used) VALUES($1,$2, now(), false)`,
      [phone, code]
    );

    // отправка SMS через smsc.ru
    const login  = process.env.SMSC_LOGIN;
    const pass   = process.env.SMSC_PASSWORD;
    const sender = process.env.SMSC_SENDER || ''; // если согласован
    const text   = encodeURIComponent(`Код входа: ${code}. Никому его не сообщайте.`);
    const url    = `https://smsc.ru/sys/send.php?login=${encodeURIComponent(login)}&psw=${encodeURIComponent(pass)}&phones=${encodeURIComponent(phone)}&mes=${text}&fmt=3&charset=utf-8${sender?`&sender=${encodeURIComponent(sender)}`:''}`;

    const { data: d } = await fetchJSON(url, { timeoutMs: 15000 });
    console.log('SMSC response:', d);

    if (!d || d.error || !d.id) {
      const errMsg = d?.error ? `${d.error} (${d.error_code})` : 'Unknown SMSC error';
      return res.status(502).json({ error: `SMSC error: ${errMsg}` });
    }

    return res.json({ ok: true, attemptId: d.id });
  } catch (e) {
    console.error('request-code error:', e);
    return res.status(500).json({ error: 'Не удалось отправить SMS' });
  }
});

app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code  = String(req.body?.code || '').replace(/\s/g, '');
    if (!phone || !code) return res.status(400).json({ error: 'phone+code required' });

    const { rows } = await query(
      `SELECT id, phone, code, is_used, created_at
         FROM auth_codes
        WHERE phone = $1
          AND code  = $2
          AND created_at > now() - interval '5 minutes'
        ORDER BY created_at DESC
        LIMIT 1`,
      [phone, code]
    );

    if (!rows[0]) {
      const dbg = await query(
        `SELECT code, created_at, is_used
           FROM auth_codes
          WHERE phone=$1
          ORDER BY created_at DESC
          LIMIT 3`,
        [phone]
      );
      console.log('OTP DEBUG last codes for', phone, dbg.rows);
      return res.status(401).json({ error: 'Неверный или просроченный код' });
    }

    const row = rows[0];
    if (row.is_used) return res.status(400).json({ error: 'Код уже использован' });

    await query(
      `UPDATE auth_codes
          SET is_used = true,
              used_at = now()
        WHERE phone = $1
          AND code  = $2
          AND created_at = $3
          AND is_used = false`,
      [phone, code, row.created_at]
    );

    let u = await query('SELECT id, phone, role, user_code, name, email, is_blocked FROM users WHERE phone=$1', [phone]);
    if (!u.rows[0]) {
      // пытаемся вставить с уникальным user_code
      let userRow = null;
      for (let i = 0; i < 5; i++) {
        const code6 = genUserCode();
        try {
          const created = await query(
            `INSERT INTO users(phone, user_code, created_at)
             VALUES($1, $2, now())
             RETURNING id, phone, role, user_code, name, email`,
            [phone, code6]
          );
          userRow = created.rows[0];
          break;
        } catch (e) {
          if (!String(e.message || '').includes('users_user_code_key')) throw e;
        }
      }
      if (!userRow) {
        const fallback = await query(
          `INSERT INTO users(phone, user_code, created_at)
           VALUES($1, $2, now())
           RETURNING id, phone, role, user_code, name, email`,
          [phone, genUserCode()]
        );
        userRow = fallback.rows[0];
      }
      u = { rows: [userRow] };
    }

    const user = u.rows[0];
    if (user?.is_blocked) {
      return res.status(403).json({
        ok: false,
        error: 'Ваш аккаунт заблокирован. Свяжитесь с поддержкой.'
      });
    }

    // лог сессии
    try {
      const ip = String((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')).split(',')[0].trim();
      const device = String(req.headers['user-agent'] || '').slice(0, 300);
      await query(
        `INSERT INTO user_sessions(user_id, ip, device) VALUES ($1,$2,$3)`,
        [user.id, ip || null, device || null]
      );
    } catch (e) {
      console.warn('session log error:', e.message);
    }

    const token = signToken({ id: user.id, phone: user.phone, role: user.role });
    return res.json({ ok: true, token });
  } catch (e) {
    console.error('verify-code error:', e);
    return res.status(500).json({ error: 'Ошибка проверки кода' });
  }
});

// ===== Listings (каталог) =====

const TRADE_TYPE_KEYS = [
  'type', 'Type',
  'trade_type', 'tradeType',
  'procedure_type', 'procedureType',
  'procedure_kind', 'procedureKind',
  'auction_type', 'auctionType',
  'auction_format', 'auctionFormat',
  'format', 'kind',
  'lot_type', 'lotType',
  'sale_type', 'saleType',
  'trade_stage', 'tradeStage',
  'trade_format', 'tradeFormat',
  'trading_type', 'tradingType',
  'trade_offer', 'tradeOffer',
  'trade_type_highlights', 'tradeTypeHighlights',
  'trading_type_highlights', 'tradingTypeHighlights',
  'trade_offer_highlights', 'tradeOfferHighlights',
  'trade_stage_highlights', 'tradeStageHighlights',
];

const TRADE_TYPE_LABEL_FIELDS = [
  'label', 'name', 'title', 'caption', 'key', 'property', 'field', 'parameter', 'param', 'attribute',
  'header', 'heading', 'question', 'type_name', 'typeName',
];

const TRADE_TYPE_VALUE_FIELDS = [
  'value', 'val', 'value_text', 'valueText', 'text', 'content', 'data', 'info', 'description',
  'values', 'items', 'options', 'variants', 'answers',
];

const TRADE_TYPE_KEY_PATTERN = /(type|offer|trade|торг|процед|аукцион|auction)/i;
const TRADE_TYPE_LABEL_PATTERN = /(торг|аукцион|процед|предлож|offer|auction|trade)/i;
const TRADE_TYPE_LABEL_ONLY_PATTERN = /^(?:тип|вид)\s+(?:торг|процед)/i;

const TRADE_TYPE_LABELS = {
  public_offer: 'Публичное предложение',
  open_auction: 'Открытый аукцион',
};

function cleanText(value) {
  if (!value && value !== 0) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeTradeTypeCode(value) {
  const text = cleanText(value);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (['public_offer', 'public offer', 'public-offer'].includes(lower)) return 'public_offer';
  if (['open_auction', 'open auction', 'open-auction'].includes(lower)) return 'open_auction';
  if (lower === 'offer' || lower.includes('публич') || lower.includes('offer') || lower.includes('предлож')) return 'public_offer';
  if (
    lower === 'auction'
    || lower.includes('аукцион')
    || lower.includes('auction')
    || lower.includes('торг')
    || lower.includes('bidding')
  ) return 'open_auction';
  return lower;
}

function tradeTypeLabelFromCode(value) {
  const normalized = normalizeTradeTypeCode(value);
  if (!normalized) return null;
  if (TRADE_TYPE_LABELS[normalized]) return TRADE_TYPE_LABELS[normalized];
  return null;
}

function withTradeTypeInfo(record) {
  if (!record) return record;
  const resolved = resolveListingTradeType(record);
  const normalized = normalizeTradeTypeCode(resolved) || normalizeTradeTypeCode(record?.trade_type);
  const label = record?.trade_type_label
    || tradeTypeLabelFromCode(resolved)
    || tradeTypeLabelFromCode(record?.trade_type)
    || cleanText(resolved)
    || cleanText(record?.trade_type);
  return {
    ...record,
    trade_type_resolved: normalized || null,
    trade_type_label: label || null,
  };
}

function collectTradeTypeHints(source, out) {
  if (!source && source !== 0) return;
  if (typeof source === 'string' || typeof source === 'number') {
    const text = String(source).trim();
    if (!text) return;
    const pairMatch = text.match(/^\s*([^:–—-]{1,80})[:–—-]\s*(.+)$/);
    if (pairMatch && TRADE_TYPE_LABEL_PATTERN.test(pairMatch[1])) {
      const valueText = pairMatch[2].trim();
      if (valueText) out.push(valueText);
      return;
    }
    const stripped = text.replace(/^(?:\s*(?:тип|вид)\s+(?:торг|процед)\s*(?:[:–—-]\s*)?)/i, '').trim();
    if (stripped && stripped !== text) {
      collectTradeTypeHints(stripped, out);
      return;
    }
    if (TRADE_TYPE_LABEL_ONLY_PATTERN.test(text)) return;
    out.push(text);
    return;
  }
  if (Array.isArray(source)) {
    source.forEach((item) => collectTradeTypeHints(item, out));
    return;
  }
  if (typeof source === 'object') {
    const labelMatches = TRADE_TYPE_LABEL_FIELDS.some(
      (field) => typeof source[field] === 'string' && TRADE_TYPE_LABEL_PATTERN.test(source[field])
    );

    if (labelMatches) {
      for (const field of TRADE_TYPE_VALUE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
          collectTradeTypeHints(source[field], out);
        }
      }
    }

    for (const [key, value] of Object.entries(source)) {
      if (TRADE_TYPE_KEYS.includes(key) || TRADE_TYPE_KEY_PATTERN.test(key)) {
        collectTradeTypeHints(value, out);
        continue;
      }
      if (labelMatches && TRADE_TYPE_LABEL_FIELDS.includes(key)) continue;
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        collectTradeTypeHints(value, out);
      } else if ((typeof value === 'string' || typeof value === 'number') && !TRADE_TYPE_LABEL_FIELDS.includes(key)) {
        collectTradeTypeHints(value, out);
      }
    }
  }
}

function resolveListingTradeType(record) {
  const hints = [];
  collectTradeTypeHints(record?.trade_type_label, hints);
  collectTradeTypeHints(record?.trade_type, hints);
  collectTradeTypeHints(record?.type, hints);
  collectTradeTypeHints(record?.additional_data, hints);
  collectTradeTypeHints(record?.additionalData, hints);

  const details = record?.details || {};
  const lot = details?.lot_details || {};

  collectTradeTypeHints(details, hints);
  collectTradeTypeHints(details?.additional_data, hints);
  collectTradeTypeHints(details?.additionalData, hints);
  collectTradeTypeHints(lot, hints);
  collectTradeTypeHints(lot?.additional_data, hints);
  collectTradeTypeHints(lot?.additionalData, hints);

  const normalized = [];
  const seen = new Set();
  for (const hint of hints) {
    if (!hint && hint !== 0) continue;
    const text = String(hint).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(text);
  }

  const lowers = normalized.map((value) => value.toLowerCase());
  const hasPublic = lowers.some((text) => text.includes('публич') || text.includes('public') || text.includes('предлож') || text.includes('offer'));
  const hasAuction = lowers.some((text) => text.includes('аукцион') || text.includes('auction'));
  const hasOpen = lowers.some((text) => text.includes('открыт') || text.includes('open'));

  const base = normalizeTradeTypeCode(record?.trade_type);

  if (hasPublic || base === 'public_offer') return 'public_offer';
  if (hasAuction || base === 'open_auction') return 'open_auction';
  if (base) return base;
  return null;
}

app.get('/api/listings', async (req, res) => {
  const {
    q,
    region,
    city,
    brand,
    asset_type,
    trade_type,
    status,
    minPrice,
    maxPrice,
    endDateFrom,
    endDateTo,
    published,
    page = 1,
    limit = 20,
  } = req.query;

  const where = [];
  const params = [];

  if (q) { params.push(q); where.push(
    `(to_tsvector('russian', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,'')) @@ plainto_tsquery('russian', $${params.length})
      OR vin ILIKE '%' || $${params.length} || '%')`
  );}
  if (region)     { params.push(region);     where.push(`region = $${params.length}`); }
  if (city)       { params.push(city);       where.push(`city = $${params.length}`); }
  if (asset_type) { params.push(asset_type); where.push(`asset_type = $${params.length}`); }
  if (brand) {
    const brandTerm = String(brand).trim();
    if (brandTerm) {
      params.push(`%${brandTerm}%`);
      where.push(`brand ILIKE $${params.length}`);
    }
  }
  if (trade_type) {
    const normalizedParam = normalizeTradeTypeCode(trade_type);
    if (normalizedParam === 'public_offer') {
      const tradeField = "lower(coalesce(trade_type, ''))";
      const detailsField = "lower(coalesce(details::text, ''))";

      const equalityValues = Array.from(new Set([
        'public_offer',
        'offer',
        'public offer',
        'public-offer',
        'публичное предложение',
        'торговое предложение',
      ].map((value) => value.toLowerCase())));
      const equalityPlaceholders = equalityValues.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      const equalityClause = equalityPlaceholders.length
        ? `${tradeField} = ANY(ARRAY[${equalityPlaceholders.join(', ')}]::text[])`
        : 'FALSE';

      const likePatterns = Array.from(new Set([
        '%публич%',
        '%предлож%',
        '%public offer%',
        '%public-offer%',
        '%public_offer%',
      ].map((pattern) => pattern.toLowerCase())));
      const likePlaceholders = likePatterns.map((pattern) => {
        params.push(pattern);
        return `$${params.length}`;
      });
      const tradeLikeClause = likePlaceholders.length
        ? `${tradeField} LIKE ANY(ARRAY[${likePlaceholders.join(', ')}]::text[])`
        : 'FALSE';
      const detailsLikeClause = likePlaceholders.length
        ? `${detailsField} LIKE ANY(ARRAY[${likePlaceholders.join(', ')}]::text[])`
        : 'FALSE';

      const positiveParts = [];
      if (equalityClause !== 'FALSE' || tradeLikeClause !== 'FALSE') {
        const tradePositive = [equalityClause, tradeLikeClause].filter((clause) => clause !== 'FALSE');
        if (tradePositive.length) positiveParts.push(`(${tradePositive.join(' OR ')})`);
      }
      if (detailsLikeClause !== 'FALSE') positiveParts.push(detailsLikeClause);
      const positiveClause = positiveParts.length ? `(${positiveParts.join(' OR ')})` : null;

      const exclusionPatterns = Array.from(new Set([
        '%аукцион%',
        '%auction%',
        '%open auction%',
        '%открыт%',
        '%bidding%',
      ].map((pattern) => pattern.toLowerCase())));
      const exclusionPlaceholders = exclusionPatterns.map((pattern) => {
        params.push(pattern);
        return `$${params.length}`;
      });
      const tradeExclusion = exclusionPlaceholders.length
        ? `${tradeField} LIKE ANY(ARRAY[${exclusionPlaceholders.join(', ')}]::text[])`
        : 'FALSE';
      const detailsExclusion = exclusionPlaceholders.length
        ? `${detailsField} LIKE ANY(ARRAY[${exclusionPlaceholders.join(', ')}]::text[])`
        : 'FALSE';
      const exclusionParts = [tradeExclusion, detailsExclusion].filter((clause) => clause !== 'FALSE');
      const exclusionClause = exclusionParts.length ? `(${exclusionParts.join(' OR ')})` : null;

      if (positiveClause && exclusionClause) {
        where.push(`(${positiveClause} AND NOT ((${exclusionClause}) AND NOT ${positiveClause}))`);
      } else if (positiveClause) {
        where.push(positiveClause);
      }
    } else if (normalizedParam === 'open_auction') {
      const trimmedTradeField = "btrim(coalesce(trade_type, ''))";
      const tradeField = `lower(${trimmedTradeField})`;
      const detailsField = "lower(coalesce(details::text, ''))";
      const hasTradeValue = `${trimmedTradeField} <> ''`;
      
      const equalityClauses = [];
      const synonyms = Array.from(new Set([
        'open_auction',
        'auction',
        'open auction',
        'open-auction',
        'открытый аукцион',
        'аукцион',
      ]));
      for (const synonym of synonyms) {
        params.push(synonym.toLowerCase());
        equalityClauses.push(`${tradeField} = $${params.length}`);
      }
      const likePatterns = ['%аукцион%', '%auction%', '%открыт%'];
      const likeClauses = likePatterns.map((pattern) => {
        params.push(pattern);
        const placeholder = `$${params.length}`;
        return `(
          ${tradeField} LIKE ${placeholder}
          OR (
            NOT (${hasTradeValue})
            AND ${detailsField} LIKE ${placeholder}
          )
        )`;
      });
      const openPatterns = ['%открыт%', '%open%', '%аукцион%', '%auction%', '%торг%', '%bidding%'];
      const combinedOpenClauses = [];
      const tradeOpenClauses = [];
      for (const pattern of openPatterns) {
        params.push(pattern.toLowerCase());
        const placeholder = `$${params.length}`;
        combinedOpenClauses.push(`(${tradeField} LIKE ${placeholder} OR ((NOT ${hasTradeValue}) AND ${detailsField} LIKE ${placeholder}))`);
        tradeOpenClauses.push(`${tradeField} LIKE ${placeholder}`);
      }

      const openClauses = equalityClauses.concat(combinedOpenClauses);
      const openClause = openClauses.length ? `(${openClauses.join(' OR ')})` : null;
      const strongTradeOpenClauses = equalityClauses.concat(tradeOpenClauses);
      const strongTradeOpenClause = strongTradeOpenClauses.length ? `(${strongTradeOpenClauses.join(' OR ')})` : null;

      const publicPatterns = ['%публич%', '%предлож%', '%offer%', '%public%'];
      const publicClauses = [];
      for (const pattern of publicPatterns) {
        params.push(pattern.toLowerCase());
        const placeholder = `$${params.length}`;
        publicClauses.push(`(${tradeField} LIKE ${placeholder} OR ((NOT ${hasTradeValue}) AND ${detailsField} LIKE ${placeholder}))`);
      }
      const publicClause = publicClauses.length ? `(${publicClauses.join(' OR ')})` : null;

      if (openClause && publicClause && strongTradeOpenClause) {
        where.push(`(${openClause} AND NOT (${publicClause} AND NOT ${strongTradeOpenClause}))`);
      } else if (openClause) {
        where.push(openClause);
      }
    } else if (normalizedParam) {
      const clauses = [];
      params.push(normalizedParam);
      clauses.push(`lower(coalesce(trade_type, '')) = $${params.length}`);
      const spaced = normalizedParam.replace(/_/g, ' ');
      if (spaced && spaced !== normalizedParam) {
        params.push(spaced);
        clauses.push(`lower(coalesce(trade_type, '')) = $${params.length}`);
      }
      params.push(`%${normalizedParam}%`);
      clauses.push(`(
        lower(coalesce(trade_type, '')) LIKE $${params.length}
        OR lower(coalesce(details::text, '')) LIKE $${params.length}
      )`);
      if (spaced && spaced !== normalizedParam) {
        params.push(`%${spaced}%`);
        clauses.push(`(
          lower(coalesce(trade_type, '')) LIKE $${params.length}
          OR lower(coalesce(details::text, '')) LIKE $${params.length}
        )`);
      }
      where.push(`(${clauses.join(' OR ')})`);
    }
  }
  if (status)     { params.push(status);     where.push(`status = $${params.length}`); }
  if (minPrice)   {
    const num = Number(String(minPrice).replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(num)) {
      params.push(num);
      where.push(`coalesce(current_price, start_price, min_price, max_price) >= $${params.length}`);
    }
  }
  if (maxPrice)   {
    const num = Number(String(maxPrice).replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(num)) {
      params.push(num);
      where.push(`coalesce(current_price, start_price, min_price, max_price) <= $${params.length}`);
    }
  }
  if (endDateFrom){ params.push(endDateFrom);where.push(`end_date >= $${params.length}`); }
  if (endDateTo)  { params.push(endDateTo);  where.push(`end_date <= $${params.length}`); }

  const publishedParam = typeof published === 'string' ? published.trim().toLowerCase() : published;
  if (publishedParam === undefined || publishedParam === '' || publishedParam === null) {
    where.push('published = TRUE');
  } else if (['1', 'true', 'yes', 'on'].includes(publishedParam)) {
    where.push('published = TRUE');
  } else if (['0', 'false', 'no', 'off'].includes(publishedParam)) {
    where.push('published = FALSE');
  }


  const pageNum = Math.max(1, parseInt(page));
  const size = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * size;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalSql = `SELECT count(*)::int AS count FROM listings ${whereSql}`;
  const listSql = `
    SELECT id, title, region, city, brand, model, production_year, vin,
           asset_type, trade_type, currency,
           start_price, current_price, min_price, max_price,
           status, end_date, source_url, photos, is_featured, published,
           details
    FROM listings
    ${whereSql}
    ORDER BY end_date NULLS LAST, created_at DESC
    LIMIT ${size} OFFSET ${offset}
  `;

  try {
    const [{ rows: [{ count }] }, { rows }] = await Promise.all([
      query(totalSql, params),
      query(listSql, params)
    ]);
    const items = rows.map(withTradeTypeInfo);
    res.json({ items, total: count, page: pageNum, pageCount: Math.ceil(count / size) });
  } catch (e) {
    console.error('Listings error:', e);
    res.status(500).json({ error: 'Failed to load listings' });
  }
});

app.get('/api/listings/meta', async (_req, res) => {
  try {
    const [regions, cities, brands, tradeTypes] = await Promise.all([
      query(`
        SELECT DISTINCT region
          FROM listings
         WHERE published = TRUE AND region IS NOT NULL AND btrim(region) <> ''
         ORDER BY region
      `),
      query(`
        SELECT DISTINCT city
          FROM listings
         WHERE published = TRUE AND city IS NOT NULL AND btrim(city) <> ''
         ORDER BY city
      `),
      query(`
        SELECT DISTINCT brand
          FROM listings
         WHERE published = TRUE AND brand IS NOT NULL AND btrim(brand) <> ''
         ORDER BY brand
      `),
      query(`
        SELECT trade_type, details
          FROM listings
         WHERE published = TRUE
      `),
    ]);

    const tradeTypeSet = new Set();
    for (const row of tradeTypes.rows) {
      const normalized = normalizeTradeTypeCode(resolveListingTradeType(row) || row.trade_type);
      if (normalized) tradeTypeSet.add(normalized);
    }
    const preferredOrder = ['public_offer', 'open_auction', 'auction', 'offer'];
    const tradeTypeList = Array.from(tradeTypeSet);
    tradeTypeList.sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    
    res.json({
      regions: regions.rows.map((r) => r.region),
      cities: cities.rows.map((r) => r.city),
      brands: brands.rows.map((r) => r.brand),
      tradeTypes: tradeTypeList,
    });
  } catch (e) {
    console.error('listings meta error:', e);
    res.status(500).json({ error: 'Failed to load filters' });
  }
});

app.get('/api/listings/featured', async (req, res) => {
  const limitRaw = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(24, limitRaw)) : 12;
  try {
    const { rows } = await query(
      `SELECT id, title, region, city, brand, model, production_year, vin,
              asset_type, trade_type, currency,
              start_price, current_price, min_price, max_price,
              status, end_date, source_url, photos, is_featured, published,
              details
         FROM listings
        WHERE published = TRUE AND is_featured = TRUE
        ORDER BY published_at DESC NULLS LAST, updated_at DESC
        LIMIT $1`,
      [limit]
    );
    const items = rows.map(withTradeTypeInfo);
    res.json({ items });
  } catch (e) {
    console.error('listings featured error:', e);
    res.status(500).json({ error: 'Failed to load featured listings' });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(withTradeTypeInfo(rows[0]));
});

// ===== Favorites =====
app.post('/api/favorites/:id', auth, async (req, res) => {
  const userId = req.user.sub; const { id } = req.params;
  try {
    await query(
      'INSERT INTO favorites(user_id, listing_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [userId, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Fav add error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/stats/summary', async (_req, res) => {
  try {
    const [usersResult, listingsResult, regionResult] = await Promise.all([
      query('SELECT count(*)::int AS count FROM users'),
      query(`
        SELECT
          count(*) FILTER (WHERE published = TRUE) AS total_published,
          count(*) FILTER (WHERE published = TRUE AND lower(coalesce(trade_type,'')) = 'offer') AS offers,
          count(*) FILTER (WHERE published = TRUE AND lower(coalesce(trade_type,'')) = 'auction') AS auctions,
          COALESCE(sum(COALESCE(current_price, start_price, min_price, max_price)) FILTER (WHERE published = TRUE), 0) AS total_value
        FROM listings
      `),
      query(`
        SELECT region,
               count(*)::int AS listings,
               COALESCE(sum(COALESCE(current_price, start_price, min_price, max_price)),0) AS total_value
          FROM listings
         WHERE published = TRUE AND region IS NOT NULL AND btrim(region) <> ''
         GROUP BY region
         ORDER BY listings DESC
      `),
    ]);

    const listingsRow = listingsResult.rows[0] || {};
    const totalValue = Number(listingsRow.total_value || 0);
    const regions = regionResult.rows.map((row) => {
      const value = Number(row.total_value || 0);
      const listings = Number(row.listings || 0);
      const average = listings ? Math.round((value / listings) * 100) / 100 : 0;
      return {
        region: row.region,
        listings,
        totalValue: value,
        averagePrice: average,
      };
    });

    res.json({
      totalUsers: usersResult.rows[0]?.count ?? 0,
      totalListings: listingsRow.total_published ?? 0,
      offersCount: listingsRow.offers ?? 0,
      auctionsCount: listingsRow.auctions ?? 0,
      totalValue,
      regions,
    });
  } catch (e) {
    console.error('stats summary error:', e);
    res.status(500).json({ error: 'Failed to load summary stats' });
  }
});

app.delete('/api/favorites/:id', auth, async (req, res) => {
  const userId = req.user.sub; const { id } = req.params;
  await query('DELETE FROM favorites WHERE user_id=$1 AND listing_id=$2', [userId, id]);
  res.json({ ok: true });
});

// Профиль текущего пользователя
app.get('/api/me', auth, async (req, res) => {
  const userId = req.user.sub;
  const { rows } = await query(
    `SELECT id, user_code, name, email, phone, role, balance
       FROM users
      WHERE id=$1`,
    [userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// Обновление профиля
app.patch('/api/me', auth, async (req, res) => {
  const userId = req.user.sub;
  let { name, email, phone } = req.body || {};

  // Валидация
  if (name !== undefined) {
    name = String(name).trim();
    if (name && (name.length < 2 || name.length > 60)) {
      return res.status(400).json({ error: 'Имя должно быть 2–60 символов' });
    }
  }
  if (email !== undefined) {
    email = String(email).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректная почта' });
    }
  }
  if (phone !== undefined) {
    phone = normalizePhone(String(phone || ''));
    if (!/^\+\d{11,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Некорректный телефон' });
    }
    // уникальность телефона
    const taken = await query(`SELECT 1 FROM users WHERE phone=$1 AND id<>$2`, [phone, userId]);
    if (taken.rows[0]) {
      return res.status(409).json({ error: 'Этот телефон уже используется' });
    }
  }

  const { rows } = await query(
    `UPDATE users
        SET name       = COALESCE($1, name),
            email      = COALESCE($2, email),
            phone      = COALESCE($3, phone),
            updated_at = now()
      WHERE id=$4
      RETURNING id, user_code, name, email, phone, role`,
    [name ?? null, email ?? null, phone ?? null, userId]
  );

  const u = rows[0];
  // если телефон изменился — выдадим новый токен
  let token;
  if (phone) {
    token = jwt.sign(
      { sub: u.id, phone: u.phone, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
  res.json({ ok: true, user: u, token });
});

app.use('/api/admin', auth, requireAdmin, adminParserRouter);
app.use('/api/inspections', auth, inspectionsRouter);
app.use('/api/admin/inspections', auth, requireAdmin, adminInspectionsRouter);



// === Admin API ===
app.get('/api/admin/admins', auth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT user_code, name, phone, email, created_at
         FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC`
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('admins list error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// добавить админа по ID
app.post('/api/admin/add', auth, requireAdmin, async (req, res) => {
  const code = String(req.body?.user_code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Неверный ID (6 цифр)' });

  try {
    const { rows } = await query(
      `UPDATE users
          SET role = 'admin', updated_at = now()
        WHERE user_code = $1
        RETURNING id, user_code, name, phone, role`,
      [code]
    );
    if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error('add admin error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// статистика дешборда
app.get('/api/admin/stats', auth, requireAdmin, async (req, res) => {
  try {
    async function resolveParticipationStats() {
      const candidates = ['participation_orders', 'trade_participation_orders', 'auction_participation_orders'];
      for (const table of candidates) {
        const exists = await query('SELECT to_regclass($1) AS oid', [table]);
        if (exists.rows[0]?.oid) {
          const [{ rows: [{ total = 0 }] }, { rows: [{ month = 0 }] }] = await Promise.all([
            query(`SELECT count(*)::int AS total FROM ${table}`),
            query(`SELECT count(*)::int AS month FROM ${table} WHERE created_at >= date_trunc('month', CURRENT_DATE)`),
          ]);
          return { total, month, table };
        }
      }
      return { total: 0, month: 0, table: null };
    }

    const [
      { rows: [{ c: users }] },
      { rows: visits },
      { rows: [listingStats] },
      { rows: [{ registrations_month: registrationsMonth }] },
      { rows: [inspectionsStats] },
      { rows: [{ pro_count: proUsers }] },
      participationStats,
    ] = await Promise.all([
      query(`SELECT count(*)::int c FROM users`),
      query(
        `SELECT day, cnt
           FROM visits_daily
          WHERE day >= CURRENT_DATE - INTERVAL '29 days'
          ORDER BY day ASC`
      ),
      query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE published = TRUE)::int AS published FROM listings`),
      query(`SELECT count(*)::int AS registrations_month FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)`),
      query(`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS month
          FROM inspections
      `),
      query(`SELECT count(*)::int AS pro_count FROM users WHERE lower(coalesce(subscription_status,'')) = 'pro'`),
      resolveParticipationStats(),
    ]);

    const map = new Map(visits.map(v => [String(v.day), v.cnt]));
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      out.push({ day: iso, cnt: map.get(iso) || 0 });
    }

    res.json({
      users,
      visits: out,
      listings: {
        total: listingStats?.total ?? 0,
        published: listingStats?.published ?? 0,
      },
      registrationsMonth: registrationsMonth ?? 0,
      inspections: {
        total: inspectionsStats?.total ?? 0,
        month: inspectionsStats?.month ?? 0,
      },
      proUsers: proUsers ?? 0,
      participation: participationStats,
    });
  } catch (e) {
    console.error('admin stats error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Пополнение баланса
app.post('/api/me/balance-add', auth, async (req, res) => {
  const userId = req.user.sub;
  const amount = Number(req.body?.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Некорректная сумма' });
  try {
    const { rows } = await query(
      `UPDATE users
          SET balance = COALESCE(balance,0) + $1,
              updated_at = now()
        WHERE id=$2
        RETURNING balance`,
      [amount, userId]
    );
    return res.json({ ok: true, balance: rows[0].balance });
  } catch (e) {
    console.error('balance-add error:', e);
    res.status(500).json({ error: 'Не удалось пополнить' });
  }
});

app.get('/api/me/favorites', auth, async (req, res) => {
  const userId = req.user.sub;
  const { rows } = await query(
    `SELECT l.* FROM favorites f JOIN listings l ON l.id=f.listing_id
     WHERE f.user_id=$1 ORDER BY f.created_at DESC`, [userId]
  );
  res.json({ items: rows.map(withTradeTypeInfo) });
});

// ===== Admin =====
app.get('/api/admin/listings-stats', auth, admin, async (req, res) => {
  const [{ rows: [{ c: total }] }, { rows: [{ c: active }] }] = await Promise.all([
    query('SELECT count(*)::int c FROM listings', []),
    query('SELECT count(*)::int c FROM listings WHERE published = TRUE', [])
  ]);
  res.json({ total, active });
});

app.patch('/api/listings/:id', auth, admin, async (req, res) => {
  const { id } = req.params;
  const { published } = req.body || {};
  try {
    const { rows } = await query(
      `UPDATE listings
          SET published = COALESCE($1, published),
              published_at = CASE
                WHEN $1 IS TRUE THEN COALESCE(published_at, now())
                WHEN $1 IS FALSE THEN NULL
                ELSE published_at
              END,
              updated_at = now()
        WHERE id = $2
        RETURNING *`,
      [published, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Update listing error:', e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.post('/api/listings/:id/feature', auth, admin, async (req, res) => {
  const { id } = req.params;
  const flagRaw = req.body?.is_featured ?? req.body?.featured ?? true;
  const isFeatured = ['1', 'true', 'yes', true].includes(String(flagRaw).toLowerCase());
  try {
    const { rows } = await query(
      `UPDATE listings
          SET is_featured = $1,
              published_at = CASE WHEN $1 = TRUE AND published = TRUE THEN COALESCE(published_at, now()) ELSE published_at END,
              updated_at = now()
        WHERE id = $2
        RETURNING *`,
      [isFeatured, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('feature listing error:', e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/listings/:id', auth, admin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await query('DELETE FROM listings WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('delete listing error:', e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// === ADMIN: пользователи ===
app.get('/api/admin/users', auth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    if (/^\d{6}$/.test(q)) {
      const { rows } = await query(`
        SELECT id, user_code, name, phone, email, created_at, subscription_status, role, is_blocked, balance_frozen, balance
          FROM users
         WHERE user_code = $1
      `, [q]);
      return res.json({ items: rows, page: 1, pages: 1, total: rows.length });
    }

    const { rows: [{ c: total }] } = await query(`SELECT count(*)::int c FROM users`);
    const { rows: items } = await query(`
      SELECT id, user_code, name, phone, email, created_at, subscription_status, role, is_blocked, balance_frozen, balance
        FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2
    `, [limit, offset]);
    const pages = Math.max(1, Math.ceil(total / limit));
    res.json({ items, page, pages, total, limit });
  } catch (e) {
    console.error('admin users list error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/users/:code', auth, requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code || '');
    const { rows } = await query(`
      SELECT id, user_code, name, phone, email, created_at, subscription_status, role, is_blocked, balance_frozen, balance
        FROM users WHERE user_code = $1
    `, [code]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });

    const user = rows[0];
    const { rows: sessions } = await query(`
      SELECT ip, city, device, created_at
        FROM user_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30
    `, [user.id]);

    res.json({ user, sessions });
  } catch (e) {
    console.error('admin user card error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/admin/users/:code/block', auth, requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code || '');
    const block = Boolean(req.body?.block);
    const { rows } = await query(`
      UPDATE users SET is_blocked = $2, updated_at = now()
       WHERE user_code = $1
      RETURNING user_code, is_blocked
    `, [code, block]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error('admin block error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/admin/users/:code/freeze-balance', auth, requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code || '');
    const freeze = Boolean(req.body?.freeze);
    const { rows } = await query(`
      UPDATE users SET balance_frozen = $2, updated_at = now()
       WHERE user_code = $1
      RETURNING user_code, balance_frozen
    `, [code, freeze]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error('admin freeze error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// === ADMIN: отправить уведомление пользователю ===
app.post('/api/admin/notify', auth, requireAdmin, async (req, res) => {
  try {
    const code = String(req.body?.user_code || '').trim();
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Неверный ID (6 цифр)' });
    if (!title || !body) return res.status(400).json({ error: 'Введите заголовок и описание' });

    const { rows: u } = await query(`SELECT id FROM users WHERE user_code = $1`, [code]);
    if (!u.length) return res.status(404).json({ error: 'Пользователь не найден' });

    await query(
      `INSERT INTO user_notifications(user_id, title, body) VALUES ($1,$2,$3)`,
      [u[0].id, title, body]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('admin notify error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// === USER: уведомления ===
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const lim = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const { rows } = await query(
      `SELECT id, title, body, created_at, read_at
         FROM user_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [req.user.sub, lim]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('get notifications error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/notifications/unread-count', auth, async (req, res) => {
  try {
    const { rows: [{ c }] } = await query(
      `SELECT count(*)::int c
         FROM user_notifications
        WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.sub]
    );
    res.json({ count: c });
  } catch (e) {
    console.error('unread count error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/api/notifications/mark-read', auth, async (req, res) => {
  try {
    await query(
      `UPDATE user_notifications
          SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.sub]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('mark read error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// ===== Ingest сырого массива (оставляем как было) =====
app.post('/api/ingest', async (req, res) => {
  const token = req.headers['x-ingest-token'];
  if (!token) return res.status(401).json({ error: 'No ingest token' });
  if (token !== process.env.INGEST_TOKEN) return res.status(403).json({ error: 'Invalid token' });

  const items = Array.isArray(req.body) ? req.body : [];
  if (!items.length) return res.status(400).json({ error: 'Array of items required' });

  try {
    for (const it of items) {
      const {
        source_id, title, description, asset_type, region,
        currency = 'RUB', start_price = null, current_price = null, status = null,
        end_date = null, source_url = null, details = {}
      } = it;

      await query(
        `INSERT INTO listings
         (source_id, title, description, asset_type, region, currency, start_price,
          current_price, status, end_date, source_url, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (source_id) DO UPDATE SET
           title=EXCLUDED.title,
           description=EXCLUDED.description,
           asset_type=EXCLUDED.asset_type,
           region=EXCLUDED.region,
           currency=EXCLUDED.currency,
           start_price=EXCLUDED.start_price,
           current_price=EXCLUDED.current_price,
           status=EXCLUDED.status,
           end_date=EXCLUDED.end_date,
           source_url=EXCLUDED.source_url,
           details=EXCLUDED.details,
           updated_at=now()`,
        [source_id, title, description, asset_type, region, currency,
         start_price, current_price, status, end_date, source_url, details]
      );
    }
    res.json({ ok: true, count: items.length });
  } catch (e) {
    console.error('Ingest error:', e);
    res.status(500).json({ error: 'Ingest failed' });
  }
});


// ==================== НОВОЕ: Интеграция с Trade Parser API ====================

// Базовый URL парсера и таймаут
const PARSER_BASE = process.env.PARSER_BASE_URL || 'http://91.135.156.232:8000';
const PARSER_TIMEOUT = Number(process.env.PARSER_API_TIMEOUT || 30000);

// Безопасный парсинг числа (с пробелами/запятыми)
function pickNumber(n) {
  if (n == null) return null;
  const num = Number(String(n).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

// Преобразование одного объекта парсера -> запись для таблицы listings
function normalizeTradeType(value) {
  if (!value && value !== 0) return null;
  const text = String(value).trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const isPublicOffer = lower.includes('публич')
    || lower.includes('offer')
    || lower.includes('предлож');
  if (isPublicOffer) {
    return 'offer';
  }

  if (lower.includes('аук') || lower.includes('auction') || lower.includes('торг') || lower.includes('bidding')) {
    return 'auction';
  }
  return text;
}

function normalizePhotoEntry(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed ? { url: trimmed } : null;
  }
  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
    if (!url) return null;
    const title = photo.title || photo.name || photo.caption || photo.alt || null;
    return title ? { url, title } : { url };
  }
  return null;
}

function collectPhotos(pr, lot) {
  const pools = [
    pr?.photos,
    pr?.images,
    lot?.photos,
    lot?.images,
    lot?.gallery,
    lot?.photo_urls,
  ].filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const pool of pools) {
    const list = Array.isArray(pool) ? pool : [pool];
    for (const entry of list) {
      const photo = normalizePhotoEntry(entry);
      if (photo && photo.url && !seen.has(photo.url)) {
        seen.add(photo.url);
        out.push(photo);
        if (out.length >= 12) return out;
      }
    }
  }

  return out;
}

function mapParsedToListing(item) {
  // поддерживаем 2 формы: { parsed_data, fedresurs_data } или плоский объект
  const fed = item?.fedresurs_data || {};
  const pr  = item?.parsed_data    || item || {};

  const lot = pr.lot_details || {};
  const photos = collectPhotos(pr, lot);

  const details = {
    lot_details: pr.lot_details || null,
    debtor_details: pr.debtor_details || null,
    contact_details: pr.contact_details || null,
    prices: pr.prices || null,
    documents: pr.documents || null,
    photos: photos.length ? photos : null,
    fedresurs_meta: fed || null,
  };

  const title = pr.title || [lot.brand, lot.model, lot.year].filter(Boolean).join(' ') || 'Лот';
  const description = pr?.description || lot?.description || '';
  const asset_type = lot.category || pr.category || 'vehicle';
  const region = lot.region || pr.region || null;
  const city = lot.city || lot.location || pr.city || pr.location || null;
  const brand = lot.brand || pr.brand || null;
  const model = lot.model || pr.model || null;
  const production_year = lot.year || lot.production_year || lot.manufacture_year || pr.year || null;
  const vin = lot.vin || pr.vin || null;

  const start_price = pickNumber(lot.start_price ?? lot.startPrice ?? pr.start_price ?? pr.startPrice);
  const min_price = pickNumber(lot.min_price ?? lot.minPrice ?? lot.minimal_price ?? lot.minimum_price ?? pr.min_price);
  const max_price = pickNumber(lot.max_price ?? lot.maxPrice ?? lot.maximum_price ?? pr.max_price);

  // current_price можно попытаться брать из последнего периода public offer, если он есть
  let current_price = pickNumber(pr.current_price ?? pr.currentPrice ?? lot.current_price ?? lot.currentPrice) || start_price;
  const prices = Array.isArray(pr.prices) ? pr.prices : [];
  if (prices.length) {
    const last = prices[prices.length - 1];
    const p = pickNumber(last?.price ?? last?.currentPrice ?? last?.current_price);
    if (p) current_price = p;
  }

  const trade_type = normalizeTradeType(pr.trade_type || lot.trade_type || lot.procedure_type || pr.procedure_type);

  // статус и дата окончания: берём из fedresurs_data, если есть
  const status = fed?.status || pr?.status || null;
  const end_date = fed?.dateFinish ? new Date(fed.dateFinish) : pr?.date_finish ? new Date(pr.date_finish) : null;

  const source_url = fed?.possible_url || pr?.trade_platform_url || pr?.source_url || null;

  // Уникальный source_id: пробуем fedresurs_id, иначе номер торгов, иначе fallback
  const source_id = pr.fedresurs_id || pr.bidding_number || fed.guid || fed.number || `unknown:${(pr.title||'').slice(0,50)}`;

  return {
    source_id,
    title,
    description,
    asset_type,
    region,
    city,
    brand,
    model,
    production_year,
    vin,
    trade_type,
    currency: 'RUB',
    start_price,
    current_price,
    min_price,
    max_price,
    status,
    end_date,
    source_url,
    photos,
    details
  };
}

// UPSERT одной записи в listings
async function upsertListing(listing) {
  const {
    source_id,
    title,
    description,
    asset_type,
    region,
    city = null,
    brand = null,
    model = null,
    production_year = null,
    vin = null,
    trade_type = null,
    currency = 'RUB',
    start_price = null,
    current_price = null,
    min_price = null,
    max_price = null,
    status = null,
    end_date = null,
    source_url = null,
    photos = [],
    details = {},
  } = listing;

  const normalizedPhotos = Array.isArray(photos) ? photos : [];

  await query(
    `INSERT INTO listings
     (source_id, title, description, asset_type, region, city, brand, model, production_year, vin,
      trade_type, currency, start_price, current_price, min_price, max_price, status, end_date,
      source_url, photos, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (source_id) DO UPDATE SET
       title=EXCLUDED.title,
       description=EXCLUDED.description,
       asset_type=EXCLUDED.asset_type,
       region=EXCLUDED.region,
       city=EXCLUDED.city,
       brand=EXCLUDED.brand,
       model=EXCLUDED.model,
       production_year=EXCLUDED.production_year,
       vin=EXCLUDED.vin,
       trade_type=EXCLUDED.trade_type,
       currency=EXCLUDED.currency,
       start_price=EXCLUDED.start_price,
       current_price=EXCLUDED.current_price,
       min_price=EXCLUDED.min_price,
       max_price=EXCLUDED.max_price,
       status=EXCLUDED.status,
       end_date=EXCLUDED.end_date,
       source_url=EXCLUDED.source_url,
       photos=EXCLUDED.photos,
       details=EXCLUDED.details,
       updated_at=now()`,
    [
      source_id,
      title,
      description,
      asset_type,
      region,
      city,
      brand,
      model,
      production_year,
      vin,
      trade_type,
      currency,
      start_price,
      current_price,
      min_price,
      max_price,
      status,
      end_date,
      source_url,
      JSON.stringify(normalizedPhotos),
      details,
    ]
  );
}

// POST /admin/ingest/fedresurs?search=vin&limit=15&offset=0&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
app.post('/admin/ingest/fedresurs', async (req, res) => {
  // защита по токену
  const token = req.headers['x-ingest-token'];
  if (!token) return res.status(401).json({ error: 'No ingest token' });
  if (token !== process.env.INGEST_TOKEN) return res.status(403).json({ error: 'Invalid token' });

  try {
    const {
      search = 'vin',
      start_date,
      end_date,
      limit = 15,
      offset = 0
    } = Object.assign({}, req.query, req.body);

    // собираем URL запроса к парсеру
    const u = new URL('/parse-fedresurs-trades', PARSER_BASE);
    u.searchParams.set('search_string', String(search));
    if (start_date) u.searchParams.set('start_date', String(start_date));
    if (end_date)   u.searchParams.set('end_date',   String(end_date));
    u.searchParams.set('limit',  String(limit));
    u.searchParams.set('offset', String(offset));

    console.log('Parser request:', u.toString());

    const { ok, status, data } = await fetchJSON(u.toString(), { timeoutMs: PARSER_TIMEOUT });
    if (!ok) {
      return res.status(502).json({ error: 'Parser error', status, data });
    }

    if (!Array.isArray(data)) {
      return res.status(502).json({ error: 'Unexpected parser payload', sample: data });
    }

    let upserted = 0;
    for (const item of data) {
      try {
        const listing = mapParsedToListing(item);
        await upsertListing(listing);
        upserted++;
      } catch (e) {
        console.error('UPSERT_FROM_PARSER_ERROR', e?.message, { fedresurs_id: item?.parsed_data?.fedresurs_id || item?.fedresurs_data?.guid });
      }
    }

    return res.json({
      ok: true,
      received: data.length,
      upserted,
      offset: Number(offset),
      limit: Number(limit)
    });
  } catch (err) {
    console.error('admin ingest fedresurs error:', err);
    return res.status(500).json({ error: 'ingest failed', message: err?.message });
  }
});

// ==================== /НОВОЕ ====================

app.listen(PORT, () => console.log(`API listening on ${PORT}`));
