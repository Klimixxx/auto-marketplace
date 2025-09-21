// pages/trades.js
import { useEffect, useState } from 'react';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';

const API = process.env.NEXT_PUBLIC_API_BASE;

const CATEGORIES = [
  { label: 'Все категории', value: '' },
  { label: 'Недвижимость', value: 'real_estate' },
  { label: 'Автомобили', value: 'car' },
  { label: 'Другое имущество', value: 'other' },
];

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
    try {
      const res = await fetch(`${API}/api/listings?`+params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = await res.json();
      setItems(data.items||[]); setPage(data.page||1); setPageCount(data.pageCount||1);
    } catch (error) {
      console.error('Failed to load listings', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  function handleSearch(f){
    const next = { ...f };
    if (!next.asset_type) delete next.asset_type;
    setFilters(next);
    load(1, next);
  }

  function handleCategory(value){
    const next = { ...filters };
    if (value) {
      next.asset_type = value;
    } else {
      delete next.asset_type;
    }
    setFilters(next);
    load(1, next);
  }

  async function toggleFav(id){
    const token = localStorage.getItem('token');
    if (!token) return alert('Войдите в аккаунт');
    await fetch(`${API}/api/favorites/${id}`, {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+token }
    });
    alert('Добавлено в избранное');
  }

  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Эталонный маркетплейс активов</div>
          <h1 className="page-heading__title">Специальные предложения</h1>
          <p className="page-heading__subtitle">
            Актуальные автомобили и другое имущество банкротов. Используйте фильтры, чтобы найти выгодный лот для покупки.
          </p>
        </div>
        <div className="page-heading__meta">
          <div className="stats-card">
            <div className="stats-card__value">{items.length}</div>
            <div className="stats-card__label">активов на странице</div>
          </div>
          <div className="stats-card">
            <div className="stats-card__value">{page} / {pageCount}</div>
            <div className="stats-card__label">страницы каталога</div>
          </div>
        </div>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((category) => {
          const isActive = (filters.asset_type || '') === category.value;
          return (
            <button key={category.value || 'all'} type="button" onClick={() => handleCategory(category.value)}>
              <span className={`chip${isActive ? ' is-active' : ''}`}>{category.label}</span>
            </button>
          );
        })}
      </div>

      <FilterBar onSearch={handleSearch} initial={filters} />

      {loading ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="big">Загружаем подборку…</div>
          <div className="muted">Пожалуйста, подождите пару секунд.</div>
        </div>
      ) : items.length ? (
        <div className="listing-grid">
          {items.map((l) => {
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
          <div className="muted">Попробуйте изменить параметры поиска или выберите другую категорию.</div>
        </div>
      )}

      <div className="pagination">
        <button
          type="button"
          disabled={page<=1}
          className="button button-outline"
          onClick={()=>load(page-1)}
        >
          ← Предыдущая
        </button>
        <div className="pagination__info">Страница {page} из {pageCount}</div>
        <button
          type="button"
          disabled={page>=pageCount}
          className="button"
          onClick={()=>load(page+1)}
        >
          Следующая →
        </button>
      </div>
    </div>
  );
}
