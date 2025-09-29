// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* === ключевые слова === */
const STATUS_KEYWORDS = {
  paid_pending: ['модерац', 'ожидан', 'оплач'],
  accepted: ['принят', 'приступ'],
  // важно: без «идет/идёт» чтобы не ловить «Идет модерация»
  in_progress: ['производ', 'выполня', 'осмотр'],
  done: ['заверш', 'готово']
};

/* прямые UI фразы -> тег */
const UI_TO_TAG = {
  'оплачен/ожидание модерации': 'paid_pending',
  'идет модерация': 'paid_pending',
  'идёт модерация': 'paid_pending',

  'заказ принят, приступаем к осмотру': 'accepted',
  'заказ принят': 'accepted',

  'производится осмотр': 'in_progress',
  'выполняется осмотр': 'in_progress',
  'идет осмотр': 'in_progress',
  'идёт осмотр': 'in_progress',

  'осмотр завершен': 'done',
  'осмотр завершён': 'done'
};

/* “сильные” ключи для точного подбора enum-метки */
const STRONG_KW = {
  paid_pending: ['модерац', 'ожидан', 'оплач'],
  accepted: ['принят', 'приступ'],
  in_progress: ['осмотр', 'производ', 'выполня'],
  done: ['заверш', 'готово']
};

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

function normalize(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
  // удаляем пунктуацию, сжимаем пробелы
    .replace(/[.,;:!?()"']/g, '')
    .replace(/\s+/g, ' ');
}

/* скоринг входной строки -> тег */
function scoreTagForInput(input, tag) {
  const kws = STATUS_KEYWORDS[tag] || [];
  let score = 0;
  for (const kw of kws) {
    const k = normalize(kw);
    if (k && input.includes(k)) score += 1;
  }
  // бонус за уникальные признаки
  if (tag === 'accepted' && (input.includes('принят') || input.includes('приступ'))) score += 2;
  if (tag === 'done' && input.includes('заверш')) score += 2;
  return score;
}

/* выбираем enum-метку под конкретный тег */
function pickEnumForTag(enumLabels, tag) {
  const labels = enumLabels.map(l => ({ raw: l, low: normalize(l) }));
  let best = null;
  let bestScore = -1;

  for (const l of labels) {
    let s = 0;
    for (const kw of STATUS_KEYWORDS[tag] || []) {
      const k = normalize(kw);
      if (k && l.low.includes(k)) s += 1;
    }
    // усиливаем по сильным ключам
    for (const kw of STRONG_KW[tag] || []) {
      const k = normalize(kw);
      if (k && l.low.includes(k)) s += 2;
    }

    // специальное правило: для in_progress в метке ОБЯЗАТЕЛЕН «осмотр»
    if (tag === 'in_progress' && !l.low.includes('осмотр')) continue;

    if (s > bestScore) { bestScore = s; best = l.raw; }
  }
  return bestScore > 0 ? best : null;
}

/* === файловое хранилище отчетов === */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportsDir),
  filename: (_req, file, cb) => {
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

    const sNorm = normalize(raw);

    // 0) точное совпадение с enum-меткой
    const exact = enumLabels.find(l => normalize(l) === sNorm);
    if (exact) {
      const r0 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [exact, id]
      );
      if (!r0.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r0.rows[0]);
    }

    // 1) прямое соответствие UI-фразе -> тег
    const directTag = UI_TO_TAG[sNorm] || null;

    // 2) скоринг входа -> тег, если прямого нет
    let chosenTag = directTag;
    if (!chosenTag) {
      let bestTag = null;
      let bestScore = -1;
      for (const tag of Object.keys(STATUS_KEYWORDS)) {
        const sc = scoreTagForInput(sNorm, tag);
        if (sc > bestScore) { bestScore = sc; bestTag = tag; }
      }
      if (bestScore > 0) chosenTag = bestTag;
    }

    if (!chosenTag) {
      return res.status(400).json({ error: 'BAD_STATUS', allowed: enumLabels });
    }

    // 3) выбираем конкретную enum-метку под тег
    let target = pickEnumForTag(enumLabels, chosenTag);

    // жёсткий fallback: пробуем альтернативные теги по приоритету
    if (!target) {
      const prio = ['accepted', 'in_progress', 'paid_pending', 'done'];
      for (const tag of prio) {
        target = pickEnumForTag(enumLabels, tag);
        if (target) break;
      }
    }

    if (!target) {
      return res.status(400).json({ error: 'BAD_STATUS', allowed: enumLabels });
    }

    const r = await query(
      'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
      [target, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR', text: String(e) });
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
