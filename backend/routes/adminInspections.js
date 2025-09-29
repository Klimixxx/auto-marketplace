// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* Канонические статусы: ключ — машинный enum код в БД */
const STATUS_CANON = {
  paid_pending: {
    label: 'Оплачен/Ожидание модерации',
    aliases: ['Оплачен/Ожидание модерации', 'paid_pending', 'оплачен', 'ожидание модерации']
  },
  accepted: {
    label: 'Заказ принят, Приступаем к Осмотру',
    aliases: ['Заказ принят, Приступаем к Осмотру', 'accepted', 'принят', 'приступаем к осмотру']
  },
  in_progress: {
    label: 'Производится осмотр',
    aliases: ['Производится осмотр', 'in_progress', 'в процессе', 'идёт осмотр', 'осмотр']
  },
  done: {
    label: 'Осмотр завершен',
    aliases: ['Осмотр завершен', 'done', 'завершен', 'готово']
  }
};

function resolveStatus(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  // прямое совпадение по ключу
  if (STATUS_CANON[s]) return { code: s, label: STATUS_CANON[s].label };

  // по регистронезависимым алиасам
  const sl = s.toLowerCase();
  for (const [code, def] of Object.entries(STATUS_CANON)) {
    if (def.aliases.some(a => String(a).toLowerCase() === sl)) {
      return { code, label: def.label };
    }
  }
  // попытка по вхождению
  for (const [code, def] of Object.entries(STATUS_CANON)) {
    if (def.aliases.some(a => sl.includes(String(a).toLowerCase()))) {
      return { code, label: def.label };
    }
  }
  return null;
}

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

/* Обновление статуса */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    const resolved = resolveStatus(raw);
    if (!resolved) {
      return res.status(400).json({
        error: 'BAD_STATUS',
        allowed: Object.keys(STATUS_CANON)
      });
    }

    const { code: enumCode, label: humanLabel } = resolved;

    // 1) Пытаемся записать как enum inspection_status (машинный код)
    try {
      const r1 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [enumCode, id]
      );
      if (!r1.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r1.rows[0]);
    } catch (err1) {
      console.warn('[inspections] enum cast failed:', err1?.code, err1?.message);

      // 2) Если тип не enum или нет такого enum-значения — пробуем текстовую колонку
      try {
        const r2 = await query(
          'UPDATE inspections SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
          [humanLabel, id]
        );
        if (!r2.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
        return res.json(r2.rows[0]);
      } catch (err2) {
        console.error('[inspections] text update failed:', err2?.code, err2?.message);
        // Если и это упало, вернём 400, чтобы фронт видел проблему маппинга/схемы
        return res.status(400).json({ error: 'STATUS_UPDATE_FAILED' });
      }
    }
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* Загрузка PDF-отчёта */
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
