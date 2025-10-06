// pages/admin/listings/[id].js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  makeKeyValueEntries,
  translateValueByKey,
} from '../../../lib/lotFormatting';
import { normalizeTradeTypeCode } from '../../../lib/tradeTypes';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

function readToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

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

function ensureAbsoluteFileUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : undefined);
  if (!base) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return trimmed;
  }
}

function normalizeFedresursCandidate(candidate) {
  if (!candidate) return null;
  const text = String(candidate).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (!lower.includes('fedresurs')) return null;
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return text;
  }
  if (lower.startsWith('//')) {
    return `https:${text}`;
  }
  if (lower.startsWith('www.')) {
    return `https://${text}`;
  }
  return `https://${text.replace(/^\/+/, '')}`;
}

function resolveFedresursUrl(trade) {
  if (!trade) return null;
  const meta = trade.raw_payload?.fedresurs_data || trade.fedresurs_meta || {};
  const candidates = [
    trade.fedresurs_url,
    trade.fedresursUrl,
    trade.source_url,
    trade.sourceUrl,
    trade.lot_details?.fedresurs_url,
    trade.lot_details?.source_url,
    meta?.url,
    meta?.link,
    meta?.card_url,
    meta?.cardUrl,
    meta?.trade_url,
    meta?.tradeUrl,
    meta?.possible_url,
    meta?.possibleUrl,
    meta?.document_url,
    meta?.documentUrl,
    meta?.links?.card,
    meta?.links?.detail,
    meta?.links?.self,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeFedresursCandidate(candidate);
    if (normalized) return normalized;
  }

  const idCandidates = [
    trade.fedresurs_id,
    trade.fedresursId,
    meta?.guid,
    meta?.number,
    meta?.id,
  ];
  for (const idCandidate of idCandidates) {
    const text = idCandidate != null ? String(idCandidate).trim() : '';
    if (!text) continue;
    return `https://fedresurs.ru/trade/${encodeURIComponent(text)}`;
  }
  return null;
}

const LOT_DETAIL_ALIASES = {
  object_name: 'title',
  objectName: 'title',
  object_title: 'title',
  objectTitle: 'title',
  lot_name: 'title',
  lotName: 'title',
  item_name: 'asset_name',
  itemName: 'asset_name',
  asset_name: 'asset_name',
  assetName: 'asset_name',
  asset_full_name: 'asset_name',
  assetFullName: 'asset_name',
  asset_title: 'asset_name',
  assetTitle: 'asset_name',
  full_name: 'asset_name',
  fullName: 'asset_name',
  name: 'asset_name',
  lotNumber: 'lot_number',
  lot_no: 'lot_number',
  lotNo: 'lot_number',
  inventoryNumber: 'inventory_number',
  inventory_no: 'inventory_number',
  inventoryNo: 'inventory_number',
  mileage_km: 'mileage',
  mileageKm: 'mileage',
  mileage_value: 'mileage',
  mileageValue: 'mileage',
  run: 'mileage',
  probeg: 'mileage',
  engine_capacity: 'engine_volume',
  engineCapacity: 'engine_volume',
  engineVolume: 'engine_volume',
  engine_volume_l: 'engine_volume',
  engine_volume_liters: 'engine_volume',
  engineVolumeLiters: 'engine_volume',
  engine_power_hp: 'engine_power',
  enginePowerHp: 'engine_power',
  engine_hp: 'engine_power',
  engineHp: 'engine_power',
  power_hp: 'engine_power',
  powerHp: 'engine_power',
  power_ps: 'engine_power',
  powerPs: 'engine_power',
  engine_power_kw: 'engine_power_kw',
  enginePowerKw: 'engine_power_kw',
  power_kw: 'engine_power_kw',
  powerKw: 'engine_power_kw',
  fuel: 'fuel_type',
  fuelType: 'fuel_type',
  transmission_type: 'transmission',
  transmissionType: 'transmission',
  gearbox: 'transmission',
  kpp: 'transmission',
  drive_type: 'drive',
  driveType: 'drive',
  drive_unit: 'drive',
  driveUnit: 'drive',
  wheel: 'steering',
  wheel_position: 'steering',
  wheelPosition: 'steering',
  steering_wheel: 'steering',
  steeringWheel: 'steering',
  steering_position: 'steering',
  steeringPosition: 'steering',
  wheel_side: 'steering',
  wheelSide: 'steering',
  steering_side: 'steering',
  steeringSide: 'steering',
  body: 'body_type',
  bodyType: 'body_type',
  color_name: 'color',
  colorName: 'color',
  doors_count: 'doors',
  doorsCount: 'doors',
  seats_count: 'seats',
  seatsCount: 'seats',
  condition_state: 'condition',
  conditionState: 'condition',
  extras_list: 'extras',
  extrasList: 'extras',
  options_list: 'options',
  optionsList: 'options',
  restrictions_list: 'restrictions',
  restrictionsList: 'restrictions',
  encumbrances_list: 'encumbrances',
  encumbrancesList: 'encumbrances',
  documents_required_list: 'documents_required',
  documentsRequired: 'documents_required',
  auctionLink: 'auction_url',
  auction_url: 'auction_url',
  sourceLink: 'source_url',
  sourceLinkUrl: 'source_url',
  tradeType: 'trade_type',
  trade_type: 'trade_type',
  startPrice: 'start_price',
  startprice: 'start_price',
  minPrice: 'min_price',
  minprice: 'min_price',
  maxPrice: 'max_price',
  maxprice: 'max_price',
  applicationCount: 'applications_count',
  applications: 'applications_count',
  application_total: 'applications_count',
};

const LOT_FIELDS_EXCLUDE = new Set([
  'title',
  'description',
  'category',
  'region',
  'brand',
  'model',
  'year',
  'vin',
  'start_price',
  'applications_count',
  'date_start',
  'date_finish',
  'trade_place',
  'source_url',
  'trade_type',
  'tradeType',
  'asset_type',
  'assetType',
  'asset_name',
  'assetName',
  'asset_title',
  'assetTitle',
  'lot_number',
  'lotNumber',
  'lot_no',
  'lotNo',
  'inventory_number',
  'inventoryNumber',
  'inventory_no',
  'inventoryNo',
  'condition',
  'condition_state',
  'conditionState',
  'extras',
  'extras_list',
  'extrasList',
  'options',
  'options_list',
  'optionsList',
  'encumbrances',
  'encumbrances_list',
  'encumbrancesList',
  'documents_required',
  'documents_required_list',
  'documentsRequired',
  'auction_url',
  'auctionLink',
  'prices',
  'documents',
  'photos',
  'period_prices',
  'periodPrices',
  'price_schedule',
  'priceSchedule',
  'offer_schedule',
  'price_graph',
  'price_schedule_text',
  'schedule',
  'contact_details',
  'debtor_details',
  'raw_payload',
  'object_name',
  'objectName',
  'object_title',
  'lot_name',
  'lotName',
  'item_name',
  'itemName',
  'asset_title',
  'assetTitle',
  'name',
]);

const LOT_FIELD_PRESETS = [];

const CONTACT_FIELDS = [
  { key: 'organizer_name', label: 'Организатор' },
  { key: 'organizer_inn', label: 'ИНН организатора' },
  { key: 'organizer_ogrn', label: 'ОГРН организатора' },
  { key: 'organizer_ogrnip', label: 'ОГРНИП организатора' },
  { key: 'organizer_type', label: 'Тип организатора' },
  { key: 'manager', label: 'Менеджер' },
  { key: 'contact_name', label: 'Контактное лицо' },
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Сайт' },
  { key: 'address', label: 'Адрес' },
  { key: 'inspection_procedure', label: 'Порядок осмотра', type: 'textarea' },
  { key: 'inspection_time', label: 'Время осмотра' },
  { key: 'inspection_dates', label: 'Даты осмотра' },
  { key: 'inspection_address', label: 'Адрес осмотра' },
];

const CONTACT_ALIASES = {
  organizer: 'organizer_name',
  organizerName: 'organizer_name',
  organizer_full_name: 'organizer_name',
  organizerFullName: 'organizer_name',
  organizer_title: 'organizer_name',
  organizerTitle: 'organizer_name',
  organisation: 'organizer_name',
  organization: 'organizer_name',
  company: 'organizer_name',
  company_name: 'organizer_name',
  companyName: 'organizer_name',
  short_name: 'organizer_name',
  shortName: 'organizer_name',
  name: 'organizer_name',
  full_name: 'organizer_name',
  fullname: 'organizer_name',
  fullName: 'organizer_name',
  inn: 'organizer_inn',
  inn_number: 'organizer_inn',
  innNumber: 'organizer_inn',
  ogrn: 'organizer_ogrn',
  ogrn_number: 'organizer_ogrn',
  ogrnNumber: 'organizer_ogrn',
  ogrnip: 'organizer_ogrnip',
  ogrn_ip: 'organizer_ogrnip',
  ogrnipNumber: 'organizer_ogrnip',
  type: 'organizer_type',
  organizer_type: 'organizer_type',
  organizerType: 'organizer_type',
  tel: 'phone',
  telephone: 'phone',
  phone_number: 'phone',
  contact: 'contact_name',
  contact_person: 'contact_name',
  manager_name: 'manager',
  representative: 'manager',
  mail: 'email',
  site: 'website',
  url: 'website',
  website_url: 'website',
};

const DEBTOR_FIELDS = [
  { key: 'debtor_name', label: 'Должник' },
  { key: 'debtor_type', label: 'Тип должника' },
  { key: 'debtor_inn', label: 'ИНН должника' },
  { key: 'debtor_ogrn', label: 'ОГРН должника' },
  { key: 'debtor_ogrnip', label: 'ОГРНИП должника' },
  { key: 'debtor_snils', label: 'СНИЛС должника' },
  { key: 'debtor_address', label: 'Адрес должника' },
  { key: 'debtor_phone', label: 'Телефон должника' },
  { key: 'debtor_email', label: 'Email должника' },
  { key: 'debtor_manager', label: 'Представитель должника' },
];

const DEBTOR_ALIASES = {
  name: 'debtor_name',
  full_name: 'debtor_name',
  fullname: 'debtor_name',
  fullName: 'debtor_name',
  short_name: 'debtor_name',
  shortName: 'debtor_name',
  debtor_full_name: 'debtor_name',
  debtorFullName: 'debtor_name',
  organization: 'debtor_name',
  organisation: 'debtor_name',
  company: 'debtor_name',
  debtor_company: 'debtor_name',
  debtorCompany: 'debtor_name',
  type: 'debtor_type',
  debtor_type: 'debtor_type',
  debtorType: 'debtor_type',
  debtor_category: 'debtor_type',
  debtorCategory: 'debtor_type',
  inn: 'debtor_inn',
  inn_number: 'debtor_inn',
  innNumber: 'debtor_inn',
  ogrn: 'debtor_ogrn',
  ogrn_number: 'debtor_ogrn',
  ogrnNumber: 'debtor_ogrn',
  ogrnip: 'debtor_ogrnip',
  ogrn_ip: 'debtor_ogrnip',
  ogrnipNumber: 'debtor_ogrnip',
  snils: 'debtor_snils',
  snils_number: 'debtor_snils',
  snilsNumber: 'debtor_snils',
  address: 'debtor_address',
  location: 'debtor_address',
  registered_address: 'debtor_address',
  registeredAddress: 'debtor_address',
  tel: 'debtor_phone',
  telephone: 'debtor_phone',
  phone: 'debtor_phone',
  phone_number: 'debtor_phone',
  mail: 'debtor_email',
  email_address: 'debtor_email',
  emailAddress: 'debtor_email',
  representative: 'debtor_manager',
  representative_name: 'debtor_manager',
  representativeName: 'debtor_manager',
  manager: 'debtor_manager',
};

function toFormString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseNumericInput(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function createLotFieldRows(lot) {
  const base = lot && typeof lot === 'object' && !Array.isArray(lot) ? { ...lot } : {};

  Object.entries(LOT_DETAIL_ALIASES).forEach(([alias, target]) => {
    if (base[alias] != null && (base[target] == null || base[target] === '')) {
      base[target] = base[alias];
    }
    if (alias in base) {
      delete base[alias];
    }
  });

  const rows = [];

  LOT_FIELD_PRESETS.forEach((preset) => {
    rows.push({
      key: preset.key,
      label: preset.label,
      type: preset.type || 'text',
      options: preset.options || null,
      placeholder: preset.placeholder,
      value: toFormString(base[preset.key]),
      numeric: Boolean(preset.numeric),
    });
  });

  return rows;
}

function sectionStateFromObject(source, fieldDefs, options = {}) {
  const base = source && typeof source === 'object' && !Array.isArray(source) ? { ...source } : {};
  const { aliases = {}, exclude = [] } = options;
  const excludeSet = new Set(exclude);

  Object.entries(aliases).forEach(([alias, target]) => {
    if (base[alias] != null && (base[target] == null || base[target] === '')) {
      base[target] = base[alias];
    }
    excludeSet.add(alias);
    if (alias in base) {
      delete base[alias];
    }
  });

  const values = {};
  fieldDefs.forEach(({ key }) => {
    values[key] = toFormString(base[key]);
    if (key in base) {
      delete base[key];
    }
  });

  const extras = [];
  Object.entries(base).forEach(([key, value]) => {
    if (excludeSet.has(key)) return;
    if (fieldDefs.some((field) => field.key === key)) return;
    extras.push({ key, value: toFormString(value) });
  });

  return { values, extras };
}

function normalizePriceHistory(prices) {
  if (!Array.isArray(prices)) return [];
  return prices.map((entry, index) => {
    const obj = entry && typeof entry === 'object' ? entry : {};
    const stage =
      obj.stage
      || obj.stage_name
      || obj.stageName
      || obj.round
      || obj.type
      || obj.name
      || obj.title
      || '';
    const price =
      obj.price
      || obj.currentPrice
      || obj.current_price
      || obj.startPrice
      || obj.start_price
      || obj.value
      || obj.amount
      || '';
    const date =
      obj.date
      || obj.date_start
      || obj.dateStart
      || obj.date_finish
      || obj.dateFinish
      || obj.updated_at
      || obj.updatedAt
      || '';
    const comment =
      obj.comment
      || obj.description
      || obj.info
      || obj.status
      || obj.note
      || '';

    const knownKeys = new Set([
      'stage', 'stage_name', 'stageName', 'round', 'type', 'name', 'title',
      'price', 'currentPrice', 'current_price', 'startPrice', 'start_price', 'value', 'amount',
      'date', 'date_start', 'dateStart', 'date_finish', 'dateFinish', 'updated_at', 'updatedAt',
      'comment', 'description', 'info', 'status', 'note',
    ]);
    const extra = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        extra[key] = value;
      }
    });

    return {
      id: obj.id || obj.code || `price-${index}`,
      stage: toFormString(stage),
      price: toFormString(price),
      date: toFormString(date),
      comment: toFormString(comment),
      extra,
    };
  });
}

function buildPriceHistoryPayload(history) {
  return history
    .filter((entry) => entry && (entry.stage || entry.price || entry.date || entry.comment))
    .map((entry) => {
      const payload = { ...entry.extra };
      if (entry.stage) payload.stage = entry.stage;
      if (entry.price) {
        const numeric = parseNumericInput(entry.price);
        payload.price = numeric != null ? numeric : entry.price;
      }
      if (entry.date) payload.date = entry.date;
      if (entry.comment) payload.comment = entry.comment;
      return payload;
    });
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  const seen = new Set();
  return documents
    .map((doc, index) => {
      const obj = doc && typeof doc === 'object' ? doc : {};
      const rawUrl =
        obj.url
        || obj.href
        || obj.link
        || obj.download_url
        || obj.path
        || obj.file
        || '';
      const absoluteUrl = rawUrl ? ensureAbsoluteFileUrl(rawUrl) : '';
      const title = toFormString(obj.title || obj.name || obj.filename || obj.originalName);
      const description = toFormString(obj.description || obj.comment || obj.note);
      const extra = { ...obj };
      delete extra.url;
      delete extra.href;
      delete extra.link;
      delete extra.download_url;
      delete extra.path;
      delete extra.file;
      delete extra.title;
      delete extra.name;
      delete extra.filename;
      delete extra.originalName;
      delete extra.description;
      delete extra.comment;
      delete extra.note;
      delete extra.id;

      const id = obj.id || absoluteUrl || `document-${index}`;
      if (absoluteUrl && seen.has(absoluteUrl)) {
        return null;
      }
      if (absoluteUrl) {
        seen.add(absoluteUrl);
      }

      return {
        id,
        title,
        description,
        url: absoluteUrl,
        extra,
      };
    })
    .filter((entry) => entry && (entry.title || entry.url || entry.description));
}

function buildDocumentsPayload(docs) {
  return docs
    .filter((doc) => doc && (doc.title || doc.url || doc.description))
    .map((doc) => {
      const payload = { ...doc.extra };
      if (doc.title) payload.title = doc.title;
      if (doc.description) payload.description = doc.description;
      if (doc.url) payload.url = doc.url;
      return payload;
    });
}

function normalizePhotosForEditing(trade) {
  const photos = [];
  const seen = new Set();
  const sources = [
    trade?.photos,
    trade?.lot_details?.photos,
    trade?.lot_details?.images,
    trade?.lot_details?.gallery,
  ];
  sources.forEach((pool) => {
    if (!Array.isArray(pool)) return;
    pool.forEach((entry) => {
      const normalized = normalizePhotoInput(entry);
      if (!normalized?.url || seen.has(normalized.url)) return;
      seen.add(normalized.url);
      photos.push({ id: normalized.url, url: normalized.url, title: normalized.title ? String(normalized.title) : '' });
    });
  });
  return photos;
}

function buildPhotosPayload(photos) {
  const list = [];
  const seen = new Set();
  photos.forEach((photo) => {
    if (!photo || !photo.url) return;
    const url = photo.url.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    const entry = { url };
    if (photo.title) entry.title = photo.title;
    list.push(entry);
  });
  return list;
}

function normalizeAuctionPricing(trade, lot) {
  const base = lot && typeof lot === 'object' ? lot : {};
  const pick = (...keys) => {
    for (const key of keys) {
      if (base[key] != null && base[key] !== '') return base[key];
      if (trade && trade[key] != null && trade[key] !== '') return trade[key];
    }
    return '';
  };

  const deadlineCandidate =
    base.application_deadline
    || base.application_deadline_date
    || base.applications_deadline
    || base.applications_deadline_date
    || trade?.application_deadline
    || trade?.applications_deadline
    || '';

  return {
    start_price: toFormString(pick('start_price', 'initial_price')), 
    current_price: toFormString(pick('current_price', 'price')), 
    min_price: toFormString(pick('min_price', 'minimal_price', 'price_min', 'minimum_price')), 
    max_price: toFormString(pick('max_price', 'maximum_price', 'price_max', 'maximumPrice')), 
    step: toFormString(pick('price_step', 'auction_step', 'step', 'bid_step', 'increase_step', 'step_value')), 
    deposit: toFormString(pick('deposit', 'deposit_amount', 'guarantee_deposit', 'zadatok', 'pledge', 'bail')), 
    currency: toFormString(pick('currency')), 
    application_deadline: toInputDate(deadlineCandidate),
  };
}

function normalizePublicOfferPeriods(lot) {
  const base = lot && typeof lot === 'object' ? lot : {};
  const pools = [
    base.period_prices,
    base.periodPrices,
    base.price_schedule,
    base.priceSchedule,
    base.offer_schedule,
    base.offerSchedule,
    base.price_graph,
    base.priceGraph,
    base.schedule,
  ];
  const periods = [];
  const seen = new Set();
  pools.forEach((pool) => {
    if (!Array.isArray(pool)) return;
    pool.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const startRaw =
        entry.date_start
        || entry.start_date
        || entry.period_start
        || entry.dateBegin
        || entry.date_from
        || entry.begin
        || entry.start
        || entry.from
        || null;
      const endRaw =
        entry.date_end
        || entry.end_date
        || entry.period_end
        || entry.dateFinish
        || entry.date_to
        || entry.finish
        || entry.end
        || entry.to
        || null;
      const priceRaw =
        entry.price
        || entry.current_price
        || entry.currentPrice
        || entry.start_price
        || entry.startPrice
        || entry.value
        || entry.amount
        || entry.price_min
        || entry.minimum_price
        || entry.min_price
        || null;
      const minPriceRaw = entry.min_price || entry.minimum_price || entry.price_min || null;
      const depositRaw =
        entry.deposit
        || entry.deposit_amount
        || entry.zadatok
        || entry.pledge
        || entry.bail
        || entry.guarantee
        || null;
      const commentRaw = entry.comment || entry.note || entry.stage || entry.stage_name || entry.description || '';
      const extra = { ...entry };
      delete extra.date_start;
      delete extra.start_date;
      delete extra.period_start;
      delete extra.dateBegin;
      delete extra.date_from;
      delete extra.begin;
      delete extra.start;
      delete extra.from;
      delete extra.date_end;
      delete extra.end_date;
      delete extra.period_end;
      delete extra.dateFinish;
      delete extra.date_to;
      delete extra.finish;
      delete extra.end;
      delete extra.to;
      delete extra.price;
      delete extra.current_price;
      delete extra.currentPrice;
      delete extra.start_price;
      delete extra.startPrice;
      delete extra.value;
      delete extra.amount;
      delete extra.price_min;
      delete extra.minimum_price;
      delete extra.min_price;
      delete extra.deposit;
      delete extra.deposit_amount;
      delete extra.zadatok;
      delete extra.pledge;
      delete extra.bail;
      delete extra.guarantee;
      delete extra.comment;
      delete extra.note;
      delete extra.stage;
      delete extra.stage_name;
      delete extra.description;

      const key = `${startRaw || ''}-${endRaw || ''}-${priceRaw || ''}-${depositRaw || ''}`;
      if (seen.has(key)) return;
      seen.add(key);

      periods.push({
        id: entry.id || entry.code || entry.key || `period-${periods.length}-${index}`,
        date_start: toInputDate(startRaw),
        date_end: toInputDate(endRaw),
        price: toFormString(priceRaw),
        min_price: toFormString(minPriceRaw),
        deposit: toFormString(depositRaw),
        comment: toFormString(commentRaw),
        extra,
      });
    });
  });

  return periods;
}

function buildPublicOfferPeriodsPayload(periods) {
  return periods
    .filter((period) => period && (period.date_start || period.date_end || period.price || period.min_price || period.deposit || period.comment))
    .map((period) => {
      const payload = { ...period.extra };
      if (period.date_start) payload.date_start = fromInputDate(period.date_start) || period.date_start;
      if (period.date_end) payload.date_end = fromInputDate(period.date_end) || period.date_end;
      if (period.price) {
        const numeric = parseNumericInput(period.price);
        payload.price = numeric != null ? numeric : period.price;
      }
      if (period.min_price) {
        const numericMin = parseNumericInput(period.min_price);
        payload.min_price = numericMin != null ? numericMin : period.min_price;
      }
      if (period.deposit) {
        const numericDeposit = parseNumericInput(period.deposit);
        payload.deposit = numericDeposit != null ? numericDeposit : period.deposit;
      }
      if (period.comment) payload.comment = period.comment;
      return payload;
    });
}

function lotFieldsToObject(rows, preserved = {}) {
  const base = { ...(preserved || {}) };
  rows.forEach((row) => {
    if (!row) return;
    const key = row.key != null ? String(row.key).trim() : '';
    if (!key) return;
    const rawValue = row.value;
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      delete base[key];
      return;
    }
    let value = rawValue;
    if (row.type === 'select') {
      value = String(rawValue).trim();
      if (!value) {
        delete base[key];
        return;
      }
    } else if (row.numeric) {
      const numeric = parseNumericInput(rawValue);
      value = numeric != null ? numeric : String(rawValue).trim();
      if (value === '') {
        delete base[key];
        return;
      }
    } else if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        delete base[key];
        return;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          value = JSON.parse(trimmed);
        } catch {
          value = trimmed;
        }
      } else {
        value = trimmed;
      }
    }
    base[key] = value;
  });
  return base;
}

function sectionStateToObject(section) {
  if (!section) return {};
  const result = {};
  const values = section.values || {};
  Object.entries(values).forEach(([key, value]) => {
    const normalizedKey = key != null ? String(key).trim() : '';
    if (!normalizedKey) return;
    const trimmedValue = trimOrNull(value);
    if (trimmedValue != null) {
      result[normalizedKey] = trimmedValue;
    }
  });

  (section.extras || []).forEach((entry) => {
    if (!entry) return;
    const key = entry.key != null ? String(entry.key).trim() : '';
    if (!key) return;
    const valueRaw = entry.value;
    if (valueRaw === undefined || valueRaw === null || valueRaw === '') return;
    if (typeof valueRaw === 'string') {
      const trimmed = valueRaw.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          result[key] = JSON.parse(trimmed);
          return;
        } catch {
          result[key] = trimmed;
          return;
        }
      }
      result[key] = trimmed;
      return;
    }
    result[key] = valueRaw;
  });

  return result;
}

function buildLotDetailsFromState(
  lotFields,
  preserved,
  form,
  auctionPricing,
  publicOfferPeriods,
  options = {},
) {
  const { includeStartPrice = true, includePeriodPrices = true, includeAuctionExtras = true } = options;
  const base = lotFieldsToObject(lotFields, preserved);

  const auction = auctionPricing || {};
  if (includeStartPrice && auction.start_price) {
    const numeric = parseNumericInput(auction.start_price);
    base.start_price = numeric != null ? numeric : auction.start_price;
  } else {
    delete base.start_price;
  }
  if (includeAuctionExtras && auction.current_price) {
    const numeric = parseNumericInput(auction.current_price);
    base.current_price = numeric != null ? numeric : auction.current_price;
  } else {
    delete base.current_price;
  }
  if (includeAuctionExtras && auction.min_price) {
    const numeric = parseNumericInput(auction.min_price);
    base.min_price = numeric != null ? numeric : auction.min_price;
  } else {
    delete base.min_price;
  }
  if (includeAuctionExtras && auction.max_price) {
    const numeric = parseNumericInput(auction.max_price);
    base.max_price = numeric != null ? numeric : auction.max_price;
  } else {
    delete base.max_price;
  }
  if (includeAuctionExtras && auction.step) {
    const numeric = parseNumericInput(auction.step);
    const stepValue = numeric != null ? numeric : String(auction.step).trim();
    base.price_step = stepValue;
    base.auction_step = stepValue;
  } else {
    delete base.price_step;
    delete base.auction_step;
  }
  if (includeAuctionExtras && auction.deposit) {
    const numeric = parseNumericInput(auction.deposit);
    base.deposit = numeric != null ? numeric : auction.deposit;
  } else {
    delete base.deposit;
  }
  if (includeAuctionExtras) {
    if (auction.currency) {
      base.currency = String(auction.currency).trim();
    } else {
      delete base.currency;
    }
  } else {
    delete base.currency;
  }

  if (auction.application_deadline) {
    base.application_deadline = fromInputDate(auction.application_deadline) || auction.application_deadline;
  } else {
    delete base.application_deadline;
  }

  const periodsPayload = includePeriodPrices ? buildPublicOfferPeriodsPayload(publicOfferPeriods || []) : [];
  if (includePeriodPrices && periodsPayload.length) {
    base.period_prices = periodsPayload;
    base.price_schedule = periodsPayload;
  } else {
    delete base.period_prices;
    delete base.price_schedule;
  }

  const synced = syncLotDetailsWithForm(base, form, { includeStartPrice });
  return synced;
}

const LOT_DETAIL_SYNC_MAP = {
  title: 'title',
  description: 'description',
  category: 'category',
  region: 'region',
  brand: 'brand',
  model: 'model',
  year: 'year',
  vin: 'vin',
  start_price: 'start_price',
  applications_count: 'applications_count',
  trade_place: 'trade_place',
  source_url: 'source_url',
};

function syncLotDetailsWithForm(lot, form, options = {}) {
  const { includeStartPrice = true } = options;
  const base = lot && typeof lot === 'object' && !Array.isArray(lot) ? { ...lot } : {};
  if (!form || typeof form !== 'object') return base;

  Object.entries(LOT_DETAIL_SYNC_MAP).forEach(([formKey, lotKey]) => {
    if (!(formKey in form)) return;
    const value = form[formKey];
    if (lotKey === 'start_price' && !includeStartPrice) {
      delete base[lotKey];
      return;
    }
    if (value === '' || value === null || value === undefined) {
      delete base[lotKey];
      return;
    }

    if (lotKey === 'start_price') {
      const numeric = Number(String(value).replace(/\s/g, '').replace(',', '.'));
      base[lotKey] = Number.isFinite(numeric) ? numeric : value;
      return;
    }

    if (lotKey === 'applications_count') {
      const numeric = Number(value);
      base[lotKey] = Number.isFinite(numeric) ? numeric : value;
      return;
    }

    if (typeof value === 'string') {
      const trimmed = trimOrNull(value);
      if (trimmed == null) {
        delete base[lotKey];
        return;
      }
      base[lotKey] = trimmed;
      return;
    }

    base[lotKey] = value;
  });

  return base;
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
  const entries = makeKeyValueEntries(data);
  if (!entries.length) return null;

  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
      {entries.map(({ key, value }, index) => {
        const isMultiline = typeof value === 'string' && value.includes('\n');
        return (
          <div key={`${key}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
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

// ── page ──────────────────────────────────────────────────────────────────────
export default function AdminParserTradeCard() {
  const router = useRouter();
  const { id } = router.query;
  const viewQuery = Array.isArray(router.query?.view) ? router.query.view[0] : router.query?.view;
  const backLinkHref = viewQuery === 'published'
    ? { pathname: '/admin/listings', query: { view: 'published' } }
    : '/admin/listings';

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(null);
  const [lotFields, setLotFields] = useState([]);
  const [lotPreserved, setLotPreserved] = useState({});
  const [contactState, setContactState] = useState({ values: {}, extras: [] });
  const [debtorState, setDebtorState] = useState({ values: {}, extras: [] });
  const [priceHistory, setPriceHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [auctionPricing, setAuctionPricing] = useState({
    start_price: '',
    current_price: '',
    min_price: '',
    max_price: '',
    step: '',
    deposit: '',
    currency: '',
    application_deadline: '',
  });
  const [publicOfferPeriods, setPublicOfferPeriods] = useState([]);
  const [publicOfferPriceMode, setPublicOfferPriceMode] = useState('start_price');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const singleFileInputRef = useRef(null);
  const multipleFileInputRef = useRef(null);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [documentUploadError, setDocumentUploadError] = useState(null);
  const documentFileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [updatingPublication, setUpdatingPublication] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState(null);

  const applyTrade = useCallback((trade) => {
    if (!trade) return;
    setItem(trade);
    
    const lotDetails = trade.lot_details && typeof trade.lot_details === 'object' ? trade.lot_details : {};

    setForm({
      title: trade.title || lotDetails.title || lotDetails.object_name || '',
      description: trade.description || lotDetails.description || '',
      category: trade.category || lotDetails.category || '',
      region: trade.region || lotDetails.region || '',
      brand: trade.brand || lotDetails.brand || '',
      model: trade.model || lotDetails.model || '',
      year: trade.year || lotDetails.year || '',
      vin: trade.vin || lotDetails.vin || '',
      start_price: trade.start_price ?? lotDetails.start_price ?? '',
      applications_count: trade.applications_count ?? 0,
      date_start: toInputDate(trade.date_start || trade.dateStart),
      date_finish: toInputDate(trade.date_finish || trade.dateFinish),
      trade_place: trade.trade_place || trade.tradePlace || lotDetails.trade_place || '',
      source_url: trade.source_url || trade.url || trade.source || '',
    });

    const rows = createLotFieldRows(lotDetails);
    const preserved = {};
    Object.entries(lotDetails || {}).forEach(([key, value]) => {
      if (LOT_FIELDS_EXCLUDE.has(key)) {
        preserved[key] = value;
      }
    });
    setLotFields(rows);
    setLotPreserved(preserved);

    setContactState(sectionStateFromObject(trade.contact_details, CONTACT_FIELDS, { aliases: CONTACT_ALIASES }));
    setDebtorState(sectionStateFromObject(trade.debtor_details, DEBTOR_FIELDS, { aliases: DEBTOR_ALIASES }));
    setPriceHistory(normalizePriceHistory(trade.prices));
    setDocuments(normalizeDocuments(trade.documents));
    setPhotos(normalizePhotosForEditing(trade));
    setAuctionPricing(normalizeAuctionPricing(trade, lotDetails));
    const normalizedPeriods = normalizePublicOfferPeriods(lotDetails);
    setPublicOfferPeriods(normalizedPeriods);
    setPublicOfferPriceMode(normalizedPeriods.length > 0 ? 'period_price' : 'start_price');
    setUploadError(null);
    setUploadingPhotos(false);
    setDocumentUploadError(null);
    setUploadingDocuments(false);
  }, []);

  // fetch trade
  useEffect(() => {
    if (!id) return;
    let aborted = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (!API_BASE) {
          throw new Error('NEXT_PUBLIC_API_BASE не задан.');
        }
        const token = readToken();
        if (!token) {
          throw new Error('Требуется авторизация администратора.');
        }

        const url = `${API_BASE}/api/admin/parser-trades/${id}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (res.status === 404) {
          if (!aborted) {
            setItem(null);
            setError('Лот не найден или удалён.');
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
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

  const triggerSingleUpload = useCallback(() => {
    setUploadError(null);
    singleFileInputRef.current?.click();
  }, []);

  const triggerMultipleUpload = useCallback(() => {
    setUploadError(null);
    multipleFileInputRef.current?.click();
  }, []);

  const uploadPhotos = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;
      if (!id) {
        alert('Сначала сохраните объявление, чтобы добавить фотографии.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Требуется авторизация администратора.');
        return;
      }

      setUploadingPhotos(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        files.forEach((file) => {
          if (file) formData.append('photos', file);
        });

        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/photos/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'Не удалось загрузить файлы');
        }

        const uploaded = Array.isArray(data.photos) ? data.photos : [];
        if (!uploaded.length) {
          throw new Error('Файлы не загружены');
        }

        const urls = uploaded
          .map((item) => ensureAbsoluteFileUrl(item.url || item.path))
          .filter(Boolean);

        if (!urls.length) {
          throw new Error('Не удалось получить ссылки на загруженные файлы');
        }

        setPhotos((prev) => {
          const previous = Array.isArray(prev) ? prev : [];
          const next = [...previous];
          const seen = new Set(previous.map((photo) => photo.url));
          uploaded.forEach((item) => {
            const url = ensureAbsoluteFileUrl(item.url || item.path);
            if (!url || seen.has(url)) return;
            seen.add(url);
            next.push({
              id: url,
              url,
              title: item.originalName || '',
            });
          });
          return next;
        });
      } catch (uploadErrorInstance) {
        console.error('upload photos error:', uploadErrorInstance);
        const message =
          uploadErrorInstance instanceof Error
            ? uploadErrorInstance.message
            : 'Не удалось загрузить файлы';
        setUploadError(message);
        alert(message);
      } finally {
        setUploadingPhotos(false);
      }
    },
    [id],
  );

  const handleSingleFileChange = useCallback(
    (event) => {
      const files = event.target?.files;
      if (files && files.length) {
        uploadPhotos(files);
      }
      if (event.target) {
        event.target.value = '';
      }
    },
    [uploadPhotos],
  );

  const handleMultipleFileChange = useCallback(
    (event) => {
      const files = event.target?.files;
      if (files && files.length) {
        uploadPhotos(files);
      }
      if (event.target) {
        event.target.value = '';
      }
    },
    [uploadPhotos],
  );

  const triggerDocumentUpload = useCallback(() => {
    setDocumentUploadError(null);
    documentFileInputRef.current?.click();
  }, []);

  const uploadDocuments = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;
      if (!id) {
        alert('Сначала сохраните объявление, чтобы добавить документы.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Требуется авторизация администратора.');
        return;
      }

      setUploadingDocuments(true);
      setDocumentUploadError(null);
      try {
        const formData = new FormData();
        files.forEach((file) => {
          if (file) formData.append('documents', file);
        });

        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/documents/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'Не удалось загрузить документы');
        }

        const uploaded = Array.isArray(data.documents) ? data.documents : [];
        if (!uploaded.length) {
          throw new Error('Файлы не загружены');
        }

        setDocuments((prev) => {
          const previous = Array.isArray(prev) ? prev : [];
          const next = [...previous];
          const seen = new Set(previous.map((doc) => doc.url).filter(Boolean));
          uploaded.forEach((item) => {
            const url = ensureAbsoluteFileUrl(item.url || item.path);
            if (!url || seen.has(url)) return;
            seen.add(url);
            next.push({
              id: url,
              url,
              title: item.originalName || item.filename || item.name || '',
              description: '',
              extra: {},
            });
          });
          return next;
        });
      } catch (uploadErrorInstance) {
        console.error('upload documents error:', uploadErrorInstance);
        const message =
          uploadErrorInstance instanceof Error
            ? uploadErrorInstance.message
            : 'Не удалось загрузить документы';
        setDocumentUploadError(message);
        alert(message);
      } finally {
        setUploadingDocuments(false);
      }
    },
    [id],
  );

  const handleDocumentFileChange = useCallback(
    (event) => {
      const files = event.target?.files;
      if (files && files.length) {
        uploadDocuments(files);
      }
      if (event.target) {
        event.target.value = '';
      }
    },
    [uploadDocuments],
  );

  const updateFormField = useCallback(
    (key) => (e) => {
      const value = e?.target?.value ?? e;
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateAuctionField = useCallback(
    (key) => (event) => {
      const value = event?.target?.value ?? event;
      setAuctionPricing((prev) => ({ ...prev, [key]: value }));
      if (key === 'start_price') {
        setForm((prev) => ({ ...(prev || {}), start_price: value }));
      }
    },
    [],
  );

  const updateLotFieldValue = useCallback((index, value) => {
    setLotFields((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], value };
      return next;
    });
  }, []);

  const updateContactValue = useCallback((key, value) => {
    setContactState((prev) => ({
      values: { ...prev.values, [key]: value },
      extras: prev.extras || [],
    }));
  }, []);

  const updateDebtorValue = useCallback((key, value) => {
    setDebtorState((prev) => ({
      values: { ...prev.values, [key]: value },
      extras: prev.extras || [],
    }));
  }, []);

  const updateContactExtra = useCallback((index, field, value) => {
    setContactState((prev) => {
      const extras = Array.isArray(prev.extras) ? [...prev.extras] : [];
      if (!extras[index]) extras[index] = { key: '', value: '' };
      extras[index] = { ...extras[index], [field]: value };
      return { values: prev.values || {}, extras };
    });
  }, []);

  const removeContactExtra = useCallback((index) => {
    setContactState((prev) => ({
      values: prev.values || {},
      extras: (prev.extras || []).filter((_, idx) => idx !== index),
    }));
  }, []);

  const addContactExtra = useCallback(() => {
    setContactState((prev) => ({
      values: prev.values || {},
      extras: [...(prev.extras || []), { key: '', value: '' }],
    }));
  }, []);

  const updateDebtorExtra = useCallback((index, field, value) => {
    setDebtorState((prev) => {
      const extras = Array.isArray(prev.extras) ? [...prev.extras] : [];
      if (!extras[index]) extras[index] = { key: '', value: '' };
      extras[index] = { ...extras[index], [field]: value };
      return { values: prev.values || {}, extras };
    });
  }, []);

  const removeDebtorExtra = useCallback((index) => {
    setDebtorState((prev) => ({
      values: prev.values || {},
      extras: (prev.extras || []).filter((_, idx) => idx !== index),
    }));
  }, []);

  const addDebtorExtra = useCallback(() => {
    setDebtorState((prev) => ({
      values: prev.values || {},
      extras: [...(prev.extras || []), { key: '', value: '' }],
    }));
  }, []);

  const updatePriceHistoryEntry = useCallback((index, patch) => {
    setPriceHistory((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const addPriceHistoryEntry = useCallback(() => {
    setPriceHistory((prev) => [
      ...prev,
      { id: `price-${Date.now()}`, stage: '', price: '', date: '', comment: '', extra: {} },
    ]);
  }, []);

  const removePriceHistoryEntry = useCallback((index) => {
    setPriceHistory((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const updatePeriodEntry = useCallback((index, patch) => {
    setPublicOfferPeriods((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const addPeriodEntry = useCallback(() => {
    setPublicOfferPeriods((prev) => [
      ...prev,
      { id: `period-${Date.now()}`, date_start: '', date_end: '', price: '', min_price: '', deposit: '', comment: '', extra: {} },
    ]);
  }, []);

  const removePeriodEntry = useCallback((index) => {
    setPublicOfferPeriods((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const movePeriodEntry = useCallback((index, direction) => {
    setPublicOfferPeriods((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const updateDocumentEntry = useCallback((index, patch) => {
    setDocuments((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const addDocumentEntry = useCallback(() => {
    setDocuments((prev) => [
      ...prev,
      { id: `document-${Date.now()}`, title: '', url: '', description: '', extra: {} },
    ]);
  }, []);

  const removeDocumentEntry = useCallback((index) => {
    setDocuments((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const updatePhotoEntry = useCallback((index, patch) => {
    setPhotos((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const updated = { ...next[index], ...patch };
      updated.id = updated.url || next[index].id;
      next[index] = updated;
      return next;
    });
  }, []);

  const addPhotoEntry = useCallback(() => {
    setPhotos((prev) => [...prev, { id: `photo-${Date.now()}`, url: '', title: '' }]);
  }, []);

  const removePhotoEntry = useCallback((index) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const movePhotoEntry = useCallback((index, direction) => {
    setPhotos((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const resetChanges = useCallback(() => {
    if (item) applyTrade(item);
  }, [item, applyTrade]);

  const descriptionPreview = useMemo(() => (form?.description || '').trim(), [form?.description]);

  const tradeType = useMemo(() => {
    const row = lotFields.find((entry) => entry.key === 'trade_type');
    if (row?.value != null && row.value !== '') {
      return String(row.value).trim();
    }
    const preservedValue =
      lotPreserved?.trade_type != null && lotPreserved.trade_type !== ''
        ? lotPreserved.trade_type
        : lotPreserved?.tradeType;
    if (preservedValue != null && preservedValue !== '') {
      return String(preservedValue).trim();
    }
    return '';
  }, [lotFields, lotPreserved]);

  const normalizedTradeType = useMemo(() => {
    const candidates = [
      tradeType,
      lotPreserved?.trade_type,
      lotPreserved?.tradeType,
      item?.trade_type,
      item?.tradeType,
      item?.lot_details?.trade_type,
      item?.lot_details?.tradeType,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeTradeTypeCode(candidate);
      if (normalized) return normalized;
    }
    return null;
  }, [item, lotPreserved, tradeType]);

  const isOpenAuction = normalizedTradeType === 'open_auction';
  const isPublicOffer = normalizedTradeType === 'public_offer';
  const isAuction = isOpenAuction || normalizedTradeType === 'auction';
  const shouldUseStartPrice = !isPublicOffer || publicOfferPriceMode === 'start_price';
  const shouldIncludePeriods = isPublicOffer && publicOfferPriceMode === 'period_price';
  const shouldIncludeAuctionExtras = true;

  useEffect(() => {
    if (!isPublicOffer && publicOfferPriceMode === 'period_price') {
      setPublicOfferPriceMode('start_price');
    }
  }, [isPublicOffer, publicOfferPriceMode]);

  const d = useMemo(() => {
    const lot = buildLotDetailsFromState(
      lotFields,
      lotPreserved,
      form,
      auctionPricing,
      publicOfferPeriods,
      {
        includeStartPrice: shouldUseStartPrice,
        includePeriodPrices: shouldIncludePeriods,
        includeAuctionExtras: shouldIncludeAuctionExtras,
      },
    );
    const contact = sectionStateToObject(contactState);
    const debtor = sectionStateToObject(debtorState);
    const pricesPayload = isOpenAuction ? [] : buildPriceHistoryPayload(priceHistory);
    const documentsPayload = buildDocumentsPayload(documents);
    const photosPayload = buildPhotosPayload(photos);

    const merged = {
      ...(item || {}),
      ...form,
      lot_details: lot,
      contact_details: contact,
      debtor_details: debtor,
      prices: pricesPayload,
      documents: documentsPayload,
      photos: photosPayload,
    };

    if (item?.raw_payload) merged.raw_payload = item.raw_payload;

    return merged;
  }, [
    item,
    form,
    lotFields,
    lotPreserved,
    contactState,
    debtorState,
    priceHistory,
    documents,
    photos,
    auctionPricing,
    publicOfferPeriods,
    shouldUseStartPrice,
    shouldIncludePeriods,
    shouldIncludeAuctionExtras,
  ]);

  const fedresursUrl = useMemo(() => resolveFedresursUrl(d || item), [d, item]);

  const saveTrade = useCallback(
    async ({ showAlert = true } = {}) => {
      if (!id) return null;
      setSaving(true);
      setError(null);
      try {
        const lotDetailsPayload = buildLotDetailsFromState(
          lotFields,
          lotPreserved,
          form,
          auctionPricing,
          publicOfferPeriods,
          {
            includeStartPrice: shouldUseStartPrice,
            includePeriodPrices: shouldIncludePeriods,
            includeAuctionExtras: shouldIncludeAuctionExtras,
          },
        );
        const contactPayload = sectionStateToObject(contactState);
        const debtorPayload = sectionStateToObject(debtorState);
        const pricesPayload = isOpenAuction ? [] : buildPriceHistoryPayload(priceHistory);
        const documentsPayload = buildDocumentsPayload(documents);
        const photosPayload = buildPhotosPayload(photos);

        const effectiveStartPrice = shouldUseStartPrice
          ? auctionPricing?.start_price && auctionPricing.start_price !== ''
            ? auctionPricing.start_price
            : form?.start_price
          : null;
        const startPriceNumeric = shouldUseStartPrice ? parseNumericInput(effectiveStartPrice) : null;
        const applicationsCountNumeric =
          form?.applications_count === '' || form?.applications_count == null
            ? 0
            : Number(form.applications_count);

        const payload = {
          ...d,
          title: trimOrNull(form?.title),
          description: trimOrNull(form?.description),
          category: trimOrNull(form?.category),
          region: trimOrNull(form?.region),
          brand: trimOrNull(form?.brand),
          model: trimOrNull(form?.model),
          year: trimOrNull(form?.year),
          vin: trimOrNull(form?.vin),
          start_price: effectiveStartPrice === '' || effectiveStartPrice == null ? null : startPriceNumeric ?? effectiveStartPrice,
          applications_count: applicationsCountNumeric,
          date_start: fromInputDate(form?.date_start),
          date_finish: fromInputDate(form?.date_finish),
          trade_place: trimOrNull(form?.trade_place),
          source_url: trimOrNull(form?.source_url),

          lot_details: lotDetailsPayload,
          contact_details: contactPayload,
          debtor_details: debtorPayload,
          prices: pricesPayload,
          documents: documentsPayload,
          photos: photosPayload,
        };

        if (!API_BASE) {
          throw new Error('NEXT_PUBLIC_API_BASE не задан.');
        }
        const token = readToken();
        if (!token) {
          throw new Error('Требуется авторизация администратора.');
        }

        const url = `${API_BASE}/api/admin/parser-trades/${id}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 404) {
          throw new Error('Лот не найден или удалён.');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json();
        applyTrade(saved);
        if (showAlert && typeof window !== 'undefined') {
          window.alert('Изменения сохранены.');
        }
        return saved;
      } catch (e) {
        setError(`Ошибка сохранения: ${e.message}`);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      form,
      d,
      lotFields,
      lotPreserved,
      contactState,
      debtorState,
      priceHistory,
      documents,
      photos,
      auctionPricing,
      publicOfferPeriods,
      applyTrade,
      shouldUseStartPrice,
      shouldIncludePeriods,
      shouldIncludeAuctionExtras,
    ],
  );

  const publishTrade = useCallback(
    async ({ showAlert = true } = {}) => {
      if (!id) return null;
      setPublishing(true);
      setError(null);
      try {
        if (!API_BASE) {
          throw new Error('NEXT_PUBLIC_API_BASE не задан.');
        }
        const token = readToken();
        if (!token) {
          throw new Error('Требуется авторизация администратора.');
        }

        const url = `${API_BASE}/api/admin/parser-trades/${id}/publish`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (res.status === 404) {
          throw new Error('Лот не найден или уже удалён.');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        try {
          const detailRes = await fetch(`${API_BASE}/api/admin/parser-trades/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          if (detailRes.ok) {
            const next = await detailRes.json().catch(() => null);
            if (next) {
              applyTrade(next);
            }
          }
        } catch (refreshError) {
          console.warn('Failed to refresh trade after publish:', refreshError);
        }

        if (showAlert && typeof window !== 'undefined') {
          window.alert('Лот опубликован и появится в общем списке объявлений.');
        }
        return true;
      } catch (e) {
        setError(`Ошибка публикации: ${e.message}`);
        throw e;
      } finally {
        setPublishing(false);
      }
    },
    [id, applyTrade],
  );

  const saveAndPublish = useCallback(async () => {
    if (!item?.published_at) {
      await publishTrade();
      return;
    }

    setUpdatingPublication(true);
    try {
      await saveTrade({ showAlert: false });
      await publishTrade({ showAlert: false });
      if (typeof window !== 'undefined') {
        window.alert('Изменения сохранены и публикация обновлена.');
      }
    } catch (error) {
      // ошибки уже обработаны в saveTrade/publishTrade
    } finally {
      setUpdatingPublication(false);
    }
  }, [item?.published_at, saveTrade, publishTrade]);

  const handlePublishClick = useCallback(() => {
    if (item?.published_at) {
      void saveAndPublish();
    } else {
      void publishTrade();
    }
  }, [item?.published_at, saveAndPublish, publishTrade]);

  const unpublishTrade = useCallback(async () => {
    if (!id) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Снять объявление с публикации? Оно исчезнет из раздела торгов.');
      if (!confirmed) return;
    }

    setUnpublishing(true);
    setError(null);
    try {
      if (!API_BASE) {
        throw new Error('NEXT_PUBLIC_API_BASE не задан.');
      }
      const token = readToken();
      if (!token) {
        throw new Error('Требуется авторизация администратора.');
      }

      const url = `${API_BASE}/api/admin/parser-trades/${id}/unpublish`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (res.status === 404) {
        throw new Error('Лот не найден или уже удалён.');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json().catch(() => null);
      const updated = data && typeof data === 'object' ? data.trade || data.item || null : null;
      if (updated && typeof updated === 'object') {
        applyTrade(updated);
      } else if (item) {
        applyTrade({ ...item, published_at: null });
      }

      if (typeof window !== 'undefined') {
        window.alert('Лот снят с публикации и скрыт из раздела торгов.');
      }

    } catch (e) {
      setError(`Ошибка снятия с публикации: ${e.message}`);
    } finally {
      setUnpublishing(false);
    }
  }, [id, item, applyTrade]);

  const onSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        await saveTrade();
      } catch (error) {
        // ошибка уже показана пользователю
      }
    },
    [saveTrade],
  );

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
        <div className="muted">{error || 'Объект не найден.'}</div>
        <div style={{ marginTop: 12 }}>
          <Link href={backLinkHref} className="link">← Назад к списку</Link>
        </div>
      </div>
    );
  }
  const publishButtonLabel = item.published_at
    ? updatingPublication || saving || publishing
      ? 'Обновляем…'
      : 'Сохранить и обновить публикацию'
    : publishing
    ? 'Публикуем…'
    : 'Опубликовать';

  const actionButtonsDisabled = saving || publishing || updatingPublication || unpublishing;

  return (
    <div className="container" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href={backLinkHref} className="link">← Список</Link>
        <h1 style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}>
          Редактирование лота <span className="muted">#{id}</span>
        </h1>
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        {item.published_at
          ? `Опубликовано: ${formatDateTime(item.published_at)}`
          : 'Ещё не опубликовано на сайте.'}
      </div>

      {error ? <div className="panel" style={{ color: '#ff6b6b' }}>{error}</div> : null}

      <form onSubmit={onSubmit} className="panel" style={{ display: 'grid', gap: 12 }}>
        <section style={{ display: 'grid', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Сведения по лоту</h3>
          </div>

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
            {shouldUseStartPrice ? (
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
            ) : null}
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
        </section>

        <section style={{ display: 'grid', gap: 12, paddingTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3 style={{ margin: 0 }}>Характеристики автомобиля</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Укажите технические параметры и дополнительные поля.
            </p>
          </div>
          {lotFields.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {lotFields.map((row, index) => {
                const fieldLabel = row?.label || translateValueByKey(row?.key) || row?.key || 'Поле';
                const rawValue = row?.value != null ? String(row.value) : '';
                const isTextarea =
                  row?.type === 'textarea'
                  || rawValue.length > 160
                  || rawValue.includes('\n');
                const rowsCount = rawValue.length > 200 ? 6 : rawValue.length > 160 ? 4 : 2;
                let control = null;
                if (row?.type === 'select' && Array.isArray(row.options)) {
                  control = (
                    <select
                      className="input"
                      value={row.value ?? ''}
                      onChange={(e) => updateLotFieldValue(index, e.target.value)}
                    >
                      {row.options.map((option) => (
                        <option key={option.value ?? option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  );
                } else if (isTextarea) {
                  control = (
                    <textarea
                      className="textarea"
                      rows={rowsCount}
                      value={row.value || ''}
                      onChange={(e) => updateLotFieldValue(index, e.target.value)}
                      placeholder={row.placeholder || ''}
                    />
                  );
                } else {
                  control = (
                    <input
                      className="input"
                      value={row.value || ''}
                      onChange={(e) => updateLotFieldValue(index, e.target.value)}
                      placeholder={row.placeholder || ''}
                      inputMode={row.numeric ? 'decimal' : undefined}
                    />
                  );
                }

                return (
                  <div
                    key={`${row.key || 'field'}-${index}`}
                    className="panel"
                    style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}
                  >
                    <div style={{ flex: '1 1 220px', display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600 }} title={row.key || undefined}>
                        {fieldLabel}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>Код: {row.key}</div>
                    </div>
                    <label style={{ flex: '2 1 260px', display: 'grid', gap: 4 }}>
                      <span className="muted" style={{ fontSize: 12 }}>Значение</span>
                      {control}
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>Поля ещё не добавлены.</div>
          )}
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h3 style={{ margin: 0 }}>Контакты организатора</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Эти данные показываются покупателям для связи. Добавляйте только актуальную информацию.
              </p>
            </div>
            <button type="button" className="button outline" onClick={addContactExtra}>
              Добавить поле контактов
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {CONTACT_FIELDS.map((field) => (
              <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted">{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea
                    className="textarea"
                    rows={contactState.values?.[field.key] && contactState.values[field.key].length > 160 ? 4 : 2}
                    value={contactState.values?.[field.key] || ''}
                    onChange={(e) => updateContactValue(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    className="input"
                    value={contactState.values?.[field.key] || ''}
                    onChange={(e) => updateContactValue(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {contactState.extras && contactState.extras.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {contactState.extras.map((extra, index) => {
                const fieldLabel =
                  translateValueByKey(extra?.key) || extra?.key || `Доп. поле ${index + 1}`;
                const rowsCount = extra?.value && extra.value.length > 200 ? 6 : extra?.value && extra.value.length > 160 ? 4 : 2;
                return (
                  <div
                    key={`contact-extra-${index}`}
                    className="panel"
                    style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}
                  >
                    <div style={{ flex: '1 1 220px', display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600 }} title={extra?.key || undefined}>{fieldLabel}</div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="muted" style={{ fontSize: 12 }}>Код поля</span>
                        <input
                          className="input"
                          value={extra?.key || ''}
                          onChange={(e) => updateContactExtra(index, 'key', e.target.value)}
                          placeholder="Например, whatsapp"
                        />
                      </label>
                    </div>
                    <label style={{ flex: '2 1 260px', display: 'grid', gap: 4 }}>
                      <span className="muted" style={{ fontSize: 12 }}>Значение</span>
                      <textarea
                        className="textarea"
                        rows={rowsCount}
                        value={extra?.value || ''}
                        onChange={(e) => updateContactExtra(index, 'value', e.target.value)}
                      />
                    </label>
                    <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start' }}>
                      <button type="button" className="button outline" onClick={() => removeContactExtra(index)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h3 style={{ margin: 0 }}>Данные должника</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Проверьте корректность сведений о должнике и добавьте дополнительные поля при необходимости.
              </p>
            </div>
            <button type="button" className="button outline" onClick={addDebtorExtra}>
              Добавить поле должника
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {DEBTOR_FIELDS.map((field) => (
              <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted">{field.label}</span>
                <input
                  className="input"
                  value={debtorState.values?.[field.key] || ''}
                  onChange={(e) => updateDebtorValue(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
          {debtorState.extras && debtorState.extras.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {debtorState.extras.map((extra, index) => {
                const fieldLabel = translateValueByKey(extra?.key) || extra?.key || `Доп. поле ${index + 1}`;
                const rowsCount = extra?.value && extra.value.length > 200 ? 6 : extra?.value && extra.value.length > 160 ? 4 : 2;
                return (
                  <div
                    key={`debtor-extra-${index}`}
                    className="panel"
                    style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}
                  >
                    <div style={{ flex: '1 1 220px', display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600 }} title={extra?.key || undefined}>{fieldLabel}</div>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="muted" style={{ fontSize: 12 }}>Код поля</span>
                        <input
                          className="input"
                          value={extra?.key || ''}
                          onChange={(e) => updateDebtorExtra(index, 'key', e.target.value)}
                          placeholder="Например, СНИЛС"
                        />
                      </label>
                    </div>
                    <label style={{ flex: '2 1 260px', display: 'grid', gap: 4 }}>
                      <span className="muted" style={{ fontSize: 12 }}>Значение</span>
                      <textarea
                        className="textarea"
                        rows={rowsCount}
                        value={extra?.value || ''}
                        onChange={(e) => updateDebtorExtra(index, 'value', e.target.value)}
                      />
                    </label>
                    <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start' }}>
                      <button type="button" className="button outline" onClick={() => removeDebtorExtra(index)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3 style={{ margin: 0 }}>Фотографии</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Можно загрузить изображения или указать ссылки вручную. Порядок влияет на отображение в карточке.
            </p>
          </div>
          <div className="admin-upload">
            <div className="admin-upload__row">
              <div className="admin-upload__text">
                <div className="admin-upload__title">Загрузить изображения</div>
                <p className="admin-upload__description">
                  Поддерживаются изображения до 10&nbsp;МБ. Можно выбрать один файл или загрузить несколько сразу.
                </p>
              </div>
            <div className="admin-upload__actions">
                <button
                  type="button"
                  className="button button-small button-outline"
                  onClick={triggerSingleUpload}
                  disabled={uploadingPhotos}
                >
                  Загрузить файл
                </button>
                <button
                  type="button"
                  className="button button-small"
                  onClick={triggerMultipleUpload}
                  disabled={uploadingPhotos}
                >
                  Загрузить несколько
                </button>
              </div>
            </div>
            {uploadingPhotos ? <div className="admin-upload__status">Загрузка фотографий…</div> : null}
            {uploadError ? <div className="admin-upload__error">{uploadError}</div> : null}
            <div className="admin-upload__hint">Загруженные файлы автоматически добавятся в список ниже.</div>
            <input
              ref={singleFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleSingleFileChange}
            />
            <input
              ref={multipleFileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleMultipleFileChange}
            />
          </div>
          {photos.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Фотографии пока не добавлены.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {photos.map((photo, index) => (
                <div key={photo.id || index} className="panel" style={{ padding: 12, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.title || `Фото ${index + 1}`}
                        style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 6 }}
                      />
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>Предпросмотр появится после указания ссылки.</div>
                    )}
                    <div style={{ display: 'grid', gap: 8, flex: '1 1 220px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted">Ссылка на изображение</span>
                        <input
                          className="input"
                          value={photo.url || ''}
                          onChange={(e) => updatePhotoEntry(index, { url: e.target.value })}
                          placeholder="https://example.ru/photo.jpg"
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted">Подпись / комментарий</span>
                        <input
                          className="input"
                          value={photo.title || ''}
                          onChange={(e) => updatePhotoEntry(index, { title: e.target.value })}
                          placeholder="Например, Вид спереди"
                        />
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => movePhotoEntry(index, -1)}
                      disabled={index === 0}
                      style={{ padding: '6px 10px' }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => movePhotoEntry(index, 1)}
                      disabled={index === photos.length - 1}
                      style={{ padding: '6px 10px' }}
                    >
                      ↓
                    </button>
                    <button type="button" className="button outline" onClick={() => removePhotoEntry(index)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="button outline" onClick={addPhotoEntry}>
              Добавить ссылку вручную
            </button>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h3 style={{ margin: 0 }}>Документы</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Загрузите файлы (PDF, Word, Excel, изображения) или укажите ссылки вручную.
              </p>
            </div>
            {fedresursUrl ? (
              <a className="button outline" href={fedresursUrl} target="_blank" rel="noreferrer">
                Перейти на Федресурс
              </a>
            ) : null}
          </div>
          <div className="admin-upload">
            <div className="admin-upload__row">
              <div className="admin-upload__text">
                <div className="admin-upload__title">Загрузить документы</div>
                <p className="admin-upload__description">
                  Поддерживаются файлы до 20&nbsp;МБ каждый. После загрузки документы появятся в списке ниже.
                </p>
              </div>
              <div className="admin-upload__actions">
                <button
                  type="button"
                  className="button button-small"
                  onClick={triggerDocumentUpload}
                  disabled={uploadingDocuments}
                >
                  Выбрать файлы
                </button>
              </div>
            </div>
            {uploadingDocuments ? <div className="admin-upload__status">Загрузка документов…</div> : null}
            {documentUploadError ? <div className="admin-upload__error">{documentUploadError}</div> : null}
            <div className="admin-upload__hint">Можно выбрать сразу несколько файлов.</div>
            <input
              ref={documentFileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleDocumentFileChange}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="button outline" onClick={addDocumentEntry}>
              Добавить ссылку вручную
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Документы пока не добавлены.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {documents.map((doc, index) => (
                <div key={doc.id || index} className="panel" style={{ padding: 12, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="muted">Название документа</span>
                      <input
                        className="input"
                        value={doc.title || ''}
                        onChange={(e) => updateDocumentEntry(index, { title: e.target.value })}
                        placeholder="Например, Проект договора"
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="muted">Ссылка на документ</span>
                      <input
                        className="input"
                        value={doc.url || ''}
                        onChange={(e) => updateDocumentEntry(index, { url: e.target.value })}
                        placeholder="https://example.ru/document.pdf"
                      />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted">Комментарий</span>
                    <textarea
                      className="textarea"
                      rows={doc.description && doc.description.length > 160 ? 4 : 2}
                      value={doc.description || ''}
                      onChange={(e) => updateDocumentEntry(index, { description: e.target.value })}
                      placeholder="Дополнительная информация или примечание"
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {doc.url ? (
                      <a className="link" href={doc.url} target="_blank" rel="noreferrer">
                        Открыть документ
                      </a>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>Укажите ссылку или загрузите файл.</span>
                    )}
                    <button type="button" className="button outline" onClick={() => removeDocumentEntry(index)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!isOpenAuction ? (
          <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3 style={{ margin: 0 }}>История изменений цены</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Эти записи отображаются в разделе «История цен» карточки лота.
            </p>
          </div>
          <button type="button" className="button outline" onClick={addPriceHistoryEntry}>
            Добавить запись
          </button>
          {priceHistory.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Записей пока нет.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {priceHistory.map((entry, index) => (
                <div key={entry.id || index} className="panel" style={{ padding: 12, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="muted">Этап / стадия</span>
                      <input
                        className="input"
                        value={entry.stage || ''}
                        onChange={(e) => updatePriceHistoryEntry(index, { stage: e.target.value })}
                        placeholder="Например, Первый этап"
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="muted">Цена</span>
                      <input
                        className="input"
                        value={entry.price || ''}
                        onChange={(e) => updatePriceHistoryEntry(index, { price: e.target.value })}
                        inputMode="numeric"
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="muted">Дата</span>
                      <input
                        className="input"
                        value={entry.date || ''}
                        onChange={(e) => updatePriceHistoryEntry(index, { date: e.target.value })}
                        placeholder="Например, 15.03.2025 10:00"
                      />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted">Комментарий</span>
                    <textarea
                      className="textarea"
                      rows={entry.comment && entry.comment.length > 160 ? 4 : 2}
                      value={entry.comment || ''}
                      onChange={(e) => updatePriceHistoryEntry(index, { comment: e.target.value })}
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="button outline" onClick={() => removePriceHistoryEntry(index)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        ) : null}

        {isPublicOffer ? (
          <section style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h3 style={{ margin: 0 }}>Цена публичного предложения</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Выберите формат цены: фиксированная стартовая или график снижения.
              </p>
            </div>
            <div className="panel" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="public-offer-price-mode"
                  value="start_price"
                  checked={publicOfferPriceMode === 'start_price'}
                  onChange={() => setPublicOfferPriceMode('start_price')}
                  style={{ marginTop: 4 }}
                />
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 600 }}>Стартовая цена</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Показывать только стартовую цену без расписания снижения.
                  </div>
                </div>
              </label>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="public-offer-price-mode"
                  value="period_price"
                  checked={publicOfferPriceMode === 'period_price'}
                  onChange={() => setPublicOfferPriceMode('period_price')}
                  style={{ marginTop: 4 }}
                />
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 600 }}>График снижения цены</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Укажите периоды с датами и ценами. Они будут показаны покупателям по порядку.
                  </div>
                </div>
              </label>
            </div>
            {shouldIncludePeriods ? (
              <>
                {publicOfferPeriods.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>Периоды пока не добавлены.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {publicOfferPeriods.map((period, index) => (
                      <div key={period.id || index} className="panel" style={{ padding: 12, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div className="muted" style={{ fontWeight: 600 }}>Период {index + 1}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="button outline"
                              onClick={() => movePeriodEntry(index, -1)}
                              disabled={index === 0}
                              style={{ padding: '6px 10px' }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="button outline"
                              onClick={() => movePeriodEntry(index, 1)}
                              disabled={index === publicOfferPeriods.length - 1}
                              style={{ padding: '6px 10px' }}
                            >
                              ↓
                            </button>
                            <button type="button" className="button outline" onClick={() => removePeriodEntry(index)}>
                              Удалить
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="muted">Дата начала</span>
                            <input
                              className="input"
                              type="datetime-local"
                              value={period.date_start || ''}
                              onChange={(e) => updatePeriodEntry(index, { date_start: e.target.value })}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="muted">Дата окончания</span>
                            <input
                              className="input"
                              type="datetime-local"
                              value={period.date_end || ''}
                              onChange={(e) => updatePeriodEntry(index, { date_end: e.target.value })}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="muted">Цена, руб.</span>
                            <input
                              className="input"
                              value={period.price || ''}
                              onChange={(e) => updatePeriodEntry(index, { price: e.target.value })}
                              inputMode="numeric"
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="muted">Минимальная цена</span>
                            <input
                              className="input"
                              value={period.min_price || ''}
                              onChange={(e) => updatePeriodEntry(index, { min_price: e.target.value })}
                              inputMode="numeric"
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="muted">Задаток, руб.</span>
                            <input
                              className="input"
                              value={period.deposit || ''}
                              onChange={(e) => updatePeriodEntry(index, { deposit: e.target.value })}
                              inputMode="numeric"
                            />
                          </label>
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className="muted">Комментарий / примечание</span>
                          <textarea
                            className="textarea"
                            rows={period.comment && period.comment.length > 160 ? 4 : 2}
                            value={period.comment || ''}
                            onChange={(e) => updatePeriodEntry(index, { comment: e.target.value })}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <button type="button" className="button outline" onClick={addPeriodEntry}>
                    Добавить период
                  </button>
                </div>
              </>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                Используется только стартовая цена. При необходимости переключитесь на режим «График снижения цены».
              </div>
            )}
          </section>
        ) : null}

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3 style={{ margin: 0 }}>Цены для открытого аукциона</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Укажите стартовую цену и дополнительные параметры аукциона при необходимости.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted">Начальная цена</span>
              <input
                className="input"
                value={auctionPricing.start_price || ''}
                onChange={updateAuctionField('start_price')}
                placeholder="Например, 1500000"
                inputMode="numeric"
              />
            </label>
            {isOpenAuction ? (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Шаг аукциона</span>
                  <input
                    className="input"
                    value={auctionPricing.step || ''}
                    onChange={updateAuctionField('step')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Задаток</span>
                  <input
                    className="input"
                    value={auctionPricing.deposit || ''}
                    onChange={updateAuctionField('deposit')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Валюта</span>
                  <input
                    className="input"
                    value={auctionPricing.currency || ''}
                    onChange={updateAuctionField('currency')}
                    placeholder="Например, RUB"
                  />
                </label>
              </>
            ) : (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Текущая цена</span>
                  <input
                    className="input"
                    value={auctionPricing.current_price || ''}
                    onChange={updateAuctionField('current_price')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Минимальная цена</span>
                  <input
                    className="input"
                    value={auctionPricing.min_price || ''}
                    onChange={updateAuctionField('min_price')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Максимальная цена</span>
                  <input
                    className="input"
                    value={auctionPricing.max_price || ''}
                    onChange={updateAuctionField('max_price')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Шаг аукциона</span>
                  <input
                    className="input"
                    value={auctionPricing.step || ''}
                    onChange={updateAuctionField('step')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Задаток</span>
                  <input
                    className="input"
                    value={auctionPricing.deposit || ''}
                    onChange={updateAuctionField('deposit')}
                    inputMode="numeric"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted">Валюта</span>
                  <input
                    className="input"
                    value={auctionPricing.currency || ''}
                    onChange={updateAuctionField('currency')}
                    placeholder="Например, RUB"
                  />
                </label>
              </>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted">Крайний срок подачи заявок</span>
              <input
                className="input"
                type="datetime-local"
                value={auctionPricing.application_deadline || ''}
                onChange={updateAuctionField('application_deadline')}
              />
            </label>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="submit" className="button primary" disabled={actionButtonsDisabled}>
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
          <button type="button" className="button outline" onClick={resetChanges} disabled={actionButtonsDisabled}>
            Сбросить изменения
          </button>
          <button type="button" className="button" onClick={handlePublishClick} disabled={actionButtonsDisabled}>
            {publishButtonLabel}
          </button>
          {item.published_at ? (
            <button
              type="button"
              className="button outline"
              onClick={unpublishTrade}
              disabled={actionButtonsDisabled}
              style={{ borderColor: '#f87171', color: '#b91c1c' }}
            >
              {unpublishing ? 'Снимаем…' : 'Снять с публикации'}
            </button>
          ) : null}
        </div>
      </form>

      {/* {descriptionPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>Описание</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{descriptionPreview}</div>
        </section>
      )} */}
{/* 
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

      {!isOpenAuction && Array.isArray(d.prices) && d.prices.length > 0 && (
        <section style={{ marginTop: 24 }}>
        <h2>История цен</h2>
        <div className="panel" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...PRICE_TABLE_HEADER_STYLE, color: '#111827 !important' }}>Этап</th>
                <th style={{ ...PRICE_TABLE_HEADER_STYLE, color: '#111827 !important' }}>Цена</th>
                <th style={{ ...PRICE_TABLE_HEADER_STYLE, color: '#111827 !important' }}>Дата</th>
                <th style={{ ...PRICE_TABLE_HEADER_STYLE, color: '#111827 !important' }}>Комментарий</th>
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
                const stageText = translateValueByKey('stage', stage) || stage;
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
                    <td style={{ ...PRICE_TABLE_CELL_STYLE, color: '#111827 !important' }}>{stageText}</td>
                    <td style={{ ...PRICE_TABLE_CELL_STYLE, color: '#111827 !important' }}>{priceText}</td>
                    <td style={{ ...PRICE_TABLE_CELL_STYLE, color: '#111827 !important' }}>{dateValue ? formatDateTime(dateValue) : '—'}</td>
                    <td style={{ ...PRICE_TABLE_CELL_STYLE, color: '#111827 !important' }}>
                      {commentMultiline ? (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#111827 !important' }}>{commentText}</pre>
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
      )} */}

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





