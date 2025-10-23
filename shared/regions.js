export const RUSSIAN_REGIONS = Object.freeze([
  { code: '01', name: 'Республика Адыгея' },
  { code: '02', name: 'Республика Башкортостан' },
  { code: '03', name: 'Республика Бурятия' },
  { code: '04', name: 'Республика Алтай' },
  { code: '05', name: 'Республика Дагестан' },
  { code: '06', name: 'Республика Ингушетия' },
  { code: '07', name: 'Кабардино-Балкарская Республика' },
  { code: '08', name: 'Республика Калмыкия' },
  { code: '09', name: 'Карачаево-Черкесская Республика' },
  { code: '10', name: 'Республика Карелия' },
  { code: '11', name: 'Республика Коми' },
  { code: '12', name: 'Республика Марий Эл' },
  { code: '13', name: 'Республика Мордовия' },
  { code: '14', name: 'Республика Саха (Якутия)' },
  { code: '15', name: 'Республика Северная Осетия — Алания' },
  { code: '16', name: 'Республика Татарстан' },
  { code: '17', name: 'Республика Тыва' },
  { code: '18', name: 'Удмуртская Республика' },
  { code: '19', name: 'Республика Хакасия' },
  { code: '20', name: 'Чеченская Республика' },
  { code: '21', name: 'Чувашская Республика' },
  { code: '22', name: 'Алтайский край' },
  { code: '23', name: 'Краснодарский край' },
  { code: '24', name: 'Красноярский край' },
  { code: '25', name: 'Приморский край' },
  { code: '26', name: 'Ставропольский край' },
  { code: '27', name: 'Хабаровский край' },
  { code: '28', name: 'Амурская область' },
  { code: '29', name: 'Архангельская область' },
  { code: '30', name: 'Астраханская область' },
  { code: '31', name: 'Белгородская область' },
  { code: '32', name: 'Брянская область' },
  { code: '33', name: 'Владимирская область' },
  { code: '34', name: 'Волгоградская область' },
  { code: '35', name: 'Вологодская область' },
  { code: '36', name: 'Воронежская область' },
  { code: '37', name: 'Ивановская область' },
  { code: '38', name: 'Иркутская область' },
  { code: '39', name: 'Калининградская область' },
  { code: '40', name: 'Калужская область' },
  { code: '41', name: 'Камчатский край' },
  { code: '42', name: 'Кемеровская область — Кузбасс' },
  { code: '43', name: 'Кировская область' },
  { code: '44', name: 'Костромская область' },
  { code: '45', name: 'Курганская область' },
  { code: '46', name: 'Курская область' },
  { code: '47', name: 'Ленинградская область' },
  { code: '48', name: 'Липецкая область' },
  { code: '49', name: 'Магаданская область' },
  { code: '50', name: 'Московская область' },
  { code: '51', name: 'Мурманская область' },
  { code: '52', name: 'Нижегородская область' },
  { code: '53', name: 'Новгородская область' },
  { code: '54', name: 'Новосибирская область' },
  { code: '55', name: 'Омская область' },
  { code: '56', name: 'Оренбургская область' },
  { code: '57', name: 'Орловская область' },
  { code: '58', name: 'Пензенская область' },
  { code: '59', name: 'Пермский край' },
  { code: '60', name: 'Псковская область' },
  { code: '61', name: 'Ростовская область' },
  { code: '62', name: 'Рязанская область' },
  { code: '63', name: 'Самарская область' },
  { code: '64', name: 'Саратовская область' },
  { code: '65', name: 'Сахалинская область' },
  { code: '66', name: 'Свердловская область' },
  { code: '67', name: 'Смоленская область' },
  { code: '68', name: 'Тамбовская область' },
  { code: '69', name: 'Тверская область' },
  { code: '70', name: 'Томская область' },
  { code: '71', name: 'Тульская область' },
  { code: '72', name: 'Тюменская область' },
  { code: '73', name: 'Ульяновская область' },
  { code: '74', name: 'Челябинская область' },
  { code: '75', name: 'Забайкальский край' },
  { code: '76', name: 'Ярославская область' },
  { code: '77', name: 'Москва' },
  { code: '78', name: 'Санкт-Петербург' },
  { code: '79', name: 'Еврейская автономная область' },
  { code: '80', name: 'Донецкая Народная Республика' },
  { code: '81', name: 'Луганская Народная Республика' },
  { code: '82', name: 'Республика Крым' },
  { code: '83', name: 'Ненецкий автономный округ' },
  { code: '84', name: 'Запорожская область' },
  { code: '85', name: 'Херсонская область' },
  { code: '86', name: 'Ханты-Мансийский автономный округ — Югра' },
  { code: '87', name: 'Чукотский автономный округ' },
  { code: '89', name: 'Ямало-Ненецкий автономный округ' },
  { code: '92', name: 'Севастополь' },
]);

const REGION_CODE_SET = new Set(RUSSIAN_REGIONS.map((region) => region.code));

const REGION_CODE_OVERRIDES = new Map([
  ['1', '01'],
  ['2', '02'],
  ['3', '03'],
  ['4', '04'],
  ['5', '05'],
  ['6', '06'],
  ['7', '07'],
  ['8', '08'],
  ['9', '09'],
  ['91', '82'],
]);

export function normalizeRegionCode(input) {
  if (input === undefined || input === null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (REGION_CODE_SET.has(trimmed)) {
    return trimmed;
  }

  const digitsOnly = trimmed.replace(/\D+/g, '');
  if (!digitsOnly) {
    return trimmed;
  }

  if (REGION_CODE_OVERRIDES.has(digitsOnly)) {
    return REGION_CODE_OVERRIDES.get(digitsOnly);
  }

  if (REGION_CODE_SET.has(digitsOnly)) {
    return digitsOnly;
  }

  if (digitsOnly.length === 1) {
    const padded = digitsOnly.padStart(2, '0');
    if (REGION_CODE_SET.has(padded)) {
      return padded;
    }
  }

  if (digitsOnly.length > 2) {
    for (let i = 2; i <= Math.min(3, digitsOnly.length); i += 1) {
      const candidate = digitsOnly.slice(-i);
      if (REGION_CODE_SET.has(candidate)) {
        return candidate;
      }
    }
    const lastTwo = digitsOnly.slice(-2);
    if (REGION_CODE_SET.has(lastTwo)) {
      return lastTwo;
    }
  }

  return trimmed;
}

const regionByCode = new Map();
for (const region of RUSSIAN_REGIONS) {
  regionByCode.set(region.code, region);
}

export const REGION_BY_CODE = Object.freeze(Object.fromEntries(regionByCode));

export function getRegionNameByCode(code) {
  const normalized = normalizeRegionCode(code);
  if (!normalized) return null;
  return REGION_BY_CODE[normalized]?.name || null;
}

export function ensureRegionRecord(code, fallbackName) {
  const normalized = normalizeRegionCode(code);
  if (!normalized) {
    return { code: null, name: fallbackName || null };
  }
  const record = REGION_BY_CODE[normalized];
  if (record) {
    return record;
  }
  return {
    code: normalized,
    name: fallbackName || normalized,
  };
}
const REGION_NAME_LOOKUP = new Map();
for (const region of RUSSIAN_REGIONS) {
  REGION_NAME_LOOKUP.set(region.name.toLowerCase(), region);
}

export function findRegionByName(name) {
  if (!name && name !== 0) return null;
  const normalized = String(name).trim().toLowerCase();
  if (!normalized) return null;
  return REGION_NAME_LOOKUP.get(normalized) || null;
}

export function findRegionCodeByName(name) {
  const region = findRegionByName(name);
  return region ? region.code : null;
}
