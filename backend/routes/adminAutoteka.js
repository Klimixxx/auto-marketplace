// backend/routes/adminAutoteka.js
import express from 'express';;
import { pool, query } from '../db.js';

const router = express.Router();

function adminUnreadCondition(alias = 'a') {
  return `(${alias}.admin_last_viewed_at IS NULL OR ${alias}.admin_last_viewed_at < ${alias}.updated_at)`;
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

function normalizeReportUrl(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return text;
  return null;
}

router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await fetchStatuses();
    res.json({ statuses });
  } catch (error) {
    console.error('admin autoteka statuses error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/unread-count', async (_req, res) => {
  try {
    const sql = `SELECT COUNT(*)::int AS count FROM autoteka_orders a WHERE ${adminUnreadCondition('a')}`;
    const r = await query(sql);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error('admin autoteka unread count error:', error);
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
      where.push(`a.status = $${params.length}::autoteka_status`);
    }

    const sql = `
      SELECT a.*, ${adminUnreadCondition('a')} AS admin_unread,
             u.name AS user_name,
             u.phone AS user_phone,
             u.subscription_status,
             l.title AS listing_title
        FROM autoteka_orders a
        JOIN users u ON u.id = a.user_id
        JOIN listings l ON l.id = a.listing_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.created_at DESC
    `;

    const q = await query(sql, params);
    res.json({ items: q.rows });
  } catch (error) {
    console.error('admin autoteka list error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const sql = `
      SELECT a.*, ${adminUnreadCondition('a')} AS admin_unread,
             u.name AS user_name,
             u.phone AS user_phone,
             u.subscription_status,
             l.title AS listing_title
        FROM autoteka_orders a
        JOIN users u ON u.id = a.user_id
        JOIN listings l ON l.id = a.listing_id
       WHERE a.id = $1
    `;

    const q = await query(sql, [id]);
    const item = q.rows[0];
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

    await query('UPDATE autoteka_orders SET admin_last_viewed_at = now() WHERE id = $1', [id]);
    res.json(item);
  } catch (error) {
    console.error('admin autoteka get error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const rawStatus = req.body?.status;
    if (typeof rawStatus !== 'string') return res.status(400).json({ error: 'BAD_STATUS_TYPE' });

    const statusValue = rawStatus.trim();
    if (!statusValue) return res.status(400).json({ error: 'EMPTY_STATUS' });

    const statuses = await fetchStatuses();
    if (!statuses.includes(statusValue)) {
      return res.status(400).json({ error: 'UNKNOWN_STATUS' });
    }

    const current = await query('SELECT id, status, report_pdf_url, listing_id FROM autoteka_orders WHERE id = $1', [
      id,
    ]);
    const order = current.rows[0];
    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

    if (statusValue === 'Обработано' && !order.report_pdf_url) {
      return res.status(400).json({ error: 'REPORT_URL_REQUIRED' });
    }

    const updateSql = `
      UPDATE autoteka_orders
         SET status = $1::autoteka_status,
             updated_at = now(),
             admin_last_viewed_at = now()
       WHERE id = $2
       RETURNING *
    `;

    const updated = await query(updateSql, [statusValue, id]);
    const updatedOrder = updated.rows[0];

    if (statusValue === 'Обработано' && updatedOrder?.report_pdf_url) {
      await query('UPDATE listings SET autoteka_pdf_url = $1, updated_at = now() WHERE id = $2', [
        updatedOrder.report_pdf_url,
        updatedOrder.listing_id,
      ]);
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('admin autoteka update status error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/:id/upload', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });
    const rawUrl = req.body?.report_url ?? req.body?.reportUrl ?? req.body?.url;
    const reportUrl = normalizeReportUrl(rawUrl);
    if (!reportUrl) {
      return res.status(400).json({ error: 'REPORT_URL_REQUIRED' });
    }

    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const current = await client.query(
        'SELECT id, listing_id FROM autoteka_orders WHERE id = $1 FOR UPDATE',
        [id]
      );
      const order = current.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ error: 'NOT_FOUND' });
      }

      const updateCurrent = await client.query(
        `UPDATE autoteka_orders
            SET report_pdf_url = $1,
                status = 'Обработано'::autoteka_status,
                updated_at = now(),
                admin_last_viewed_at = now()
          WHERE id = $2
          RETURNING *`,
        [reportUrl, id]
      );
      const updatedOrder = updateCurrent.rows[0];

      await client.query('UPDATE listings SET autoteka_pdf_url = $1, updated_at = now() WHERE id = $2', [
        reportUrl,
        order.listing_id,
      ]);

      await client.query(
        `UPDATE autoteka_orders
            SET report_pdf_url = $1,
                status = 'Обработано'::autoteka_status,
                updated_at = now()
          WHERE listing_id = $2 AND id <> $3
            AND (report_pdf_url IS DISTINCT FROM $1 OR status <> 'Обработано'::autoteka_status)`,
        [reportUrl, order.listing_id, id]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      res.json({ ok: true, order: updatedOrder });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('admin autoteka upload rollback error:', rollbackError);
        }
      }
      throw error;
    } finally {
      if (client) client.release();
    }
  } catch (error) {
    console.error('admin autoteka upload error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
