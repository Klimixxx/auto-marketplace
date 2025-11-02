import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TRADE_TYPE_LABELS, formatTradeTypeLabel, normalizeTradeTypeCode } from '../lib/tradeTypes';
import { RUSSIAN_REGIONS } from '../../shared/regions.js';

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

function normalizeRegionCodes(value) {
  if (value === undefined || value === null) return [];
  const toArray = (input) => {
    if (input === undefined || input === null) return [];
    if (Array.isArray(input)) {
      return input.flatMap((entry) => toArray(entry));
    }
    const text = typeof input === 'string' ? input : String(input);
    return text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  };
  const flattened = toArray(value);
  const unique = new Set();
  flattened.forEach((code) => {
    const normalized = typeof code === 'string' ? code.trim() : String(code);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique.values());
}

export default function FilterBar({
  onSearch,
  initial,
  favoritesCount = 0,
  showFavoritesLink = true,
}) {
  const [q, setQ] = useState(initial?.q || '');
  const [regionCodes, setRegionCodes] = useState(
    () => normalizeRegionCodes(initial?.region_code ?? initial?.region)
  );
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
  const [isRegionMenuOpen, setRegionMenuOpen] = useState(false);
  const [regionSearchTerm, setRegionSearchTerm] = useState('');
  const regionMenuRef = useRef(null);
  const regionSearchInputRef = useRef(null);

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

  const selectedRegionRecords = useMemo(() => {
    if (!Array.isArray(regionCodes) || !regionCodes.length) return [];
    const map = new Map(regionOptions.map((region) => [region.code, region]));
    return regionCodes.map((code) => map.get(code) || { code, name: code }).filter(Boolean);
  }, [regionCodes, regionOptions]);

  const filteredRegionOptions = useMemo(() => {
    if (!regionSearchTerm) return regionOptions;
    const query = regionSearchTerm.trim().toLowerCase();
    if (!query) return regionOptions;
    return regionOptions.filter((region) => {
      const name = region?.name ? String(region.name).toLowerCase() : '';
      const code = region?.code ? String(region.code).toLowerCase() : '';
      return name.includes(query) || code.includes(query);
    });
  }, [regionOptions, regionSearchTerm]);

  const regionSummary = useMemo(() => {
    if (!regionCodes.length) return 'Все регионы';
    const names = selectedRegionRecords.map((region) => region.name || region.code);
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(', ');
    return `${names.length} регионов`;
  }, [regionCodes, selectedRegionRecords]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    function handleClickOutside(event) {
      if (!regionMenuRef.current) return;
      if (regionMenuRef.current.contains(event.target)) return;
      setRegionMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isRegionMenuOpen || typeof document === 'undefined') return undefined;
    const input = regionSearchInputRef.current;
    if (input) {
      input.focus({ preventScroll: true });
      input.select?.();
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        setRegionMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isRegionMenuOpen]);

  useEffect(() => {
    if (!isRegionMenuOpen) {
      setRegionSearchTerm('');
    }
  }, [isRegionMenuOpen]);

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
    setRegionCodes(normalizeRegionCodes(initial?.region_code ?? initial?.region));
    setCity(initial?.city || '');
    setBrand(initial?.brand || '');
    setTradeType(normalizeTradeTypeCode(initial?.trade_type) || '');
    setMinPrice(initial?.minPrice || '');
    setMaxPrice(initial?.maxPrice || '');
  }, [initial]);

  function submit(e) {
    e.preventDefault();
    onSearch({
      q,
      region_code: regionCode,
      city,
      brand,
      trade_type: tradeType,
      minPrice,
      maxPrice,
    });
  }

  function resetFilters() {
    setQ('');
    setRegionCode('');
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
          <div className="input-wrap" ref={regionMenuRef}>
            <button
              type="button"
              className={`input pro multi-trigger ${isRegionMenuOpen ? 'open' : ''}`}
              onClick={() => setRegionMenuOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isRegionMenuOpen}
            >
              <span className="trigger-label">{regionSummary}</span>
            </button>
            {isRegionMenuOpen ? (
              <div className="region-dropdown" role="listbox" aria-multiselectable="true">
                <div className="region-dropdown-content">
                  <label className="region-option all-regions">
                    <input
                      type="checkbox"
                      checked={regionCodes.length === 0}
                      onChange={() => setRegionCodes([])}
                    />
                    <span>Все регионы</span>
                  </label>
                  <div className="region-search">
                    <input
                      ref={regionSearchInputRef}
                      className="region-search-input"
                      type="search"
                      placeholder="Поиск региона"
                      value={regionSearchTerm}
                      onChange={(event) => setRegionSearchTerm(event.target.value)}
                    />
                  </div>
                  <div className="region-options" role="group">
                    {filteredRegionOptions.length ? (
                      filteredRegionOptions.map((region) => {
                        const checked = regionCodes.includes(region.code);
                        return (
                          <label key={region.code} className={`region-option ${checked ? 'checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setRegionCodes((prev) => {
                                  const exists = prev.includes(region.code);
                                  if (exists) {
                                    return prev.filter((code) => code !== region.code);
                                  }
                                  return [...prev, region.code];
                                });
                              }}
                            />
                            <span>{region.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="region-empty">Регион не найден</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
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

        .multi-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          padding-right: 36px;
        }
        .multi-trigger::after {
          content: '';
          width: 14px;
          height: 14px;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
          flex-shrink: 0;
          transition: transform .18s ease;
        }
        .multi-trigger.open::after {
          transform: rotate(180deg);
        }
        .multi-trigger .trigger-label {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .region-dropdown {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
          padding: 4px 0;
        }
        .region-dropdown-content {
          display: flex;
          flex-direction: column;
          max-height: 320px;
        }
        .region-search {
          padding: 8px 16px 12px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%);
        }
        .region-search-input {
          width: 100%;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(226,232,240,0.9);
          padding: 0 10px;
          font-size: 14px;
          color: var(--text);
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .region-search-input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.12);
        }
        .region-options {
          overflow-y: auto;
          max-height: 260px;
          padding: 4px 0 6px;
        }
        .region-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          font-size: 14px;
          color: var(--text);
          cursor: pointer;
        }
        .region-option input {
          flex-shrink: 0;
        }
        .region-option span {
          flex: 1;
        }
        .region-option:hover {
          background: rgba(30,144,255,.08);
        }
        .region-option.checked span {
          font-weight: 600;
        }
        .region-option.all-regions {
          position: sticky;
          top: 0;
          background: linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(248,250,252,0.88) 100%);
          border-bottom: 1px solid var(--line);
          z-index: 1;
        }
        .region-empty {
          padding: 16px;
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }

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




