// pages/trades.js
import { useEffect, useState } from 'react';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || '').replace(/\/$/, '');

function buildApiUrl(path) {
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

export default function Trades(){
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);

  async function load(p=1, f=filters){
    setLoading(true);
    const params = new URLSearchParams({ ...f, page: p, limit: 20 });
    params.set('published', 'true');
    const url = buildApiUrl(`/api/listings?${params.toString()}`);

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = await res.json();
      setItems(data.items||[]);
      setPage(data.page||1);
      setPageCount(data.pageCount||1);
    } catch (error) {
      console.error('Failed to load listings', error);
      setItems([]);
      setPage(1);
      setPageCount(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  function handleSearch(nextFilters){
    const cleaned = { ...nextFilters };
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === '' || cleaned[key] == null) {
        delete cleaned[key];
      }
    });
    setFilters(cleaned);
    load(1, cleaned);
  }

  async function toggleFav(id){
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return alert('Войдите в аккаунт');
    try {
      await fetch(buildApiUrl(`/api/favorites/${id}`), {
        method:'POST',
        headers:{ 'Authorization':'Bearer '+token }
      });
      alert('Добавлено в избранное');
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  }

  return (
    <div className="container">
      <h1>Торги</h1>

      <FilterBar onSearch={handleSearch} initial={filters} />

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="big">Загружаем подборку…</div>
            <div className="muted">Пожалуйста, подождите несколько секунд.</div>
          </div>
        ) : items.length ? (
          <div className="grid">
            {items.map(l => {
              const isFavorite = Boolean(l.is_favorite ?? l.favorite ?? l.isFavorite);
              return (
                <ListingCard
                  key={l.id}
                  l={l}
                  fav={isFavorite}
                  onFav={() => toggleFav(l.id)}
                  detailHref={`/trades/${l.id}`}
                  sourceHref={l.source_url}
                />
              );
            })}
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="big">Предложения скоро появятся</div>
            <div className="muted">Попробуйте изменить параметры поиска.</div>
          </div>
        )}
      </div>

      <div style={{display:'flex', gap:8, marginTop:16}}>
        <button disabled={page<=1} className="button" onClick={()=>load(page-1)}>← Предыдущая</button>
        <div style={{alignSelf:'center'}}>Стр. {page} / {pageCount}</div>
        <button disabled={page>=pageCount} className="button" onClick={()=>load(page+1)}>Следующая →</button>
      </div>
    </div>
  );
}
