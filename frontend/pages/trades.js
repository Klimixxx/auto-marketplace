import { useEffect, useState } from 'react';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Trades(){
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [filters, setFilters] = useState({});

  async function load(p=1, f=filters){
    const params = new URLSearchParams({ ...f, page: p, limit: 20 });
    const res = await fetch(`${API}/api/listings?`+params.toString());
    const data = await res.json();
    setItems(data.items||[]); setPage(data.page||1); setPageCount(data.pageCount||1);
  }

  useEffect(()=>{ load(); }, []);

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
      <h1>Торги</h1>
      <FilterBar onSearch={(f)=>{ setFilters(f); load(1,f); }} />

      <div className="grid" style={{marginTop:16}}>
        {items.map(l => (
          <ListingCard key={l.id} l={l} onFav={()=>toggleFav(l.id)} />
        ))}
      </div>

      <div style={{display:'flex', gap:8, marginTop:16}}>
        <button disabled={page<=1} className="button" onClick={()=>load(page-1)}>← Предыдущая</button>
        <div style={{alignSelf:'center'}}>Стр. {page} / {pageCount}</div>
        <button disabled={page>=pageCount} className="button" onClick={()=>load(page+1)}>Следующая →</button>
      </div>
    </div>
  );
}

