import { useEffect, useState } from 'react';
import Link from 'next/link';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminParserTrades() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);

  async function load(p=1) {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`${API}/api/admin/parser-trades?${params.toString()}`, {
        headers: { Authorization: 'Bearer '+token }
      });
      const data = await r.json();
      setItems(data.items||[]); setPage(data.page||1); setPageCount(data.pageCount||1);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(1); }, []);

  async function runIngest() {
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/actions/ingest`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ search:'vin', limit:50, offset:0 })
    });
    const d = await r.json();
    if (!r.ok) return alert('Ошибка: '+(d?.error||'ingest failed'));
    alert(`Получено: ${d.received}, сохранено/обновлено: ${d.upserted}`);
    load(1);
  }

  async function publish(id) {
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/api/admin/parser-trades/${id}/publish`, {
      method:'POST',
      headers:{ Authorization:'Bearer '+token }
    });
    if (!r.ok) {
      const d = await r.json().catch(()=>({}));
      return alert('Ошибка публикации: '+(d?.error||'failed'));
    }
    alert('Опубликовано! Запись доступна на /trades');
  }

  return (
    <div className="container" style={{paddingTop:16, paddingBottom:32}}>
      <h1>Админка — Объявления (из парсера)</h1>

      <div style={{display:'flex', gap:8, margin:'12px 0'}}>
        <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск (название/регион/марка/модель/VIN)"/>
        <button className="button" onClick={()=>load(1)} disabled={loading}>Найти</button>
        <button className="button primary" onClick={runIngest} disabled={loading}>Спарсить объявления</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead><tr>
            <th>Заголовок</th><th>Регион</th><th>ТС</th><th>Стартовая</th><th>Окончание</th><th>Действия</th>
          </tr></thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id}>
                <td>
                  <div style={{fontWeight:600}}>{it.title||'Лот'}</div>
                  <div className="muted" style={{fontSize:12}}>
                    {it.source_url ? <a href={it.source_url} target="_blank" rel="noreferrer">Источник</a> : '—'}
                  </div>
                </td>
                <td>{it.region||'—'}</td>
                <td>{[it.brand, it.model, it.year].filter(Boolean).join(' ')||'—'}<br/>{it.vin||''}</td>
                <td>{it.start_price ?? '—'}</td>
                <td>{it.date_finish ? new Date(it.date_finish).toLocaleDateString('ru-RU') : '—'}</td>
                <td style={{whiteSpace:'nowrap'}}>
                  <Link href={`/admin/listings/${it.id}`} className="button">Открыть</Link>{' '}
                  <button className="button primary" onClick={()=>publish(it.id)}>Выложить</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} style={{textAlign:'center',padding:'24px 0'}}>Пусто</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{display:'flex', gap:8, marginTop:16}}>
        <button className="button" onClick={()=>load(page-1)} disabled={page<=1}>← Назад</button>
        <div style={{alignSelf:'center'}}>Стр. {page} / {pageCount}</div>
        <button className="button" onClick={()=>load(page+1)} disabled={page>=pageCount}>Вперёд →</button>
      </div>
    </div>
  );
}
