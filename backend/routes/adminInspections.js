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
  done: [
    'заверш', 'готово', 'закончено', 'выполнен', 'выполнена', 'отчет готов', 'отчёт готов'
  ],
  accepted: [
    'заказ принят', 'принят', 'подтвержден', 'подтверждено', 'приступ', 'приступаем', 'стартуем'
  ],
  in_progress: [
    'идет осмотр', 'идёт осмотр', 'в процессе', 'процесс', 'осмотр',
    'выполняется', 'производится', 'работают', 'работа начата'
  ],
  paid_pending: [
    'модерац', 'ожидан', 'оплач', 'ожидает проверки', 'ждет проверки', 'ждёт проверки'
  ],
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

/* ===== распознавание тега по произвольной фразе =====
   Жесткий порядок: done → accepted → in_progress → paid_pending.
   Это устраняет коллизию "принят + осмотр". */
function detectTagFromText(sRaw) {
  const s = norm(sRaw);

  // полное совпадение с известной UI-фразой
  if (UI_TO_TAG[s]) return UI_TO_TAG[s];
  for (const [k, tag] of Object.entries(UI_TO_TAG)) {
    if (s.includes(k)) return tag;
  }

  const hasAny = (arr) => arr.some((kw) => s.includes(norm(kw)));

  if (hasAny(MARKERS.done)) return 'done';
  if (hasAny(MARKERS.accepted)) return 'accepted';
  if (hasAny(MARKERS.in_progress)) return 'in_progress';
  if (hasAny(MARKERS.paid_pending)) return 'paid_pending';

  return null;
}

/* ===== классификация enum-лейбла в БД в один из тегов =====
   Те же правила и порядок приоритета. */
function classifyEnumLabel(labelRaw) {
  const l = norm(labelRaw);

  // точная UI-фраза
  if (UI_TO_TAG[l]) return UI_TO_TAG[l];
  for (const [k, tag] of Object.entries(UI_TO_TAG)) {
    if (l.includes(k)) return tag;
  }

  const hasAny = (arr) => arr.some((kw) => l.includes(norm(kw)));

  if (hasAny(MARKERS.done)) return 'done';
  if (hasAny(MARKERS.accepted)) return 'accepted';
  if (hasAny(MARKERS.in_progress)) return 'in_progress';
  if (hasAny(MARKERS.paid_pending)) return 'paid_pending';

  return null; // неизвестный лейбл
}

/* ===== получение и подготовка enum-лейблов из БД ===== */
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

/* Разворачиваем список лейблов в словарь {tag: [labels...]} */
function bucketizeLabels(enumLabels) {
  /** @type {Record<string, string[]>} */
  const buckets = { paid_pending: [], accepted: [], in_progress: [], done: [] };
  for (const lbl of enumLabels) {
    const tag = classifyEnumLabel(lbl);
    if (tag && buckets[tag]) buckets[tag].push(lbl);
  }
  return buckets;
}

/* Выбор лейбла для заданного тега:
   1) Если есть несколько, используем стабильную эвристику для читаемости.
   2) Если нет подходящих, НЕ меняем тег. Возвращаем null для корректного 400. */
function pickLabelForTag(buckets, tag) {
  const list = buckets[tag] || [];
  if (!list.length) return null;

  // эвристика выбора самого "типичного" текста
  const prefByTag = {
    paid_pending: [
      'оплачен/ожидание модерации', 'ожидает проверки', 'идет модерация', 'идёт модерация'
    ],
    accepted: [
      'заказ принят, приступаем к осмотру', 'заказ принят', 'приступаем к осмотру', 'подтвержден', 'подтверждено'
    ],
    in_progress: [
      'выполняется осмотр машины', 'выполняется осмотр', 'производится осмотр', 'идет осмотр', 'идёт осмотр'
    ],
    done: [
      'осмотр завершен', 'осмотр завершён', 'отчет готов', 'отчёт готов', 'завершен', 'завершён'
    ]
  };

  const listNorm = list.map((x) => ({ raw: x, n: norm(x) }));

  // сначала пытаемся найти предпочтительную формулировку
  for (const pref of prefByTag[tag]) {
    const p = norm(pref);
    const hit = listNorm.find((it) => it.n === p || it.n.includes(p));
    if (hit) return hit.raw;
  }

  // иначе берём самую длинную формулировку для большей конкретики
  list.sort((a, b) => b.length - a.length);
  return list[0];
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
   1) Берём входную строку, детектим канонический тег.
   2) Забираем enum-лейблы из БД и раскладываем по тегам.
   3) Выбираем ЛЕЙБЛ ровно для распознанного тега.
   4) Если для тега нет ни одного лейбла в БД — 400 с подсказкой. */
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

    // 0) если пользователь прислал точный enum-лейбл — используем как есть
    const rawNorm = norm(raw);
    const exact = enumLabels.find((l) => norm(l) === rawNorm);
    if (exact) {
      const r0 = await query(
        'UPDATE inspections SET status = $1::inspection_status, updated_at = now() WHERE id = $2 RETURNING *',
        [exact, id]
      );
      if (!r0.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json(r0.rows[0]);
    }

    // 1) распознаём канонический тег по входу
    const tag = detectTagFromText(raw);
    if (!tag) {
      // сформируем подсказку с доступными вариантами
      const buckets = bucketizeLabels(enumLabels);
      const allowed = TAGS.flatMap((t) => buckets[t]).filter(Boolean);
      return res.status(400).json({ error: 'BAD_STATUS', message: 'Не удалось распознать статус', allowed });
    }

    // 2) находим подходящий enum-лейбл РОВНО этого тега
    const buckets = bucketizeLabels(enumLabels);
    const target = pickLabelForTag(buckets, tag);

    if (!target) {
      // в БД нет лейбла для нужного тега — это конфигурационная ошибка enum'а
      const diag = {
        detected_tag: tag,
        available_by_tag: buckets
      };
      return res.status(400).json({
        error: 'ENUM_MISSING_FOR_TAG',
        message: `В enum inspection_status отсутствует лейбл для тега ${tag}`,
        details: diag
      });
    }

    // 3) обновляем
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
