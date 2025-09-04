export default function ListingCard({ l, onFav, fav }){
  const price = l.current_price ?? l.start_price;
  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:600}}>{l.title}</div>
          <div className="badge" style={{marginTop:8}}>{l.asset_type || '—'}</div>
        </div>
        <button className="button" onClick={onFav}>
          {fav ? '★ В избранном' : '☆ В избранное'}
        </button>
      </div>
      <div style={{marginTop:8, color:'var(--muted)'}}>
        Регион: {l.region || '—'} • Цена: {price ? `${price} ${l.currency||'RUB'}` : '—'}
      </div>
      {l.source_url && (
        <div style={{marginTop:8}}>
          <a href={l.source_url} target="_blank">Открыть источник →</a>
        </div>
      )}
    </div>
  );
}

