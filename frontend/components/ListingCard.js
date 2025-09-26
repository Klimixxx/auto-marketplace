import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  localizeListingBadge,
  translateValueByKey,
} from '../lib/lotFormatting';

/* ---- helpers ----------------------------------------------------------- */

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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPriceNumber(value) {
  try {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  } catch { return String(value); }
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
    return value ? `${formatPriceNumber(value)} ${currency}` : 'Цена уточняется';
  }
}

function tradeTypeLabel(type) {
  if (!type) return null;
  const lower = String(type).toLowerCase();
  if (lower === 'auction' || lower.includes('аукцион')) return 'Аукцион';
  if (lower === 'offer' || lower.includes('публич')) return 'Торговое предложение';
  return localizeListingBadge(type) || translateValueByKey('asset_type', type) || String(type);
}

function formatRuDateTime(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---- component --------------------------------------------------------- */

export default function ListingCard({ l, onFav, fav, detailHref, sourceHref, favoriteContext }) {
  const [isHovered, setHovered] = useState(false);
  const photos = useMemo(() => collectPhotos(l), [l]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => { setActivePhotoIndex(0); }, [l?.id]);

  const photo = photos[activePhotoIndex] || photos[0] || null;

  // prices
  const price = l.current_price ?? l.start_price ?? pickDetailValue(l, ['current_price', 'price', 'start_price']);
  const minPrice = pickDetailValue(l, ['min_price', 'minimal_price', 'price_min', 'minimum_price']);
  const priceLabel = formatPrice(price, l.currency || 'RUB');
  const minPriceLabel = minPrice != null ? formatPrice(minPrice, l.currency || 'RUB') : null;

  // eyebrow: Тип • Регион • Год
  const region = l.region || pickDetailValue(l, ['region']);
  const year = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const rawType = l.trade_type ?? pickDetailValue(l, ['trade_type', 'type']);
  const tradeType = tradeTypeLabel(rawType) || 'Лот';
  const eyebrow = [tradeType, region, year ? `${year} г.` : null].filter(Boolean).join(' • ');

  // description (короткий)
  const description =
    l.description ||
    l.details?.lot_details?.description ||
    l.details?.description ||
    '';
  const shortDescription = description ? (description.length > 220 ? `${description.slice(0, 217)}…` : description) : '';

  // даты (если есть)
  const dateFinish = pickDetailValue(l, [
    'datefinish', 'dateFinish', 'date_end', 'dateEnd', 'date_to', 'end_date', 'dateFinishRu'
  ]);
  const dateFinishLabel = formatRuDateTime(dateFinish);

  // общий жёсткий сброс «таблеток»
  const resetPill = { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', padding: 0 };

  const Content = (
    <article
      className="listing-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: isHovered ? '0 10px 26px rgba(15,23,42,0.15)' : '0 1px 2px rgba(15,23,42,0.06)',
        transition: 'box-shadow .2s ease, transform .2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        overflow: 'hidden',
        /* ВАЖНО: занимаем всю строку сетки родителя */
        gridColumn: '1 / -1',
        width: '100%',
      }}
    >
      {/* GRID: фото | контент | правая колонка */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 220px',
          gap: 20,
          padding: 20,
          alignItems: 'stretch',
        }}
      >
        {/* фото слева */}
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            background: '#e6eef8',
            position: 'relative',
            aspectRatio: '4 / 3',
            minHeight: 160,
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt={l.title || 'Фото лота'}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9aa7b8', fontWeight: 600 }}>
              Нет фото
            </div>
          )}
        </div>

        {/* центральная колонка: тексты */}
        <div style={{ display: 'grid', alignContent: 'start', gap: 8 }}>
          {eyebrow ? (
            <div style={{ ...resetPill, color: '#1E90FF', fontWeight: 600, fontSize: 12, letterSpacing: 0.2 }}>
              {eyebrow}
            </div>
          ) : null}

          <h3 style={{ ...resetPill, margin: 0, fontSize: 20, lineHeight: 1.3, color: '#0f172a' }}>
            {l.title || 'Лот'}
          </h3>

          {/* вторичные строки под заголовком можно заменить на свои поля */}
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {l.number ? <span style={{ marginRight: 8 }}>№{l.number}</span> : null}
            {l.lot_number ? <span style={{ marginRight: 8 }}>Лот №{l.lot_number}</span> : null}
            {/* сюда можно добавить ещё мелкие метки */}
          </div>

          {shortDescription ? (
            <div style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'pre-line' }}>{shortDescription}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            {dateFinishLabel ? (
              <div style={{ fontSize: 13, color: '#0f172a' }}>
                Окончание текущего периода: <b>{dateFinishLabel}</b>
              </div>
            ) : null}
            {region ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#1E90FF', display: 'inline-block' }} />
                {region}
              </div>
            ) : null}
          </div>
        </div>

        {/* правая колонка: цены и действия */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr auto', alignContent: 'start', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...resetPill, fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>{priceLabel}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Текущая цена</div>
          </div>

          {minPriceLabel ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...resetPill, fontSize: 16, fontWeight: 800, color: '#e11d48' }}>{minPriceLabel}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Минимальная цена</div>
            </div>
          ) : null}

          <div />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {detailHref ? (
              <Link
                href={detailHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 14px',
                  background: '#1E90FF',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 10,
                  textDecoration: 'none',
                  flex: 1,
                }}
              >
                Смотреть
              </Link>
            ) : null}

            {(onFav || favoriteContext === 'collection') ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFav?.(); }}
                aria-label={fav ? 'Удалить из избранного' : 'Добавить в избранное'}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  color: fav ? '#f59e0b' : '#64748b',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                {fav ? '★' : '☆'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* локальный css-сброс, чтобы НИГДЕ не всплыли белые «таблетки» у цены */}
      <style jsx>{`
        .listing-card * {
          box-sizing: border-box;
        }
        .listing-card .listing-card__price,
        .listing-card .listing-card__price * {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          outline: none !important;
        }
        @media (max-width: 900px) {
          .listing-card > div {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  );

  // По макету кликабельна кнопка «Смотреть», а не вся карточка.
  // Если хочешь кликабельной всю карточку — скажи, оберну в <Link>.
  return Content;
}
