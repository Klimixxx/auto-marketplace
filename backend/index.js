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
app.get('/api/listings', async (req, res) => {
  const {
    q, region, asset_type, status, minPrice, maxPrice, endDateFrom, endDateTo,
    page = 1, limit = 20
  } = req.query;

  const where = [];
  const params = [];

  if (q) { params.push(q); where.push(
    `to_tsvector('russian', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('russian', $${params.length})`
  );}
  if (region)     { params.push(region);     where.push(`region = $${params.length}`); }
  if (asset_type) { params.push(asset_type); where.push(`asset_type = $${params.length}`); }
  if (status)     { params.push(status);     where.push(`status = $${params.length}`); }
  if (minPrice)   { params.push(minPrice);   where.push(`coalesce(current_price, start_price) >= $${params.length}`); }
  if (maxPrice)   { params.push(maxPrice);   where.push(`coalesce(current_price, start_price) <= $${params.length}`); }
  if (endDateFrom){ params.push(endDateFrom);where.push(`end_date >= $${params.length}`); }
  if (endDateTo)  { params.push(endDateTo);  where.push(`end_date <= $${params.length}`); }

  const pageNum = Math.max(1, parseInt(page));
  const size = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * size;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalSql = `SELECT count(*)::int AS count FROM listings ${whereSql}`;
  const listSql = `
    SELECT id, title, region, asset_type, currency, start_price, current_price, status, end_date, source_url, details
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
    res.json({ items: rows, total: count, page: pageNum, pageCount: Math.ceil(count / size) });
  } catch (e) {
    console.error('Listings error:', e);
    res.status(500).json({ error: 'Failed to load listings' });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
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
    const [{ rows: [{ c: users }] }, { rows: visits }] = await Promise.all([
      query(`SELECT count(*)::int c FROM users`),
      query(
        `SELECT day, cnt
           FROM visits_daily
          WHERE day >= CURRENT_DATE - INTERVAL '29 days'
          ORDER BY day ASC`
      ),
    ]);
    const map = new Map(visits.map(v => [String(v.day), v.cnt]));
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      out.push({ day: iso, cnt: map.get(iso) || 0 });
    }
    res.json({ users, visits: out });
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
  res.json({ items: rows });
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
  const { id } = req.params; const { published } = req.body || {};
  try {
    const { rows } = await query(
      'UPDATE listings SET published = COALESCE($1, published), updated_at = now() WHERE id=$2 RETURNING *',
      [published, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Update listing error:', e);
    res.status(500).json({ error: 'Failed to update' });
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
function mapParsedToListing(item) {
  // поддерживаем 2 формы: { parsed_data, fedresurs_data } или плоский объект
  const fed = item?.fedresurs_data || {};
  const pr  = item?.parsed_data    || item || {};

  const lot = pr.lot_details || {};
  const details = {
    lot_details: pr.lot_details || null,
    debtor_details: pr.debtor_details || null,
    contact_details: pr.contact_details || null,
    prices: pr.prices || null,
    documents: pr.documents || null,
    fedresurs_meta: fed || null,
  };

  const title = pr.title || [lot.brand, lot.model, lot.year].filter(Boolean).join(' ') || 'Лот';
  const description = (pr?.lot_details?.description) || '';
  const asset_type = lot.category || 'vehicle'; // по умолчанию считаем ТС — ты можешь скорректировать
  const region = lot.region || null;

  const start_price = pickNumber(lot.start_price);
  // current_price можно попытаться брать из последнего периода public offer, если он есть
  let current_price = start_price;
  const prices = Array.isArray(pr.prices) ? pr.prices : [];
  if (prices.length) {
    const last = prices[prices.length - 1];
    const p = pickNumber(last?.price ?? last?.currentPrice ?? last?.current_price);
    if (p) current_price = p;
  }

  // статус и дата окончания: берём из fedresurs_data, если есть
  const status = fed?.status || null;
  const end_date = fed?.dateFinish ? new Date(fed.dateFinish) : null;

  const source_url = fed?.possible_url || pr?.trade_platform_url || null;

  // Уникальный source_id: пробуем fedresurs_id, иначе номер торгов, иначе fallback
  const source_id = pr.fedresurs_id || pr.bidding_number || fed.guid || fed.number || `unknown:${(pr.title||'').slice(0,50)}`;

  return {
    source_id,
    title,
    description,
    asset_type,
    region,
    currency: 'RUB',
    start_price,
    current_price,
    status,
    end_date,
    source_url,
    details
  };
}

// UPSERT одной записи в listings
async function upsertListing(listing) {
  const {
    source_id, title, description, asset_type, region,
    currency = 'RUB', start_price = null, current_price = null, status = null,
    end_date = null, source_url = null, details = {}
  } = listing;

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
