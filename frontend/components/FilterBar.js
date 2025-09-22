import { useEffect, useState } from 'react';

const TRADE_TYPE_LABELS = {
  auction: 'Аукцион',
  offer: 'Торговое предложение'};


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

  return (
    <form onSubmit={submit} className="card filter-form" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted">Поиск по названию или VIN</span>
          <input
            className="input"
            placeholder="Марка, модель, номер лота…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="filter-form__row">
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Регион</span>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Все регионы</option>
            {meta.regions?.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Город</span>
          <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Все города</option>
            {meta.cities?.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-form__row">
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Марка автомобиля</span>
          <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Все марки</option>
            {meta.brands?.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Тип торгов</span>
          <select className="input" value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
            <option value="">Все типы</option>
            {meta.tradeTypes?.map((value) => (
              <option key={value} value={value}>{TRADE_TYPE_LABELS[value] || value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-form__row">
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Мин. цена</span>
          <input
            className="input"
            placeholder="от"
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </label>
        <label style={{ flex: 1, display: 'grid', gap: 4 }}>
          <span className="muted">Макс. цена</span>
          <input
            className="input"
            placeholder="до"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="button" type="submit">Показать</button>
      </div>
    </form>
  );
}
