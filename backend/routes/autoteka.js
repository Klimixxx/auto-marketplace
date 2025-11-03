// backend/routes/autoteka.js
import express from 'express';
import { pool, query } from '../db.js';
import { loadAutotekaSettings, normalizeAutotekaPrice } from '../services/autotekaSettings.js';

const router = express.Router();

const INITIAL_STATUS = 'В процессе';
const PROCESSED_STATUS = 'Обработано';

function userUnreadCondition(alias = 'a') {
  return `(${alias}.user_last_viewed_at IS NULL OR ${alias}.user_last_viewed_at < ${alias}.updated_at)`;
}

async function fetchStatuses() {
  const sql = `
    SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = 'autoteka_status'
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
        // ignore and fall through to digits below
      }
    }
    return digits;
  }

  return clean.length > MAX_LISTING_ID_LENGTH ? clean.slice(0, MAX_LISTING_ID_LENGTH) : clean;
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

router.post('/', async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'No user' });

  const rawId = req.body?.listingId ?? req.body?.listing_id ?? req.query?.listingId;
  const listingId = normalizeListingId(rawId);
  if (!listingId) {
    return res.status(400).json({ error: 'listingId required' });
  }

  let client;
  let transactionStarted = false;

  try {
    const listingQuery = await query(
      'SELECT id, source_id, title, autoteka_pdf_url FROM listings WHERE id::text = $1 OR source_id = $1 LIMIT 1',
      [listingId]
    );
    const listing = listingQuery.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const listingDbId = listing.id;

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const userRes = await client.query(
      `SELECT id, balance, subscription_status, balance_frozen
         FROM users
        WHERE id::text = $1
        FOR UPDATE`,
      [String(userId)]
    );
    const user = userRes.rows[0];
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

    const settings = await loadAutotekaSettings(client);
    const price = normalizeAutotekaPrice(settings?.price);

    const currentBalance = parseMoneyLike(user.balance);
    if (!Number.isFinite(currentBalance) || currentBalance < price) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(402)
        .json({ error: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств, пополните счет' });
    }

    const nextBalance = Number((currentBalance - price).toFixed(2));
    await client.query('UPDATE users SET balance = $1, updated_at = now() WHERE id::text = $2', [
      nextBalance,
      String(userId),
    ]);

    const hasReadyReport = typeof listing.autoteka_pdf_url === 'string' && listing.autoteka_pdf_url.trim();
    const status = hasReadyReport ? PROCESSED_STATUS : INITIAL_STATUS;
    const reportUrl = hasReadyReport ? listing.autoteka_pdf_url.trim() : null;

    const params = [String(userId), String(listingDbId), status, price, reportUrl];
    const insertSql = hasReadyReport
      ? `
        INSERT INTO autoteka_orders
          (user_id, listing_id, status, final_amount, report_pdf_url, user_last_viewed_at, admin_last_viewed_at)
        VALUES ($1, $2, $3::autoteka_status, $4, $5, now(), now())
        RETURNING *
      `
      : `
        INSERT INTO autoteka_orders
          (user_id, listing_id, status, final_amount, report_pdf_url, user_last_viewed_at)
        VALUES ($1, $2, $3::autoteka_status, $4, $5, now())
        RETURNING *
      `;

    const ins = await client.query(insertSql, params);

    await client.query('COMMIT');
    transactionStarted = false;

    if (hasReadyReport) {
      // если отчёт уже готов — пометим заказ как прочитанный для пользователя сразу же
      const order = ins.rows[0];
      return res.json({ ok: true, order });
    }

    return res.json({ ok: true, order: ins.rows[0] });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('autoteka rollback error:', rollbackError);
      }
    }
    console.error('create autoteka order error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    if (client) client.release();
  }
});

router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await fetchStatuses();
    res.json({ statuses });
  } catch (error) {
    console.error('autoteka statuses error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const sql = `SELECT COUNT(*)::int AS count FROM autoteka_orders a WHERE a.user_id::text = $1 AND ${userUnreadCondition(
      'a'
    )}`;
    const r = await query(sql, [String(userId)]);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error('autoteka unread count error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });

    const { status, markViewed } = req.query || {};
    const params = [String(userId)];
    const where = ['a.user_id::text = $1'];

    if (typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      where.push(`a.status = $${params.length}::autoteka_status`);
    }

    const sql = `
      SELECT a.*, ${userUnreadCondition('a')} AS user_unread,
             l.title AS listing_title
        FROM autoteka_orders a
        JOIN listings l ON l.id = a.listing_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
    `;

    const q = await query(sql, params);

    if (markViewed && String(markViewed).trim() !== '') {
      await query('UPDATE autoteka_orders SET user_last_viewed_at = now() WHERE user_id::text = $1', [
        String(userId),
      ]);
    }

    res.json({ items: q.rows });
  } catch (error) {
    console.error('my autoteka error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
