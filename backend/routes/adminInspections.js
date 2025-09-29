// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* ===== UI последовательность статусов (для справки) ===== */
const STATUS_FLOW = [
  'Оплачен/Ожидание модерации',
  'Заказ принят, Приступаем к Осмотру',
  'Производится осмотр',
  'Осмотр завершен'
];

/* ===== Маппинг входа -> значение в БД =====
 * Приходит либо человекочитаемый лейбл, либо машинный код.
 * Значение справа — то, что пишем в колонку `status`.
 */
const STATUS_DB_MAP = {
  'Оплачен/Ожидание модерации': 'Оплачен/Ожидание модерации',
  'Заказ принят, Приступаем к Осмотру': 'Заказ принят, Приступаем к Осмотру',
  'Производится осмотр': 'Производится осмотр',
  'Осмотр завершен': 'Осмотр завершен',

  // машинные статусы
  paid_pending: 'Оплачен/Ожидание модерации',
  accepted: 'Заказ принят, Приступаем к Осмотру',
  in_progress: 'Производится осмотр',
  done: 'Осмотр завершен'
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage });

/* ===== Список осмотров ===== */
router.get('/', async (_req, res) => {
  try {
    const q = await query(
      `SELECT i.*,
              u.name  AS user_name, u.phone AS user_phone, u.subscription_status,
              l.title AS listing_title
         FROM inspections i
         JOIN users u ON u.id = i.user_id
         JOIN listings l ON l.id = i.listing_id
        ORDER BY i.created_at DESC`
    );
    res.json({ items: q.rows });
  } catch (e) {
    console.error('admin list inspections error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== Детали осмотра ===== */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const q = await query(
      `SELECT i.*,
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

/* ===== Обновление статуса ===== */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return res.status(400).json({ error: 'BAD_STATUS' });
    }

    const uiLabel = raw.trim();
    // Пробуем прямой ключ, иначе — в нижнем регистре для машинных
    const normalizedKey = Object.prototype.hasOwnProperty.call(STATUS_DB_MAP, uiLabel)
      ? uiLabel
      : uiLabel.toLowerCase();

    const enumValue = STATUS_DB_MAP[normalizedKey];
    if (!enumValue) return res.status(400).json({ error: 'BAD_STATUS' });

    // 1) Обновление с кастом к enum, если в БД тип enum inspection_status
    try {
      const r1 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [enumValue, id]
      );
      if (!r1.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r1.rows[0]);
    } catch (err) {
      // 2) Фоллбек на TEXT/VARCHAR
      console.warn('enum cast failed, fallback to TEXT update:', err?.code, err?.message);
      const r2 = await query(
        'UPDATE inspections SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [enumValue, id]
      );
      if (!r2.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r2.rows[0]);
    }
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ===== Загрузка PDF-отчёта ===== */
router.post('/:id/upload', upload.single('report_pdf'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });
    if (!req.file) return res.status(400).json({ error: 'NO_FILE' });

    const publicUrl = `/uploads/reports/${req.file.filename}`;
    const r = await query(
      'UPDATE inspections SET report_pdf_url=$1, updated_at=now() WHERE id=$2 RETURNING *',
      [publicUrl, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, order: r.rows[0] });
  } catch (e) {
    console.error('admin upload pdf error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
