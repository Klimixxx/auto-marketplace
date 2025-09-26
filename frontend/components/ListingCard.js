import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  localizeListingBadge,
  translateValueByKey,
} from '../lib/lotFormatting';

function collectPhotos(listing) {
  const pools = [
    listing?.photos,
    listing?.details?.photos,
    listing?.details?.lot_details?.photos,
    listing?.details?.lot_details?.images,
  ];

  const out = [];
  const seen = new Set();

  for (const pool of pools) {
    if (!pool) continue;
    const list = Array.isArray(pool) ? pool : [pool];
    for (const entry of list) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); out.push(trimmed); }
      } else if (typeof entry === 'object') {
        const url = entry.url || entry.href || entry.link || entry.download_url || entry.src || null;
        if (url && !seen.has(url)) { seen.add(url); out.push(url); }
      }
      if (out.length >= 8) return out;
    }
  }

  return out;
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

function formatPrice(value, currency = 'RUB') {
  try {
    if (value == null || value === '') return 'Цена уточняется';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value ? `${value} ${currency}` : 'Цена уточняется';
  }
}

function tradeTypeLabel(type) {
  if (!type) return null;
  const lower = String(type).toLowerCase();
  if (lower === 'auction' || lower.includes('аукцион')) return 'Аукцион';
  if (lower === 'offer' || lower.includes('публич')) return 'Торговое предложение';
  // если строка уже на русском (например "Публичное предложение") — вернуть как есть
  return localizeListingBadge(type) || translateValueByKey('asset_type', type) || String(type);
}

export default function ListingCard({ l, onFav, fav, detailHref, sourceHref, favoriteContext }) {
  const [isHovered, setHovered] = useState(false);
  const photos = useMemo(() => collectPhotos(l), [l]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [l?.id]);

  const activePhoto = photos[activePhotoIndex] || photos[0] || null;
  const price = l.current_price ?? l.start_price;
  const priceLabel = formatPrice(price, l.currency || 'RUB');

  // Характеристики (оставляем, но год убираем из списка, тк он теперь в шапке)
  const metaSet = new Set();
  const metaItems = [];
  const year = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  // (Год в metaItems НЕ добавляем)
  const mileage = formatMileage(pickDetailValue(l, ['mileage', 'run', 'probeg', 'mileage_km']));
  if (mileage && !metaSet.has(mileage)) { metaSet.add(mileage); metaItems.push(mileage); }
  const engine = formatEngine(pickDetailValue(l, ['engine_volume', 'engine_volume_l', 'engine', 'engine_volume_liters']));
  if (engine && !metaSet.has(engine)) { metaSet.add(engine); metaItems.push(engine); }
  const transmission = translateValueByKey('transmission', pickDetailValue(l, ['transmission', 'gearbox', 'kpp']));
  if (transmission) {
    const text = String(transmission);
    if (text && !metaSet.has(text)) { metaSet.add(text); metaItems.push(text); }
  }

  // NEW: Тип объявления + Регион + Год
  const region = l.region || pickDetailValue(l, ['region']);
  const rawType = l.trade_type ?? pickDetailValue(l, ['trade_type', 'type']);
  const tradeType = tradeTypeLabel(rawType) || 'Лот';
  const eyebrow = [tradeType, region, year ? `${year} г.` : null].filter(Boolean).join(' • ');

  const cardContent = (
    <article
      className="listing-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // УБРАНА белая рамка у карточки
        border: 'none',
        borderRadius: 16,
        background: 'rgba(15,23,42,0.72)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 16px 32px rgba(0,0,0,0.35)' : 'none',
        cursor: detailHref ? 'pointer' : 'default',
      }}
    >
      <div style={{ position: 'relative', paddingBottom: '56%', background: '#0f172a' }}>
        {activePhoto ? (
          <img src={activePhoto} alt={l.title || 'Объявление'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(226,232,240,0.65)' }}>
            Нет фото
          </div>
        )}

        {/* Кнопка "В избранное" на фото (левый верх), чёрная */}
        {onFav ? (
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFav(); }}
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              borderRadius: 10,
              border: '1px solid #000',
              background: '#fff',
              color: '#000',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
            }}
            aria-label={fav ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <span aria-hidden="true">{favoriteContext === 'collection' ? '✕' : (fav ? '★' : '☆')}</span>
            <span>{favoriteContext === 'collection' ? 'Убрать' : (fav ? 'В избранном' : 'В избранное')}</span>
          </button>
        ) : null}

        {photos.length > 1 ? (
          <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 8 }}>
            {photos.slice(0, 4).map((photo, index) => (
              <button
                key={`${photo}-${index}`}
                type="button"
                onMouseEnter={() => setActivePhotoIndex(index)}
                onFocus={() => setActivePhotoIndex(index)}
                style={{
                  width: 52,
                  height: 36,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: index === activePhotoIndex ? '2px solid #67e8f9' : '1px solid rgba(255,255,255,0.18)',
                  padding: 0,
                  background: '#0f172a',
                  cursor: 'pointer',
                }}
                aria-label={`Фотография ${index + 1}`}
              >
                <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ padding: '16px 18px', display: 'grid', gap: 10, flex: '1 1 auto' }}>
        {/* Синяя строка: Тип • Регион • Год */}
        {eyebrow ? <div className="listing-card__eyebrow" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.2, color: '#1E90FF' }}>{eyebrow}</div> : null}

        {/* Заголовок чёрный */}
        <h3 className="listing-card__title" style={{ margin: 0, fontSize: 18, color: '#000' }}>{l.title || 'Лот'}</h3>

        <div className="listing-card__price-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          {/* Цена чёрная */}
          <div className="listing-card__price" style={{ fontWeight: 700, fontSize: 18, color: '#000' }}>{priceLabel}</div>
        </div>

        {metaItems.length ? (
          <div className="listing-card__meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {metaItems.slice(0, 3).map((item, index) => (
              <span key={`${item}-${index}`} className="chip" style={{ background: 'rgba(103,232,249,0.12)', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>
                {item}
              </span>
            ))}
          </div>
        ) : null}

        {/* ОПИСАНИЕ УДАЛЕНО по ТЗ */}
      </div>

      {(detailHref || sourceHref || l.source_url) && (
        <div className="listing-card__footer" style={{ padding: '0 18px 18px', display: 'flex', gap: 10 }}>
          {detailHref ? (
            <span style={{ flex: 1 }}>
              <button
                type="button"
                className="button button-small"
                style={{
                  display: 'inline-flex',
                  justifyContent: 'center',
                  width: '100%',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: '#1E90FF',
                  color: '#fff',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Подробнее
              </button>
            </span>
          ) : null}
          {(sourceHref || l.source_url) ? (
            <a
              href={sourceHref || l.source_url}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-outline"
              onClick={(event) => event.stopPropagation()}
              style={{
                borderRadius: 10,
                padding: '10px 12px',
                background: '#1E90FF',
                color: '#fff',
                fontWeight: 600,
                border: 'none',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Источник
            </a>
          ) : null}
        </div>
      )}
    </article>
  );

  if (detailHref) {
    return (
      <Link
        href={detailHref}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

const UI = {
  borderActive: 'rgba(103,232,249,0.45)',
};
