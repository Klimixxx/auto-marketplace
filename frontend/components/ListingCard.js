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

  // характеристики (год теперь выводим в «eyebrow», сюда не добавляем)
  const metaSet = new Set();
  const metaItems = [];
  const year = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const mileage = formatMileage(pickDetailValue(l, ['mileage', 'run', 'probeg', 'mileage_km']));
  if (mileage && !metaSet.has(mileage)) { metaSet.add(mileage); metaItems.push(mileage); }
  const engine = formatEngine(pickDetailValue(l, ['engine_volume', 'engine_volume_l', 'engine', 'engine_volume_liters']));
  if (engine && !metaSet.has(engine)) { metaSet.add(engine); metaItems.push(engine); }
  const transmission = translateValueByKey('transmission', pickDetailValue(l, ['transmission', 'gearbox', 'kpp']));
  if (transmission) {
    const text = String(transmission);
    if (text && !metaSet.has(text)) { metaSet.add(text); metaItems.push(text); }
  }

  // Тип + Регион + Год
  const region = l.region || pickDetailValue(l, ['region']);
  const rawType = l.trade_type ?? pickDetailValue(l, ['trade_type', 'type']);
  const tradeType = tradeTypeLabel(rawType) || 'Лот';
  const eyebrow = [tradeType, region, year ? `${year} г.` : null].filter(Boolean).join(' • ');

  // общий «сброс» таблеток для текстовых блоков
  const resetPill = {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    padding: 0,
  };

  const cardContent = (
    <article
      className="listing-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
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

        {/* "В избранное" */}
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

      {/* ИНФО-ПАНЕЛЬ: теперь белая */}
      <div
        style={{
          padding: '16px 18px',
          display: 'grid',
          gap: 10,
          flex: '1 1 auto',
          background: '#fff',
        }}
      >
        {/* Синяя строка: Тип • Регион • Год */}
        {eyebrow ? (
          <div
            className="listing-card__eyebrow"
            style={{ ...resetPill, fontSize: 12, fontWeight: 600, letterSpacing: 0.2, color: '#1E90FF' }}
          >
            {eyebrow}
          </div>
        ) : null}

        {/* Заголовок чёрный */}
        <h3
          className="listing-card__title"
          style={{ ...resetPill, margin: 0, fontSize: 18, color: '#000' }}
        >
          {l.title || 'Лот'}
        </h3>

        <div className="listing-card__price-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          {/* Цена без «таблетки» */}
          <div
            className="listing-card__price no-pill"
            style={{
              ...resetPill,
              fontWeight: 700,
              fontSize: 18,
              color: '#000',
              background: 'transparent',
            }}
          >
            {priceLabel}
          </div>
        </div>

        {/* Характеристики (опционально) */}
        {metaItems.length ? (
          <div className="listing-card__meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {metaItems.slice(0, 3).map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="chip"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#111827',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* НИЖНИЕ КНОПКИ — на белом фоне */}
      {(detailHref || sourceHref || l.source_url) && (
        <div
          className="listing-card__footer"
          style={{
            padding: '0 18px 18px',
            display: 'flex',
            gap: 10,
            background: '#fff',
            border: 'none',
          }}
        >
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
                  boxShadow: 'none',
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
                boxShadow: 'none',
                textDecoration: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                justifyContent: 'center',
              }}
            >
              Источник
            </a>
          ) : null}
        </div>
      )}

      {/* Локальный CSS для жёсткого убирания «таблеток» у цены */}
      <style jsx>{`
        .listing-card .no-pill,
        .listing-card .no-pill * {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          outline: none !important;
        }
      `}</style>
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
