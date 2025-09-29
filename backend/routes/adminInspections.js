// backend/routes/adminInspections.js
import express from 'express';
import { query } from '../db.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/* ===== утилиты ===== */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:!?()"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function sqlStringLiteral(s) {
  // экранируем одинарные кавычки для SQL-литерала
  return String(s).replace(/'/g, "''");
}

/* ===== канонические теги и словари ===== */
const TAGS = ['paid_pending', 'accepted', 'in_progress', 'done'];

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

/* желаемые читаемые лейблы для каждого тега */
const DESIRED_ENUM_LABEL = {
  paid_pending: 'Идет модерация',
  accepted: 'Заказ принят, Приступаем к Осмотру',
  in_progress: 'Выполняется осмотр машины',
  done: 'Завершен'
};

/* ===== распознавание тега по тексту =====
   Порядок: done → accepted → in_progress → paid_pending */
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

/* безопасно добавить значение в enum, если его нет.
   Требует PostgreSQL 12+ (поддержка IF NOT EXISTS для ENUM). */
async function ensureEnumLabel(enumType, value) {
  if (enumType !== 'inspection_status') {
    throw new Error('Unsupported enum type');
  }
  const literal = sqlStringLiteral(value);
  const sql = `ALTER TYPE ${enumType} ADD VALUE IF NOT EXISTS '${literal}';`;
  await query(sql); // без параметров — это DDL, параметры тут не работают
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

/* ===== обновление статуса =====
   Алгоритм:
   1) Если прислали точный enum-лейбл — ставим его.
   2) Иначе распознаём тег по тексту.
   3) Для тега берём желаемый лейбл DESIRED_ENUM_LABEL[tag].
   4) Гарантируем его наличие в enum (ensureEnumLabel), затем пишем. */
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

    // 0) точное совпадение с существующим enum
    const exact = enumLabels.find((l) => norm(l) === rawNorm);
    if (exact) {
      const r0 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [exact, id]
      );
      if (!r0.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r0.rows[0]);
    }

    // 1) определить канонический тег
    const tag = detectTagFromText(raw);
    if (!tag) {
      return res.status(400).json({ error: 'BAD_STATUS', message: 'Не удалось распознать статус' });
    }

    // 2) желаемый читаемый лейбл для enum
    const desired = DESIRED_ENUM_LABEL[tag];
    if (!desired) {
      return res.status(400).json({ error: 'TAG_NOT_SUPPORTED', tag });
    }

    // 3) гарантируем наличие такого лейбла в enum (DDL без параметров)
    await ensureEnumLabel('inspection_status', desired);

    // 4) обновляем запись
    const r = await query(
      'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
      [desired, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json({ ...r.rows[0], _resolved_tag: tag, _enum_ensured: true });
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
