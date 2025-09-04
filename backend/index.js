import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin === '*' ? true : [allowedOrigin] }));

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

// ===== Вспомогательные функции аутентификации =====
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ===== Служебный =====
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ===== Phone auth (MVP) =====

import fetch from 'node-fetch'; // наверху подключи (npm i node-fetch)

app.post('/api/auth/request-code', async (req,res)=>{
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({error:'phone required'});
  const code = Math.floor(1000 + Math.random()*9000).toString(); // 4 цифры

  // сохраняем код в БД
  await query('INSERT INTO auth_codes(phone, code) VALUES($1,$2)', [phone, code]);

  // отправляем SMS через smsc.ru
  try {
    const login = process.env.SMSC_LOGIN;
    const pass = process.env.SMSC_PASSWORD;
    const text = encodeURIComponent(`Ваш код: ${code}`);
    const url = `https://smsc.ru/sys/send.php?login=${login}&psw=${pass}&phones=${phone}&mes=${text}&fmt=3`;

    const r = await fetch(url);
    const d = await r.json();
    console.log('SMS response:', d);
  } catch(e) {
    console.error('Ошибка отправки SMS', e);
  }

  res.json({ ok: true });
});


// Проверить код и войти
app.post('/api/auth/verify-code', async (req,res)=>{
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({error:'phone+code required'});

  const { rows } = await query(
    `SELECT * FROM auth_codes
     WHERE phone=$1 AND code=$2
       AND created_at > now() - interval '5 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );
  if (!rows[0]) return res.status(401).json({error:'Invalid or expired code'});

  // ищем или создаём пользователя
  let u = await query('SELECT * FROM users WHERE email=$1', [phone]);
  if (!u.rows[0]) {
    const ins = await query(
      'INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email,role',
      [phone,'']
    );
    u = { rows: [ins.rows[0]] };
  }

  const user = { id: u.rows[0].id, email: u.rows[0].email, role: u.rows[0].role };
  const token = signToken(user);
  res.json({ token, user });
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

app.get('/api/me/favorites', auth, async (req, res) => {
  const userId = req.user.sub;
  const { rows } = await query(
    `SELECT l.* FROM favorites f JOIN listings l ON l.id=f.listing_id
     WHERE f.user_id=$1 ORDER BY f.created_at DESC`, [userId]
  );
  res.json({ items: rows });
});

// ===== Admin =====
app.get('/api/admin/stats', auth, admin, async (req, res) => {
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

