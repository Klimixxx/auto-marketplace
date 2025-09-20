import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AdminInspectionsList() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) { location.href = '/login'; return; }
      const me = await fetch(`${API}/api/me`, { headers:{ Authorization:'Bearer '+token } });
      const user = await me.json();
      if (user?.role !== 'admin') { location.href = '/'; return; }

      const res = await fetch(`${API}/api/admin/inspections`, { headers:{ Authorization:'Bearer '+token } });
      if (!res.ok) { alert('Нет доступа'); location.href = '/'; return; }
      const data = await res.json();
      setItems(data?.items || []);
    })();
  }, []);

  if (!items) return <div className="container" style={{maxWidth:1100,padding:16}}>Загрузка…</div>;

  return (
    <div className="container" style={{maxWidth:1100,padding:16}}>
      <h1>Заказы на Осмотры</h1>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Дата</th>
              <th style={th}>Пользователь</th>
              <th style={th}>Подписка</th>
              <th style={th}>Объявление</th>
              <th style={th}>Статус</th>
              <th style={th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={td}>{new Date(it.created_at).toLocaleString('ru-RU')}</td>
                <td style={td}>{it.user_name || it.user_phone}</td>
                <td style={td}>{it.subscription_status}</td>
                <td style={td}><a href={`/trades/${it.listing_id}`} target="_blank" rel="noreferrer">{it.listing_title || it.listing_id}</a></td>
                <td style={td}>{it.status}</td>
                <td style={td}><a href={`/admin/inspections/${it.id}`}>перейти на осмотр</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const th = { textAlign:'left', borderBottom:'1px solid #eee', padding:'8px' };
const td = { borderBottom:'1px solid #f3f3f3', padding:'8px' };
