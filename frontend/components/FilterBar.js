import { useState } from 'react';

export default function FilterBar({ onSearch, initial }) {
  const [q, setQ] = useState(initial?.q || '');
  const [region, setRegion] = useState(initial?.region || '');
  const [asset_type, setType] = useState(initial?.asset_type || '');
  const [minPrice, setMin] = useState(initial?.minPrice || '');
  const [maxPrice, setMax] = useState(initial?.maxPrice || '');

  function submit(e){ e.preventDefault(); onSearch({ q, region, asset_type, minPrice, maxPrice }); }

  return (
    <form onSubmit={submit} className="card" style={{display:'grid', gap:12}}>
      <input className="input" placeholder="Поиск по названию" value={q} onChange={e=>setQ(e.target.value)} />
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <input className="input" placeholder="Регион" value={region} onChange={e=>setRegion(e.target.value)} />
        <input className="input" placeholder="Тип актива (car, real_estate)" value={asset_type} onChange={e=>setType(e.target.value)} />
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <input className="input" placeholder="Мин. цена" value={minPrice} onChange={e=>setMin(e.target.value)} />
        <input className="input" placeholder="Макс. цена" value={maxPrice} onChange={e=>setMax(e.target.value)} />
      </div>
      <button className="button" type="submit">Показать</button>
    </form>
  );
}

