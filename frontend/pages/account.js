import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Account(){
  const [items, setItems] = useState([]);

  useEffect(()=>{
    const token = localStorage.getItem('token');
    if (!token) { location.href='/login'; return; }
    fetch(`${API}/api/me/favorites`, { headers:{ 'Authorization':'Bearer '+token } })
      .then(r=>r.json()).then(d=> setItems(d.items||[]));
  },[]);

  return (
    <div className="container">
      <h1>Избранное</h1>
      <div className="grid" style={{marginTop:16}}>
        {items.map(i=> (
          <div key={i.id} className="card">
            <div style={{fontWeight:600}}>{i.title}</div>
            <div style={{color:'var(--muted)'}}>Регион: {i.region||'—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

