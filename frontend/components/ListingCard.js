import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  localizeListingBadge,
  translateValueByKey,
} from '../lib/lotFormatting';
import { formatTradeTypeLabel, normalizeTradeTypeCode } from '../lib/tradeTypes';
import computeTradeTiming from '../lib/tradeTiming';

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

function buildAdditionalEyebrow(listing, tradeTypeInfo = null) {
  if (!listing) return null;

  const parts = [];

  const assetType = pickDetailValue(listing, [
    'asset_type',
    'assetType',
    'category',
    'category_name',
    'categoryName',
    'object_type',
    'objectType',
  ]);
  if (assetType && typeof assetType === 'string') {
    const normalized = assetType.trim();
    if (normalized && normalized !== tradeTypeInfo?.label) parts.push(normalized);
  }

  const region = listing.region || pickDetailValue(listing, ['region']);
  if (region && typeof region === 'string') {
    const normalized = region.trim();
    if (normalized) parts.push(normalized);
  }

  const rawYear = pickDetailValue(listing, [
    'year',
    'production_year',
    'manufacture_year',
    'year_of_issue',
    'productionYear',
    'yearOfIssue',
  ]);
  if (rawYear != null && rawYear !== '') {
    let normalized = null;
    if (typeof rawYear === 'number' && Number.isFinite(rawYear)) {
      normalized = rawYear;
    } else if (typeof rawYear === 'string') {
      const match = rawYear.match(/\d{4}/);
      if (match) normalized = match[0];
    }
    if (normalized) parts.push(String(normalized));
  }

  return parts.length ? parts.join(' • ') : null;
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
  const mapped = formatTradeTypeLabel(type);
  if (mapped) return mapped;
  if (!type && type !== 0) return null;
  const text = String(type).trim();
  if (!text) return null;
  return localizeListingBadge(text) || translateValueByKey('asset_type', text) || text;
}

const TYPE_FIELD_KEYS = [
  'type',
  'Type',
  'trade_type',
  'tradeType',
  'procedure_type',
  'procedureType',
  'procedure_kind',
  'procedureKind',
  'auction_type',
  'auctionType',
  'auction_format',
  'auctionFormat',
  'format',
  'kind',
  'trade_stage',
  'tradeStage',
  'trade_format',
  'tradeFormat',
  'trading_type',
  'tradingType',
  'trade_offer',
  'tradeOffer',
  'trade_type_highlights',
  'tradeTypeHighlights',
  'trading_type_highlights',
  'tradingTypeHighlights',
  'trade_offer_highlights',
  'tradeOfferHighlights',
  'trade_stage_highlights',
  'tradeStageHighlights',
];

const TYPE_LABEL_FIELDS = [
  'label',
  'name',
  'title',
  'caption',
  'key',
  'property',
  'field',
  'parameter',
  'param',
  'attribute',
  'header',
  'heading',
  'question',
  'type_name',
  'typeName',
];

const TYPE_VALUE_FIELDS = [
  'value',
  'val',
  'value_text',
  'valueText',
  'text',
  'content',
  'data',
  'info',
  'description',
  'values',
  'items',
  'options',
  'variants',
  'answers',
];

const TYPE_KEY_PATTERN = /(type|offer|trade|торг|процед|аукцион|auction)/i;
const TYPE_LABEL_PATTERN = /(торг|аукцион|процед|предлож|offer|auction|trade)/i;
const TYPE_LABEL_ONLY_PATTERN = /^(?:тип|вид)\s+(?:торг|процед)/i;

function collectTypeStrings(source, out) {
  if (!source && source !== 0) return;
  if (typeof source === 'string' || typeof source === 'number') {
    const text = String(source).trim();
    if (!text) return;
    const pairMatch = text.match(/^\s*([^:–—-]{1,80})[:–—-]\s*(.+)$/);
    if (pairMatch && TYPE_LABEL_PATTERN.test(pairMatch[1])) {
      const valueText = pairMatch[2].trim();
      if (valueText) out.push(valueText);
      return;
    }
    const stripped = text.replace(/^(?:\s*(?:тип|вид)\s+(?:торг|процед)\s*(?:[:–—-]\s*)?)/i, '').trim();
    if (stripped && stripped !== text) {
      collectTypeStrings(stripped, out);
      return;
    }
    if (TYPE_LABEL_ONLY_PATTERN.test(text)) return;
    out.push(text);
    return;
  }
  if (Array.isArray(source)) {
    source.forEach((item) => collectTypeStrings(item, out));
    return;
  }
  if (typeof source === 'object') {
    const labelMatches = TYPE_LABEL_FIELDS.some(
      (field) => typeof source[field] === 'string' && TYPE_LABEL_PATTERN.test(source[field])
    );

    if (labelMatches) {
      for (const field of TYPE_VALUE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
          collectTypeStrings(source[field], out);
        }
      }
    }

    for (const [key, value] of Object.entries(source)) {
      if (TYPE_FIELD_KEYS.includes(key) || TYPE_KEY_PATTERN.test(key)) {
        collectTypeStrings(value, out);
        continue;
      }
      if (labelMatches && TYPE_LABEL_FIELDS.includes(key)) continue;
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        collectTypeStrings(value, out);
      } else if ((typeof value === 'string' || typeof value === 'number') && !TYPE_LABEL_FIELDS.includes(key)) {
        collectTypeStrings(value, out);
      }
    }
  }
}

function resolveTradeType(listing) {
  const candidates = [];
  const push = (value) => collectTypeStrings(value, candidates);

  const backendLabel = listing?.trade_type_label || listing?.resolved_trade_type_label || null;
  const backendRaw = listing?.trade_type_resolved ?? listing?.resolved_trade_type ?? listing?.normalized_trade_type ?? listing?.trade_type;
  const backendKind = normalizeTradeTypeCode(backendRaw);

  push(backendLabel);
  push(backendRaw);

  push(listing?.trade_type);
  push(listing?.type);
  push(listing?.additional_data);
  push(listing?.additionalData);

  const details = listing?.details || {};
  const lot = details?.lot_details || {};

  push(details);
  push(details?.additional_data);
  push(details?.additionalData);
  push(details?.fedresurs_meta);
  push(details?.fedresurs_meta?.additional_data);
  push(details?.fedresurs_meta?.additionalData);
  push(lot);
  push(lot?.additional_data);
  push(lot?.additionalData);
  push(lot?.fedresurs_meta);
  push(lot?.fedresurs_meta?.additional_data);
  push(lot?.fedresurs_meta?.additionalData);

  const normalized = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) continue;
    const text = String(candidate).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(text);
  }

  const lowers = normalized.map((value) => value.toLowerCase());
  const hasPublic = lowers.some((text) => text.includes('публич') || text.includes('public') || text.includes('предлож') || text.includes('offer'));
  const hasAuction = lowers.some((text) => text.includes('аукцион') || text.includes('auction'));
  const hasOpen = lowers.some((text) => text.includes('открыт') || text.includes('open'));

  const base = normalizeTradeTypeCode(backendRaw || listing?.trade_type);

  let kind = backendKind || null;
  if (!kind) {
    if (hasPublic) {
      kind = 'public_offer';
    } else if (hasAuction) {
      kind = 'open_auction';
    } else if (base) {
      kind = base;
    }
  }
  if (!kind && normalized.length) {
    const hintKind = normalizeTradeTypeCode(normalized[0]);
    if (hintKind) kind = hintKind;
  }

  let label = backendLabel || null;
  if (!label) {
    if (kind === 'public_offer') {
      label = normalized.find((text) => {
        const lower = text.toLowerCase();
        return lower.includes('публич') || lower.includes('предлож') || lower.includes('offer');
      }) || tradeTypeLabel('public_offer');
    } else if (kind === 'open_auction') {
      const auctionLabel = normalized.find((text) => /аукцион|auction/i.test(text));
      if (auctionLabel) {
        const lower = auctionLabel.toLowerCase();
        if (lower.includes('открыт') || lower.includes('open')) {
          label = auctionLabel;
        } else {
          label = hasOpen ? tradeTypeLabel('open_auction') : tradeTypeLabel('auction');
        }
      } else {
        label = hasOpen ? tradeTypeLabel('open_auction') : tradeTypeLabel('auction');
      }
    }
  }

  if (!label && kind) {
    label = tradeTypeLabel(kind);
  }
  if (!label && normalized.length) {
    label = tradeTypeLabel(normalized[0]);
  }

  return { kind, label, candidates: normalized };
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.results)) return value.results;
    return Object.values(value);
  }
  return [];
}

function extractPeriodPrices(listing) {
  const lot = listing?.details?.lot_details || {};
  const details = listing?.details && typeof listing.details === 'object' ? listing.details : {};
  const pools = [
    listing?.period_prices,
    listing?.periodPrices,
    details?.period_prices,
    details?.periodPrices,
    lot?.period_prices,
    lot?.periodPrices,
    lot?.price_schedule,
    lot?.priceSchedule,
    lot?.offer_schedule,
    lot?.price_periods,
    lot?.pricePeriods,
    lot?.price_graph,
    lot?.schedule,
  ];

  const entries = [];
  for (const pool of pools) {
    const arr = toArray(pool);
    for (const entry of arr) {
      if (entry && typeof entry === 'object') entries.push(entry);
    }
  }
  return entries;
}

function findMinimalPeriodPrice(entries) {
  let min = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const candidates = [
      entry.min_price,
      entry.minPrice,
      entry.minimum_price,
      entry.minimumPrice,
      entry.price_min,
      entry.priceMin,
      entry.price,
      entry.current_price,
      entry.currentPrice,
      entry.amount,
      entry.cost,
      entry.value,
    ];
    for (const candidate of candidates) {
      const num = normalizeNumber(candidate);
      if (num != null) {
        if (min == null || num < min) min = num;
      }
    }
  }
  return min;
}

function formatRuDateTime(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---- lot status helpers ------------------------------------------------ */

function extractLotStatus(listing) {
  const cand = [
    listing?.status,
    listing?.status?.name,
    listing?.details?.status,
    listing?.details?.status?.name,
    listing?.details?.lot_details?.status,
    listing?.details?.lot_details?.status?.name,
    pickDetailValue(listing, ['status_name', 'statusName', 'lot_status']),
  ];
  for (const c of cand) {
    if (!c) continue;
    if (typeof c === 'string') return c.trim();
    if (typeof c === 'object') {
      if (c.name) return String(c.name).trim();
      if (c.title) return String(c.title).trim();
    }
  }
  return null;
}

function classifyStatus(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('заверш')) return { label: 'Торги завершены', color: '#dc2626' };
  if (/(открыт|открыта|при[её]м|заявок)/i.test(lower)) return { label: 'Открыт прием заявок', color: '#16a34a' };
  return { label: name, color: '#64748b' };
}

/* ---- component --------------------------------------------------------- */

export default function ListingCard({ l, onFav, fav, detailHref, sourceHref, favoriteContext, variant = 'default' }) {
  const router = useRouter();
  const [isHovered, setHovered] = useState(false);
  const photos = useMemo(() => collectPhotos(l), [l]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photoContainerRef = useRef(null);

  useEffect(() => { setActivePhotoIndex(0); }, [l?.id]);
  useEffect(() => {
    setActivePhotoIndex((index) => {
      if (!photos.length) return 0;
      if (index < 0) return 0;
      if (index >= photos.length) return photos.length - 1;
      return index;
    });
  }, [photos.length]);

  const hasMultiplePhotos = photos.length > 1;
  const photo = photos[activePhotoIndex] || photos[0] || null;
  const isCompact = variant === 'compact';

  const updatePhotoFromPointer = (clientX) => {
    if (!hasMultiplePhotos) return;
    const rect = photoContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const relativeX = clientX - rect.left;
    const normalized = Math.max(0, Math.min(1, relativeX / rect.width));
    let nextIndex = Math.floor(normalized * photos.length);
    if (nextIndex >= photos.length) nextIndex = photos.length - 1;
    if (nextIndex < 0) nextIndex = 0;
    setActivePhotoIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  };

  const showPreviousPhoto = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!hasMultiplePhotos) return;
    setActivePhotoIndex((index) => (index - 1 + photos.length) % photos.length);
  };

  const showNextPhoto = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!hasMultiplePhotos) return;
    setActivePhotoIndex((index) => (index + 1) % photos.length);
  };

  const handlePhotoMouseMove = (event) => {
    updatePhotoFromPointer(event.clientX);
  };

  const handlePhotoMouseLeave = () => {
    if (!hasMultiplePhotos) return;
    setActivePhotoIndex(0);
  };

  const handlePhotoTouchMove = (event) => {
    if (!event.touches?.length) return;
    updatePhotoFromPointer(event.touches[0].clientX);
  };

  const handlePhotoTouchEnd = () => {
    if (!hasMultiplePhotos) return;
    setActivePhotoIndex(0);
  };

  // prices
  const tradeTypeInfo = useMemo(() => resolveTradeType(l), [l]);
  const timing = useMemo(() => computeTradeTiming(l), [l]);
  const listingKind = tradeTypeInfo?.kind || null;

  const currency = l.currency || 'RUB';
  const startPriceRaw = l.start_price ?? pickDetailValue(l, ['start_price', 'startPrice', 'initial_price']);
  const currentPriceRaw = l.current_price ?? pickDetailValue(l, ['current_price', 'currentPrice', 'price']);
  const minPriceRaw = l.min_price ?? pickDetailValue(l, ['min_price', 'minimal_price', 'price_min', 'minimum_price']);
  const stepRaw = pickDetailValue(l, ['auction_step', 'price_step', 'step', 'bid_step', 'bid_increment', 'increase_step', 'step_value']);
  const depositRaw = pickDetailValue(l, ['deposit', 'deposit_amount', 'zadatok', 'pledge', 'bail', 'guarantee']);

  const numericStart = normalizeNumber(startPriceRaw);
  const numericCurrent = normalizeNumber(currentPriceRaw);
  const numericMin = normalizeNumber(minPriceRaw);
  const numericStep = normalizeNumber(stepRaw);
  const numericDeposit = normalizeNumber(depositRaw);

  // исправленный блок расчёта цен
  let primaryValue = numericCurrent ?? numericStart;
  let primaryLabel = numericCurrent != null ? 'Текущая цена' : 'Начальная цена';
  let secondaryValue = null;
  let secondaryLabel = null;

  if (listingKind === 'open_auction') {
    primaryValue = numericStart ?? numericCurrent ?? null;
    primaryLabel = 'Начальная цена';
    if (numericStep != null) {
      secondaryValue = numericStep;
      secondaryLabel = 'Величина повышения';
    } else if (numericDeposit != null) {
      secondaryValue = numericDeposit;
      secondaryLabel = 'Задаток';
    }
  } else if (listingKind === 'public_offer') {
    if (timing?.currentPriceNumber != null) {
      primaryValue = timing.currentPriceNumber;
      primaryLabel = 'Текущая цена';
      if (numericStart != null && Math.abs(numericStart - timing.currentPriceNumber) > 1) {
        secondaryValue = numericStart;
        secondaryLabel = 'Стартовая цена';
      }
    } else if (numericCurrent != null) {
      primaryValue = numericCurrent;
      primaryLabel = 'Текущая цена';
      if (numericStart != null) {
        secondaryValue = numericStart;
        secondaryLabel = 'Стартовая цена';
      }
    } else {
      primaryValue = numericStart ?? null;
      primaryLabel = primaryValue != null ? 'Стартовая цена' : 'Цена уточняется';
    }
  } else {
    primaryValue = numericCurrent ?? numericStart ?? null;
    primaryLabel = numericCurrent != null ? 'Текущая цена' : 'Начальная цена';
    if (numericMin != null && (primaryValue == null || numericMin < primaryValue)) {
      secondaryValue = numericMin;
      secondaryLabel = 'Минимальная цена';
    }
  }

  const priceLabel = formatPrice(primaryValue, currency);
  const shouldShowSecondaryPrice =
    secondaryValue != null && (
      primaryValue == null ||
      Math.abs(secondaryValue - primaryValue) > 1 ||
      (listingKind === 'public_offer' && secondaryLabel === 'Стартовая цена')
    );

  const secondaryPriceLabel = shouldShowSecondaryPrice ? formatPrice(secondaryValue, currency) : null;

  // eyebrow

  // eyebrow: Тип • Регион • Год
  const region = l.region || pickDetailValue(l, ['region']);
  const locationLabel = [l.city, region]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean)
    .join(', ');
  const rawType = l.trade_type_resolved ?? l.trade_type ?? pickDetailValue(l, ['trade_type', 'type']);
  const tradeType = tradeTypeInfo?.label || l.trade_type_label || tradeTypeLabel(rawType) || 'Лот';
  const fallbackYear = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const additionalEyebrow = listingKind ? buildAdditionalEyebrow(l, tradeTypeInfo) : null;
  const eyebrow = tradeType || additionalEyebrow || null;

  // description (короткий)
  const description =
    l.description ||
    l.details?.lot_details?.description ||
    l.details?.description ||
    '';
  const shortDescription = description ? (description.length > 220 ? `${description.slice(0, 217)}…` : description) : '';

  // даты
  const fallbackDateFinish = pickDetailValue(l, [
    'datefinish', 'dateFinish', 'date_end', 'dateEnd', 'date_to', 'end_date', 'dateFinishRu'
  ]);
  const dateFinish = timing?.currentPeriod?.end
    || timing?.applicationDeadline
    || timing?.finishDate
    || fallbackDateFinish;
  const dateFinishLabel = formatRuDateTime(dateFinish);
  const stageLabel = timing?.currentPeriodIndex != null && timing?.periodsCount
    ? `Этап ${timing.currentPeriodIndex + 1} из ${timing.periodsCount}`
    : null;

  // статус лота
  const rawStatus = extractLotStatus(l);
  const statusInfo = timing?.status || (rawStatus ? classifyStatus(rawStatus) : null);

  // общий сброс «таблеток»
  const resetPill = { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', padding: 0 };

  const baseStyles = `
    .listing-card * { box-sizing: border-box; }

    /* Удаляем любые "таблетки" у цены */
    .listing-card .listing-card__price,
    .listing-card .listing-card__price * {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      outline: none !important;
    }

    /* Ховер-эффект для кнопки "Подробнее" */
    .btn-more {
      transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
    }
    .btn-more:hover {
      transform: scale(1.03);
      box-shadow: 0 8px 20px rgba(30, 144, 255, .35);
      filter: brightness(1.03);
    }

    @media (max-width: 900px) {
      .listing-card:not(.listing-card--compact) > div { grid-template-columns: 1fr; }
    }
  `;

  // Навигация по клику на всю карточку
  const handleCardClick = () => {
    if (detailHref) router.push(detailHref);
  };
  const handleCardKey = (e) => {
    if (!detailHref) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(detailHref);
      return;
    }
    if (e.key === 'ArrowLeft' && hasMultiplePhotos) {
      e.preventDefault();
      showPreviousPhoto();
    }
    if (e.key === 'ArrowRight' && hasMultiplePhotos) {
      e.preventDefault();
      showNextPhoto();
    }
  };

  const articleHoverStyle = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: isHovered ? '0 10px 26px rgba(15,23,42,0.15)' : '0 1px 2px rgba(15,23,42,0.06)',
    transition: 'box-shadow .2s ease, transform .2s ease',
    transform: isHovered ? 'translateY(-2px)' : 'none',
    overflow: 'hidden',
    width: '100%',
    cursor: detailHref ? 'pointer' : 'default',
  };

  const compactArticleStyle = {
    ...articleHoverStyle,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const defaultArticleStyle = {
    ...articleHoverStyle,
    gridColumn: '1 / -1',
  };

  if (isCompact) {
    return (
      <article
        className="listing-card listing-card--compact"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleCardClick}
        onKeyDown={handleCardKey}
        role={detailHref ? 'link' : undefined}
        tabIndex={detailHref ? 0 : -1}
        style={compactArticleStyle}
      >
        <div
          ref={photoContainerRef}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#0f172a',
            paddingTop: '66%',
          }}
          onMouseMove={handlePhotoMouseMove}
          onMouseLeave={handlePhotoMouseLeave}
          onTouchMove={handlePhotoTouchMove}
          onTouchEnd={handlePhotoTouchEnd}
        >
          {photo ? (
            <img
              src={photo}
              alt={l.title || 'Фото лота'}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9aa7b8', fontWeight: 600 }}>
              Нет фото
            </div>
          )}

          {tradeType ? (
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(15,23,42,0.85)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              }}
            >
              {tradeType}
            </span>
          ) : null}

          {hasMultiplePhotos ? (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                display: 'flex',
                gap: 6,
                pointerEvents: 'none',
              }}
            >
              {photos.map((_, index) => (
                <div
                  key={`indicator-${index}`}
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 999,
                    background: index === activePhotoIndex ? '#2563eb' : 'rgba(255,255,255,0.55)',
                    opacity: index === activePhotoIndex ? 1 : 0.65,
                    transition: 'background 0.2s ease, opacity 0.2s ease',
                  }}
                />
              ))}
            </div>
          ) : null}

          {onFav ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFav(); }}
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: fav ? '#f59e0b' : '#64748b',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
              }}
              aria-label={fav ? 'Удалить из избранного' : 'Добавить в избранное'}
            >
              <span aria-hidden="true">{fav ? '★' : '☆'}</span>
              <span>{fav ? 'В избранном' : 'В избранное'}</span>
            </button>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 12, padding: '16px 16px 18px', flex: '1 1 auto' }}>
          {eyebrow ? (
            <div style={{ ...resetPill, color: '#1E90FF', fontWeight: 600, fontSize: 12, letterSpacing: 0.2 }}>
              {eyebrow}
            </div>
          ) : null}

          <h3 style={{ ...resetPill, margin: 0, fontSize: 18, lineHeight: 1.35, color: '#0f172a' }}>
            {l.title || 'Лот'}
          </h3>

          {shortDescription ? (
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, maxHeight: '3.9em', overflow: 'hidden' }}>
              {shortDescription}
            </div>
          ) : null}

          {locationLabel ? (
            <div style={{ fontSize: 13, color: '#475569' }}>{locationLabel}</div>
          ) : null}

          {(statusInfo || stageLabel || dateFinishLabel) ? (
            <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
              {statusInfo ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: statusInfo.color || '#64748b', display: 'inline-block' }} />
                  <span>{statusInfo.label}</span>
                </div>
              ) : null}
              {stageLabel ? (
                <div>
                  Этап: <b>{stageLabel}</b>
                </div>
              ) : null}
              {dateFinishLabel ? (
                <div>
                  До: <b>{dateFinishLabel}</b>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{primaryLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>{priceLabel}</div>
            </div>
            {secondaryPriceLabel && secondaryLabel ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{secondaryLabel}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e11d48' }}>{secondaryPriceLabel}</div>
              </div>
            ) : null}
          </div>

          {sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: 'auto',
                fontSize: 13,
                fontWeight: 600,
                color: '#1d4ed8',
                textDecoration: 'none',
              }}
            >
              Перейти к источнику →
            </a>
          ) : null}
        </div>
        <style jsx>{baseStyles}</style>
      </article>
    );
  }

  return (
    <article
      className="listing-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      role={detailHref ? 'link' : undefined}
      tabIndex={detailHref ? 0 : -1}
      style={defaultArticleStyle}
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
          ref={photoContainerRef}
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            background: '#e6eef8',
            position: 'relative',
            minHeight: 160,
            paddingTop: '75%',
            aspectRatio: '4 / 3',
          }}
          onMouseMove={handlePhotoMouseMove}
          onMouseLeave={handlePhotoMouseLeave}
          onTouchMove={handlePhotoTouchMove}
          onTouchEnd={handlePhotoTouchEnd}
        >
          {photo ? (
            <img
              src={photo}
              alt={l.title || 'Фото лота'}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9aa7b8', fontWeight: 600 }}>
              Нет фото
            </div>
          )}

          {hasMultiplePhotos ? (
            <div
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 12,
                display: 'flex',
                gap: 6,
                pointerEvents: 'none',
              }}
            >
              {photos.map((_, index) => (
                <div
                  key={`indicator-${index}`}
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 999,
                    background: index === activePhotoIndex ? '#2563eb' : 'rgba(255,255,255,0.55)',
                    opacity: index === activePhotoIndex ? 1 : 0.65,
                    transition: 'background 0.2s ease, opacity 0.2s ease',
                  }}
                />
              ))}
            </div>
          ) : null}

          {/* Избранное — не даём клику всплыть к карточке */}
          {onFav ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFav(); }}
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: fav ? '#f59e0b' : '#64748b',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
              }}
              aria-label={fav ? 'Удалить из избранного' : 'Добавить в избранное'}
            >
              <span aria-hidden="true">{fav ? '★' : '☆'}</span>
              <span>{fav ? 'В избранном' : 'В избранное'}</span>
            </button>
          ) : null}
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

          <div style={{ fontSize: 13, color: '#64748b' }}>
            {l.number ? <span style={{ marginRight: 8 }}>№{l.number}</span> : null}
            {l.lot_number ? <span style={{ marginRight: 8 }}>Лот №{l.lot_number}</span> : null}
          </div>

          {shortDescription ? (
            <div style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'pre-line' }}>{shortDescription}</div>
          ) : null}

          {/* дата + регион */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 8 }}>
            {(stageLabel || dateFinishLabel) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#0f172a' }}>
                {stageLabel ? (
                  <span>
                    Текущий этап: <b>{stageLabel}</b>
                  </span>
                ) : null}
                {dateFinishLabel ? (
                  <span>
                    До: <b>{dateFinishLabel}</b>
                  </span>
                ) : null}
              </div>
            ) : null}
            {region ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#1E90FF', display: 'inline-block' }} />
                {region}
              </div>
            ) : null}
          </div>

          {/* статус лота */}
          {statusInfo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: statusInfo.color, display: 'inline-block' }} />
              <span>Статус лота: <b>{statusInfo.label}</b></span>
            </div>
          ) : null}
        </div>

        {/* правая колонка: цены и действия */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr auto', alignContent: 'start', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...resetPill, fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>{priceLabel}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{primaryLabel}</div>
          </div>

          {secondaryPriceLabel && secondaryLabel ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...resetPill, fontSize: 16, fontWeight: 800, color: '#e11d48' }}>{secondaryPriceLabel}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{secondaryLabel}</div>
            </div>
          ) : null}

          <div />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {detailHref ? (
              <button
                type="button"
                className="btn-more"
                onClick={(e) => { e.stopPropagation(); router.push(detailHref); }}
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
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Подробнее
              </button>
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
              
      <style jsx>{baseStyles}</style>
      
    </article>
  );
}
