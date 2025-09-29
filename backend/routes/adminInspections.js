// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* === словарь синонимов -> ключевые слова для подбора enum-метки === */
const STATUS_KEYWORDS = {
  paid_pending: ['модерац', 'ожидан', 'оплач', 'ожидание модерации'],
  accepted: ['принят', 'приступ', 'к осмотру'],
  in_progress: ['произв', 'идет осмотр', 'идёт осмотр', 'осмотр'],
  done: ['заверш', 'готово']
};

/* === утилиты для enum === */
async function getEnumLabels() {
  const sql = `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'inspection_status'
    ORDER BY e.enumsortorder
  `;
  const r = await query(sql);
  return r.rows.map(x => x.enumlabel);
}

function findEnumByKeywords(enumLabels, keywords) {
  const labels = enumLabels.map(l => ({ raw: l, low: l.toLowerCase() }));
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    const hit = labels.find(l => l.low.includes(k));
    if (hit) return hit.raw;
  }
  return null;
}

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

/* === файловое хранилище для отчетов === */
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

/* === список осмотров === */
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

/* === детали осмотра === */
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

/* === обновление статуса === */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    if (typeof raw !== 'string' || raw.trim() === '') {
      return res.status(400).json({ error: 'BAD_STATUS' });
    }

    const enumLabels = await getEnumLabels();
    if (!enumLabels.length) return res.status(500).json({ error: 'ENUM_EMPTY' });

    const s = normalize(raw);

    // 1) если фронт прислал уже точную enum-метку
    const exact = enumLabels.find(l => l.toLowerCase() === s);
    let target = exact || null;

    // 2) прямые UI-лейблы -> ключи словаря
    if (!target) {
      // наиболее частые варианты UI
      const uiDict = {
        'оплачен/ожидание модерации': 'paid_pending',
        'заказ принят, приступаем к осмотру': 'accepted',
        'производится осмотр': 'in_progress',
        'осмотр завершен': 'done',
        // возможные краткие/разговорные
        'идет модерация': 'paid_pending',
        'идёт модерация': 'paid_pending',
        'заказ принят': 'accepted',
        'идет осмотр': 'in_progress',
        'идёт осмотр': 'in_progress'
      };
      const tag = uiDict[s];
      if (tag) {
        target = findEnumByKeywords(enumLabels, STATUS_KEYWORDS[tag]);
      }
    }

    // 3) общий подбор по ключевым словам, если ничего не найдено
    if (!target) {
      const allKW = Object.values(STATUS_KEYWORDS).flat();
      // подбираем по всем корзинам, начиная с самых явных
      target =
        findEnumByKeywords(enumLabels, STATUS_KEYWORDS.paid_pending) ||
        findEnumByKeywords(enumLabels, STATUS_KEYWORDS.accepted) ||
        findEnumByKeywords(enumLabels, STATUS_KEYWORDS.in_progress) ||
        findEnumByKeywords(enumLabels, STATUS_KEYWORDS.done) ||
        null;
      // если вход уже содержит подсказки — приоритизируем их
      for (const [tag, kws] of Object.entries(STATUS_KEYWORDS)) {
        if (kws.some(k => s.includes(k))) {
          const tryPick = findEnumByKeywords(enumLabels, kws);
          if (tryPick) { target = tryPick; break; }
        }
      }
    }

    if (!target) {
      return res.status(400).json({ error: 'BAD_STATUS', allowed: enumLabels });
    }

    // enum-колонка: используем точную метку + явный каст
    const r = await query(
      'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
      [target, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' , text: e});
  }
});

/* === загрузка PDF-отчёта === */
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
