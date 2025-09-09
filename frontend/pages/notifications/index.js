import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/notifications`, { headers: { Authorization:'Bearer '+token } })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Ошибка'); return d; })
      .then(d=>setItems(d.items || []))
      .catch(e=>{ setErr(e.message); });
  }, []);

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1>Уведомления</h1>
      {err && <div style={{ color:'salmon' }}>{err}</div>}

      {items.length === 0 && !err && <div>Пока пусто</div>}

      {items.length > 0 && (
        <div style={{ display:'grid', gap:10 }}>
          {items.map(n => (
            <div key={n.id} className="card" style={{ padding:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                <div style={{ fontWeight:800 }}>{n.title}</div>
                <div style={{ fontSize:12, opacity:.7 }}>{new Date(n.created_at).toLocaleString('ru-RU')}</div>
              </div>
              <div style={{ marginTop:6 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
