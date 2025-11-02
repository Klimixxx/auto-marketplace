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

  const canResetRegions = regionCodes.length > 0 || regionSearchTerm.trim().length > 0;

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
      region_code: regionCodes,
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
    setRegionSearchTerm('');
    setCity('');
    setBrand('');
    setTradeType('');
    setMinPrice('');
    setMaxPrice('');
    onSearch({
      q: '',
      region_code: [],
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
                <div className="region-dropdown-card">
                  <div className="region-dropdown-head">
                    <div className="region-dropdown-title">
                      <span className="region-headline">Выберите регионы</span>
                      <span className="region-subline">
                        {regionCodes.length ? `Выбрано ${regionCodes.length}` : 'Все регионы'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`region-clear ${canResetRegions ? '' : 'disabled'}`.trim()}
                      onClick={() => {
                        if (!canResetRegions) return;
                        setRegionCodes([]);
                        setRegionSearchTerm('');
                      }}
                      disabled={!canResetRegions}
                    >
                      Сбросить
                    </button>
                  </div>

                  <div className="region-search">
                    <span className="region-search-icon" aria-hidden="true" />
                    <input
                      ref={regionSearchInputRef}
                      className="region-search-input"
                      type="search"
                      placeholder="Поиск региона"
                      value={regionSearchTerm}
                      onChange={(event) => setRegionSearchTerm(event.target.value)}
                    />
                  </div>

                  <div className="region-options" role="group" aria-label="Список регионов">
                    {filteredRegionOptions.length ? (
                      <ul className="region-option-list">
                        {filteredRegionOptions.map((region) => {
                          const checked = regionCodes.includes(region.code);
                          return (
                            <li key={region.code}>
                              <label className={`region-option ${checked ? 'checked' : ''}`}>
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
                                <span className="region-option-name">{region.name}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="region-empty">
                        <strong>Ничего не нашлось</strong>
                        <span>Попробуйте изменить запрос</span>
                      </div>
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
          min-width: max(100%, 320px);
          width: min(540px, calc(100vw - 32px));
        }
        .region-dropdown-card {
          background: #fff;
          border: 1px solid rgba(203, 213, 225, 0.65);
          border-radius: 16px;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.2);
          padding: 18px 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .region-dropdown-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .region-dropdown-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .region-headline {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }
        .region-subline {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
        }
        .region-clear {
          border: none;
          background: rgba(30,144,255,.08);
          color: var(--brand);
          border-radius: 999px;
          padding: 0 14px;
          height: 32px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s ease, box-shadow .15s ease, transform .15s ease;
        }
        .region-clear:hover {
          background: rgba(30,144,255,.15);
          box-shadow: 0 10px 22px rgba(30,144,255,.2);
          transform: translateY(-1px);
        }
        .region-clear:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(30,144,255,.25);
        }
        .region-clear.disabled,
        .region-clear:disabled {
          background: rgba(148,163,184,0.14);
          color: rgba(100,116,139,0.7);
          cursor: default;
          box-shadow: none;
          transform: none;
        }
        .region-search {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          border: 1px solid rgba(226,232,240,0.9);
          padding: 0 12px;
          height: 38px;
          background: linear-gradient(180deg, rgba(248,250,252,0.94) 0%, rgba(255,255,255,0.96) 100%);
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .region-search:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.14);
          background: #fff;
        }
        .region-search-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.188 11.188l3.07 3.07-1.06 1.06-3.07-3.07a6 6 0 1 1 1.06-1.06zM7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z' fill='%238B97A8'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.7;
        }
        .region-search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: var(--text);
        }
        .region-options {
          max-height: 280px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .region-option-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .region-options::-webkit-scrollbar {
          width: 8px;
        }
        .region-options::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.45);
          border-radius: 999px;
        }
        .region-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(148,163,184,0.25);
          font-size: 14px;
          color: var(--text);
          cursor: pointer;
          transition: background .15s ease, border-color .15s ease;
        }
        .region-option:hover {
          background: rgba(30,144,255,.08);
          border-color: rgba(30,144,255,.25);
        }
        .region-option.checked {
          background: rgba(30,144,255,.12);
          border-color: rgba(30,144,255,.4);
        }
        .region-option input {
          margin-top: 0;
          flex-shrink: 0;
          accent-color: var(--brand);
        }
        .region-option-name {
          flex: 1;
          line-height: 1.4;
          word-break: break-word;
        }
        .region-empty {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 32px 20px;
          border-radius: 14px;
          border: 1px dashed rgba(148,163,184,0.35);
          background: rgba(248,250,252,0.92);
          color: var(--muted);
          font-size: 13px;
          text-align: center;
        }
        .region-empty strong {
          color: var(--text);
          font-size: 14px;
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
          .region-dropdown { width: calc(100vw - 32px); }
          .region-options { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }</style>
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





