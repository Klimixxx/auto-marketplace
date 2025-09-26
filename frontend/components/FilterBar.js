import { useEffect, useState } from 'react';

const TRADE_TYPE_LABELS = {
  auction: 'Аукцион',
  offer: 'Торговое предложение',
};

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export default function FilterBar({ onSearch, initial }) {
  const [q, setQ] = useState(initial?.q || '');
  const [region, setRegion] = useState(initial?.region || '');
  const [city, setCity] = useState(initial?.city || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [tradeType, setTradeType] = useState(initial?.trade_type || '');
  const [minPrice, setMinPrice] = useState(initial?.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initial?.maxPrice || '');
  const [meta, setMeta] = useState({ regions: [], cities: [], brands: [], tradeTypes: [] });

  useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const res = await fetch(api('/api/listings/meta'));
        if (!res.ok) throw new Error('meta');
        const data = await res.json();
        if (!ignore) setMeta(data);
      } catch (e) {
        console.error('Failed to load filter options', e);
        if (!ignore) setMeta({ regions: [], cities: [], brands: [], tradeTypes: [] });
      }
    }
    loadMeta();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    setQ(initial?.q || '');
    setRegion(initial?.region || '');
    setCity(initial?.city || '');
    setBrand(initial?.brand || '');
    setTradeType(initial?.trade_type || '');
    setMinPrice(initial?.minPrice || '');
    setMaxPrice(initial?.maxPrice || '');
  }, [initial]);

  function submit(e) {
    e.preventDefault();
    onSearch({
      q,
      region,
      city,
      brand,
      trade_type: tradeType,
      minPrice,
      maxPrice,
    });
  }

  function resetFilters() {
    setQ('');
    setRegion('');
    setCity('');
    setBrand('');
    setTradeType('');
    setMinPrice('');
    setMaxPrice('');
    // Можно сразу перезапустить поиск с пустыми значениями:
    onSearch({
      q: '',
      region: '',
      city: '',
      brand: '',
      trade_type: '',
      minPrice: '',
      maxPrice: '',
    });
  }

  return (
    <form onSubmit={submit} className="filters-panel-pro" aria-label="Фильтры поиска по торгам">
      {/* Верхняя строка: общий поиск */}
      <div className="row">
        <label className="field col-span-12 lg:col-span-6">
          <span className="label">Поиск по названию или VIN</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="Марка, модель, номер лота…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="icon" aria-hidden>🔎</span>
          </div>
        </label>
      </div>

      {/* Вторая строка: регион/город */}
      <div className="row">
        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
          <span className="label">Регион</span>
          <div className="input-wrap">
            <select className="input pro select" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Все регионы</option>
              {meta.regions?.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </label>

        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
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

        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
          <span className="label">Марка автомобиля</span>
          <div className="input-wrap">
            <select className="input pro select" value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Все марки</option>
              {meta.brands?.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </label>

        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
          <span className="label">Тип торгов</span>
          <div className="input-wrap">
            <select className="input pro select" value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
              <option value="">Все типы</option>
              {meta.tradeTypes?.map((value) => (
                <option key={value} value={value}>{TRADE_TYPE_LABELS[value] || value}</option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {/* Третья строка: цена от/до */}
      <div className="row">
        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
          <span className="label">Мин. цена</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="от"
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <span className="suffix">₽</span>
          </div>
        </label>

        <label className="field col-span-12 md:col-span-6 lg:col-span-3">
          <span className="label">Макс. цена</span>
          <div className="input-wrap">
            <input
              className="input pro"
              placeholder="до"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
            <span className="suffix">₽</span>
          </div>
        </label>

        {/* Пустые колонки для выравнивания на десктопе */}
        <div className="col-span-12 lg:col-span-3 hide-on-mobile" />
        <div className="col-span-12 lg:col-span-3 hide-on-mobile" />
      </div>

      {/* Действия */}
      <div className="actions row">
        <button type="button" className="btn secondary" onClick={resetFilters}>
          Сбросить
        </button>
        <button type="submit" className="btn primary">
          Показать
        </button>
      </div>

      {/* Стили — современный "взрослый" скин под наши карточки */}
      <style jsx>{`
        :root {
          --brand: #1E90FF;
          --text: #0f172a;
          --muted: #6b7280;
          --line: #e5e7eb;
          --bg: #ffffff;
          --chip: #f1f5f9;
          --shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
          --shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
        }

        .filters-panel-pro {
          background: var(--bg);
          border-radius: 16px;
          border: 1px solid #eef2f7;
          box-shadow: var(--shadow-sm);
          padding: 16px;
          display: grid;
          gap: 14px;
          position: relative;
        }

        /* сетка 12 колонок с помощниками классов */
        .row {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 12px 14px;
          align-items: start;
        }
        .col-span-12 { grid-column: span 12 / span 12; }
        .md\\:col-span-6 { grid-column: span 12 / span 12; }
        .lg\\:col-span-3 { grid-column: span 12 / span 12; }
        .lg\\:col-span-6 { grid-column: span 12 / span 12; }

        @media (min-width: 720px) {
          .md\\:col-span-6 { grid-column: span 6 / span 6; }
        }
        @media (min-width: 1024px) {
          .lg\\:col-span-3 { grid-column: span 3 / span 3; }
          .lg\\:col-span-6 { grid-column: span 6 / span 6; }
        }

        .field { display: grid; gap: 6px; }
        .label {
          font-size: 12px;
          color: var(--muted);
          user-select: none;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input.pro {
          width: 100%;
          height: 44px;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 0 14px;
          background: #f9fafb;
          color: var(--text);
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease, transform .08s ease;
          will-change: transform;
        }
        .input.pro:hover {
          background: #fff;
        }
        .input.pro:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(30,144,255, .15);
          background: #fff;
        }

        /* кастомная стрелка для select */
        .select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%23758596' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }

        .icon {
          position: absolute;
          right: 12px;
          pointer-events: none;
          font-size: 14px;
          opacity: .65;
        }
        .suffix {
          position: absolute;
          right: 12px;
          font-size: 12px;
          color: #9aa1ae;
          pointer-events: none;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 2px;
        }

        .btn {
          height: 44px;
          border-radius: 12px;
          padding: 0 16px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: transform .15s ease, box-shadow .15s ease, filter .15s ease, background .15s ease, color .15s ease;
        }
        .btn.primary {
          background: var(--brand);
          color: #fff;
          box-shadow: 0 10px 22px rgba(30,144,255, .25);
        }
        .btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(30,144,255, .35);
          filter: brightness(1.03);
        }
        .btn.secondary {
          background: #f3f4f6;
          color: #111827;
          border: 1px solid var(--line);
        }
        .btn.secondary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(17, 24, 39, .08);
          filter: brightness(1.02);
          background: #fff;
        }

        .hide-on-mobile { display: none; }

        @media (min-width: 1024px) {
          .filters-panel-pro {
            padding: 18px 18px 16px;
            box-shadow: var(--shadow);
          }
          .hide-on-mobile { display: block; }
        }
      `}</style>
    </form>
  );
}
