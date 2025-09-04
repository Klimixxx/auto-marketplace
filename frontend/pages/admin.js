import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Admin(){
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(()=>{
    const token = localStorage.getItem('token');
    if (!token) { location.href='/login'; return; }
    fetch(`${API}/api/admin/stats`, { headers:{ 'Authorization':'Bearer '+token } })
      .then(async r => { if(!r.ok){ const d=await r.json(); throw new Error(d.error||'Ошибка'); } return r.json(); })
      .then(setStats).catch(e=> setErr(e.message));
  },[]);

  return (
    <div className="container">
      <h1>Админ-панель</h1>
      {err && <div style={{color:'salmon'}}>{err}</div>}
      {stats && (
        <div className="card" style={{display:'flex', gap:24}}>
          <div><div className="badge">Всего</div><div style={{fontSize:28, fontWeight:700}}>{stats.total}</div></div>
          <div><div className="badge">Опубликовано</div><div style={{fontSize:28, fontWeight:700}}>{stats.active}</div></div>
        </div>
      )}
      <p style={{color:'var(--muted)'}}>Здесь позже добавим управление объявлениями.</p>
    </div>
  );
}
