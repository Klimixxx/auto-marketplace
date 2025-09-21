import { useEffect, useState } from 'react';

export default function FilterBar({ onSearch, initial }) {
  const [q, setQ] = useState(initial?.q || '');
  const [region, setRegion] = useState(initial?.region || '');
  const [asset_type, setType] = useState(initial?.asset_type || '');
  const [minPrice, setMin] = useState(initial?.minPrice || '');
  const [maxPrice, setMax] = useState(initial?.maxPrice || '');

  useEffect(() => {
    if (!initial) return;
    setQ(initial.q || '');
    setRegion(initial.region || '');
    setType(initial.asset_type || '');
    setMin(initial.minPrice || '');
    setMax(initial.maxPrice || '');
  }, [initial]);

  function submit(e){ e.preventDefault(); onSearch({ q, region, asset_type, minPrice, maxPrice }); }

  return (
    <form onSubmit={submit} className="filter-bar">
      <div className="filter-bar__grid">
        <div className="filter-bar__row filter-bar__row--main">
          <div className="input-with-icon">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M14.5 14.5L18 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.25 8.625C15.25 12.147 12.397 15 8.875 15C5.35304 15 2.5 12.147 2.5 8.625C2.5 5.10304 5.35304 2.25 8.875 2.25C12.397 2.25 15.25 5.10304 15.25 8.625Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            <input
              className="input"
              placeholder="Название, собственник или номер торга"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="button button-small" type="submit">Найти</button>
        </div>
        <div className="filter-bar__row">
          <input className="input" placeholder="Регион" value={region} onChange={(e) => setRegion(e.target.value)} />
          <input
            className="input"
            placeholder="Тип актива (car, real_estate)"
            value={asset_type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
        <div className="filter-bar__row">
          <input className="input" placeholder="Мин. цена" value={minPrice} onChange={(e) => setMin(e.target.value)} />
          <input className="input" placeholder="Макс. цена" value={maxPrice} onChange={(e) => setMax(e.target.value)} />
        </div>
      </div>
    </form>
  );
}
