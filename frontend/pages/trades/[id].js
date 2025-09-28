import Link from 'next/link';
import { useEffect, useState } from 'react';
import InspectionModal from '../../components/InspectionModal';
import {
  formatValueForDisplay,
  translateFieldKey,
  translateValueByKey,
} from '../../lib/lotFormatting';
import { formatTradeTypeLabel } from '../../lib/tradeTypes';
import computeTradeTiming from '../../lib/tradeTiming';

const API = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || '';

function parseNumberValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fmtPrice(value, currency = 'RUB') {
  const numeric = parseNumberValue(value);
  if (numeric == null) return value == null || value === '' ? '—' : String(value);
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toLocaleString('ru-RU');
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function normalizePhoto(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    return { url: photo, title: '' };
  }
  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.src || null;
    if (!url) return null;
    return { url, title: photo.title || photo.name || photo.alt || '' };
  }
  return null;
}

function collectPhotos(details) {
  const pools = [
    details?.photos,
    details?.images,
    details?.lot_details?.photos,
    details?.lot_details?.images,
    details?.gallery,
  ].filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const pool of pools) {
    const arr = Array.isArray(pool) ? pool : [pool];
    for (const raw of arr) {
      const ph = normalizePhoto(raw);
      if (ph && ph.url && !seen.has(ph.url)) {
        seen.add(ph.url);
        out.push(ph);
      }
    }
  }
  return out;
}

function buildKeyValueEntries(source) {
  if (!source || typeof source !== 'object') return [];
  const result = [];
  const seen = new Set();

  Object.entries(source).forEach(([key, value]) => {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return;
    const displayValue = formatValueForDisplay(key, value);
    if (!displayValue || displayValue === '—') return;
    const label = translateFieldKey(key);
    const dedupeKey = `${label}:${displayValue}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push({
      key: label,
      value: displayValue,
      rawKey: key,
      rawValue: value,
    });
  });

  return result;
}

function formatTradeType(value) {
  const mapped = formatTradeTypeLabel(value);
  if (mapped) return mapped;
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'tender' || normalized === 'torgi') return 'Торги';
  return translateFieldKey(value);
}

const DOCUMENT_TYPE_LABELS = {
  protocol: 'Протокол',
  report: 'Отчёт',
  contract: 'Договор',
  notice: 'Уведомление',
  statement: 'Заявление',
  application: 'Заявка',
  decision: 'Решение',
  order: 'Приказ',
  passport: 'Паспорт',
  conclusion: 'Заключение',
  regulation: 'Положение',
  instruction: 'Инструкция',
  agreement: 'Соглашение',
  act: 'Акт',
};

function translateDocumentType(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/[а-яё]/i.test(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (DOCUMENT_TYPE_LABELS[normalized]) return DOCUMENT_TYPE_LABELS[normalized];
  return translateFieldKey(raw);
}

function normalizeDocuments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((doc, index) => {
      if (!doc || typeof doc !== 'object') return null;
      const url = doc.url || doc.href || doc.link || doc.download_url || doc.file || null;
      const title = doc.title || doc.name || doc.filename || doc.label || `Документ ${index + 1}`;
      const typeRaw = doc.document_type || doc.type || doc.kind || null;
      const type = translateDocumentType(typeRaw);
      const description = doc.description || doc.comment || doc.note || '';
      const date = doc.date || doc.created_at || doc.updated_at || doc.uploaded_at || null;
      return {
        id: url || `${title}-${index}`,
        title,
        type,
        rawType: typeRaw,
        description,
        date,
        url,
      };
    })
    .filter(Boolean);
}

function renderContactValue(entry) {
  const raw = entry?.rawValue;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return entry.value;
    if (/^https?:\/\//i.test(trimmed)) {
      return (
        <a href={trimmed} target="_blank" rel="noreferrer">
          {trimmed}
        </a>
      );
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return <a href={`mailto:${trimmed}`}>{trimmed}</a>;
    }
    const digits = trimmed.replace(/[^\d+]/g, '');
    const digitCount = digits.replace(/\D/g, '').length;
    if (digitCount >= 10) {
      const normalized = digits.startsWith('+') ? digits : `+${digits.replace(/^8/, '7')}`;
      return <a href={`tel:${normalized}`}>{entry.value}</a>;
    }
  }
  return entry.value;
}
  

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU');
}

function hasData(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

const PRICE_HEADER_STYLE = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#9aa6b2',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const PRICE_CELL_STYLE = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
  fontSize: 13,
  color: '#e8edf2',
};

function resolveApiBase(req) {
  if (API) return API.replace(/\/$/, '');
  const headers = req?.headers || {};
  const proto = headers['x-forwarded-proto'] || (req?.socket?.encrypted ? 'https' : 'http');
  const host = headers['x-forwarded-host'] || headers.host;
  return host ? `${proto}://${host}` : '';
}

export async function getServerSideProps(context) {
  const { params, req } = context;
  const base = resolveApiBase(req);
  if (!base) return { notFound: true };

  const url = `${base}/api/listings/${params.id}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 404) return { notFound: true };
    if (!response.ok) return { notFound: true };
    const item = await response.json();
    return { props: { item } };
  } catch {
    return { notFound: true };
  }
}

function KeyValueGrid({ entries }) {
  if (!entries || !entries.length) return null;
  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
      {entries.map((entry, index) => {
        const { key, value } = entry;
        const isMultiline = typeof value === 'string' && value.includes('\n');
        return (
          <div key={`${key}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="muted" style={{ fontSize: 12 }}>{key}</div>
            {isMultiline
              ? <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</pre>
              : <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>}
          </div>
        );
      })}
    </div>
  );
}

function KeyValueList({ entries, renderValue, valueClassName, valueStyle }) {
  if (!entries || !entries.length) return null;
  const baseStyle = { fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', ...(valueStyle || {}) };
  return (
    <div className="panel" style={{ display: 'grid', gap: 8 }}>
      {entries.map((entry, index) => {
        const { key, value } = entry;
        const content = renderValue ? renderValue(entry) : value;
        const resolvedClassName = typeof valueClassName === 'function' ? valueClassName(entry) : valueClassName;
        const isMultiline = typeof content === 'string' && content.includes('\n');
        return (
          <div key={`${key}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div className="muted" style={{ fontSize: 12 }}>{key}</div>
            {isMultiline ? (
              <pre
                className={resolvedClassName}
                style={{ ...baseStyle, margin: 0, whiteSpace: 'pre-wrap' }}
              >
                {content}
              </pre>
            ) : (
              <div className={resolvedClassName} style={baseStyle}>
                {content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function pickLotValue(source, keys = []) {
  if (!source || typeof source !== 'object' || !keys.length) return null;
  for (const key of keys) {
    if (key in source) {
      const value = source[key];
      if (value != null && value !== '') return value;
    }
  }
  return null;
}


export default function ListingPage({ item }) {
  const details = item?.details && typeof item.details === 'object' ? item.details : {};
  const listingIdentifier =
    item?.id ?? item?.source_id ?? item?.listing_id ?? item?._id ?? null;
  const listingIdRaw = listingIdentifier != null ? String(listingIdentifier).trim() : '';
  const timing = computeTradeTiming(item || {});
  const statusInfo = timing?.status || null;
  const periods = Array.isArray(timing?.periods) ? timing.periods : [];
  const currentPeriodIndex = timing?.currentPeriodIndex;
  const currentPeriod = timing?.currentPeriod || (typeof currentPeriodIndex === 'number' ? periods[currentPeriodIndex] : null);
  const currentStageLabel = (typeof currentPeriodIndex === 'number' && timing?.periodsCount)
    ? `${currentPeriodIndex + 1} из ${timing.periodsCount}`
    : null;
  const stageEndDate = timing?.currentPeriod?.end || null;
  const stageEndLabel = stageEndDate ? formatDateTime(stageEndDate) : null;
  const applicationDeadlineDate = timing?.applicationDeadline || null;
  const applicationDeadlineLabel = applicationDeadlineDate
    && (!stageEndDate || applicationDeadlineDate.getTime() !== stageEndDate.getTime())
      ? formatDateTime(applicationDeadlineDate)
      : null;
  const finishDate = timing?.finishDate || null;
  const finishLabel = finishDate
    && (!applicationDeadlineDate || finishDate.getTime() !== applicationDeadlineDate.getTime())
      ? formatDateTime(finishDate)
      : (item?.end_date ? formatDateTime(item.end_date) : null);
  const fallbackStatusLabel = item?.status
    ? translateValueByKey('status', item.status) || translateFieldKey(item.status)
    : null;
  const statusDisplay = statusInfo || (fallbackStatusLabel ? { label: fallbackStatusLabel, color: '#64748b' } : null);
  const summaryStartPrice = item?.start_price
    ?? periods[0]?.priceNumber
    ?? periods[0]?.minPriceNumber
    ?? null;
  const summaryCurrentPrice = timing?.currentPriceNumber != null
    ? timing.currentPriceNumber
    : (item?.current_price
      ?? currentPeriod?.priceNumber
      ?? currentPeriod?.minPriceNumber
      ?? item?.start_price
      ?? null);

  const [openInspection, setOpenInspection] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  function handleOrderClick() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      const next = `/trades/${listingIdRaw || ''}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    setOpenInspection(true);
  }

  const photos = collectPhotos(details);
  useEffect(() => {
    setActivePhotoIndex(0);
  }, [item?.id, photos.length]);
  const activePhoto = photos[activePhotoIndex] || photos[0] || null;

  const lotEntries = buildKeyValueEntries(details?.lot_details);
  const contactEntries = buildKeyValueEntries(details?.contact_details);
  const debtorEntries = buildKeyValueEntries(details?.debtor_details);
  const prices = Array.isArray(details?.prices) ? details.prices : [];
  const documents = normalizeDocuments(Array.isArray(details?.documents) ? details.documents : []);
  const periodScheduleEntries = periods;
  const periodScheduleDeadline = applicationDeadlineDate;
  const fedresursMeta = details?.fedresurs_meta;
  const currency = item?.currency || 'RUB';

  const lotDetails = details?.lot_details && typeof details.lot_details === 'object' ? details.lot_details : {};
  const heroChips = [];
  const heroChipSet = new Set();
  const addChip = (value) => {
    if (!value && value !== 0) return;
    const text = String(value).trim();
    if (!text || heroChipSet.has(text)) return;
    heroChipSet.add(text);
    heroChips.push(text);
  };
  const assetTypeLabel = item?.asset_type
    ? translateValueByKey('asset_type', item.asset_type) || translateFieldKey(item.asset_type)
    : null;
  if (assetTypeLabel) addChip(assetTypeLabel);
  if (item?.lot_number) addChip(`Лот № ${item.lot_number}`);
  const yearValue = lotDetails?.year || lotDetails?.production_year || lotDetails?.manufacture_year || item?.year;
  if (yearValue) addChip(`Год выпуска ${yearValue}`);
  const mileageValue = lotDetails?.mileage || lotDetails?.probeg || lotDetails?.run || item?.mileage;
  if (mileageValue) {
    const numericMileage = parseNumberValue(mileageValue);
    const formattedMileage = numericMileage != null
      ? `${new Intl.NumberFormat('ru-RU').format(Math.round(numericMileage))} км`
      : formatValueForDisplay('mileage', mileageValue);
    addChip(`Пробег ${formattedMileage}`);
  }
  const vinValue = lotDetails?.vin || lotDetails?.VIN || item?.vin;
  if (vinValue) addChip(`VIN ${vinValue}`);

  const locationLabel = [item?.city, item?.region].filter(Boolean).join(', ');
  const tradeTypeLabel = item?.trade_type_label
    || formatTradeType(item?.trade_type_resolved ?? item?.trade_type);

  return (
    <div className="container detail-page">
      <div className="back-link">
        <Link href="/trades" className="link">← Назад к списку</Link>
      </div>

      <div className="detail-hero">
        <div className="detail-hero__gallery">
          <div className="detail-hero__main-photo">
            {activePhoto ? (
              <img src={activePhoto.url} alt={activePhoto.title || item?.title || 'Фотография лота'} />
            ) : (
              <div className="detail-hero__placeholder">Фотографии появятся позже</div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="detail-hero__thumbs">
              {photos.slice(0, 8).map((photo, index) => (
                <button
                  key={photo.url || `${index}-${photo.title || ''}`}
                  type="button"
                  className={index === activePhotoIndex ? 'is-active' : undefined}
                  onClick={() => setActivePhotoIndex(index)}
                  onMouseEnter={() => setActivePhotoIndex(index)}
                  aria-label={`Фотография ${index + 1}`}
                >
                  <img src={photo.url} alt={photo.title || `Фото ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-hero__info">
          {tradeTypeLabel ? <div className="detail-hero__badge">{tradeTypeLabel}</div> : null}
          <h1 className="detail-hero__title">{item?.title || 'Лот'}</h1>
          {locationLabel ? <div className="detail-hero__location">{locationLabel}</div> : null}
          {heroChips.length ? (
            <div className="detail-hero__meta">
              {heroChips.slice(0, 6).map((chip, index) => (
                <span key={`${chip}-${index}`} className="chip">{chip}</span>
              ))}
            </div>
          ) : null}
        

        <div className="detail-summary-card detail-summary-card--inline">
            <div className="detail-summary__prices">
              <div className="detail-summary__price">
                <div className="detail-summary__price-label">Стартовая цена</div>
                <div className="detail-summary__price-value">{fmtPrice(summaryStartPrice, currency)}</div>
              </div>
              <div className="detail-summary__price">
                <div className="detail-summary__price-label">Текущая цена</div>
                <div className="detail-summary__price-value">{fmtPrice(summaryCurrentPrice, currency)}</div>
              </div>
            </div>

          {(statusDisplay || currentStageLabel || stageEndLabel || applicationDeadlineLabel || finishLabel) && (
              <div className="detail-summary__status">
                {statusDisplay ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {statusDisplay.color ? (
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: statusDisplay.color, display: 'inline-block' }} />
                    ) : null}
                    <div><strong>Статус:</strong> {statusDisplay.label}</div>
                  </div>
                ) : null}
                {currentStageLabel ? <div><strong>Текущий этап:</strong> {currentStageLabel}</div> : null}
                {stageEndLabel ? <div><strong>Окончание этапа:</strong> {stageEndLabel}</div> : null}
                {applicationDeadlineLabel ? <div><strong>Приём заявок до:</strong> {applicationDeadlineLabel}</div> : null}
                {!stageEndLabel && !applicationDeadlineLabel && finishLabel ? (
                  <div><strong>Дата окончания:</strong> {finishLabel}</div>
                ) : null}
                {finishLabel && (stageEndLabel || applicationDeadlineLabel) && finishLabel !== stageEndLabel && finishLabel !== applicationDeadlineLabel ? (
                  <div><strong>Завершение торгов:</strong> {finishLabel}</div>
                ) : null}
              </div>
            )}

          <div className="detail-summary__actions">
              <button onClick={handleOrderClick} className="button">Заказать осмотр</button>
              {item?.source_url ? (
                <a href={item.source_url} target="_blank" rel="noreferrer" className="button button-outline">
                  Перейти к источнику
                </a>
              ) : null}
            </div>

          <div className="muted" style={{ fontSize: 13 }}>
              ID объявления: {listingIdRaw || '—'}
            </div>
          </div>
        </div>
      </div>

      <InspectionModal
        listingId={listingIdRaw}
        isOpen={openInspection}
        onClose={() => setOpenInspection(false)}
      />

      <div className="detail-layout">
        <div className="detail-main">
          {(item?.description || details?.lot_details?.description) && (
            <section className="detail-section">
              <h2>Описание</h2>
              <div className="panel" style={{ whiteSpace: 'pre-wrap' }}>
                {item?.description || details?.lot_details?.description}
              </div>
            </section>
          )}

          {lotEntries.length > 0 && (
            <section className="detail-section">
              <h2>Характеристики</h2>
              <KeyValueGrid entries={lotEntries} />
            </section>
          )}

          {periodScheduleEntries.length > 0 && (
            <section className="detail-section">
              <h2>График снижения цены</h2>
              <div className="panel table-scroll" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...PRICE_HEADER_STYLE, width: 60 }}>№</th>
                      <th style={PRICE_HEADER_STYLE}>Дата начала</th>
                      <th style={PRICE_HEADER_STYLE}>Дата окончания</th>
                      <th style={PRICE_HEADER_STYLE}>Цена, руб.</th>
                      <th style={PRICE_HEADER_STYLE}>Задаток, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodScheduleEntries.map((entry, index) => {
                      const isActive = typeof currentPeriodIndex === 'number' && currentPeriodIndex === index;
                      const startText = entry.start ? formatDateTime(entry.start) : '—';
                      const endText = entry.end ? formatDateTime(entry.end) : '—';
                      const priceNumeric = entry.priceNumber != null ? entry.priceNumber : entry.minPriceNumber;
                      const priceText = priceNumeric != null
                        ? fmtPrice(priceNumeric, currency)
                        : (entry.priceRaw != null ? formatValueForDisplay('price', entry.priceRaw) : '—');
                      const depositText = entry.depositNumber != null
                        ? fmtPrice(entry.depositNumber, currency)
                        : (entry.depositRaw != null ? formatValueForDisplay('deposit', entry.depositRaw) : '—');

                      return (
                        <tr
                          key={entry.id || `period-${index}`}
                          style={isActive ? { background: 'rgba(30,144,255,0.08)' } : undefined}
                        >
                          <td style={{ ...PRICE_CELL_STYLE, textAlign: 'center', fontWeight: 600 }}>{index + 1}</td>
                          <td style={PRICE_CELL_STYLE}>{startText}</td>
                          <td style={PRICE_CELL_STYLE}>{endText}</td>
                          <td style={PRICE_CELL_STYLE}>{priceText}</td>
                          <td style={PRICE_CELL_STYLE}>{depositText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {periodScheduleDeadline ? (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
                  Дата окончания приёма заявок по лоту: <b>{formatDateTime(periodScheduleDeadline)}</b>
                </div>
              ) : null}
            </section>
          )}

          {Array.isArray(prices) && prices.length > 0 && (
            <section className="detail-section">
              <h2>История цен</h2>
              <div className="panel table-scroll" style={{ padding: 0 }}>
                <table>
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
                      const labelRaw = entry.stage || entry.stage_name || entry.stageName || entry.round || entry.type || entry.name || entry.title;
                      const label = labelRaw ? translateFieldKey(labelRaw) : `Запись ${index + 1}`
                      const numericPrice = parseNumberValue(
                        entry.price ?? entry.currentPrice ?? entry.current_price ?? entry.startPrice ?? entry.start_price ?? entry.value ?? entry.amount
                      );
                      const fallbackPrice = entry.price ?? entry.currentPrice ?? entry.current_price ?? entry.startPrice ?? entry.start_price ?? entry.value ?? entry.amount ?? '—';
                      const priceText = numericPrice != null
                        ? fmtPrice(numericPrice, currency)
                        : formatValueForDisplay('price', fallbackPrice);
                      const dateValue = entry.date || entry.date_start || entry.dateStart || entry.date_finish || entry.dateFinish || entry.updated_at || entry.updatedAt;
                      const dateText = dateValue ? formatDateTime(dateValue) : '—';
                      const commentRaw = entry.comment || entry.description || entry.info || entry.status || entry.note || entry.result || null;
                      const commentText = commentRaw ? formatValueForDisplay('comment', commentRaw) : null;

                      return (
                        <tr key={entry.id || `${label}-${index}`}>
                          <td style={PRICE_CELL_STYLE}>{label}</td>
                          <td style={PRICE_CELL_STYLE}>{priceText}</td>
                          <td style={PRICE_CELL_STYLE}>{dateText}</td>
                          <td style={PRICE_CELL_STYLE}>{commentText ? <span style={{ whiteSpace: 'pre-wrap' }}>{commentText}</span> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {documents.length > 0 && (
            <section className="detail-section">
              <h2>Документы</h2>
              <div className="panel" style={{ display: 'grid', gap: 12 }}>
                {documents.map((doc) => {
                  const hasMeta = doc.type || doc.date;

                  return (
                    <article key={doc.id} className="document-card">
                      <div className="document-card__title">{doc.title}</div>
                      {hasMeta ? (
                        <div className="document-card__meta">
                          {doc.type ? <span>{doc.type}</span> : null}
                          {doc.date ? <span>Дата: {formatDate(doc.date)}</span> : null}
                        </div>
                      ) : null}
                      {doc.description ? (
                        <div style={{ color: 'rgba(226,232,240,0.75)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                          {doc.description}
                        </div>
                      ) : null}
                      {doc.url ? (
                        <div className="document-card__actions">
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            Открыть документ →
                          </a>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {hasData(fedresursMeta) && (
            <section className="detail-section">
              <h2>Дополнительные данные</h2>
              <div className="panel" style={{ padding: 12, overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(fedresursMeta, null, 2)}
                </pre>
              </div>
            </section>
          )}
        </div>

        <aside className="detail-aside">
          {contactEntries.length > 0 && (
            <section className="detail-section">
              <h2>Контакты</h2>
              <KeyValueList
                entries={contactEntries}
                renderValue={renderContactValue}
                valueClassName="contact-list__value"
                valueStyle={{ textAlign: 'left' }}
              />
            </section>
          )}

          {debtorEntries.length > 0 && (
            <section className="detail-section">
              <h2>Данные должника</h2>
              <KeyValueList entries={debtorEntries} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
