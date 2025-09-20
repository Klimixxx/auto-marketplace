import Link from 'next/link';
import { useState } from 'react';
import InspectionModal from '../../components/InspectionModal';


const API = process.env.NEXT_PUBLIC_API_BASE;

function parseNumberValue(value) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fmtPrice(value, currency = 'RUB') {
  const numeric = parseNumberValue(value);
  if (numeric == null) {
    if (value == null || value === '') {
      return '—';
    }
    return String(value);
  }

  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

function normalizePhoto(photo) {
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

function collectPhotos(details) {
  if (!details || typeof details !== 'object') {
    return [];
  }
  const list = [];
  const seen = new Set();
  const sources = [
    details.photos,
    details.lot_details?.photos,
    details.lot_details?.images,
    details.lot_details?.gallery,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const photo of source) {
      const normalized = normalizePhoto(photo);
      if (normalized && normalized.url && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        list.push(normalized);
      }
    }
  }

  return list;
}

function formatValue(value) {
  if (value == null || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return '—';
    }
    const mapped = value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'number' || typeof item === 'boolean') return String(item);
        if (typeof item === 'object') {
          try {
            return JSON.stringify(item);
          } catch {
            return String(item);
          }
        }
        return String(item);
      })
      .filter(Boolean);
    return mapped.length ? mapped.join(', ') : '—';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function makeKeyValueEntries(source) {
  if (!source) {
    return [];
  }

  const entries = [];
  if (Array.isArray(source)) {
    source.forEach((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const label =
          item.label ||
          item.title ||
          item.name ||
          item.type ||
          item.key ||
          item.stage ||
          `#${index + 1}`;
        const value = 'value' in item ? item.value : item;
        entries.push({ key: label, value });
      } else {
        entries.push({ key: `#${index + 1}`, value: item });
      }
    });
  } else if (typeof source === 'object') {
    Object.entries(source).forEach(([key, value]) => {
      entries.push({ key, value });
    });
  } else {
    entries.push({ key: 'Значение', value: source });
  }

  return entries.map(({ key, value }, index) => ({
    key: key || `#${index + 1}`,
    value: formatValue(value),
  }));
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('ru-RU');
}

function hasData(value) {
  if (!value) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

const PRICE_HEADER_STYLE = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#9aa6b2',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const PRICE_CELL_STYLE = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
  fontSize: 13,
};

export async function getServerSideProps({ params }) {
  const r = await fetch(`${API}/api/listings/${params.id}`, { cache: 'no-store' });
  if (!r.ok) return { notFound: true };
  const item = await r.json();
  return { props: { item } };
}

function KeyValueGrid({ entries }) {
  if (!entries || !entries.length) {
    return null;
  }

  return (
    <div
      className="panel"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}
    >
      {entries.map(({ key, value }, index) => {
        const isMultiline = typeof value === 'string' && value.includes('\n');
        return (
          <div key={`${key}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              {key}
            </div>
            {isMultiline ? (
              <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</pre>
            ) : (
              <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeyValueList({ entries }) {
  if (!entries || !entries.length) {
    return null;
  }

  return (
    <div className="panel" style={{ display: 'grid', gap: 8 }}>
      {entries.map(({ key, value }, index) => {
        const isMultiline = typeof value === 'string' && value.includes('\n');
        return (
          <div
            key={`${key}-${index}`}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              {key}
            </div>
            {isMultiline ? (
              <pre
                style={{
                  margin: 0,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textAlign: 'right',
                }}
              >
                {value}
              </pre>
            ) : (
              <div style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ListingPage({ item }) {
  const details = item?.details && typeof item.details === 'object' ? item.details : {};
    const [openInspection, setOpenInspection] = useState(false);

  function handleOrderClick() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      const next = `/trades/${item?.id}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    setOpenInspection(true);
  }

  const photos = collectPhotos(details);
  const lotEntries = makeKeyValueEntries(details?.lot_details);
  const contactEntries = makeKeyValueEntries(details?.contact_details);
  const debtorEntries = makeKeyValueEntries(details?.debtor_details);
  const prices = Array.isArray(details?.prices) ? details.prices : [];
  const documents = Array.isArray(details?.documents) ? details.documents : [];
  const fedresursMeta = details?.fedresurs_meta;
  const currency = item?.currency || 'RUB';

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/trades" className="link">
          ← Назад к списку
        </Link>
      </div>

      <h1 style={{ marginBottom: 4 }}>{item?.title || 'Лот'}</h1>
      <div style={{ color: '#9aa6b2', marginBottom: 12 }}>
        {(item?.region || 'Регион не указан')} • {(item?.asset_type || 'тип имущества')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <div className="panel">
          <div className="muted">Стартовая цена</div>
          <div className="big">{fmtPrice(item?.start_price, currency)}</div>
        </div>
        <div className="panel">
          <div className="muted">Текущая цена</div>
          <div className="big">{fmtPrice(item?.current_price, currency)}</div>
        </div>
      </div>
<div style={{ marginTop: 12 }}>
  <button onClick={handleOrderClick} className="btn">Заказать осмотр</button>
</div>

<InspectionModal
  listingId={item?.id}
  isOpen={openInspection}
  onClose={() => setOpenInspection(false)}
/>



      {(item?.status || item?.end_date) && (
        <div style={{ marginTop: 8, color: '#9aa6b2' }}>
          Статус: {item?.status ?? '—'}
          {item?.end_date ? ` • Окончание: ${formatDate(item.end_date)}` : null}
        </div>
      )}

      {item?.source_url && (
        <div style={{ marginTop: 8 }}>
          <a href={item.source_url} target="_blank" rel="noreferrer" className="link">
            Перейти к источнику
          </a>
        </div>
      )}

      {photos.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Фотографии</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {photos.map((photo, index) => (
              <div key={photo.url || index} className="panel" style={{ padding: 8 }}>
                <img
                  src={photo.url}
                  alt={photo.title || `Фото ${index + 1}`}
                  style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8 }}
                />
                <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-word' }}>
                  {photo.title || photo.url}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(item?.description || details?.lot_details?.description) && (
        <section style={{ marginTop: 24 }}>
          <h2>Описание</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{item?.description || details?.lot_details?.description}</div>
        </section>
      )}

      {lotEntries.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Характеристики</h2>
          <KeyValueGrid entries={lotEntries} />
        </section>
      )}

      {contactEntries.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Контакты</h2>
          <KeyValueList entries={contactEntries} />
        </section>
      )}

      {debtorEntries.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Данные должника</h2>
          <KeyValueList entries={debtorEntries} />
        </section>
      )}

      {prices.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>История цен</h2>
          <div className="panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={PRICE_HEADER_STYLE}>Этап</th>
                  <th style={PRICE_HEADER_STYLE}>Цена</th>
                  <th style={PRICE_HEADER_STYLE}>Дата</th>
                  <th style={PRICE_HEADER_STYLE}>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((entry, index) => {
                  const label =
                    entry.stage ||
                    entry.stage_name ||
                    entry.stageName ||
                    entry.round ||
                    entry.type ||
                    entry.name ||
                    entry.title ||
                    `Запись ${index + 1}`;
                  const numericPrice = parseNumberValue(
                    entry.price ??
                      entry.currentPrice ??
                      entry.current_price ??
                      entry.startPrice ??
                      entry.start_price ??
                      entry.value ??
                      entry.amount,
                  );
                  const priceText =
                    numericPrice != null
                      ? fmtPrice(numericPrice, currency)
                      : formatValue(
                          entry.price ??
                            entry.currentPrice ??
                            entry.current_price ??
                            entry.startPrice ??
                            entry.start_price ??
                            entry.value ??
                            entry.amount ??
                            '—',
                        );
                  const dateValue =
                    entry.date ||
                    entry.date_start ||
                    entry.dateStart ||
                    entry.date_finish ||
                    entry.dateFinish ||
                    entry.updated_at ||
                    entry.updatedAt;
                  const comment =
                    entry.comment ||
                    entry.description ||
                    entry.info ||
                    entry.status ||
                    entry.note ||
                    entry.result ||
                    null;

                  return (
                    <tr key={entry.id || `${label}-${index}`}>
                      <td style={PRICE_CELL_STYLE}>{label}</td>
                      <td style={PRICE_CELL_STYLE}>{priceText}</td>
                      <td style={PRICE_CELL_STYLE}>{dateValue ? formatDateTime(dateValue) : '—'}</td>
                      <td style={PRICE_CELL_STYLE}>
                        {comment ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{formatValue(comment)}</span>
                        ) : (
                          '—'
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

      {documents.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Документы</h2>
          <div className="panel" style={{ display: 'grid', gap: 8 }}>
            {documents.map((doc, index) => {
              const url = doc?.url || doc?.href || doc?.link || doc?.download_url || null;
              const title = doc?.title || doc?.name || doc?.filename || `Документ ${index + 1}`;
              const description = doc?.description || doc?.comment || doc?.note || null;
              const date = doc?.date || doc?.created_at || doc?.updated_at || null;

              return (
                <div key={url || `${title}-${index}`}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="link">
                      {title}
                    </a>
                  ) : (
                    <div>{title}</div>
                  )}
                  {date ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      Дата: {formatDate(date)}
                    </div>
                  ) : null}
                  {description ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasData(fedresursMeta) && (
        <section style={{ marginTop: 24 }}>
          <h2>Дополнительные данные</h2>
          <div className="panel" style={{ padding: 12, overflowX: 'auto' }}>
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(fedresursMeta, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
