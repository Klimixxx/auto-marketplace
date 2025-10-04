import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function AdminUsers() {
  const [me, setMe] = useState(null);
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

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
    load(page);
  }, [me, page]);

  async function load(pageNum=1, qStr='') {
    setLoading(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    params.set('page', pageNum);
    params.set('limit', limit);
    if (qStr) params.set('q', qStr);
    const url = `${API}/api/admin/users?` + params.toString();
    const r = await fetch(url, { headers: { Authorization:'Bearer '+token } });
    const d = await r.json();
    setList(d.items || []);
    setPages(d.pages || 1);
    setTotal(d.total || 0);
    setLoading(false);
  }

  function submit(e){
    e.preventDefault();
    const id = q.trim();
    if (/^\d{6}$/.test(id)) {
      location.href = `/admin/users/${id}`;
    } else {
      setPage(1);
      load(1, id);
    }
  }

  function Pager() {
    if (pages <= 1) return null;
    const items = [];
    const maxButtons = 7;
    const start = Math.max(1, Math.min(page - 3, pages - maxButtons + 1));
    const end = Math.min(pages, start + maxButtons - 1);
    const go = (p) => { if (p>=1 && p<=pages) setPage(p); };
    items.push(<button key="prev" className="button" onClick={()=>go(page-1)} disabled={page<=1}>←</button>);
    for (let p=start; p<=end; p++) {
      items.push(
        <button key={p} className="button" onClick={()=>go(p)}
          style={{ background: p===page ? 'rgba(34,197,94,0.15)' : undefined, fontWeight: p===page ? 700 : 500 }}>
          {p}
        </button>
      );
    }
    items.push(<button key="next" className="button" onClick={()=>go(page+1)} disabled={page>=pages}>→</button>);
    return <div style={{ display:'flex', gap:8, marginTop:12 }}>{items}</div>;
  }

  const formatBalance = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return rub.format(numeric);
  };

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
            gridTemplateColumns:'240px 90px 160px 220px 170px 160px 140px 120px',
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
            <div>Баланс</div>
            <div></div>
          </div>

          {/* строки */}
          {list.map(u => (
            <div key={u.user_code}
              style={{
                display:'grid',
                gridTemplateColumns:'240px 90px 160px 220px 170px 160px 140px 120px',
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
              <div style={{ fontSize:12 }}>
                {formatBalance(u.balance)}
              </div>
              <div>
                <a className="button" href={`/admin/users/${u.user_code}`}>Профиль</a>
              </div>
            </div>
          ))}

          <Pager />

          <div style={{ marginTop:6, fontSize:12, opacity:.7 }}>
            Всего: {total.toLocaleString('ru-RU')}, страниц: {pages}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
