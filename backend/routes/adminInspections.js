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
  in_progress: ['производ', 'выполня', 'идет осмотр', 'идёт осмотр'],
  done: ['заверш', 'готово']
};

/* прямые UI фразы -> тег (сырые ключи) */
const UI_TO_TAG_RAW = {
  'оплачен/ожидание модерации': 'paid_pending',
  'идет модерация': 'paid_pending',
  'идёт модерация': 'paid_pending',

  'заказ принят, приступаем к осмотру': 'accepted',
  'заказ принят': 'accepted',
  'приступаем к осмотру': 'accepted',

  'производится осмотр': 'in_progress',
  'выполняется осмотр': 'in_progress',
  'идет осмотр': 'in_progress',
  'идёт осмотр': 'in_progress',

  'осмотр завершен': 'done',
  'осмотр завершён': 'done'
};

function normalize(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:!?()"']/g, '')
    .replace(/\s+/g, ' ');
}

/* нормализованный словарь UI -> тег */
const UI_TO_TAG = (() => {
  const out = {};
  for (const [k, v] of Object.entries(UI_TO_TAG_RAW)) out[normalize(k)] = v;
  return out;
})();

/* “сильные” ключи для точного подбора enum-метки */
const STRONG_KW = {
  paid_pending: ['модерац', 'ожидан', 'оплач'],
  accepted: ['заказ принят', 'принят', 'приступ'],
  in_progress: ['осмотр', 'выполня', 'производ'],
  done: ['заверш', 'завершен', 'завершен']
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

/* детерминированный выбор тега по входной строке с приоритетами */
function chooseTagDeterministic(sNorm) {
  const has = (kw) => sNorm.includes(kw);

  // Высший приоритет: завершено
  if (['заверш'].some(has)) return 'done';
  // Затем: заказ принят / приступаем
  if (['заказ принят', 'принят', 'приступ'].some(has)) return 'accepted';
  // Затем: в процессе
  if (['идет осмотр', 'идет  осмотр', 'идёт осмотр', 'осмотр', 'выполня', 'производ'].some(has)) return 'in_progress';
  // Иначе: оплачен/модерация/ожидание
  if (['модерац', 'ожидан', 'оплач'].some(has)) return 'paid_pending';

  return null;
}

/* скоринг входной строки -> тег (оставлено как резерв) */
function scoreTagForInput(input, tag) {
  const kws = STATUS_KEYWORDS[tag] || [];
  let score = 0;
  for (const kw of kws) {
    const k = normalize(kw);
    if (k && input.includes(k)) score += 1;
  }
  // анти-коллизия: если явно видим "принят/приступ", то штрафуем in_progress
  if (tag === 'in_progress' && (input.includes('принят') || input.includes('приступ'))) score -= 3;
  // усиление по ключам
  for (const kw of STRONG_KW[tag] || []) {
    const k = normalize(kw);
    if (k && input.includes(k)) score += 2;
  }
  return score;
}

/* выбираем enum-метку под конкретный тег */
function pickEnumForTag(enumLabels, tag) {
  const labels = enumLabels.map(l => ({ raw: l, low: normalize(l) }));
  let best = null;
  let bestScore = -1;

  for (const l of labels) {
    // Жёсткие фильтры по тегу чтобы не спутать
    if (tag === 'accepted' && !(l.low.includes('принят') || l.low.includes('приступ'))) continue;
    if (tag === 'in_progress' && !l.low.includes('осмотр') && !(l.low.includes('выполня') || l.low.includes('производ'))) continue;
    if (tag === 'done' && !l.low.includes('заверш')) continue;
    if (tag === 'paid_pending' && !(l.low.includes('модерац') || l.low.includes('ожидан') || l.low.includes('оплач'))) continue;

    let s = 0;
    for (const kw of STATUS_KEYWORDS[tag] || []) {
      const k = normalize(kw);
      if (k && l.low.includes(k)) s += 1;
    }
    for (const kw of STRONG_KW[tag] || []) {
      const k = normalize(kw);
      if (k && l.low.includes(k)) s += 2;
    }
    if (s > bestScore) { bestScore = s; best = l.raw; }
  }
  return best ?? null;
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

    // 1) прямое соответствие UI-фразе (строгое и по подстроке)
    let directTag = UI_TO_TAG[sNorm] || null;
    if (!directTag) {
      for (const [kNorm, t] of Object.entries(UI_TO_TAG)) {
        if (sNorm.includes(kNorm)) { directTag = t; break; }
      }
    }

    // 2) детерминированный выбор по приоритетам
    let chosenTag = directTag || chooseTagDeterministic(sNorm);

    // 3) резерв: скоринг, если всё ещё не определили
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

    // 4) выбираем конкретную enum-метку под тег
    let target = pickEnumForTag(enumLabels, chosenTag);

    // 5) fallback по приоритету, но с сохранением логики
    if (!target) {
      const prio = ['done', 'accepted', 'in_progress', 'paid_pending'];
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
