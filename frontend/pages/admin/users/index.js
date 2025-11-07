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
        <div className="table">
          <div className="table-header">
            <div>Имя</div>
            <div>ID</div>
            <div>Номер</div>
            <div>Почта</div>
            <div>Дата регистрации</div>
            <div>Баланс</div>
            <div></div>
          </div>

          {list.map(u => (
            <div key={u.user_code} className="table-row">
              <div className="cell">
                <span className="cell-label">Имя</span>
                <b>{u.name || 'Без имени'}</b>
              </div>
              <div className="cell">
                <span className="cell-label">ID</span>
                <span>{u.user_code}</span>
              </div>
              <div className="cell">
                <span className="cell-label">Номер</span>
                <span>{u.phone || '—'}</span>
              </div>
              <div className="cell">
                <span className="cell-label">Почта</span>
                <span>{u.email || '—'}</span>
              </div>
              <div className="cell">
                <span className="cell-label">Дата регистрации</span>
                <span style={{ fontSize:12, opacity:.8 }}>
                  {new Date(u.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <div className="cell">
                <span className="cell-label">Баланс</span>
                <span style={{ fontSize:12 }}>{formatBalance(u.balance)}</span>
              </div>
              <div className="cell actions">
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

      <style jsx>{`
        .table {
          display: grid;
          gap: 0;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns:
            minmax(180px, 1.4fr)
            minmax(90px, 0.6fr)
            minmax(150px, 1fr)
            minmax(200px, 1.2fr)
            minmax(160px, 1fr)
            minmax(140px, 0.9fr)
            minmax(120px, 0.8fr);
          gap: 12px;
          align-items: center;
        }

        .table-header {
          padding: 12px 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .table-row {
          padding: 14px 0;
          border-bottom: 1px solid var(--line);
        }

        .cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 14px;
        }

        .cell-label {
          display: none;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .actions {
          align-items: center;
          justify-content: flex-end;
        }

        @media (max-width: 1100px) {
          .table-header {
            display: none;
          }

          .table-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            padding: 16px 0;
          }

          .cell-label {
            display: block;
          }

          .actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .table-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminLayout>
  );
}

