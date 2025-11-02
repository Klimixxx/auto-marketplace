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
    if (Array.isArray(input)) return input.flatMap((entry) => toArray(entry));
    const text = typeof input === 'string' ? input : String(input);
    return text.split(',').map((p) => p.trim()).filter(Boolean);
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

  // -------- Регионы: селект-подобный дропдаун ----------
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
        if (!map.has(code)) map.set(code, { code, name: code });
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
    const map = new Map(regionOptions.map((r) => [r.code, r]));
    return regionCodes.map((code) => map.get(code) || { code, name: code }).filter(Boolean);
  }, [regionCodes, regionOptions]);

  const filteredRegionOptions = useMemo(() => {
    if (!regionSearchTerm) return regionOptions;
    const q = regionSearchTerm.trim().toLowerCase();
    if (!q) return regionOptions;
    return regionOptions.filter((r) => {
      const name = r?.name ? String(r.name).toLowerCase() : '';
      const code = r?.code ? String(r.code).toLowerCase() : '';
      return name.includes(q) || code.includes(q);
    });
  }, [regionOptions, regionSearchTerm]);

  const regionSummary = useMemo(() => {
    if (!regionCodes.length) return 'Все регионы';
    const names = selectedRegionRecords.map((r) => r.name || r.code);
    if (names.length <= 1) return names.join(', ');
    if (names.length <= 3) return names.join(', ');
    return `${names.length} регионов`;
  }, [regionCodes, selectedRegionRecords]);

  const canResetRegions = regionCodes.length > 0 || regionSearchTerm.trim().length > 0;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    function handleClickOutside(e) {
      if (!regionMenuRef.current) return;
      if (regionMenuRef.current.contains(e.target)) return;
      setRegionMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isRegionMenuOpen || typeof document === 'undefined') return;
    const input = regionSearchInputRef.current;
    input?.focus({ preventScroll: true });
    function onKey(e) {
      if (e.key === 'Escape') setRegionMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isRegionMenuOpen]);

  useEffect(() => {
    if (!isRegionMenuOpen) setRegionSearchTerm('');
  }, [isRegionMenuOpen]);

  // --------- Типы торгов ----------
  const tradeTypeOptions = useMemo(() => {
    const normalized = new Set();
    const preferredOrder = ['public_offer', 'open_auction'];
    preferredOrder.forEach((c) => normalized.add(c));
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
      const la = TRADE_TYPE_LABELS[a] || formatTradeTypeLabel(a) || a;
      const lb = TRADE_TYPE_LABELS[b] || formatTradeTypeLabel(b) || b;
      return la.localeCompare(lb, 'ru');
    });
    return options;
  }, [meta.tradeTypes]);

  // --------- Загрузка меты ----------
  useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const res = await fetch(api('/api/listings/meta'));
        if (!res.ok) throw new Error('meta');
        const data = await res.json();
        if (!ignore) {
          const next = data && typeof data === 'object' && !Array.isArray(data)
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

  // --------- Сброс при смене initial ----------
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

        {/* Регион — выглядит как обычный select, но с мультивыбором */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Регион</span>
          <div className="region-select-wrap" ref={regionMenuRef}>
            <button
              type="button"
              className={`input pro select region-trigger ${isRegionMenuOpen ? 'open' : ''}`}
              onClick={() => setRegionMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={isRegionMenuOpen}
              title={regionSummary}
            >
              <span className="truncate">{regionSummary}</span>
            </button>

            {isRegionMenuOpen && (
              <div className="select-like-dropdown" role="listbox" aria-multiselectable="true">
                <div className="select-like-head">
                  <div className="head-left">
                    <strong>Выбор регионов</strong>
                    <span className="muted">
                      {regionCodes.length ? `Выбрано: ${regionCodes.length}` : 'Все регионы'}
                    </span>
                  </div>
                  <div className="head-actions">
                    <button
                      type="button"
                      className="link-btn"
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

                <div className="select-like-search">
                  <input
                    ref={regionSearchInputRef}
                    type="search"
                    placeholder="Поиск региона…"
                    value={regionSearchTerm}
                    onChange={(e) => setRegionSearchTerm(e.target.value)}
                  />
                </div>

                {filteredRegionOptions.length ? (
                  <ul className="select-like-list">
                    {filteredRegionOptions.map((region) => {
                      const checked = regionCodes.includes(region.code);
                      return (
                        <li key={region.code}>
                          <label className={`select-like-option ${checked ? 'selected' : ''}`}>
                            {/* скрытый чекбокс, чтобы строка выглядела как у обычного select */}
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
                              aria-label={region.name}
                            />
                            <span className="option-text">{region.name}</span>
                            <span className="option-check" aria-hidden="true" />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="select-like-empty">
                    <strong>Ничего не нашлось</strong>
                    <span className="muted">Измените запрос</span>
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
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginTop: 4 }}
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
              style={{ background: '#ffffff', color: '#374151', border: '1px solid #D1D5DB', whiteSpace: 'nowrap' }}
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
        .btn.primary { background: #1E90FF; color: #fff; }
        .btn.primary:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(30,144,255,.28); filter: brightness(1.03); }
        .btn.secondary { background: rgba(255,255,255,.8); color: #111827; border: 1px solid var(--line); }
        .btn.secondary:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(17,24,39,.08); background: #fff; }
        .btn.ghost { background: #ffffff; color: #374151; border: 1px solid #D1D5DB; }
        .btn.ghost:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(17,24,39,.08); background: #F9FAFB; border-color: #CBD5E1; color: #111827; }

        /* ---------- Регионы: селект-подобный дропдаун ---------- */
        .region-select-wrap { position: relative; }
        .region-trigger { display: flex; align-items: center; justify-content: space-between; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }

        .select-like-dropdown {
          position: absolute;
          z-index: 30;
          top: calc(100% + 4px);
          left: 0;
          min-width: 100%;
          width: min(560px, calc(100vw - 40px));
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          box-shadow: 0 16px 32px rgba(0,0,0,.08);
          overflow: hidden;
        }

        .select-like-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
        }
        .head-left { display: grid; gap: 2px; }
        .muted { color: #6b7280; font-size: 12px; }
        .head-actions { display: flex; gap: 8px; }
        .link-btn {
          background: transparent;
          border: none;
          color: #1E90FF;
          font-weight: 700;
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
        }
        .link-btn:disabled { color: #94a3b8; cursor: default; }

        .select-like-search {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          background: #fff;
        }
        .select-like-search input {
          width: 100%;
          height: 32px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0 10px;
          font-size: 14px;
          outline: none;
        }
        .select-like-search input:focus {
          border-color: #1E90FF;
          box-shadow: 0 0 0 3px rgba(30,144,255,.15);
        }

        .select-like-list {
          max-height: 280px;
          overflow-y: auto;
          list-style: none;
          margin: 0;
          padding: 4px 0;
        }
        .select-like-list::-webkit-scrollbar { width: 8px; }
        .select-like-list::-webkit-scrollbar-thumb { background: rgba(148,163,184,.45); border-radius: 999px; }

        .select-like-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background .1s ease;
        }
        .select-like-option:hover { background: #f3f4f6; }
        .select-like-option input { display: none; } /* прячем чекбокс */
        .select-like-option .option-text {
          flex: 1;
          font-size: 14px;
          color: #0f172a;
          line-height: 1.35;
        }
        .select-like-option .option-check::after {
          content: '';
          width: 0;
          height: 0;
          display: inline-block;
        }
        .select-like-option.selected .option-check::after {
          content: '';
          width: 14px;
          height: 14px;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 9.5L2.5 6.5l1.1-1.1 1.9 1.9 4-4 1.1 1.1-5.1 5.1z' fill='%231E90FF'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
        }

        .select-like-empty {
          padding: 28px 16px;
          text-align: center;
        }

        @media (max-width: 719.98px) {
          .filters-panel-pro { padding: 10px; }
          .actions { flex-direction: column; align-items: stretch; }
          .select-like-dropdown { width: calc(100vw - 32px); }
        }
      `}</style>
    </form>
  );
}
