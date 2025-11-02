import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const regionSummary = useMemo(() => {
    if (!validRegionCodes.length) return 'Все регионы';
    const nameByCode = new Map(regionOptions.map((r) => [r.code, r.name || r.code]));
    const names = validRegionCodes.map((c) => nameByCode.get(c) || c);
    if (names.length <= 3) return names.join(', ');
    return `${names.length} регионов`;
  }, [validRegionCodes, regionOptions]);

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
    setCity(initial?.city || '');
    setBrand(initial?.brand || '');
    setTradeType(normalizeTradeTypeCode(initial?.trade_type) || '');
    setMinPrice(initial?.minPrice || '');
    setMaxPrice(initial?.maxPrice || '');
  }, [initial]);

  // submit/reset
  function submit(e) {
    e.preventDefault();
    onSearch({
      q,
      region_code: validRegionCodes,
      city,
      brand,
      trade_type: tradeType,
      minPrice,
      maxPrice,
    });
  }

  function resetFilters() {
    setQ('');
    setRegionCodes(['']); // оставить одну пустую строку
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

  // --- регионы: несколько select
  const rows = (regionCodes.length ? [...regionCodes] : ['']).map((v) => v || '');

  const handleRowChange = (rowIndex, newCode) => {
    setRegionCodes((prev) => {
      const base = prev.length ? [...prev] : [''];
      base[rowIndex] = newCode;
      const seen = new Set();
      const next = [];
      for (const c of base) {
        if (!c) continue;
        if (!seen.has(c)) {
          seen.add(c);
          next.push(c);
        }
      }
      return next.length ? next : [''];
    });
  };

  const addRow = () => {
    setRegionCodes((prev) => {
      const list = prev.length ? [...prev] : [''];
      if (list[list.length - 1] === '') return list;
      return [...list, ''];
    });
  };

  const removeRow = (rowIndex) => {
    setRegionCodes((prev) => {
      const isSingleEmpty = prev.length === 1 && (prev[0] === '' || !prev[0]);
      if (isSingleEmpty) return prev;
      const next = [...prev];
      next.splice(rowIndex, 1);
      return next.length ? next : [''];
    });
  };

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
          <div className="summary">{regionSummary}</div>

          <div className="region-multi">
            {rows.map((value, idx) => {
              const isLast = idx === rows.length - 1;
              const isSingleEmpty = rows.length === 1 && (rows[0] === '' || !rows[0]);
              return (
                <div className="region-row" key={idx}>
                  {/* минус слева */}
                  <button
                    type="button"
                    className="btn icon minus"
                    onClick={() => removeRow(idx)}
                    title="Удалить регион"
                    aria-label="Удалить регион"
                    style={{ visibility: isSingleEmpty ? 'hidden' : 'visible' }}
                  >
                    −
                  </button>

                  {/* селект по центру */}
                  <select
                    className="input pro select region-select"
                    value={value}
                    onChange={(e) => handleRowChange(idx, e.target.value)}
                  >
                    <option value="">{idx === 0 ? 'Все регионы' : 'Выберите регион'}</option>
                    {regionOptions.map((r) => (
                      <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                  </select>

                  {/* плюс справа только у последнего */}
                  <button
                    type="button"
                    className="btn icon plus"
                    onClick={addRow}
                    title="Добавить регион"
                    aria-label="Добавить регион"
                    style={{ visibility: isLast ? 'visible' : 'hidden' }}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>

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
          --icon-size: 18px; /* меньше кнопки */
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
          height: 36px; /* чуть ниже */
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

        .summary { margin: 2px 0 6px; font-size: 12px; color: var(--muted); min-height: 18px; }

        /* меньше расстояние между строками регионов */
        .region-multi { display: grid; gap: 4px; }

        .region-row {
          display: grid;
          grid-template-columns: minmax(var(--icon-size), auto) 1fr minmax(var(--icon-size), auto);
          column-gap: 6px;
          align-items: center;
        }

        /* Жёстко задаем места элементов в сетке */
        .region-row .minus { grid-column: 1; }
        .region-row .region-select { grid-column: 2; width: 100%; }
        .region-row .plus { grid-column: 3; }

        .btn.icon {
          display: inline-grid;
          place-items: center;
          width: var(--icon-size);
          height: var(--icon-size);
          border-radius: 5px;
          border: 1px solid transparent;
          background: var(--brand);
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          line-height: 1;
          padding: 0;
          cursor: pointer;
          transition: transform .12s ease, box-shadow .12s ease, filter .12s ease, opacity .12s ease;
        }
        .btn.icon:hover { transform: translateY(-1px); box-shadow: 0 6px 12px rgba(30,144,255,.25); filter: brightness(1.03); }
        .btn.icon.plus { background: var(--brand); }
        .btn.icon.minus { background: var(--danger); }
        .btn.icon:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }

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
