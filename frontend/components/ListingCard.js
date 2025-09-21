import Link from 'next/link';
import {
  localizeListingBadge,
  translateValueByKey,
} from '../lib/lotFormatting';

function formatPrice(value, currency = 'RUB') {
  try {
    if (value == null || value === '') return null;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value ? `${value} ${currency}` : null;
  }
}

function pickPhotoUrl(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed || null;
  }
  if (typeof photo === 'object') {
    return photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
  }
  return null;
}

function getCoverPhoto(listing) {
  const photos = Array.isArray(listing?.details?.photos) ? listing.details.photos : [];
  for (const photo of photos) {
    const url = pickPhotoUrl(photo);
    if (url) return url;
  }
  return null;
}

function pickDetailValue(listing, keys = []) {
  if (!listing || !keys.length) return null;
  const sources = [listing, listing?.details, listing?.details?.lot_details];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      const value = source[key];
      if (value != null && value !== '') return value;
    }
  }
  return null;
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMileage(value) {
  const numeric = normalizeNumber(value);
  if (numeric == null) return null;
  const rounded = Math.round(numeric);
  return `${new Intl.NumberFormat('ru-RU').format(rounded)} км`;
}

function formatEngine(value) {
  if (value == null || value === '') return null;
  const numeric = normalizeNumber(value);
  if (numeric != null) {
    const liters = numeric > 25 ? numeric / 1000 : numeric;
    const normalized = Math.max(liters, 0.1);
    const display = Math.round(normalized * 10) / 10;
    return `${String(display).replace('.', ',')} л`;
  }
  const str = String(value).trim();
  return str ? str : null;
}

export default function ListingCard({ l, onFav, fav, detailHref, sourceHref }) {
  const cover = getCoverPhoto(l);
  const price = l.current_price ?? l.start_price;
  const priceLabel = formatPrice(price, l.currency || 'RUB') || 'Цена уточняется';
  const description = l.description || l.details?.lot_details?.description || '';
  const shortDescription = description.length > 220 ? `${description.slice(0, 217)}…` : description;

  const metaSet = new Set();
  const metaItems = [];
  const year = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue']);
  if (year && !metaSet.has(year)) { metaSet.add(year); metaItems.push(`${year} г.`); }
  const mileage = formatMileage(pickDetailValue(l, ['mileage', 'run', 'probeg', 'mileage_km']));
  if (mileage && !metaSet.has(mileage)) { metaSet.add(mileage); metaItems.push(mileage); }
  const engine = formatEngine(pickDetailValue(l, ['engine_volume', 'engine_volume_l', 'engine', 'engine_volume_liters']));
  if (engine && !metaSet.has(engine)) { metaSet.add(engine); metaItems.push(engine); }
  const transmission = translateValueByKey('transmission', pickDetailValue(l, ['transmission', 'gearbox', 'kpp']));
  if (transmission) {
    const text = String(transmission);
    if (text && !metaSet.has(text)) { metaSet.add(text); metaItems.push(text); }
  }

  const location = l.region || pickDetailValue(l, ['city', 'location']);
  const assetType = translateValueByKey('asset_type', l.asset_type || pickDetailValue(l, ['assetType', 'type']));
  const rawBadge = l.status || l.stage || l.stage_name || assetType || 'Лот';
  const badgeText = localizeListingBadge(rawBadge) || translateValueByKey('asset_type', rawBadge) || rawBadge;
  const badge = badgeText == null ? 'Лот' : String(badgeText);
  const eyebrowParts = [assetType, location].filter((part) => {
    if (part == null) return false;
    const text = String(part).trim();
    return Boolean(text);
  });
  const eyebrow = eyebrowParts.join(' • ');

  return (
    <article className="listing-card">
      <div className="listing-card__media">
        {cover ? (
          <img src={cover} alt={l.title || 'Объявление'} />
        ) : (
          <div className="listing-card__placeholder" aria-hidden="true">🚗</div>
        )}
        {badge ? <div className="listing-card__badge">{badge}</div> : null}
      </div>

      <div className="listing-card__body">
        {eyebrow ? <div className="listing-card__eyebrow">{eyebrow}</div> : null}
        <h3 className="listing-card__title">{l.title || 'Лот'}</h3>
        <div className="listing-card__price-row">
          <div className="listing-card__price">{priceLabel}</div>
          {onFav ? (
            <button
              type="button"
              className={`bookmark-button${fav ? ' is-active' : ''}`}
              onClick={onFav}
            >
              <span aria-hidden="true">{fav ? '★' : '☆'}</span>
              {fav ? 'В избранном' : 'В избранное'}
            </button>
          ) : null}
        </div>

        {metaItems.length ? (
          <div className="listing-card__meta">
            {metaItems.slice(0, 3).map((item, index) => (
              <span key={`${item}-${index}`} className="chip">{item}</span>
            ))}
          </div>
        ) : null}

        {shortDescription && (
          <div className="listing-card__description" style={{ whiteSpace: 'pre-line' }}>
            {shortDescription}
          </div>
        )}
      </div>

      {(detailHref || sourceHref || l.source_url) && (
        <div className="listing-card__footer">
          {detailHref ? (
            <Link href={detailHref} className="button button-small">
              Подробнее
            </Link>
          ) : null}
          {(sourceHref || l.source_url) ? (
            <a
              href={sourceHref || l.source_url}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-outline"
            >
              Источник
            </a>
          ) : null}
        </div>
      )}
    </article>
  );
}
