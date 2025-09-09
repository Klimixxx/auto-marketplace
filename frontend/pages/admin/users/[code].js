// pages/admin/users/[code].js
import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminUserCard() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const code = typeof window !== 'undefined' ? location.pathname.split('/').pop() : '';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => location.href = '/');
  }, []);

  useEffect(() => {
    if (!me || !code) return;
    load();
  }, [me, code]);

  async function load() {
    setErr('');
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/users/${code}`, { headers: { Authorization:'Bearer '+token } });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || 'Ошибка загрузки'); return; }
    setData(d);
  }

  async function toggleBlock(block) {
    setErr('');
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/users/${code}/block`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ block })
    });
    const d = await r.json();
    if (!r.ok || d.ok === false) { setErr(d.error || 'Ошибка операции'); return; }
    await load();
  }

  async function toggleFreeze(freeze) {
    setErr('');
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/users/${code}/freeze-balance`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ freeze })
    });
    const d = await r.json();
    if (!r.ok || d.ok === false) { setErr(d.error || 'Ошибка операции'); return; }
    await load();
  }

  const u = data?.user;
  const sessions = data?.sessions || [];

  const fmtRUB = (n) => new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB' }).format(n ?? 0);

  return (
    <AdminLayout me={me} title={`Пользователь ${code}`}>
      {!data && !err && <div>Загрузка…</div>}
      {err && <div style={{ color:'salmon' }}>{err}</div>}

      {u && (
        <div style={{ display:'grid', gap:14 }}>
          {/* Кнопки действий сверху справа */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <a className="button" href={`/admin/notify?user_code=${u.user_code}`}>Отправить уведомление</a>
          </div>

          {/* Информация о пользователе */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Info label="Имя" value={u.name || '—'} />
            <Info label="Телефон" value={u.phone || '—'} />
            <Info label="Почта" value={u.email || '—'} />
            <Info label="Дата регистрации" value={new Date(u.created_at).toLocaleString('ru-RU')} />
            <Info label="Статус подписки" value={u.subscription_status || 'free'} />
            <Info label="Роль" value={u.role || 'user'} />
            <Info label="Заблокирован" value={u.is_blocked ? 'Да' : 'Нет'} />
            <Info label="Баланс заморожен" value={u.balance_frozen ? 'Да' : 'Нет'} />
            <Info label="Баланс" value={fmtRUB(u.balance)} />
          </div>

          {/* Кнопки управления статусами */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {!u.is_blocked
              ? <button className="button" onClick={()=>toggleBlock(true)}>Заблокировать</button>
              : <button className="button" onClick={()=>toggleBlock(false)}>Разблокировать</button>}
            {!u.balance_frozen
              ? <button className="button" onClick={()=>toggleFreeze(true)}>Заморозить баланс</button>
              : <button className="button" onClick={()=>toggleFreeze(false)}>Разморозить баланс</button>}
          </div>

          {/* Последние сессии */}
          <div style={{ marginTop:10 }}>
            <h3 style={{ marginTop:0 }}>Последние сессии</h3>
            {sessions.length === 0 && <div>Нет данных о сессиях.</div>}
            {sessions.length > 0 && (
              <div style={{ borderTop:'1px solid var(--line)' }}>
                {sessions.map((s, i) => (
                  <div key={i} style={{
                    display:'grid',
                    gridTemplateColumns:'240px 1fr 1fr',
                    gap:12, padding:'10px 0',
                    borderBottom:'1px solid var(--line)'
                  }}>
                    <div style={{ fontFamily:'monospace' }}>{s.ip || '—'}</div>
                    <div>{s.city || '—'}</div>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.device || '—'}
                    </div>
                    <div style={{ gridColumn:'1 / -1', fontSize:12, opacity:.7 }}>
                      {new Date(s.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:12, color:'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  );
}
