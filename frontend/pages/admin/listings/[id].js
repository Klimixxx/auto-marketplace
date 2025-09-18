// pages/admin/listings/[id].js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(value, currency = 'RUB') {
  try {
    if (value == null || value === '') return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

function fromInputDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

function formatObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify({}, null, 2);
}

function formatArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizePhotoInput(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed ? { url: trimmed } : null;
  }
  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
    if (!url) return null;
    const title = photo.title || photo.name || photo.caption || null;
    return title ? { url, title } : { url };
  }
  return null;
}

function extractPhotos(trade) {
  if (!trade) return [];
  const sources = [
    trade.photos,
    trade.lot_details?.photos,
    trade.lot_details?.images,
    trade.lot_details?.gallery,
  ];
  const urls = [];
  const seen = new Set();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const normalized = normalizePhotoInput(entry);
      if (normalized?.url && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        urls.push(normalized.url);
      }
    }
  }
  return urls;
}

function parsePhotosInput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Некорректный JSON фотографий.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('JSON фотографий должен быть массивом.');
    }
    const result = [];
    for (const entry of parsed) {
      const normalized = normalizePhotoInput(entry);
      if (normalized) result.push(normalized);
    }
    return result;
  }
  return trimmed
    .split('\n')
    .map((line) => normalizePhotoInput(line))
    .filter(Boolean);
}

function getPhotoPreview(text) {
  try {
    return parsePhotosInput(text).map((photo) => photo.url);
  } catch {
    return [];
  }
}

const PRICE_TABLE_HEADER_STYLE = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#9aa6b2',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const PRICE_TABLE_CELL_STYLE = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
  fontSize: 13,
};

// ── UI pieces ─────────────────────────────────────────────────────────────────
function ContactSection({ contact }) {
  if (!contact || typeof contact !== 'object') return null;

  const {
    organizer_name: organizerName,
    organizer_inn: organizerInn,
    phone,
    email,
    address,
    inspection_procedure: inspectionProcedure,
  } = contact || {};

  if (!organizerName && !organizerInn && !phone && !email && !address && !inspectionProcedure) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Контакты</h2>
      <div className="panel" style={{ display: 'grid', gap: 6 }}>
        {organizerName ? (
          <div>
            <span className="muted">Организатор: </span>
            {organizerName}
          </div>
        ) : null}
        {organizerInn ? (
          <div>
            <span className="muted">ИНН: </span>
            {organizerInn}
          </div>
        ) : null}
        {phone ? (
          <div>
            <span className="muted">Телефон: </span>
            {phone}
          </div>
        ) : null}
        {email ? (
          <div>
            <span className="muted">Email: </span>
            <a className="link" href={`mailto:${email}`}>
              {email}
            </a>
          </div>
        ) : null}
        {address ? (
          <div>
            <span className="muted">Адрес: </span>
            {address}
          </div>
        ) : null}
        {inspectionProcedure ? (
          <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
            Осмотр: {inspectionProcedure}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function KeyValueList({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data);
  if (!entries.length) return null;

  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
      {entries.map(([key, value]) => {
        const text =
          value && typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value ?? '—');
        const isMultiline = text.includes('\n');
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div className="muted">{key}</div>
            {isMultiline ? (
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  textAlign: 'right',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </pre>
            ) : (
              <div style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function AdminParserTradeCard() {
  const router = useRouter();
  const { id } = router.query;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(null);
  const [lotDetailsText, setLotDetailsText] = useState('{}');
  const [contactDetailsText, setContactDetailsText] = useState('{}');
  const [debtorDetailsText, setDebtorDetailsText] = useState('{}');
  const [pricesText, setPricesText] = useState('[]');
  const [documentsText, setDocumentsText] = useState('[]');
  const [photosText, setPhotosText] = useState('');

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const applyTrade = useCallback((trade) => {
    if (!trade) return;
    setItem(trade);

    setForm({
      title: trade.title || '',
      description: trade.description || trade.lot_details?.description || '',
      category: trade.category || '',
      region: trade.region || '',
      brand: trade.brand || '',
      model: trade.model || '',
      year: trade.year || '',
      vin: trade.vin || trade.lot_details?.vin || '',
      start_price: trade.start_price ?? trade.lot_details?.start_price ?? '',
      applications_count: trade.applications_count ?? 0,
      date_start: toInputDate(trade.date_start || trade.dateStart),
      date_finish: toInputDate(trade.date_finish || trade.dateFinish),
      trade_place: trade.trade_place || trade.tradePlace || '',
      source_url: trade.source_url || trade.url || trade.source || '',
    });

    setLotDetailsText(formatObject(trade.lot_details));
    setContactDetailsText(formatObject(trade.contact_details));
    setDebtorDetailsText(formatObject(trade.debtor_details));
    setPricesText(formatArray(trade.prices));
    setDocumentsText(formatArray(trade.documents));

    const photos = extractPhotos(trade);
    if (photos.length) {
      setPhotosText(photos.join('\n'));
    } else if (Array.isArray(trade.photos)) {
      setPhotosText(JSON.stringify(trade.photos, null, 2));
    } else {
      setPhotosText('');
    }
  }, []);

  // fetch trade
  useEffect(() => {
    if (!id) return;
    let aborted = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const url = API_BASE ? `${API_BASE}/admin/listings/${id}` : `/api/admin/listings/${id}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!aborted) applyTrade(data);
      } catch (e) {
        if (!aborted) setError(`Ошибка загрузки: ${e.message}`);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [id, applyTrade]);

  const updateFormField = useCallback(
    (key) => (e) => {
      const value = e?.target?.value ?? e;
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetChanges = useCallback(() => {
    if (item) applyTrade(item);
  }, [item, applyTrade]);

  const descriptionPreview = useMemo(() => (form?.description || '').trim(), [form?.description]);

  const d = useMemo(() => {
    // parsed blocks for preview sections
    let lot = {};
    let contact = {};
    let debtor = {};
    let prices = [];
    let documents = [];
    let photos = [];

    try { lot = JSON.parse(lotDetailsText || '{}') } catch {}
    try { contact = JSON.parse(contactDetailsText || '{}') } catch {}
    try { debtor = JSON.parse(debtorDetailsText || '{}') } catch {}
    try { prices = JSON.parse(pricesText || '[]') } catch {}
    try { documents = JSON.parse(documentsText || '[]') } catch {}
    try { photos = parsePhotosInput(photosText || '') } catch {}

    const merged = {
      ...(item || {}),
      ...form,
      lot_details: lot,
      contact_details: contact,
      debtor_details: debtor,
      prices,
      documents,
      photos,
    };

    // keep original payload for debug if present
    if (item?.raw_payload) merged.raw_payload = item.raw_payload;

    return merged;
  }, [
    item,
    form,
    lotDetailsText,
    contactDetailsText,
    debtorDetailsText,
    pricesText,
    documentsText,
    photosText,
  ]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      // build payload
      const payload = {
        ...d,
        title: trimOrNull(form.title),
        description: trimOrNull(form.description),
        category: trimOrNull(form.category),
        region: trimOrNull(form.region),
        brand: trimOrNull(form.brand),
        model: trimOrNull(form.model),
        year: trimOrNull(form.year),
        vin: trimOrNull(form.vin),
        start_price:
          form.start_price === '' || form.start_price == null
            ? null
            : Number(String(form.start_price).replace(/\s/g, '').replace(',', '.')),
        applications_count:
          form.applications_count === '' || form.applications_count == null
            ? 0
            : Number(form.applications_count),
        date_start: fromInputDate(form.date_start),
        date_finish: fromInputDate(form.date_finish),
        trade_place: trimOrNull(form.trade_place),
        source_url: trimOrNull(form.source_url),

        lot_details: JSON.parse(lotDetailsText || '{}'),
        contact_details: JSON.parse(contactDetailsText || '{}'),
        debtor_details: JSON.parse(debtorDetailsText || '{}'),
        prices: JSON.parse(pricesText || '[]'),
        documents: JSON.parse(documentsText || '[]'),
        photos: parsePhotosInput(photosText || ''),
      };

      const url = API_BASE ? `${API_BASE}/admin/listings/${id}` : `/api/admin/listings/${id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      applyTrade(saved);
    } catch (e) {
      setError(`Ошибка сохранения: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function publishTrade() {
    if (!id) return;
    setPublishing(true);
    setError(null);
    try {
      const url = API_BASE ? `${API_BASE}/admin/listings/${id}/publish` : `/api/admin/listings/${id}/publish`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // no-op: backend handles status
    } catch (e) {
      setError(`Ошибка публикации: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="muted">Загрузка…</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container">
        <div className="muted">Объект не найден.</div>
        <div style={{ marginTop: 12 }}>
          <Link href="/admin/listings" className="link">← Назад к списку</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/admin/listings" className="link">← Список</Link>
        <h1 style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}>
          Редактирование лота <span className="muted">#{id}</span>
        </h1>
      </div>

      {error ? <div className="panel" style={{ color: '#ff6b6b' }}>{error}</div> : null}

      <form onSubmit={onSubmit} className="panel" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Заголовок</span>
          <input className="input" value={form.title} onChange={updateFormField('title')} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Категория</span>
            <input className="input" value={form.category} onChange={updateFormField('category')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Регион</span>
            <input className="input" value={form.region} onChange={updateFormField('region')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Марка</span>
            <input className="input" value={form.brand} onChange={updateFormField('brand')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Модель</span>
            <input className="input" value={form.model} onChange={updateFormField('model')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Год</span>
            <input className="input" value={form.year} onChange={updateFormField('year')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">VIN</span>
            <input className="input" value={form.vin} onChange={updateFormField('vin')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Стартовая цена</span>
            <input
              className="input"
              value={form.start_price}
              onChange={updateFormField('start_price')}
              placeholder="Например, 1500000"
              inputMode="numeric"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Кол-во заявок</span>
            <input
              className="input"
              value={form.applications_count}
              onChange={updateFormField('applications_count')}
              type="number"
              min="0"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Дата начала</span>
            <input
              className="input"
              value={form.date_start}
              onChange={updateFormField('date_start')}
              type="datetime-local"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Дата окончания</span>
            <input
              className="input"
              value={form.date_finish}
              onChange={updateFormField('date_finish')}
              type="datetime-local"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Площадка</span>
            <input className="input" value={form.trade_place} onChange={updateFormField('trade_place')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Ссылка на источник</span>
            <input className="input" value={form.source_url} onChange={updateFormField('source_url')} type="url" />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Описание</span>
          <textarea
            className="textarea"
            rows={4}
            value={form.description}
            onChange={updateFormField('description')}
            placeholder="Текст описания для публикации"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Фотографии (каждый URL с новой строки или JSON-массив)</span>
          <textarea
            className="textarea"
            rows={4}
            value={photosText}
            onChange={(e) => setPhotosText(e.target.value)}
            placeholder='["https://.../1.jpg","https://.../2.jpg"] или по строке на URL'
          />
        </label>

        {getPhotoPreview(photosText).length > 0 && (
          <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {getPhotoPreview(photosText).map((url, i) => (
              <div key={url || i} className="panel" style={{ padding: 8 }}>
                <img src={url} alt={`Фото ${i + 1}`} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }} />
                <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-word' }}>{url}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">lot_details (JSON)</span>
            <textarea className="textarea" rows={8} value={lotDetailsText} onChange={(e) => setLotDetailsText(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">contact_details (JSON)</span>
            <textarea className="textarea" rows={8} value={contactDetailsText} onChange={(e) => setContactDetailsText(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">debtor_details (JSON)</span>
            <textarea className="textarea" rows={8} value={debtorDetailsText} onChange={(e) => setDebtorDetailsText(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">prices (JSON-массив)</span>
            <textarea className="textarea" rows={6} value={pricesText} onChange={(e) => setPricesText(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">documents (JSON-массив)</span>
            <textarea className="textarea" rows={6} value={documentsText} onChange={(e) => setDocumentsText(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="submit" className="button primary" disabled={saving || publishing}>
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
          <button type="button" className="button outline" onClick={resetChanges} disabled={saving || publishing}>
            Сбросить изменения
          </button>
          <button type="button" className="button" onClick={publishTrade} disabled={saving || publishing}>
            {publishing ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>
      </form>

      {descriptionPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>Описание</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{descriptionPreview}</div>
        </section>
      )}

      {d.lot_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Характеристики</h2>
          <KeyValueList data={d.lot_details} />
        </section>
      )}

      <ContactSection contact={d.contact_details} />

      {d.debtor_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Данные должника</h2>
          <KeyValueList data={d.debtor_details} />
        </section>
      )}

      {Array.isArray(d.photos) && d.photos.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Фотографии (сохранённые)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {d.photos.map((photo, index) => {
              const normalized = normalizePhotoInput(photo);
              if (!normalized) return null;
              return (
                <div key={normalized.url || index} className="panel" style={{ padding: 8 }}>
                  <img
                    src={normalized.url}
                    alt={normalized.title || `Фото ${index + 1}`}
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }}
                  />
                  <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-word' }}>
                    {normalized.title || normalized.url}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Array.isArray(d.prices) && d.prices.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>История цен</h2>
          <div className="panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={PRICE_TABLE_HEADER_STYLE}>Этап</th>
                  <th style={PRICE_TABLE_HEADER_STYLE}>Цена</th>
                  <th style={PRICE_TABLE_HEADER_STYLE}>Дата</th>
                  <th style={PRICE_TABLE_HEADER_STYLE}>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {d.prices.map((entry, index) => {
                  const stage =
                    entry.stage ||
                    entry.stage_name ||
                    entry.stageName ||
                    entry.round ||
                    entry.type ||
                    entry.name ||
                    entry.title ||
                    `Запись ${index + 1}`;
                  const rawPrice =
                    entry.price ||
                    entry.currentPrice ||
                    entry.current_price ||
                    entry.startPrice ||
                    entry.start_price ||
                    entry.value ||
                    entry.amount ||
                    null;
                  const numericPrice =
                    rawPrice != null ? Number(String(rawPrice).replace(/\s/g, '').replace(',', '.')) : null;
                  const priceText =
                    Number.isFinite(numericPrice)
                      ? fmtPrice(numericPrice)
                      : rawPrice != null
                      ? String(rawPrice)
                      : '—';
                  const dateValue =
                    entry.date ||
                    entry.date_start ||
                    entry.dateStart ||
                    entry.date_finish ||
                    entry.dateFinish ||
                    entry.updated_at ||
                    entry.updatedAt ||
                    null;
                  const comment =
                    entry.comment ||
                    entry.description ||
                    entry.note ||
                    entry.status ||
                    entry.info ||
                    null;
                  const commentText =
                    comment && typeof comment === 'object'
                      ? JSON.stringify(comment, null, 2)
                      : comment
                      ? String(comment)
                      : '—';
                  const commentMultiline = commentText.includes('\n');
                  return (
                    <tr key={entry.id || `${stage}-${index}`}>
                      <td style={PRICE_TABLE_CELL_STYLE}>{stage}</td>
                      <td style={PRICE_TABLE_CELL_STYLE}>{priceText}</td>
                      <td style={PRICE_TABLE_CELL_STYLE}>{dateValue ? formatDateTime(dateValue) : '—'}</td>
                      <td style={PRICE_TABLE_CELL_STYLE}>
                        {commentMultiline ? (
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{commentText}</pre>
                        ) : (
                          commentText
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {Array.isArray(d.documents) && d.documents.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Документы</h2>
          <div className="panel" style={{ display: 'grid', gap: 8 }}>
            {d.documents.map((doc, index) => {
              const url = doc?.url || doc?.href || doc?.link || doc?.download_url || null;
              const title = doc?.title || doc?.name || doc?.filename || `Документ ${index + 1}`;
              const description = doc?.description || doc?.comment || doc?.note || null;
              const date = doc?.date || doc?.created_at || doc?.updated_at || null;
              return (
                <div key={url || `${title}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="link">
                      {title}
                    </a>
                  ) : (
                    <div>{title}</div>
                  )}
                  {date ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      Дата: {formatDateTime(date)}
                    </div>
                  ) : null}
                  {description ? (
                    <div className="muted" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{description}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.raw_payload && (
        <section style={{ marginTop: 24 }}>
          <h2>Исходные данные парсера</h2>
          <div className="panel" style={{ padding: 12, overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(d.raw_payload, null, 2)}
            </pre>
          </div>
        </section>
      )}

      {d.raw_payload?.fedresurs_data && !d.fedresurs_meta && (
        <section style={{ marginTop: 24 }}>
          <h2>Данные Федресурса</h2>
          <div className="panel" style={{ padding: 12, overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(d.raw_payload.fedresurs_data, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
