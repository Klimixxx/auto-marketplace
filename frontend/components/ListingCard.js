import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  localizeListingBadge,
  translateValueByKey,
} from '../lib/lotFormatting';
import { formatTradeTypeLabel, normalizeTradeTypeCode } from '../lib/tradeTypes';

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
  'auction_type',
  'auctionType',
  'format',
  'kind',
];

function collectTypeStrings(source, out) {
  if (!source && source !== 0) return;
  if (typeof source === 'string' || typeof source === 'number') {
    const text = String(source).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(source)) {
    source.forEach((item) => collectTypeStrings(item, out));
    return;
  }
  if (typeof source === 'object') {
    for (const key of TYPE_FIELD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        collectTypeStrings(source[key], out);
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
  push(lot);
  push(lot?.additional_data);
  push(lot?.additionalData);

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

  return { kind, label, candidates: normalized };
}

const ADDITIONAL_DATA_KEYS = [
  'additional_data',
  'additionalData',
  'additional',
  'additional_info',
  'additionalInformation',
  'extra',
  'extra_data',
  'extraData',
  'characteristics',
  'short_characteristics',
  'main_characteristics',
  'specifications',
  'specs',
  'vehicle_info',
  'car_info',
  'parameters',
  'params',
  'car_params',
  'tech_data',
  'tech_characteristics',
  'technical_data',
  'technical_characteristics',
  'key_parameters',
  'consumer_properties',
];

const LABEL_KEYWORDS_TO_SKIP = [
  'пробег',
  'мощност',
  'horse',
  'power',
  'кпп',
  'короб',
  'трансмис',
  'привод',
  'топлив',
  'двигател',
  'fuel',
  'engine',
  'vin',
  'кузов',
  'л.с',
  'лс',
  'квт',
  'акпп',
  'вариатор',
  'robot',
  'автомат',
  'год',
];

function appendUnit(text, unit) {
  if (!text || !unit) return text;
  const trimmed = String(text).trim();
  const unitLower = String(unit).trim().toLowerCase();
  if (!unitLower) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes(unitLower)) return trimmed;
  return `${trimmed} ${unit}`.trim();
}

function formatAdditionalPair(label, rawValue, unit) {
  if (rawValue == null || rawValue === '') return null;

  let text = null;
  if (typeof rawValue === 'number') {
    text = formatPriceNumber(rawValue);
  } else if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const numeric = normalizeNumber(trimmed);
    const digitsOnly = trimmed.replace(/[0-9.,\s-]/g, '') === '';
    if (numeric != null && digitsOnly) {
      text = formatPriceNumber(numeric);
    } else {
      text = trimmed;
    }
  } else {
    return null;
  }

  const lowerLabel = label ? String(label).trim().toLowerCase() : '';
  if (unit) {
    text = appendUnit(text, unit);
  } else if (lowerLabel) {
    if (lowerLabel.includes('пробег') || lowerLabel.includes('км')) {
      text = appendUnit(text, 'км');
    } else if (lowerLabel.includes('л.с') || lowerLabel.includes('лс') || lowerLabel.includes('мощност') || lowerLabel.includes('horse') || lowerLabel.includes('power')) {
      text = appendUnit(text, 'л.с.');
    } else if (lowerLabel.includes('квт') || lowerLabel.includes('kw')) {
      text = appendUnit(text, 'кВт');
    }
  }

  if (!lowerLabel || LABEL_KEYWORDS_TO_SKIP.some((kw) => lowerLabel.includes(kw))) {
    return text.replace(/\s+/g, ' ').trim();
  }

  const normalizedLabel = String(label).trim();
  if (!normalizedLabel) return text.replace(/\s+/g, ' ').trim();

  const lowerText = text.toLowerCase();
  if (lowerText.includes(lowerLabel)) {
    return text.replace(/\s+/g, ' ').trim();
  }

  return `${normalizedLabel} ${text}`.replace(/\s+/g, ' ').trim();
}

function normalizeAdditionalEntry(entry, defaultLabel = null) {
  if (entry == null || entry === '') return null;

  if (typeof entry === 'string' || typeof entry === 'number') {
    return formatAdditionalPair(defaultLabel, entry);
  }

  if (typeof entry === 'object') {
    const label = entry.label ?? entry.name ?? entry.title ?? entry.caption ?? entry.key ?? entry.type ?? entry.property ?? defaultLabel;
    const unit = entry.unit ?? entry.units ?? entry.measure ?? entry.suffix ?? entry.postfix ?? null;
    let value = entry.value ?? entry.amount ?? entry.val ?? entry.text ?? entry.content ?? entry.info ?? entry.data ?? entry.description ?? entry.value_text ?? entry.price ?? entry.price_value ?? null;

    if (Array.isArray(value)) {
      const normalized = value.map((v) => normalizeAdditionalEntry(v, label)).filter(Boolean);
      if (normalized.length) return normalized.join(', ');
      value = null;
    }

    if (value == null || value === '') {
      const entries = Object.entries(entry).filter(([key]) => !['label', 'name', 'title', 'caption', 'key', 'type', 'property', 'unit', 'units', 'measure', 'suffix', 'postfix', 'value', 'val', 'amount', 'text', 'content', 'info', 'data', 'description', 'value_text', 'price', 'price_value'].includes(key));
      const nested = entries.map(([key, val]) => normalizeAdditionalEntry(val, key)).filter(Boolean);
      if (nested.length) return nested.join(', ');
      return null;
    }

    return formatAdditionalPair(label, value, unit);
  }

  return null;
}

function extractAdditionalData(listing) {
  const result = [];
  const seen = new Set();

  const push = (value, label) => {
    const formatted = normalizeAdditionalEntry(value, label);
    if (!formatted) return;
    const normalized = formatted.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  };

  const lotDetails = listing?.details?.lot_details || {};
  const details = listing?.details && typeof listing.details === 'object' ? listing.details : {};

  const sources = [lotDetails, details, listing];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ADDITIONAL_DATA_KEYS) {
      if (!(key in source)) continue;
      const value = source[key];
      if (value == null || value === '') continue;
      if (Array.isArray(value)) {
        value.forEach((entry) => push(entry));
      } else {
        push(value);
      }
    }
  }

  const fallbackPairs = [
    ['engine_power', 'Мощность'],
    ['power_hp', 'Мощность'],
    ['horsepower', 'Мощность'],
    ['power', 'Мощность'],
    ['mileage', 'Пробег'],
    ['probeg', 'Пробег'],
    ['run', 'Пробег'],
    ['mileage_km', 'Пробег'],
    ['mileage_value', 'Пробег'],
    ['transmission', 'Коробка передач'],
    ['transmission_type', 'Коробка передач'],
    ['gearbox', 'Коробка передач'],
    ['kpp', 'Коробка передач'],
    ['drive', 'Привод'],
    ['drive_type', 'Привод'],
    ['wheel', 'Руль'],
    ['steering', 'Руль'],
    ['fuel', 'Топливо'],
    ['fuel_type', 'Топливо'],
    ['engine', 'Двигатель'],
    ['engine_type', 'Двигатель'],
  ];

  for (const [key, label] of fallbackPairs) {
    const value = pickDetailValue(listing, [key]);
    if (value != null && value !== '') push(value, label);
  }

  return result;
}

function buildAdditionalEyebrow(listing, tradeTypeInfo) {
  const parts = [];
  const seen = new Set();
  const push = (value) => {
    if (!value && value !== 0) return;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(text);
  };

  if (tradeTypeInfo?.label) push(tradeTypeInfo.label);

  const brand = listing?.brand || pickDetailValue(listing, ['brand']);
  const model = listing?.model || pickDetailValue(listing, ['model']);
  const titleLine = [brand, model].filter(Boolean).join(' ');
  if (titleLine) push(titleLine);

  const year = pickDetailValue(listing, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  if (year) push(`${year} г.`);

  const additionalEntries = extractAdditionalData(listing);
  additionalEntries.forEach(push);

  return parts.join(' • ');
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
  if (lower.includes('заверш')) return { label: 'Торги завершены', color: '#dc2626' }; // red
  if (/(открыт|открыта|при[её]м|заявок)/i.test(lower)) return { label: 'Открыт прием заявок', color: '#16a34a' }; // green
  return { label: name, color: '#64748b' }; // fallback gray
}

/* ---- component --------------------------------------------------------- */

export default function ListingCard({ l, onFav, fav, detailHref, sourceHref, favoriteContext }) {
  const router = useRouter();
  const [isHovered, setHovered] = useState(false);
  const photos = useMemo(() => collectPhotos(l), [l]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => { setActivePhotoIndex(0); }, [l?.id]);

  const photo = photos[activePhotoIndex] || photos[0] || null;

  // prices
  const tradeTypeInfo = useMemo(() => resolveTradeType(l), [l]);
  const listingKind = tradeTypeInfo?.kind || null;
  const periodPriceEntries = useMemo(() => extractPeriodPrices(l), [l]);
  const minimalPeriodPrice = useMemo(() => findMinimalPeriodPrice(periodPriceEntries), [periodPriceEntries]);

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
    primaryValue = numericCurrent ?? numericStart ?? null;
    primaryLabel = numericCurrent != null ? 'Текущая цена' : 'Начальная цена';
    const minimalOfferPrice = minimalPeriodPrice ?? numericMin;
    if (minimalOfferPrice != null && (primaryValue == null || minimalOfferPrice < primaryValue)) {
      secondaryValue = minimalOfferPrice;
      secondaryLabel = 'Минимальная цена';
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
  const secondaryPriceLabel = (secondaryValue != null && (primaryValue == null || Math.abs(secondaryValue - primaryValue) > 1))
    ? formatPrice(secondaryValue, currency)
    : null;

  // eyebrow

  // eyebrow: Тип • Регион • Год
  const region = l.region || pickDetailValue(l, ['region']);
  const rawType = l.trade_type_resolved ?? l.trade_type ?? pickDetailValue(l, ['trade_type', 'type']);
  const tradeType = tradeTypeInfo?.label || l.trade_type_label || tradeTypeLabel(rawType) || 'Лот';
  const fallbackYear = pickDetailValue(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const additionalEyebrow = listingKind ? buildAdditionalEyebrow(l) : null;
  const eyebrow = additionalEyebrow || [tradeType, region, fallbackYear ? `${fallbackYear} г.` : null].filter(Boolean).join(' • ');
  

  // description (короткий)
  const description =
    l.description ||
    l.details?.lot_details?.description ||
    l.details?.description ||
    '';
  const shortDescription = description ? (description.length > 220 ? `${description.slice(0, 217)}…` : description) : '';

  // даты
  const dateFinish = pickDetailValue(l, [
    'datefinish', 'dateFinish', 'date_end', 'dateEnd', 'date_to', 'end_date', 'dateFinishRu'
  ]);
  const dateFinishLabel = formatRuDateTime(dateFinish);

  // статус лота
  const rawStatus = extractLotStatus(l);
  const statusInfo = rawStatus ? classifyStatus(rawStatus) : null;

  // общий сброс «таблеток»
  const resetPill = { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', padding: 0 };

  // Навигация по клику на всю карточку
  const handleCardClick = () => {
    if (detailHref) router.push(detailHref);
  };
  const handleCardKey = (e) => {
    if (!detailHref) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(detailHref);
    }
  };

  return (
    <article
      className="listing-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      role={detailHref ? 'link' : undefined}
      tabIndex={detailHref ? 0 : -1}
      style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: isHovered ? '0 10px 26px rgba(15,23,42,0.15)' : '0 1px 2px rgba(15,23,42,0.06)',
        transition: 'box-shadow .2s ease, transform .2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        overflow: 'hidden',
        gridColumn: '1 / -1',
        width: '100%',
        cursor: detailHref ? 'pointer' : 'default',
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

      {/* локальные стили */}
      <style jsx>{`
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
          .listing-card > div { grid-template-columns: 1fr; }
        }
      `}</style>
    </article>
  );
}
