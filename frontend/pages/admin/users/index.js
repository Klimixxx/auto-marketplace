import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminUsers() {
  const [me, setMe] = useState(null);
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => location.href = '/');
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
  }, [me]);

  async function load(qStr='') {
    setLoading(true);
    const token = localStorage.getItem('token');
    const url = qStr ? `${API}/api/admin/users?q=${encodeURIComponent(qStr)}` : `${API}/api/admin/users`;
    fetch(url, { headers: { Authorization:'Bearer '+token } })
      .then(r=>r.json())
      .then(d=>setList(d.items || []))
      .finally(()=>setLoading(false));
  }

  function submit(e){
    e.preventDefault();
    const id = q.trim();
    if (/^\d{6}$/.test(id)) {
      location.href = `/admin/users/${id}`;
    } else {
      load(id);
    }
  }

  return (
    <AdminLayout me={me} title="Пользователи">
      <form onSubmit={submit} style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input className="input" placeholder="Поиск по ID (6 цифр) или пусто — показать всех"
               value={q} onChange={e=>setQ(e.target.value.replace(/\D/g,''))} maxLength={6} style={{ width:260 }} />
        <button className="button">Найти</button>
      </form>

      {loading && <div>Загрузка…</div>}
      {!loading && list.length === 0 && <div>Пользователи не найдены.</div>}

      {!loading && list.length > 0 && (
  <div>
    {/* заголовки колонок */}
    <div style={{
      display:'grid',
      gridTemplateColumns:'240px 90px 160px 220px 170px 160px 120px',
      gap:12,
      padding:'10px 0',
      borderTop:'1px solid var(--line)',
      borderBottom:'1px solid var(--line)',
      fontSize:12,
      opacity:.8
    }}>
      <div>Имя</div>
      <div>ID</div>
      <div>Номер</div>
      <div>Почта</div>
      <div>Дата регистрации</div>
      <div>Статус подписки</div>
      <div></div> {/* колонка под кнопку */}
    </div>

    {/* строки */}
    {list.map(u => (
      <div key={u.user_code}
           style={{
             display:'grid',
             gridTemplateColumns:'240px 90px 160px 220px 170px 160px 120px',
             gap:12, padding:'10px 0',
             borderBottom:'1px solid var(--line)'
           }}>
        <div><b>{u.name || 'Без имени'}</b></div>
        <div>{u.user_code}</div>
        <div>{u.phone || '—'}</div>
        <div>{u.email || '—'}</div>
        <div style={{ fontSize:12, opacity:.8 }}>
          {new Date(u.created_at).toLocaleDateString('ru-RU')}
        </div>
        <div style={{ fontSize:12 }}>
          {u.subscription_status || 'free'}
        </div>
        <div>
          <a className="button" href={`/admin/users/${u.user_code}`}>Профиль</a>
        </div>
      </div>
    ))}
  </div>
)}

    </AdminLayout>
  );
}
