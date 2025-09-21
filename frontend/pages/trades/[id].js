import Link from 'next/link';
import { useEffect, useState } from 'react';
import InspectionModal from '../../components/InspectionModal';

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

function normalizePhoto(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
function makeKeyValueEntries(source) {
  return entries.map(({ key, value }, index) => ({ key: key || `#${index + 1}`, value: formatValue(value) }));
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
  if (!base) {
    console.error('API base URL is not configured.');
    return { notFound: true };
  }

  const url = `${base}/api/listings/${params.id}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 404) {
      return { notFound: true };
    }
    if (!response.ok) {
      console.error('Failed to fetch listing details', response.status);
      return { notFound: true };
    }
    const item = await response.json();
    return { props: { item } };
  } catch (error) {
    console.error('Failed to fetch listing details', error);
    return { notFound: true };
  }
}

function KeyValueGrid({ entries }) {
  if (!entries || !entries.length) return null;
  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
      {entries.map(({ key, value }, index) => {
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

function KeyValueList({ entries }) {
  if (!entries || !entries.length) return null;
  return (
    <div className="panel" style={{ display: 'grid', gap: 8 }}>
      {entries.map(({ key, value }, index) => {
        const isMultiline = typeof value === 'string' && value.includes('\n');
        return (
          <div key={`${key}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div className="muted" style={{ fontSize: 12 }}>{key}</div>
            {isMultiline
              ? <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'right' }}>{value}</pre>
              : <div style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function ListingPage({ item }) {
  const details = item?.details && typeof item.details === 'object' ? item.details : {};

  // ЕДИНСТВЕННЫЙ ID, которым мы пользуемся в файле:
  const listingIdNum = Number(item?.id || 0);

  const [openInspection, setOpenInspection] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  function handleOrderClick() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      const next = `/trades/${listingIdNum || ''}`;
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
  const lotEntries = makeKeyValueEntries(details?.lot_details);
  const contactEntries = makeKeyValueEntries(details?.contact_details);
  const debtorEntries = makeKeyValueEntries(details?.debtor_details);
  const prices = Array.isArray(details?.prices) ? details.prices : [];
  const documents = Array.isArray(details?.documents) ? details.documents : [];
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
  addChip(item?.region);
  addChip(item?.asset_type);
  if (item?.lot_number) addChip(`Лот № ${item.lot_number}`);
  const yearValue = lotDetails?.year || lotDetails?.production_year || lotDetails?.manufacture_year || item?.year;
  if (yearValue) addChip(`Год выпуска ${yearValue}`);
  const mileageValue = lotDetails?.mileage || lotDetails?.probeg || lotDetails?.run || item?.mileage;
  if (mileageValue) {
    const numericMileage = parseNumberValue(mileageValue);
    const formattedMileage = numericMileage != null
      ? `${new Intl.NumberFormat('ru-RU').format(Math.round(numericMileage))} км`
      : formatValue(mileageValue);
    addChip(`Пробег ${formattedMileage}`);
  }
  const vinValue = lotDetails?.vin || lotDetails?.VIN || item?.vin;
  if (vinValue) addChip(`VIN ${vinValue}`);

  return (
    <div className="container detail-page">
      <div className="back-link">
        <Link href="/trades" className="link">← Назад к списку</Link>
      </div>

      <div className="detail-hero">
        <div className="detail-hero__info">
          <div className="eyebrow">{item?.asset_type || 'Объявление'}</div>
          <h1 className="detail-hero__title">{item?.title || 'Лот'}</h1>
          {heroChips.length ? (
            <div className="detail-hero__meta">
              {heroChips.slice(0, 5).map((chip, index) => (
                <span key={`${chip}-${index}`} className="chip">{chip}</span>
              ))}
            </div>
          ) : null}
          {(item?.description || details?.lot_details?.description) && (
            <div className="muted" style={{ whiteSpace: 'pre-line' }}>
              {(item?.description || details?.lot_details?.description || '').slice(0, 260)}
              {(item?.description || details?.lot_details?.description || '').length > 260 ? '…' : ''}
            </div>
          )}
        </div>

        <aside className="detail-summary-card">
          <div className="detail-summary__prices">
            <div className="detail-summary__price">
              <div className="detail-summary__price-label">Стартовая цена</div>
              <div className="detail-summary__price-value">{fmtPrice(item?.start_price, currency)}</div>
            </div>
            <div className="detail-summary__price">
              <div className="detail-summary__price-label">Текущая цена</div>
              <div className="detail-summary__price-value">{fmtPrice(item?.current_price, currency)}</div>
            </div>
          </div>

          {(item?.status || item?.end_date) && (
            <div className="detail-summary__status">
              <div><strong>Статус:</strong> {item?.status ?? '—'}</div>
              {item?.end_date ? <div><strong>Дата окончания:</strong> {formatDate(item.end_date)}</div> : null}
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
            ID объявления: {item?.id}
          </div>
        </aside>
      </div>

      <InspectionModal
        listingId={listingIdNum}
        isOpen={openInspection}
        onClose={() => setOpenInspection(false)}
      />

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-section detail-gallery">
            <h2>Фотографии</h2>
            {activePhoto ? (
              <div className="detail-gallery__main">
                <img src={activePhoto.url} alt={activePhoto.title || item?.title || 'Фотография лота'} />
              </div>
            ) : (
              <div className="panel" style={{ textAlign: 'center' }}>
                <div className="big">Фотографии отсутствуют</div>
                <div className="muted">Организатор не загрузил изображения для этого лота.</div>
              </div>
            )}
            {photos.length > 1 && (
              <div className="detail-gallery__thumbs">
                {photos.map((photo, index) => (
                  <button
                    key={photo.url || index}
                    type="button"
                    className={`detail-gallery__thumb${index === activePhotoIndex ? ' is-active' : ''}`}
                    onClick={() => setActivePhotoIndex(index)}
                  >
                    <img src={photo.url} alt={photo.title || `Фото ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </section>

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

          {prices.length > 0 && (
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
                      const label = entry.stage || entry.stage_name || entry.stageName || entry.round || entry.type || entry.name || entry.title || `Запись ${index + 1}`;
                      const numericPrice = parseNumberValue(
                        entry.price ?? entry.currentPrice ?? entry.current_price ?? entry.startPrice ?? entry.start_price ?? entry.value ?? entry.amount
                      );
                      const priceText = numericPrice != null
                        ? fmtPrice(numericPrice, currency)
                        : formatValue(
                          entry.price ?? entry.currentPrice ?? entry.current_price ?? entry.startPrice ?? entry.start_price ?? entry.value ?? entry.amount ?? '—'
                        );
                      const dateValue = entry.date || entry.date_start || entry.dateStart || entry.date_finish || entry.dateFinish || entry.updated_at || entry.updatedAt;
                      const comment = entry.comment || entry.description || entry.info || entry.status || entry.note || entry.result || null;

                      return (
                        <tr key={entry.id || `${label}-${index}`}>
                          <td style={PRICE_CELL_STYLE}>{label}</td>
                          <td style={PRICE_CELL_STYLE}>{priceText}</td>
                          <td style={PRICE_CELL_STYLE}>{dateValue ? formatDateTime(dateValue) : '—'}</td>
                          <td style={PRICE_CELL_STYLE}>{comment ? <span style={{ whiteSpace: 'pre-wrap' }}>{formatValue(comment)}</span> : '—'}</td>
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
                {documents.map((doc, index) => {
                  const url = doc?.url || doc?.href || doc?.link || doc?.download_url || null;
                  const title = doc?.title || doc?.name || doc?.filename || `Документ ${index + 1}`;
                  const description = doc?.description || doc?.comment || doc?.note || null;
                  const date = doc?.date || doc?.created_at || doc?.updated_at || null;

                  return (
                    <div key={url || `${title}-${index}`}>
                      {url ? <a href={url} target="_blank" rel="noreferrer" className="link">{title}</a> : <div>{title}</div>}
                      {date ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Дата: {formatDate(date)}</div> : null}
                      {description ? <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>{description}</div> : null}
                    </div>
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
              <KeyValueList entries={contactEntries} />
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
