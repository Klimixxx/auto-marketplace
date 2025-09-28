// backend/routes/inspections.js
import express from 'express';
import { pool, query } from '../db.js';

const router = express.Router();
const BASE_PRICE = 12000;
const INITIAL_STATUS = 'Оплачен/Ожидание модерации';

function normalizeListingId(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const truncated = Math.trunc(value);
    return truncated > 0 ? truncated : null;
  }

  const str = String(value).trim();
  if (!str) return null;

  const asNumber = Number(str);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.trunc(asNumber);
  }

  const match = str.match(/\d+/);
  if (match) {
    const parsed = Number.parseInt(match[0], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
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
    const l = await query('SELECT id, title FROM listings WHERE id=$1', [listingId]);
    if (!l.rows[0]) return res.status(404).json({ error: 'Listing not found' });

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const u = await client.query(
      `SELECT id, balance, COALESCE(subscription_status,'free') AS subscription_status
         FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );
    const user = u.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'User not found' });
    }

    const isPro = String(user.subscription_status).toLowerCase() === 'pro';
    const discountPercent = isPro ? 50 : 0;
    const finalAmount = Math.round((BASE_PRICE * (100 - discountPercent)) / 100);

    const currentBalance = Number(user.balance ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance < finalAmount) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(402)
        .json({ error: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств, пополните счет' });
    }

    await client.query(
      'UPDATE users SET balance = balance - $1, updated_at = now() WHERE id=$2',
      [finalAmount, userId]
    );

    const ins = await client.query(
      `INSERT INTO inspections (user_id, listing_id, status, base_price, discount_percent, final_amount)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
      [userId, listingId, INITIAL_STATUS, BASE_PRICE, discountPercent, finalAmount]
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

// Список заказов текущего пользователя
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const q = await query(
      `SELECT i.*, l.title AS listing_title
         FROM inspections i
         JOIN listings l ON l.id = i.listing_id
        WHERE i.user_id = $1
        ORDER BY i.created_at DESC`,
      [userId]
    );
    res.json({ items: q.rows });
  } catch (e) {
    console.error('my inspections error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
