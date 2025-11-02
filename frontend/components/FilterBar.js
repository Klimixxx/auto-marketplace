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

  // --- Регион: состояние выпадающего списка
  const [isRegionMenuOpen, setRegionMenuOpen] = useState(false);
  const [regionSearchTerm, setRegionSearchTerm] = useState('');
  const regionMenuRef = useRef(null);
  const regionSearchInputRef = useRef(null);

  // Собираем опции регионов (мета + fallback), нормализуем {code, name}
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
    if (names.length <= 3) return names.join(', ');
    return `${names.length} регионов`;
  }, [regionCodes, selectedRegionRecords]);

  const canResetRegions = regionCodes.length > 0 || regionSearchTerm.trim().length > 0;

  // Клик снаружи — закрываем меню
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

  // Фокус в поиске + Esc
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

  // Очистка строки поиска при закрытии
  useEffect(() => {
    if (!isRegionMenuOpen) {
      setRegionSearchTerm('');
    }
  }, [isRegionMenuOpen]);

  // Список типов торгов (с приоритетом)
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

  // Загрузка метаданных для фильтров
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

  // Сбрасываем локальные состояния при смене initial
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
          </div>
        </label>

        {/* Регион — упрощённый кастомный «select» с мультивыбором и поиском */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Регион</span>
          <div className="custom-select" ref={regionMenuRef}>
            <button
              type="button"
              className={`select-display ${isRegionMenuOpen ? 'open' : ''}`}
              onClick={() => setRegionMenuOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isRegionMenuOpen}
              title={regionSummary}
            >
              <span className="select-text">{regionSummary}</span>
              <span aria-hidden="true" className={`select-caret ${isRegionMenuOpen ? 'up' : ''}`} />
            </button>

            {isRegionMenuOpen && (
              <div className="select-dropdown" role="listbox" aria-multiselectable="true">
                <div className="dropdown-head">
                  <div className="dropdown-title">
                    <span className="headline">Выбор регионов</span>
                    <span className="subline">
                      {regionCodes.length ? `Выбрано: ${regionCodes.length}` : 'Все регионы'}
                    </span>
                  </div>
                  <div className="dropdown-actions">
                    <button
                      type="button"
                      className={`clear-btn ${canResetRegions ? '' : 'disabled'}`.trim()}
                      disabled={!canResetRegions}
                      onClick={() => {
                        if (!canResetRegions) return;
                        setRegionCodes([]);
                        setRegionSearchTerm('');
                      }}
                    >
                      Очистить
                    </button>
                  </div>
                </div>

                <div className="select-search">
                  <span className="search-icon" aria-hidden="true" />
                  <input
                    ref={regionSearchInputRef}
                    type="search"
                    placeholder="Поиск региона…"
                    value={regionSearchTerm}
                    onChange={(e) => setRegionSearchTerm(e.target.value)}
                  />
                </div>

                {filteredRegionOptions.length ? (
                  <div className="select-options" role="group" aria-label="Список регионов">
                    {filteredRegionOptions.map((region) => {
                      const checked = regionCodes.includes(region.code);
                      return (
                        <label key={region.code} className={`option ${checked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setRegionCodes((prev) => {
                                const exists = prev.includes(region.code);
                                if (exists) return prev.filter((c) => c !== region.code);
                                return [...prev, region.code];
                              });
                            }}
                          />
                          <span className="option-name">{region.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">
                    <strong>Ничего не нашлось</strong>
                    <span>Попробуйте изменить запрос</span>
                  </div>
                )}
              </div>
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
                <option key={value} value={value}>
                  {TRADE_TYPE_LABELS[value] || formatTradeTypeLabel(value) || value}
                </option>
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
          </div>
        </label>

        {/* Кнопки */}
        <div
          className="actions col-span-12"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
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

          {showFavoritesLink ? (
            <Link
              href="/favorites"
              className="btn ghost fav-btn"
              style={{
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #D1D5DB',
                whiteSpace: 'nowrap',
              }}
            >
              Мои избранные{favoritesCount ? ` (${favoritesCount})` : ''}
            </Link>
          ) : null}
        </div>
      </div>

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
          color: var(--brand);
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

        .select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 30px;
        }

        .actions { justify-content: flex-end; }

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
        .btn.ghost {
          background: #ffffff;
          color: #374151;
          border: 1px solid #D1D5DB;
        }
        .btn.ghost:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(17,24,39,.08);
          background: #F9FAFB;
          border-color: #CBD5E1;
          color: #111827;
        }

        /* ---- Новый кастомный select для регионов ---- */
        .custom-select { position: relative; width: 100%; }
        .select-display {
          width: 100%;
          height: 38px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 0 36px 0 12px;
          background: rgba(255,255,255,.8);
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .select-display:hover { background: #fff; }
        .select-display.open {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.15);
          background: #fff;
        }
        .select-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .select-caret {
          position: absolute;
          right: 10px;
          width: 14px;
          height: 14px;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
          transition: transform .18s ease;
        }
        .select-caret.up { transform: rotate(180deg); }

        .select-dropdown {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          min-width: 100%;
          width: min(540px, calc(100vw - 32px));
          background: #fff;
          border: 1px solid rgba(203, 213, 225, 0.65);
          border-radius: 12px;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.2);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 320px;
          overflow: hidden;
        }

        .dropdown-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 2px;
        }
        .dropdown-title { display: flex; flex-direction: column; gap: 2px; }
        .headline { font-size: 14px; font-weight: 700; color: var(--text); }
        .subline {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: var(--muted);
        }
        .clear-btn {
          border: none;
          background: rgba(30,144,255,.08);
          color: var(--brand);
          border-radius: 999px;
          padding: 0 12px;
          height: 28px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background .15s ease, box-shadow .15s ease, transform .15s ease;
        }
        .clear-btn:hover {
          background: rgba(30,144,255,.15);
          box-shadow: 0 6px 16px rgba(30,144,255,.2);
          transform: translateY(-1px);
        }
        .clear-btn.disabled,
        .clear-btn:disabled {
          background: rgba(148,163,184,0.14);
          color: rgba(100,116,139,0.7);
          cursor: default;
          box-shadow: none;
          transform: none;
        }

        .select-search {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(226,232,240,0.9);
          border-radius: 10px;
          padding: 0 10px;
          height: 36px;
          background: linear-gradient(180deg, rgba(248,250,252,0.94) 0%, rgba(255,255,255,0.96) 100%);
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .select-search:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.14);
          background: #fff;
        }
        .search-icon {
          width: 16px; height: 16px; flex-shrink: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.188 11.188l3.07 3.07-1.06 1.06-3.07-3.07a6 6 0 1 1 1.06-1.06zM7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z' fill='%238B97A8'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: center; opacity: .7;
        }
        .select-search input {
          flex: 1; border: none; outline: none; background: transparent;
          font-size: 14px; color: var(--text);
        }

        .select-options {
          overflow-y: auto;
          padding-right: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 220px;
        }
        .select-options::-webkit-scrollbar { width: 8px; }
        .select-options::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.45); border-radius: 999px;
        }

        .option {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(148,163,184,0.25);
          font-size: 14px; color: var(--text);
          cursor: pointer;
          transition: background .1s ease, border-color .1s ease;
        }
        .option:hover {
          background: rgba(30,144,255,.08);
          border-color: rgba(30,144,255,.25);
        }
        .option.checked {
          background: rgba(30,144,255,.12);
          border-color: rgba(30,144,255,.4);
          font-weight: 600;
        }
        .option input { margin-top: 0; flex-shrink: 0; accent-color: var(--brand); }
        .option-name { flex: 1; line-height: 1.35; word-break: break-word; }

        .empty {
          display: grid; place-items: center;
          gap: 6px; padding: 28px 16px;
          border-radius: 10px;
          border: 1px dashed rgba(148,163,184,0.35);
          background: rgba(248,250,252,0.92);
          color: var(--muted);
          font-size: 13px;
          text-align: center;
        }
        .empty strong { color: var(--text); font-size: 14px; }

        @media (max-width: 719.98px) {
          .filters-panel-pro { padding: 10px; }
          .actions { flex-direction: column; align-items: stretch; }
          .select-dropdown { width: calc(100vw - 32px); }
        }
      `}</style>
    </form>
  );
}
