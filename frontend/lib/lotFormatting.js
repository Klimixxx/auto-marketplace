const EXACT_FIELD_LABELS = {
  asset_type: 'Тип актива',
  assettype: 'Тип актива',
  lot_number: 'Номер лота',
  lotnum: 'Номер лота',
  brand: 'Марка',
  model: 'Модель',
  generation: 'Поколение',
  modification: 'Модификация',
  title: 'Название',
  name: 'Название',
  object_name: 'Заголовок',
  objectName: 'Заголовок',
  item_name: 'Наименование объекта',
  itemName: 'Наименование объекта',
  asset_title: 'Наименование актива',
  assetTitle: 'Наименование актива',
  lot_name: 'Наименование лота',
  lotName: 'Наименование лота',
  year: 'Год выпуска',
  production_year: 'Год выпуска',
  manufacture_year: 'Год выпуска',
  release_year: 'Год выпуска',
  mileage: 'Пробег',
  run: 'Пробег',
  mileage_km: 'Пробег',
  mileage_kilometers: 'Пробег',
  mileage_value: 'Пробег',
  engine: 'Двигатель',
  engine_type: 'Тип двигателя',
  engine_volume: 'Объём двигателя',
  engine_volume_l: 'Объём двигателя',
  engine_volume_liters: 'Объём двигателя',
  engine_capacity: 'Объём двигателя',
  engine_power: 'Мощность двигателя',
  engine_power_hp: 'Мощность двигателя (л.с.)',
  engine_power_kw: 'Мощность двигателя (кВт)',
  transmission: 'Коробка передач',
  transmission_type: 'Тип коробки передач',
  gearbox: 'Коробка передач',
  kpp: 'КПП',
  drive: 'Тип привода',
  drive_type: 'Тип привода',
  wheel: 'Расположение руля',
  steering: 'Расположение руля',
  steering_wheel: 'Расположение руля',
  body_type: 'Тип кузова',
  body: 'Кузов',
  doors: 'Количество дверей',
  seats: 'Количество мест',
  color: 'Цвет',
  paint: 'Цвет',
  interior: 'Интерьер',
  upholstery: 'Отделка салона',
  condition: 'Состояние',
  state: 'Состояние',
  vin: 'VIN',
  vin_number: 'VIN',
  chassis: 'Номер шасси',
  frame: 'Номер рамы',
  registration_number: 'Регистрационный номер',
  license_plate: 'Госномер',
  category: 'Категория',
  subcategory: 'Подкатегория',
  asset_category: 'Категория актива',
  price: 'Цена',
  start_price: 'Стартовая цена',
  startprice: 'Стартовая цена',
  current_price: 'Текущая цена',
  currentprice: 'Текущая цена',
  min_price: 'Минимальная цена',
  max_price: 'Максимальная цена',
  last_price: 'Последняя цена',
  average_price: 'Средняя цена',
  deposit: 'Задаток',
  step: 'Шаг аукциона',
  auction_step: 'Шаг аукциона',
  currency: 'Валюта',
  tax: 'Налог',
  nds: 'НДС',
  region: 'Регион',
  city: 'Город',
  location: 'Локация',
  address: 'Адрес',
  latitude: 'Широта',
  longitude: 'Долгота',
  organizer: 'Организатор',
  organizer_name: 'Организатор',
  organizer_full_name: 'Организатор',
  organizerFullName: 'Организатор',
  organizer_title: 'Организатор',
  organizerTitle: 'Организатор',
  organisation: 'Организация',
  organization: 'Организация',
  company: 'Компания',
  company_name: 'Компания',
  companyName: 'Компания',
  full_name: 'Полное название',
  fullname: 'Полное название',
  fullName: 'Полное название',
  organizer_inn: 'ИНН организатора',
  inn_number: 'ИНН',
  innNumber: 'ИНН',
  organizer_ogrn: 'ОГРН организатора',
  ogrn_number: 'ОГРН',
  ogrnNumber: 'ОГРН',
  inn: 'ИНН',
  ogrn: 'ОГРН',
  ogrnip: 'ОГРНИП',
  ogrn_ip: 'ОГРНИП',
  ogrnipNumber: 'ОГРНИП',
  snils: 'СНИЛС',
  manager: 'Менеджер',
  contact_name: 'Контактное лицо',
  contact_phone: 'Контактный телефон',
  phone: 'Телефон',
  phone_number: 'Телефон',
  email: 'Email',
  website: 'Сайт',
  auction_url: 'Ссылка на торги',
  organizer_type: 'Тип организатора',
  organizerType: 'Тип организатора',
  source_url: 'Ссылка на источник',
  inspection_procedure: 'Порядок осмотра',
  inspection_time: 'Время осмотра',
  inspection_address: 'Адрес осмотра',
  inspection_dates: 'Даты осмотра',
  description: 'Описание',
  short_description: 'Краткое описание',
  notes: 'Заметки',
  comment: 'Комментарий',
  comments: 'Комментарии',
  document: 'Документ',
  documents: 'Документы',
  debtor: 'Должник',
  debtor_name: 'Должник',
  debtor_full_name: 'Должник',
  debtorFullName: 'Должник',
  debtor_company: 'Должник',
  debtorCompany: 'Должник',
  debtor_inn: 'ИНН должника',
  debtor_type: 'Тип должника',
  debtorType: 'Тип должника',
  debtor_category: 'Тип должника',
  debtorCategory: 'Тип должника',
  debtor_ogrn: 'ОГРН должника',
  debtor_ogrnip: 'ОГРНИП должника',
  debtor_snils: 'СНИЛС должника',
  debtor_address: 'Адрес должника',
  registered_address: 'Адрес регистрации',
  registeredAddress: 'Адрес регистрации',
  lot_size: 'Количество лотов',
  quantity: 'Количество',
  amount: 'Сумма',
  sum: 'Сумма',
  application_deadline: 'Срок подачи заявок',
  applications_count: 'Количество заявок',
  bidding_number: 'Номер торгов',
  bidding_date: 'Дата торгов',
  bidding_time: 'Время торгов',
  bidding_place: 'Место торгов',
  trade_place: 'Площадка торгов',
  start_date: 'Дата начала торгов',
  date_start: 'Дата начала торгов',
  end_date: 'Дата окончания торгов',
  finish_date: 'Дата окончания торгов',
  date_finish: 'Дата окончания торгов',
  publish_date: 'Дата публикации',
  created_at: 'Создано',
  updated_at: 'Обновлено',
  passport: 'Паспорт',
  customs: 'Таможня',
  restrictions: 'Ограничения',
  pledges: 'Залоги',
  encumbrances: 'Обременения',
  equipment: 'Комплектация',
  options: 'Опции',
  features: 'Особенности',
  extras: 'Дополнительно',
  owner: 'Владелец',
  owners_count: 'Количество владельцев',
  usage: 'Эксплуатация',
  service_history: 'История обслуживания',
  insurance: 'Страхование',
  damages: 'Повреждения',
  defects: 'Дефекты',
  accidents: 'Аварии',
  photo: 'Фото',
  photos: 'Фотографии',
  gallery: 'Галерея',
  stage: 'Этап',
  status: 'Статус',
  result: 'Результат',
  asset_name: 'Наименование актива',
  maker: 'Производитель',
  country: 'Страна',
  lot: 'Лот',
  id: 'ID',
  slug: 'Слаг',
  type: 'Тип',
  fuel_type: 'Тип топлива',
  fuel: 'Топливо',
  engine_fuel: 'Топливо',
  displacement: 'Рабочий объём',
  torque: 'Крутящий момент',
  power_kw: 'Мощность (кВт)',
  power_hp: 'Мощность (л.с.)',
  suspension: 'Подвеска',
  brakes: 'Тормоза',
  length: 'Длина',
  width: 'Ширина',
  height: 'Высота',
  weight: 'Масса',
  curb_weight: 'Снаряжённая масса',
  gross_weight: 'Полная масса',
  load_capacity: 'Грузоподъёмность',
  wheelbase: 'Колёсная база',
  clearance: 'Клиренс',
  consumption: 'Расход топлива',
  fuel_consumption: 'Расход топлива',
  drive_unit: 'Тип привода',
  base: 'База',
  package: 'Пакет',
  warranty: 'Гарантия',
  start_time: 'Время начала',
  end_time: 'Время окончания',
  time_start: 'Время начала',
  time_finish: 'Время окончания',
};

const TOKEN_LABELS = {
  asset: 'актива',
  type: 'тип',
  lot: 'лот',
  number: 'номер',
  date: 'дата',
  time: 'время',
  count: 'количество',
  total: 'итог',
  price: 'цена',
  start: 'стартовая',
  end: 'окончание',
  finish: 'окончание',
  current: 'текущая',
  min: 'минимальная',
  max: 'максимальная',
  step: 'шаг',
  deposit: 'задаток',
  sum: 'сумма',
  payment: 'оплата',
  info: 'информация',
  contact: 'контакт',
  organizer: 'организатор',
  inspection: 'осмотр',
  fuel: 'топливо',
  engine: 'двигатель',
  power: 'мощность',
  volume: 'объём',
  transmission: 'коробка',
  drive: 'привод',
  wheel: 'руль',
  steering: 'руль',
  body: 'кузов',
  color: 'цвет',
  interior: 'интерьер',
  description: 'описание',
  debtor: 'должник',
  contactperson: 'контактное лицо',
  phone: 'телефон',
  email: 'email',
  address: 'адрес',
  region: 'регион',
  city: 'город',
  place: 'место',
  application: 'заявка',
  status: 'статус',
  stage: 'этап',
  result: 'результат',
  photo: 'фото',
  document: 'документ',
};

const VALUE_TRANSLATIONS = {
  asset_type: {
    car: 'Автомобиль',
    cars: 'Автомобиль',
    auto: 'Автомобиль',
    automobile: 'Автомобиль',
    moto: 'Мотоцикл',
    motorcycle: 'Мотоцикл',
    truck: 'Грузовой автомобиль',
    trucks: 'Грузовой автомобиль',
    special_equipment: 'Спецтехника',
    specialequipment: 'Спецтехника',
    bus: 'Автобус',
    buses: 'Автобус',
    real_estate: 'Недвижимость',
    realty: 'Недвижимость',
    apartment: 'Квартира',
    house: 'Дом',
    land: 'Земельный участок',
    equipment: 'Оборудование',
    other: 'Прочее',
  },
  transmission: {
    automatic: 'Автоматическая',
    at: 'Автоматическая',
    auto: 'Автоматическая',
    manual: 'Механическая',
    mt: 'Механическая',
    mechanic: 'Механическая',
    robot: 'Роботизированная',
    robotic: 'Роботизированная',
    robotized: 'Роботизированная',
    dsg: 'Робот DSG',
    variator: 'Вариатор',
    cvt: 'Вариатор',
  },
  gearbox: {
    automatic: 'Автоматическая',
    manual: 'Механическая',
    robot: 'Роботизированная',
    variator: 'Вариатор',
  },
  kpp: {
    automatic: 'Автоматическая',
    manual: 'Механическая',
    robot: 'Роботизированная',
    variator: 'Вариатор',
  },
  drive: {
    awd: 'Полный привод',
    fourwd: 'Полный привод',
    '4wd': 'Полный привод',
    fwd: 'Передний привод',
    front: 'Передний привод',
    rwd: 'Задний привод',
    rear: 'Задний привод',
  },
  drive_type: {
    awd: 'Полный привод',
    '4wd': 'Полный привод',
    fourwd: 'Полный привод',
    fwd: 'Передний привод',
    rwd: 'Задний привод',
  },
  wheel: {
    left: 'Левый',
    right: 'Правый',
    lhd: 'Левый',
    rhd: 'Правый',
  },
  steering: {
    left: 'Левый',
    right: 'Правый',
    lhd: 'Левый',
    rhd: 'Правый',
  },
  fuel_type: {
    petrol: 'Бензин',
    gasoline: 'Бензин',
    benzin: 'Бензин',
    diesel: 'Дизель',
    gas: 'Газ',
    lpg: 'Газ',
    cng: 'Метан',
    hybrid: 'Гибрид',
    electric: 'Электро',
    electricity: 'Электро',
    hydrogen: 'Водород',
  },
  condition: {
    new: 'Новый',
    used: 'Подержанный',
    excellent: 'Отличное',
    good: 'Хорошее',
    satisfactory: 'Удовлетворительное',
    damaged: 'Повреждённый',
    broken: 'Неисправный',
  },
  status: {
    draft: 'Черновик',
    published: 'Опубликовано',
    active: 'Активно',
    closed: 'Завершено',
    finished: 'Завершено',
    sold: 'Продано',
    canceled: 'Отменено',
    cancelled: 'Отменено',
    processing: 'В обработке',
    planned: 'Запланировано',
    pending: 'Ожидает',
    trading: 'Идут торги',
  },
  result: {
    sold: 'Продано',
    not_sold: 'Не продано',
    canceled: 'Отменено',
    cancelled: 'Отменено',
    unknown: 'Неизвестно',
  },
  pts: {
    original: 'Оригинал',
    duplicate: 'Дубликат',
    absent: 'Отсутствует',
  },
  sts: {
    original: 'Оригинал',
    duplicate: 'Дубликат',
    absent: 'Отсутствует',
  },
  nds: {
    included: 'НДС включён',
    excluded: 'НДС не включён',
    not_applicable: 'НДС не облагается',
  },
};

const DATE_FIELDS = new Set([
  'date_start',
  'start_date',
  'date_finish',
  'finish_date',
  'end_date',
  'publish_date',
  'application_deadline',
  'bidding_date',
]);

const DATETIME_FIELDS = new Set([
  'created_at',
  'updated_at',
  'bidding_time',
  'start_time',
  'end_time',
  'time_start',
  'time_finish',
]);

function hasCyrillic(value) {
  return /[а-яё]/i.test(String(value || ''));
}

function normalizeKey(raw) {
  if (!raw && raw !== 0) return '';
  const str = String(raw);
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^\p{L}\p{Nd}]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function translateTokens(tokens) {
  const translated = tokens.map((token) => {
    if (!token) return '';
    const lower = token.toLowerCase();
    return TOKEN_LABELS[lower] || lower;
  });
  const text = translated.join(' ').replace(/\s+/g, ' ').trim();
  return capitalize(text || tokens.join(' '));
}

export function translateFieldKey(key) {
  if (key == null) return '';
  const raw = String(key).trim();
  if (!raw) return '';
  if (hasCyrillic(raw)) {
    return capitalize(raw);
  }
  const normalized = normalizeKey(raw);
  if (normalized in EXACT_FIELD_LABELS) {
    return EXACT_FIELD_LABELS[normalized];
  }
  if (!normalized) {
    return capitalize(raw);
  }
  const tokens = normalized.split('_').filter(Boolean);
  if (!tokens.length) {
    return capitalize(raw);
  }
  return translateTokens(tokens);
}

export function translateLabelKey(key) {
  return translateFieldKey(key);
}


export function translateValueByKey(key, value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (hasCyrillic(trimmed)) return trimmed;
    const normalizedKey = normalizeKey(key || '');
    const dict = VALUE_TRANSLATIONS[normalizedKey];
    if (dict) {
      const normalizedValue = normalizeKey(trimmed);
      if (normalizedValue in dict) {
        return dict[normalizedValue];
      }
      if (trimmed.toLowerCase() in dict) {
        return dict[trimmed.toLowerCase()];
      }
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (/^[A-Z0-9\-]+$/i.test(trimmed) && !hasCyrillic(trimmed)) {
      return trimmed;
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => translateValueByKey(key, item));
  }
  return value;
}

function formatDateValue(value, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', options);
}

export function formatValueForDisplay(key, rawValue) {
  if (rawValue == null || rawValue === '') return '—';

  const normalizedKey = normalizeKey(key || '');
  if (DATE_FIELDS.has(normalizedKey)) {
    return formatDateValue(rawValue, { dateStyle: 'short' });
  }
  if (DATETIME_FIELDS.has(normalizedKey)) {
    return formatDateValue(rawValue, { dateStyle: 'short', timeStyle: 'short' });
  }

  const value = translateValueByKey(key, rawValue);

  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const parts = value
      .map((item) => {
        if (item == null || item === '') return '';
        if (Array.isArray(item)) {
          return formatValueForDisplay(key, item);
        }
        if (typeof item === 'object') {
          try {
            return JSON.stringify(item, null, 2);
          } catch {
            return String(item);
          }
        }
        return formatValueForDisplay(key, item);
      })
      .filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat('ru-RU').format(value);
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function makeKeyValueEntries(source) {
  if (!source) return [];
  const entries = [];

  if (Array.isArray(source)) {
    source.forEach((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const label =
          item.label ||
          item.title ||
          item.name ||
          item.type ||
          item.key ||
          item.stage ||
          `#${index + 1}`;
        const value = 'value' in item ? item.value : item;
        entries.push({ key: label, value });
      } else {
        entries.push({ key: `#${index + 1}`, value: item });
      }
    });
  } else if (typeof source === 'object') {
    Object.entries(source).forEach(([key, value]) => {
      entries.push({ key, value });
    });
  } else {
    entries.push({ key: 'Значение', value: source });
  }

  return entries
    .map(({ key, value }, index) => {
      const safeKey = key || `#${index + 1}`;
      const displayValue = formatValueForDisplay(safeKey, value);
      if (displayValue === '—') return null;
      return {
        key: translateFieldKey(safeKey),
        value: displayValue,
      };
    })
    .filter(Boolean);
}

export function localizeListingBadge(value) {
  if (value == null) return value;
  const translated = translateValueByKey('status', value);
  return typeof translated === 'string' ? translated : value;
}

