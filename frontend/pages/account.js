// pages/account.js
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Account() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Не удалось загрузить профиль');
        return d;
      })
      .then(setMe)
      .catch(e => setErr(e.message));
  }, []);

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <h1>Личный кабинет</h1>

      {err && <div style={{ color: 'salmon' }}>{err}</div>}
      {!me && !err && <div>Загрузка…</div>}

      {me && (
        <div className="card" style={{ display: 'grid', gap: 8, padding: 16 }}>
          <div><span style={{ color: 'var(--muted)' }}>Имя:</span> {me.name || '—'}</div>
          <div><span style={{ color: 'var(--muted)' }}>Телефон:</span> {me.phone}</div>
        </div>
      )}
    </div>
  );
}
