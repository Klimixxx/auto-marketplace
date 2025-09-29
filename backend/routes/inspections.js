// backend/routes/inspections.js
import express from 'express';
import { pool, query } from '../db.js';

const router = express.Router();
const BASE_PRICE = 12000;
const INITIAL_STATUS = 'Оплачен/Ожидание модерации';

function userUnreadCondition(alias = 'i') {
  return `(${alias}.user_last_viewed_at IS NULL OR ${alias}.user_last_viewed_at < ${alias}.updated_at)`;
}

async function fetchStatuses() {
  const sql = `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'inspection_status'
    ORDER BY e.enumsortorder
  `;
  const r = await query(sql);
  return r.rows.map((x) => x.enumlabel);
}


const MAX_LISTING_ID_LENGTH = 160;

function normalizeListingId(value) {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const truncated = Math.trunc(value);
    return truncated > 0 ? String(truncated) : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '');
  if (!compact) return null;

  const clean = compact.replace(/[\u0000-\u001f\u007f]/g, '');
  if (!clean) return null;

  if (/^[0-9]+$/.test(clean)) {
    const digits = clean.replace(/^0+/, '');
    if (!digits) return null;
    if (typeof BigInt === 'function') {
      try {
        const big = BigInt(digits);
        if (big > 0n) return big.toString();
      } catch {
        // fall through to returning the plain digit string below
      }
    }
    return digits;
  }


  return clean.length > MAX_LISTING_ID_LENGTH
    ? clean.slice(0, MAX_LISTING_ID_LENGTH)
    : clean;
}

function parseMoneyLike(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);

  const cleaned = String(value)
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');

  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'bigint') return value !== 0n;
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized);
}

// Создать заказ на осмотр
router.post('/', async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'No user' });

  // мягкий парсинг listingId
  const rawId = req.body?.listingId ?? req.body?.listing_id ?? req.query?.listingId;
  const listingId = normalizeListingId(rawId);
  if (!listingId) {
    return res.status(400).json({ error: 'listingId required' });
  }
  let client;
  let transactionStarted = false;

  try {
    // Проверим, что объявление существует (отдельно от транзакции)
    const l = await query(
      'SELECT id, source_id, title FROM listings WHERE id::text = $1 OR source_id = $1 LIMIT 1',
      [listingId]
    );
    const listing = l.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const listingDbId = listing.id;

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const u = await client.query(
      `SELECT id, balance, subscription_status, balance_frozen
         FROM users WHERE id::text=$1 FOR UPDATE`,
      [String(userId)]
    );
    const user = u.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.balance_frozen) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(423)
        .json({ error: 'BALANCE_FROZEN', message: 'Баланс пользователя заморожен' });
    }

    const subscriptionStatus = String(user.subscription_status || 'free').trim().toLowerCase() || 'free';
    const isPro = subscriptionStatus === 'pro';
    const discountPercent = isPro ? 50 : 0;
    const finalAmount = Math.round((BASE_PRICE * (100 - discountPercent)) / 100);

    const currentBalance = parseMoneyLike(user.balance);
    if (!Number.isFinite(currentBalance) || currentBalance < finalAmount) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(402)
        .json({ error: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств, пополните счет' });
    }

    const nextBalance = Number((currentBalance - finalAmount).toFixed(2));

    await client.query(
      'UPDATE users SET balance = $1, updated_at = now() WHERE id::text=$2',
      [nextBalance, String(userId)]
    );

    const ins = await client.query(
      `INSERT INTO inspections (user_id, listing_id, status, base_price, discount_percent, final_amount, user_last_viewed_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
         RETURNING *`,
      [
        String(userId),
        String(listingDbId),
        INITIAL_STATUS,
        BASE_PRICE,
        discountPercent,
        finalAmount,
      ]
    );


    await client.query('COMMIT');
    transactionStarted = false;
    return res.json({ ok: true, order: ins.rows[0] });
  } catch (e) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('rollback error:', rollbackError);
      }
    }
    console.error('create inspection error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await fetchStatuses();
    res.json({ statuses });
  } catch (e) {
    console.error('inspections statuses error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const sql = `SELECT COUNT(*)::int AS count FROM inspections i WHERE i.user_id::text = $1 AND ${userUnreadCondition('i')}`;
    const r = await query(sql, [String(userId)]);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (e) {
    console.error('inspections unread count error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Список заказов текущего пользователя
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const { status, markViewed } = req.query || {};
    const params = [String(userId)];
    const where = ['i.user_id::text = $1'];

    if (typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      where.push(`i.status = $${params.length}::inspection_status`);
    }

    const sql = `
      SELECT i.*, ${userUnreadCondition('i')} AS user_unread,
             l.title AS listing_title
        FROM inspections i
        JOIN listings l ON l.id = i.listing_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.created_at DESC
    `;
    const q = await query(sql, params);

    if (markViewed && String(markViewed).trim() !== '') {
      await query('UPDATE inspections SET user_last_viewed_at = now() WHERE user_id::text = $1', [String(userId)]);
    }

    res.json({ items: q.rows });
  } catch (e) {
    console.error('my inspections error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});
export default router;
