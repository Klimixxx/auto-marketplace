// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* ===== utils ===== */
function sqlStringLiteral(s) {
  return String(s).replace(/'/g, "''");
}

/* ===== ENUM helpers ===== */
async function getEnumLabels() {
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

/* PostgreSQL 12+: IF NOT EXISTS для ENUM */
async function ensureEnumValue(value) {
  const literal = sqlStringLiteral(value);
  const sql = `ALTER TYPE inspection_status ADD VALUE IF NOT EXISTS '${literal}';`;
  await query(sql);
}

/* ===== files ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  },
});
const upload = multer({ storage });

function adminUnreadCondition(alias = 'i') {
  return `(${alias}.admin_last_viewed_at IS NULL OR ${alias}.admin_last_viewed_at < ${alias}.updated_at)`;
}

/* ===== meta: statuses ===== */
router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await getEnumLabels();
    res.json({ statuses });
  } catch (e) {
    console.error('admin inspections statuses error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== unread count ===== */
router.get('/unread-count', async (_req, res) => {
  try {
    const sql = `SELECT COUNT(*)::int AS count FROM inspections i WHERE ${adminUnreadCondition('i')}`;
    const r = await query(sql);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (e) {
    console.error('admin inspections unread count error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== list ===== */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query || {};
    const params = [];
    const where = [];

    if (typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      where.push(`i.status = $${params.length}::inspection_status`);
    }

    const sql = `
      SELECT i.*, ${adminUnreadCondition('i')} AS admin_unread,
             u.name  AS user_name, u.phone AS user_phone, u.subscription_status,
             l.title AS listing_title
        FROM inspections i
        JOIN users u ON u.id = i.user_id
        JOIN listings l ON l.id = i.listing_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY i.created_at DESC
    `;
    const q = await query(sql, params);
    res.json({ items: q.rows });
  } catch (e) {
    console.error('admin list inspections error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== details ===== */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    await query('UPDATE inspections SET admin_last_viewed_at = now() WHERE id = $1', [id]);

    const q = await query(
      `SELECT i.*, ${adminUnreadCondition('i')} AS admin_unread,
              u.name  AS user_name, u.phone AS user_phone, u.subscription_status,
              l.title AS listing_title
         FROM inspections i
         JOIN users u ON u.id = i.user_id
         JOIN listings l ON l.id = i.listing_id
        WHERE i.id = $1`,
      [id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(q.rows[0]);
  } catch (e) {
    console.error('admin get inspection error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== update status (save exactly as received) ===== */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    if (typeof raw !== 'string') return res.status(400).json({ error: 'BAD_STATUS_TYPE' });

    const value = raw.trim();
    if (value.length === 0) return res.status(400).json({ error: 'EMPTY_STATUS' });
    if (value.length > 200) return res.status(400).json({ error: 'STATUS_TOO_LONG' });

    // если такого enum-значения нет — добавить
    const labels = await getEnumLabels();
    if (!labels.includes(value)) {
      await ensureEnumValue(value);
    }

    const r = await query(
      `UPDATE inspections
          SET status = $1::inspection_status,
              updated_at = now()
        WHERE id = $2
        RETURNING *`,
      [value, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    await query('UPDATE inspections SET admin_last_viewed_at = now() WHERE id = $1', [id]);

    res.json(r.rows[0]);
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR', text: String(e) });
  }
});

/* ===== upload report PDF ===== */
router.post('/:id/upload', upload.single('report_pdf'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });
    if (!req.file) return res.status(400).json({ error: 'NO_FILE' });

    const publicUrl = `/uploads/reports/${req.file.filename}`;
    const r = await query(
      `UPDATE inspections
          SET report_pdf_url=$1,
              updated_at=now()
        WHERE id=$2
        RETURNING *`,
      [publicUrl, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    await query('UPDATE inspections SET admin_last_viewed_at = now() WHERE id = $1', [id]);

    res.json({ ok: true, order: r.rows[0] });
  } catch (e) {
    console.error('admin upload pdf error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
