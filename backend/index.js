import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';





dotenv.config();



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
async function fetchJSON(url, { timeoutMs = 15000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}



const app = express();
app.use(express.json({ limit: '2mb' }));

// ==== МИГРАЦИИ (выполнить все .sql из /backend/migrations по алфавиту) ====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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



// CORS
const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  }
}));


// Порт: Render сам задаёт process.env.PORT
const PORT = process.env.PORT || 8080;

// Диагностика окружения (увидишь в Runtime logs на Render)
console.log('Starting server with env:', {
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
  JWT_SECRET: !!process.env.JWT_SECRET,
  INGEST_TOKEN: !!process.env.INGEST_TOKEN,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}


async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, phone, role }

    // ⬇️ ДОБАВЛЕНО: мгновенная проверка блокировки
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


// --- admin guard ---
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

// ===== Служебный =====
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
    // 1) Нормализуем телефон и код
    const phone = normalizePhone(req.body?.phone);
    const code  = String(req.body?.code || '').replace(/\s/g, '');
    if (!phone || !code) return res.status(400).json({ error: 'phone+code required' });

    // 2) Ищем ровно этот код для этого номера за последние 5 минут
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
      // Доп. лог для отладки — последние 3 кода по номеру
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

    // 3) Помечаем код использованным
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


    // 4) Находим/создаём пользователя по телефону
    let u = await query('SELECT id, phone, role, user_code, name, email, is_blocked FROM users WHERE phone=$1', [phone]);
if (!u.rows[0]) {
  // пытаемся вставить с уникальным user_code (несколько попыток на случай коллизии)
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
      // если нарушена уникальность по user_code — пробуем снова
      if (!String(e.message || '').includes('users_user_code_key')) throw e;
    }
  }
  if (!userRow) {
    // почти невозможно, но на всякий случай
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


// 5) Проверка блокировки
const user = u.rows[0];
if (user?.is_blocked) {
  return res.status(403).json({
    ok: false,
    error: 'Ваш аккаунт заблокирован. Свяжитесь с поддержкой.'
  });
}

// 6) Логируем сессию до ответа
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

// 7) Выдаём токен
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

// Обновление профиля: name (обязательно при первичном заполнении), email (опц.)
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
  // если телефон изменился — выдадим новый токен с обновлённым phone
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

// === Admin API ===

// список админов
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

// добавить админа по ID (6 цифр user_code)
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

// статистика для дешборда
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


// Пополнение баланса (временный dev-эндпоинт)
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

// список пользователей / поиск по ID (user_code)
app.get('/api/admin/users', auth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (/^\d{6}$/.test(q)) {
      const { rows } = await query(`
        SELECT id, user_code, name, phone, email, created_at, subscription_status, role, is_blocked, balance_frozen, balance
          FROM users
         WHERE user_code = $1
      `, [q]);
      return res.json({ items: rows });
    }
    const { rows } = await query(`
      SELECT id, user_code, name, phone, email, created_at, subscription_status, role, is_blocked, balance_frozen, balance
        FROM users
       ORDER BY created_at DESC
       LIMIT 500
    `);
    res.json({ items: rows });
  } catch (e) {
    console.error('admin users list error:', e);
    res.status(500).json({ error: 'failed' });
  }
});

// карточка пользователя
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

// блокировка/разблокировка пользователя
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

// заморозка/разморозка баланса
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


// ===== Ingest для парсера (UPSERT по source_id) =====
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

app.listen(PORT, () => console.log(`API listening on ${PORT}`));

