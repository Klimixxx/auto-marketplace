// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* ===== нормализация ===== */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:!?()"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ===== канонические теги и маркеры ===== */
const TAGS = /** @type const */ (['paid_pending', 'accepted', 'in_progress', 'done']);

const MARKERS = {
  done: ['заверш', 'готово', 'закончено', 'выполнен', 'выполнена', 'отчет готов', 'отчёт готов'],
  accepted: ['заказ принят', 'принят', 'подтвержден', 'подтверждено', 'приступ', 'приступаем', 'стартуем'],
  in_progress: ['идет осмотр', 'идёт осмотр', 'в процессе', 'процесс', 'осмотр', 'выполняется', 'производится', 'работают', 'работа начата'],
  paid_pending: ['модерац', 'ожидан', 'оплач', 'ожидает проверки', 'ждет проверки', 'ждёт проверки'],
};

const UI_TO_TAG_RAW = {
  // paid_pending
  'оплачен/ожидание модерации': 'paid_pending',
  'идет модерация': 'paid_pending',
  'идёт модерация': 'paid_pending',
  'ожидает проверки': 'paid_pending',
  'ждет проверки': 'paid_pending',
  'ждёт проверки': 'paid_pending',

  // accepted
  'заказ принят, приступаем к осмотру': 'accepted',
  'заказ принят': 'accepted',
  'приступаем к осмотру': 'accepted',
  'приступаем': 'accepted',
  'подтвержден': 'accepted',
  'подтверждено': 'accepted',

  // in_progress
  'производится осмотр': 'in_progress',
  'выполняется осмотр': 'in_progress',
  'выполняется осмотр машины': 'in_progress',
  'идет осмотр': 'in_progress',
  'идёт осмотр': 'in_progress',
  'осмотр начат': 'in_progress',
  'в процессе': 'in_progress',

  // done
  'осмотр завершен': 'done',
  'осмотр завершён': 'done',
  'завершен': 'done',
  'завершён': 'done',
  'отчет готов': 'done',
  'отчёт готов': 'done'
};

const UI_TO_TAG = (() => {
  const out = {};
  for (const [k, v] of Object.entries(UI_TO_TAG_RAW)) out[norm(k)] = v;
  return out;
})();

/* ===== распознавание тега по тексту (жесткий порядок) =====
   done → accepted → in_progress → paid_pending */
function detectTagFromText(sRaw) {
  const s = norm(sRaw);
  if (UI_TO_TAG[s]) return UI_TO_TAG[s];
  for (const [k, tag] of Object.entries(UI_TO_TAG)) if (s.includes(k)) return tag;

  const hasAny = (arr) => arr.some((kw) => s.includes(norm(kw)));
  if (hasAny(MARKERS.done)) return 'done';
  if (hasAny(MARKERS.accepted)) return 'accepted';
  if (hasAny(MARKERS.in_progress)) return 'in_progress';
  if (hasAny(MARKERS.paid_pending)) return 'paid_pending';
  return null;
}

/* ===== классификация enum-лейбла БД в тег (тот же порядок) ===== */
function classifyEnumLabel(labelRaw) {
  const l = norm(labelRaw);
  if (UI_TO_TAG[l]) return UI_TO_TAG[l];
  for (const [k, tag] of Object.entries(UI_TO_TAG)) if (l.includes(k)) return tag;

  const hasAny = (arr) => arr.some((kw) => l.includes(norm(kw)));
  if (hasAny(MARKERS.done)) return 'done';
  if (hasAny(MARKERS.accepted)) return 'accepted';
  if (hasAny(MARKERS.in_progress)) return 'in_progress';
  if (hasAny(MARKERS.paid_pending)) return 'paid_pending';
  return null;
}

/* ===== enum из БД ===== */
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

/* раскладываем лейблы по тегам */
function bucketizeLabels(enumLabels) {
  const buckets = { paid_pending: [], accepted: [], in_progress: [], done: [] };
  for (const lbl of enumLabels) {
    const tag = classifyEnumLabel(lbl);
    if (tag && buckets[tag]) buckets[tag].push(lbl);
  }
  return buckets;
}

/* выбор "типичного" лейбла внутри тега */
function pickLabelForTag(buckets, tag) {
  const list = (buckets[tag] || []).map((x) => ({ raw: x, n: norm(x) }));
  if (!list.length) return null;

  const prefByTag = {
    paid_pending: ['оплачен/ожидание модерации', 'ожидает проверки', 'идет модерация', 'идёт модерация'],
    accepted: ['заказ принят, приступаем к осмотру', 'заказ принят', 'приступаем к осмотру', 'подтвержден', 'подтверждено'],
    in_progress: ['выполняется осмотр машины', 'выполняется осмотр', 'производится осмотр', 'идет осмотр', 'идёт осмотр'],
    done: ['осмотр завершен', 'осмотр завершён', 'отчет готов', 'отчёт готов', 'завершен', 'завершён']
  }[tag] || [];

  for (const pref of prefByTag) {
    const p = norm(pref);
    const hit = list.find((it) => it.n === p || it.n.includes(p));
    if (hit) return hit.raw;
  }
  // иначе — самая длинная строка
  list.sort((a, b) => b.raw.length - a.raw.length);
  return list[0].raw;
}

/* мягкий fallback: выбираем ближайший доступный тег */
function pickWithFallback(buckets, detectedTag) {
  /** порядки близости */
  const fallbackOrder = {
    accepted: ['accepted', 'in_progress', 'paid_pending'],
    in_progress: ['in_progress', 'accepted', 'paid_pending'],
    paid_pending: ['paid_pending', 'accepted', 'in_progress'],
    done: ['done', 'in_progress', 'accepted'] // если нет done — откатываемся к процессу
  }[detectedTag] || [detectedTag];

  for (const tag of fallbackOrder) {
    const lbl = pickLabelForTag(buckets, tag);
    if (lbl) return { tag, label: lbl };
  }
  return null;
}

/* ===== файловое хранилище отчётов ===== */
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

/* ===== список осмотров ===== */
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

/* ===== детали осмотра ===== */
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

/* ===== обновление статуса ===== */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const raw = req.body?.status;
    if (typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ error: 'BAD_STATUS' });
    }

    const enumLabels = await getEnumLabels();
    if (!enumLabels.length) return res.status(500).json({ error: 'ENUM_EMPTY' });

    const rawNorm = norm(raw);

    // точное совпадение с enum-лейблом
    const exact = enumLabels.find((l) => norm(l) === rawNorm);
    if (exact) {
      const r0 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [exact, id]
      );
      if (!r0.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r0.rows[0]);
    }

    // распознать тег по тексту
    const detectedTag = detectTagFromText(raw);
    if (!detectedTag) {
      return res.status(400).json({ error: 'BAD_STATUS', message: 'Не удалось распознать статус' });
    }

    // разложить enum-лейблы и выбрать по мягкому fallback
    const buckets = bucketizeLabels(enumLabels);
    const pick = pickWithFallback(buckets, detectedTag);
    if (!pick) {
      return res.status(400).json({
        error: 'ENUM_EMPTY_FOR_ALL',
        message: 'В enum нет подходящих лейблов ни для исходного тега, ни для fallback'
      });
    }

    const r = await query(
      'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
      [pick.label, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    // добавим диагностический хвост, чтобы видеть куда упали по fallback
    res.json({ ...r.rows[0], _resolved_tag: detectedTag, _used_tag: pick.tag });
  } catch (e) {
    console.error('admin update status error:', e);
    res.status(500).json({ error: 'SERVER_ERROR', text: String(e) });
  }
});

/* ===== загрузка PDF-отчёта ===== */
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
