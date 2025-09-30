import express from 'express';
import { query } from '../db.js';

const router = express.Router();

function sqlStringLiteral(s) {
  return String(s).replace(/'/g, "''");
}

async function getEnumLabels() {
  const sql = `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'trade_order_status'
    ORDER BY e.enumsortorder
  `;
  const r = await query(sql);
  return r.rows.map((x) => x.enumlabel);
}

async function ensureEnumValue(value) {
  const literal = sqlStringLiteral(value);
  const sql = `ALTER TYPE trade_order_status ADD VALUE IF NOT EXISTS '${literal}';`;
  await query(sql);
}

function adminUnreadCondition(alias = 'o') {
  return `(${alias}.admin_last_viewed_at IS NULL OR ${alias}.admin_last_viewed_at < ${alias}.updated_at)`;
}

router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await getEnumLabels();
    res.json({ statuses });
  } catch (error) {
    console.error('admin trade orders statuses error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/unread-count', async (_req, res) => {
  try {
    const sql = `SELECT COUNT(*)::int AS count FROM trade_orders o WHERE ${adminUnreadCondition('o')}`;
    const r = await query(sql);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error('admin trade orders unread count error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status } = req.query || {};
    const params = [];
    const where = [];

    if (typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      where.push(`o.status = $${params.length}::trade_order_status`);
    }

    const sql = `
      SELECT o.*, ${adminUnreadCondition('o')} AS admin_unread,
             u.name AS user_name, u.phone AS user_phone, u.subscription_status,
             l.title AS listing_title
        FROM trade_orders o
        JOIN users u ON u.id = o.user_id
        JOIN listings l ON l.id = o.listing_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY o.created_at DESC
    `;
    const q = await query(sql, params);
    res.json({ items: q.rows });
  } catch (error) {
    console.error('admin list trade orders error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    await query('UPDATE trade_orders SET admin_last_viewed_at = now() WHERE id = $1', [id]);

    const q = await query(
      `SELECT o.*, ${adminUnreadCondition('o')} AS admin_unread,
              u.name AS user_name, u.phone AS user_phone, u.subscription_status,
              l.title AS listing_title
         FROM trade_orders o
         JOIN users u ON u.id = o.user_id
         JOIN listings l ON l.id = o.listing_id
        WHERE o.id = $1`,
      [id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(q.rows[0]);
  } catch (error) {
    console.error('admin get trade order error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    if (typeof raw !== 'string') return res.status(400).json({ error: 'BAD_STATUS_TYPE' });

    const value = raw.trim();
    if (!value) return res.status(400).json({ error: 'EMPTY_STATUS' });
    if (value.length > 200) return res.status(400).json({ error: 'STATUS_TOO_LONG' });

    const labels = await getEnumLabels();
    if (!labels.includes(value)) {
      await ensureEnumValue(value);
    }

    const updated = await query(
      `UPDATE trade_orders
          SET status = $1::trade_order_status,
              updated_at = now()
        WHERE id = $2
        RETURNING *`,
      [value, id]
    );
    if (!updated.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    await query('UPDATE trade_orders SET admin_last_viewed_at = now() WHERE id = $1', [id]);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('admin update trade order status error:', error);
    res.status(500).json({ error: 'SERVER_ERROR', text: String(error) });
  }
});

export default router;
