import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TRADE_TYPE_LABELS, formatTradeTypeLabel, normalizeTradeTypeCode } from '../lib/tradeTypes';
import { RUSSIAN_REGIONS } from '../../shared/regions.js';

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

function parseRegionCodes(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((item) => String(item ?? '').split(','))
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
      )
    );
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return parseRegionCodes(value.value);
  }
  return [];
}

function serializeRegionCodes(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return '';
  return codes
    .map((code) => String(code || '').trim())
    .filter(Boolean)
    .join(',');
}

export default function FilterBar({
  onSearch,
  initial,
  favoritesCount = 0,
  showFavoritesLink = true,
  allowMultipleRegions = true,
}) {
  const [q, setQ] = useState(initial?.q || '');
  const [regionCodes, setRegionCodes] = useState(() => {
    const parsed = parseRegionCodes(initial?.region_code || initial?.region);
    return allowMultipleRegions ? parsed : parsed.slice(0, 1);
  });
  const [city, setCity] = useState(initial?.city || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [tradeType, setTradeType] = useState(() => normalizeTradeTypeCode(initial?.trade_type) || '');
  const [minPrice, setMinPrice] = useState(initial?.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initial?.maxPrice || '');
  const EMPTY_META = useMemo(
    () => ({ regions: RUSSIAN_REGIONS, cities: [], brands: [], tradeTypes: [] }),
    []
  );

  const [meta, setMeta] = useState(EMPTY_META);
  const [isRegionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const regionDropdownRef = useRef(null);
  const selectedRegionCodes = allowMultipleRegions ? regionCodes : regionCodes.slice(0, 1);
  const singleRegionValue = selectedRegionCodes[0] || '';
  const regionOptions = useMemo(() => {
    const fallback = Array.isArray(RUSSIAN_REGIONS) ? RUSSIAN_REGIONS : [];
    const metaRegions = Array.isArray(meta.regions) && meta.regions.length ? meta.regions : fallback;
    const map = new Map();
    fallback.forEach((item) => {
      if (item?.code) {
        const code = String(item.code);
        map.set(code, { code, name: item.name || code });
      }
    });
    metaRegions.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === 'string') {
        const code = entry;
        if (!map.has(code)) {
          map.set(code, { code, name: code });
        }
      } else if (typeof entry === 'object') {
        const code = entry.code ?? entry.value ?? entry.id;
        if (!code) return;
        const stringCode = String(code);
        const name = entry.name || entry.label || entry.title || entry.region || stringCode;
        map.set(stringCode, { code: stringCode, name });
      }
    });
    return Array.from(map.values());
  }, [meta.regions]);

const tradeTypeOptions = useMemo(() => {
    const normalized = new Set();
    const preferredOrder = ['public_offer', 'open_auction'];

    preferredOrder.forEach((code) => normalized.add(code));
    (meta.tradeTypes || []).forEach((value) => {
      const code = normalizeTradeTypeCode(value);
      if (code) normalized.add(code);
    });

    const options = Array.from(normalized);
    options.sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      const labelA = TRADE_TYPE_LABELS[a] || formatTradeTypeLabel(a) || a;
      const labelB = TRADE_TYPE_LABELS[b] || formatTradeTypeLabel(b) || b;
      return labelA.localeCompare(labelB, 'ru');
    });

    return options;
  }, [meta.tradeTypes]);

  const regionNameMap = useMemo(() => {
    const map = new Map();
    regionOptions.forEach((region) => {
      if (region?.code) {
        map.set(region.code, region.name || region.code);
      }
    });
    return map;
  }, [regionOptions]);

  const regionSummary = useMemo(() => {
    if (!selectedRegionCodes.length) return 'Все регионы';
    const names = selectedRegionCodes
      .map((code) => regionNameMap.get(code) || code)
      .filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} + ещё ${names.length - 2}`;
  }, [selectedRegionCodes, regionNameMap]);

  useEffect(() => {
    if (!allowMultipleRegions) {
      return () => {};
    }
    function handleClickOutside(event) {
      if (!regionDropdownRef.current) return;
      if (!regionDropdownRef.current.contains(event.target)) {
        setRegionDropdownOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setRegionDropdownOpen(false);
      }
    }

    if (typeof document === 'undefined') {
      return () => {};
    }

    if (isRegionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [allowMultipleRegions, isRegionDropdownOpen]);

  useEffect(() => {
    if (!allowMultipleRegions && isRegionDropdownOpen) {
      setRegionDropdownOpen(false);
    }
  }, [allowMultipleRegions, isRegionDropdownOpen]);
  useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const res = await fetch(api('/api/listings/meta'));
        if (!res.ok) throw new Error('meta');
        const data = await res.json();
        if (!ignore) {
          const next =
            data && typeof data === 'object' && !Array.isArray(data)
              ? {
                  regions: Array.isArray(data.regions) && data.regions.length ? data.regions : RUSSIAN_REGIONS,
                  cities: Array.isArray(data.cities) ? data.cities : [],
                  brands: Array.isArray(data.brands) ? data.brands : [],
                  tradeTypes: Array.isArray(data.tradeTypes) ? data.tradeTypes : [],
                }
              : EMPTY_META;
          setMeta(next);
        }
      } catch (e) {
        console.error('Failed to load filter options', e);
        if (!ignore) setMeta(EMPTY_META);
      }
    }
    loadMeta();
    return () => { ignore = true; };
  }, [EMPTY_META]);

  useEffect(() => {
    setQ(initial?.q || '');
    const parsed = parseRegionCodes(initial?.region_code || initial?.region);
    setRegionCodes(allowMultipleRegions ? parsed : parsed.slice(0, 1));
    setCity(initial?.city || '');
    setBrand(initial?.brand || '');
    setTradeType(normalizeTradeTypeCode(initial?.trade_type) || '');
    setMinPrice(initial?.minPrice || '');
    setMaxPrice(initial?.maxPrice || '');
  }, [initial, allowMultipleRegions]);

  function toggleRegionSelection(code) {
    setRegionCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((item) => item !== code);
      }
      return [...prev, code];
    });
  }

  function clearRegions() {
    setRegionCodes([]);
  }

  function submit(e) {
    e.preventDefault();
    onSearch({
      q,
      region_code: serializeRegionCodes(selectedRegionCodes),
      city,
      brand,
      trade_type: tradeType,
      minPrice,
      maxPrice,
    });
  }

function resetFilters() {
    setQ('');
    setRegionCodes([]);
    setCity('');
    setBrand('');
    setTradeType('');
    setMinPrice('');
    setMaxPrice('');
    onSearch({
      q: '',
      region_code: '',
      city: '',
      brand: '',
      trade_type: '',
      minPrice: '',
      maxPrice: '',
    });
  }

  return (
    <form onSubmit={submit} className="filters-panel-pro" aria-label="Фильтры поиска по торгам">
      <div className="row compact">
        {/* Поиск */}
        <label className="field col-span-12 md:col-span-6 lg:col-span-4">
          <span className="label">Поиск</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="Марка, модель, номер лота…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {/* иконку поиска убрали по ТЗ */}
          </div>
        </label>

           {/* Регион */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Регион</span>
          <div className="input-wrap">
            {allowMultipleRegions ? (
              <div
                ref={regionDropdownRef}
                className={`region-multi-select ${isRegionDropdownOpen ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="input pro multi-select-trigger"
                  onClick={() => setRegionDropdownOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isRegionDropdownOpen}
                >
                  <span className={`multi-select-label ${selectedRegionCodes.length ? 'has-value' : ''}`}>
                    {regionSummary}
                  </span>
                  <span className="multi-select-arrow" aria-hidden="true" />
                </button>
                {isRegionDropdownOpen ? (
                  <div className="multi-select-dropdown" role="listbox" aria-multiselectable="true">
                    <button type="button" className="multi-select-option" onClick={clearRegions}>
                      <span className="checkbox">
                        <input type="checkbox" checked={regionCodes.length === 0} readOnly />
                      </span>
                      <span>Все регионы</span>
                    </button>
                    <div className="multi-select-options">
                      {regionOptions.map((region) => {
                        const checked = regionCodes.includes(region.code);
                        return (
                          <label key={region.code} className={`multi-select-option${checked ? ' is-selected' : ''}`}>
                            <span className="checkbox">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRegionSelection(region.code)}
                              />
                            </span>
                            <span>{region.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <select
                className="input pro select"
                value={singleRegionValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setRegionCodes(value ? [value] : []);
                }}
              >
                <option value="">Все регионы</option>
                {regionOptions.map((region) => (
                  <option key={region.code} value={region.code}>{region.name}</option>
                ))}
              </select>
            )}
          </div>
        </label>

        {/* Город */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Город</span>
          <div className="input-wrap">
            <select className="input pro select" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Все города</option>
              {meta.cities?.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </label>

        {/* Марка */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Марка</span>
          <div className="input-wrap">
            <select className="input pro select" value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Все марки</option>
              {meta.brands?.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </label>

        {/* Тип торгов */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Тип торгов</span>
          <div className="input-wrap">
            <select className="input pro select" value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
              <option value="">Все типы</option>
              {tradeTypeOptions.map((value) => (
                <option key={value} value={value}>{TRADE_TYPE_LABELS[value] || formatTradeTypeLabel(value) || value}</option>
              ))}
            </select>
          </div>
        </label>

        {/* Цена от/до */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Мин. цена</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="от"
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            {/* Убрали символ ₽ */}
          </div>
        </label>

        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Макс. цена</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="до"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
            {/* Убрали символ ₽ */}
          </div>
        </label>

       
        {/* Кнопки */}
<div
  className="actions col-span-12"
  style={{
    display: 'flex',
    justifyContent: 'flex-end', // ← всё вправо в одну линию
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  }}
>
  <button type="button" className="btn secondary hover-reset" onClick={resetFilters}>
    Сбросить
  </button>
  <button type="submit" className="btn primary">
    Показать
  </button>

  {/* Кнопка "Мои избранные" — вправо и с нейтральным стилем */}
  {showFavoritesLink ? (
    <Link
      href="/favorites"
      className="btn ghost fav-btn"
      style={{
        background: '#ffffff',          // принудительно белая
        color: '#374151',               // серо-графитовый текст
        border: '1px solid #D1D5DB',    // светло-серый бордер
        whiteSpace: 'nowrap',
      }}
    >
      Мои избранные{favoritesCount ? ` (${favoritesCount})` : ''}
    </Link>
  ) : null}
</div>
</div> 



      {/* Стили: компактный размер и полупрозрачный голубой фон */}
      <style jsx>{`
        :root {
          --brand: #1E90FF;
          --text: #0f172a;
          --muted: #6b7280;
          --line: #dbe3ed;
          --filters-bg: rgba(230, 238, 248, .8);
        }

        .filters-panel-pro {
          background: var(--filters-bg);
          border-radius: 14px;
          border: 1px solid rgba(30,144,255,.08);
          box-shadow: none;
          padding: 12px;
          backdrop-filter: saturate(1.05) blur(1.5px);
        }

        /* 12-колоночная сетка + адаптивные помощники */
        .row.compact {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 10px 12px;
          align-items: end;
        }
        .col-span-12 { grid-column: span 12 / span 12; }
        .col-span-6  { grid-column: span 6 / span 6; }
        .md\\:col-span-6 { grid-column: span 12 / span 12; }
        .md\\:col-span-3 { grid-column: span 12 / span 12; }
        .lg\\:col-span-4 { grid-column: span 12 / span 12; }
        .lg\\:col-span-2 { grid-column: span 12 / span 12; }

        @media (min-width: 720px) {
          .md\\:col-span-6 { grid-column: span 6 / span 6; }
          .md\\:col-span-3 { grid-column: span 3 / span 3; }
        }
        @media (min-width: 1024px) {
          .lg\\:col-span-4 { grid-column: span 4 / span 4; }
          .lg\\:col-span-2 { grid-column: span 2 / span 2; }
        }

        .field { display: grid; gap: 4px; }
        .label {
          font-size: 11px;
          color: var(--brand);      /* подписи стали синими */
          font-weight: 600;
        }

        .input-wrap { position: relative; display: flex; align-items: center; }

        .input.pro {
          width: 100%;
          height: 38px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 0 12px;
          background: rgba(255,255,255,.8);
          color: var(--text);
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .input.pro:hover  { background: #fff; }
        .input.pro:focus  {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.15);
          background: #fff;
        }

           /* кастомная стрелка для select */
        .select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 30px;
        }

        .region-multi-select {
          position: relative;
          width: 100%;
        }

        .multi-select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
        }

        .multi-select-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--muted);
          font-size: 14px;
          text-align: left;
        }

        .multi-select-label.has-value {
          color: var(--text);
        }

        .multi-select-arrow {
          flex-shrink: 0;
          width: 14px;
          height: 14px;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
          transition: transform .15s ease;
        }

        .region-multi-select.is-open .multi-select-arrow {
          transform: rotate(180deg);
        }

        .multi-select-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 20;
          background: #fff;
          border-radius: 12px;
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(30,144,255,.18);
          padding: 6px 0;
          max-height: 280px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .multi-select-options {
          overflow-y: auto;
          max-height: 220px;
        }

        .multi-select-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 6px 14px;
          font-size: 14px;
          cursor: pointer;
          color: var(--text);
          transition: background .12s ease;
        }

        .multi-select-option:hover {
          background: rgba(30,144,255,.08);
        }

        .multi-select-option.is-selected {
          background: rgba(30,144,255,.12);
        }

        button.multi-select-option {
          background: transparent;
          border: none;
          text-align: left;
          font: inherit;
        }

        button.multi-select-option:focus-visible,
        .multi-select-trigger:focus-visible {
          outline: none;
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.15);
        }

        .multi-select-option .checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .multi-select-option input[type='checkbox'] {
          width: 16px;
          height: 16px;
        }

        /* иконку поиска и суффикс ₽ мы удалили, соответствующие стили не нужны */

        .actions {
  display: flex;
  justify-content: flex-end; /* всё уводим вправо в одну линию */
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}
.right-actions { display: flex; gap: 8px; }


        .btn {
          height: 38px;
          border-radius: 10px;
          padding: 0 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
        }
        .btn.primary {
          background: #1E90FF;
          color: #fff;
        }
        .btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(30,144,255,.28);
          filter: brightness(1.03);
        }
        .btn.secondary {
          background: rgba(255,255,255,.8);
          color: #111827;
          border: 1px solid var(--line);
        }
        .btn.secondary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(17,24,39,.08);
          background: #fff;
        }
        /* Менее синий, нейтрально-серый стиль для "Мои избранные" */
.btn.ghost {
  background: #ffffff;
  color: #374151;              /* slate-700 */
  border: 1px solid #D1D5DB;   /* gray-300 */
}
.btn.ghost:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(17,24,39,.08); /* мягкая тень */
  background: #F9FAFB;         /* gray-50 */
  border-color: #CBD5E1;       /* slate-300 */
  color: #111827;              /* slate-900 */
}


        @media (max-width: 719.98px) {
          .filters-panel-pro { padding: 10px; }
          .actions { flex-direction: column; align-items: stretch; }
          .right-actions { justify-content: stretch; }
        }
      `}</style>
        <style jsx>{`
  /* Контейнер действий: всё вправо — для надёжности (если снимешь inline-стили) */
  .actions {
    justify-content: flex-end;
  }

  /* Серая версия кнопки "Мои избранные" поверх глобальных .btn правил */
  :global(.fav-btn) {
    background: #ffffff !important;
    color: #374151 !important;
    border: 1px solid #D1D5DB !important;
  }
  :global(.fav-btn:hover) {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(17,24,39,.08);
    background: #F9FAFB !important;
    border-color: #CBD5E1 !important;
    color: #111827 !important;
  }
`}</style>

    </form>
  );
}



