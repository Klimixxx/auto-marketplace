import Link from 'next/link';
import { useEffect, useMemo, useState, useRef } from 'react';
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

// Компонент мультиселекта с чекбоксами и поиском
function MultiSelectDropdown({ 
  label, 
  options, 
  selectedValues, 
  onChange, 
  placeholder = 'Все',
  getOptionValue = (opt) => opt,
  getOptionLabel = (opt) => opt 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt => 
      getOptionLabel(opt).toLowerCase().includes(searchLower)
    );
  }, [options, search, getOptionLabel]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const handleToggle = (value) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onChange(Array.from(newSet));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length <= 2) {
      return selectedValues.map(val => {
        const opt = options.find(o => getOptionValue(o) === val);
        return opt ? getOptionLabel(opt) : val;
      }).join(', ');
    }
    return `Выбрано: ${selectedValues.length}`;
  }, [selectedValues, options, placeholder, getOptionValue, getOptionLabel]);

  return (
     <div
      className={`multiselect-dropdown ${isOpen ? 'is-open' : ''}`}
      ref={dropdownRef}
    >
      <div 
        className="multiselect-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="multiselect-text">{displayText}</span>
        <svg 
          className={`multiselect-arrow ${isOpen ? 'open' : ''}`}
          width="14" 
          height="14" 
          viewBox="0 0 14 14"
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      {isOpen && (
        <div className="multiselect-panel">
          <div className="multiselect-search">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="multiselect-actions">
            <button
              type="button"
              className="action-btn"
              style={{background: "red", color: "white"}}
              onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
            >
              Очистить
            </button>
          </div>

          <div className="multiselect-options">
            {filteredOptions.length === 0 ? (
              <div className="no-options">Ничего не найдено</div>
            ) : (
              filteredOptions.map((opt) => {
                const value = getOptionValue(opt);
                const label = getOptionLabel(opt);
                const isChecked = selectedSet.has(value);

                return (
                  <label 
                    key={value} 
                    className="multiselect-option"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(value)}
                      className="option-checkbox"
                    />
                    <span className="option-label">{label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      <style jsx>{`
       .multiselect-dropdown {
          position: relative;
          width: 100%;
        }

        .multiselect-dropdown.is-open {
          z-index: 3200;
        }
        .multiselect-trigger {
          width: 100%;
          height: 36px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 0 30px 0 12px;
          background: rgba(255,255,255,.8);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
          position: relative;
        }

        .multiselect-trigger:hover {
          background: #fff;
        }

        .multiselect-trigger:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255,.15);
          background: #fff;
        }

        .multiselect-text {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }

        .multiselect-arrow {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #758596;
          transition: transform .2s ease;
          pointer-events: none;
        }

        .multiselect-arrow.open {
          transform: translateY(-50%) rotate(180deg);
        }

        .multiselect-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  z-index: 3000; /* было 2100 */
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

        .multiselect-search {
          padding: 8px;
          border-bottom: 1px solid var(--line);
        }

        .search-input {
          width: 100%;
          height: 32px;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          transition: border-color .15s ease;
        }

        .search-input:focus {
          border-color: var(--brand);
        }

        .multiselect-actions {
          display: flex;
          gap: 8px;
          padding: 8px;
          border-bottom: 1px solid var(--line);
        }

        .action-btn {
          flex: 1;
          height: 28px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: rgba(255,255,255,.8);
          color: var(--brand);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s ease;
        }

        .action-btn:hover {
          background: rgba(30,144,255,.08);
          border-color: var(--brand);
        }

        .multiselect-options {
          overflow-y: auto;
          max-height: 220px;
        }

        .multiselect-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background .12s ease;
          user-select: none;
        }

        .multiselect-option:hover {
          background: rgba(30,144,255,.05);
        }

        .option-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--brand);
        }

        .option-label {
          flex: 1;
          font-size: 14px;
          color: var(--text);
        }

        .no-options {
          padding: 16px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

export default function FilterBar({
  onSearch,
  initial,
  favoritesCount = 0,
  showFavoritesLink = true,
  showCityFilter = true,
}) {
  const [q, setQ] = useState(initial?.q || '');
  const [regionCodes, setRegionCodes] = useState(
    () => normalizeRegionCodes(initial?.region_code ?? initial?.region)
  );
  const [cities, setCities] = useState(() => {
    if (!showCityFilter) return [];
    const val = initial?.city || initial?.cities;
    if (!val) return [];
    return Array.isArray(val) ? val : [val].filter(Boolean);
  });
  const [brands, setBrands] = useState(() => {
    const val = initial?.brand || initial?.brands;
    if (!val) return [];
    return Array.isArray(val) ? val : [val].filter(Boolean);
  });
  const [tradeType, setTradeType] = useState(() => normalizeTradeTypeCode(initial?.trade_type) || '');
  const [minPrice, setMinPrice] = useState(initial?.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initial?.maxPrice || '');

  const EMPTY_META = useMemo(
    () => ({ regions: RUSSIAN_REGIONS, cities: [], brands: [], tradeTypes: [] }),
    []
  );
  const [meta, setMeta] = useState(EMPTY_META);
  const hasAutoAppliedRegionsRef = useRef(false);

  // регионы -> [{code,name}] + сортировка
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
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.code).localeCompare(b.name || b.code, 'ru')
    );
  }, [meta.regions]);

  const validRegionCodes = useMemo(
    () => (Array.isArray(regionCodes) ? regionCodes.filter(Boolean) : []),
    [regionCodes]
  );

  // загрузка меты
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

  // синхронизация initial
  useEffect(() => {
    setQ(initial?.q || '');
    setRegionCodes(normalizeRegionCodes(initial?.region_code ?? initial?.region));

    if (showCityFilter) {
      const cityVal = initial?.city || initial?.cities;
      setCities(cityVal ? (Array.isArray(cityVal) ? cityVal : [cityVal].filter(Boolean)) : []);
    } else {
      setCities([]);
    }

    const brandVal = initial?.brand || initial?.brands;
    setBrands(brandVal ? (Array.isArray(brandVal) ? brandVal : [brandVal].filter(Boolean)) : []);
    
    setTradeType(normalizeTradeTypeCode(initial?.trade_type) || '');
    setMinPrice(initial?.minPrice || '');
    setMaxPrice(initial?.maxPrice || '');
  }, [initial, showCityFilter]);

  // submit/reset
  const buildPayload = () => {
    const payload = {
      q,
      region_code: validRegionCodes,
      brand: brands.filter(Boolean),
      trade_type: tradeType,
      minPrice,
      maxPrice,
    };
    if (showCityFilter) payload.city = cities.filter(Boolean);
    return payload;
  };

  function submit(e) {
    e.preventDefault();
    onSearch(buildPayload());
  }

  function resetFilters() {
    setQ('');
    setRegionCodes([]);
    setCities([]);
    setBrands([]);
    setTradeType('');
    setMinPrice('');
    setMaxPrice('');
    const payload = {
      q: '',
      region_code: [],
      brand: [],
      trade_type: '',
      minPrice: '',
      maxPrice: '',
    };
    if (showCityFilter) payload.city = [];
    onSearch(payload);
  }

  useEffect(() => {
    if (!hasAutoAppliedRegionsRef.current) {
      hasAutoAppliedRegionsRef.current = true;
      return;
    }

    onSearch(buildPayload());
  }, [validRegionCodes, onSearch]);

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

        {/* Регионы */}
        <div className="field col-span-6 md:col-span-3 lg:col-span-4">
          <span className="label">Регион</span>
          <MultiSelectDropdown
            label="Регион"
            options={regionOptions}
            selectedValues={validRegionCodes}
            onChange={setRegionCodes}
            placeholder="Все регионы"
            getOptionValue={(opt) => opt.code}
            getOptionLabel={(opt) => opt.name}
          />
        </div>

        {/* Город */}
        {showCityFilter ? (
          <div className="field col-span-6 md:col-span-3 lg:col-span-2">
            <span className="label">Город</span>
            <MultiSelectDropdown
              label="Город"
              options={meta.cities || []}
              selectedValues={cities}
              onChange={setCities}
              placeholder="Все города"
            />
          </div>
        ) : null}

        {/* Марка */}
        <div className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Марка</span>
          <MultiSelectDropdown
            label="Марка"
            options={meta.brands || []}
            selectedValues={brands}
            onChange={setBrands}
            placeholder="Все марки"
          />
        </div>

        {/* Тип торгов */}
        <label className="field col-span-6 md:col-span-3 lg:col-span-2">
          <span className="label">Тип торгов</span>
          <div className="input-wrap">
            <select className="input pro select" value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
              <option value="">Все типы</option>
              {(meta.tradeTypes || []).map((value) => {
                const v = normalizeTradeTypeCode(value);
                return v ? (
                  <option key={v} value={v}>
                    {TRADE_TYPE_LABELS[v] || formatTradeTypeLabel(v) || v}
                  </option>
                ) : null;
              })}
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
          --danger: #ef4444;
        }

        .filters-panel-pro {
  background: var(--filters-bg);
  border-radius: 14px;
  border: 1px solid rgba(30,144,255,.08);
  box-shadow: none;
  padding: 12px;
  backdrop-filter: saturate(1.05) blur(1.5px);
  position: relative; /* z-index удалить */
  z-index: 3100;
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
          height: 36px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 0 12px;
          background: rgba(255,255,255,.8);
          color: var(--text);
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .input.pro:hover { background: #fff; }
        .input.pro:focus  { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30,144,255,.15); background: #fff; }

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

        @media (max-width: 719.98px) {
          .filters-panel-pro { padding: 10px; }
          .actions { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </form>
  );

}





