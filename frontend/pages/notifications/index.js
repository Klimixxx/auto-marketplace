// pages/notifications/index.js
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }

    async function run() {
      try {
        // 1) помечаем прочитанным
        await fetch(`${API}/api/notifications/mark-read`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        }).catch(()=>{});

        // 2) сигналим шапке, чтобы обнулила бейдж
        try { window.dispatchEvent(new Event('notifications-read')); } catch {}

        // 3) грузим список
        const r = await fetch(`${API}/api/notifications`, { headers: { Authorization:'Bearer '+token } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Ошибка');
        setItems(d.items || []);
      } catch (e) {
        setErr(e.message || 'Ошибка');
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1>Уведомления</h1>
      {loading && <div>Загрузка…</div>}
      {err && <div style={{ color:'salmon' }}>{err}</div>}
      {!loading && !err && items.length === 0 && <div>Пока пусто</div>}

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
