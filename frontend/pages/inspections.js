// pages/inspections.js
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE || '';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login?next=/inspections'; return; }
      const res = await fetch(`${API}/api/inspections/me`, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) { window.location.href = '/login?next=/inspections'; return; }
      const data = await res.json();
      setItems(data?.items || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="container" style={{ maxWidth: 800, padding:16 }}>Загрузка…</div>;

  return (
    <div className="container" style={{ maxWidth: 1000, padding:16 }}>
      <h1>Мои Осмотры</h1>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Дата</th>
              <th style={th}>Объявление</th>
              <th style={th}>Статус</th>
              <th style={th}>Сумма</th>
              <th style={th}>Отчёт</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={td}>{new Date(it.created_at).toLocaleString('ru-RU')}</td>
                <td style={td}><a href={`/trades/${it.listing_id}`} target="_blank" rel="noreferrer">{it.listing_title || it.listing_id}</a></td>
                <td style={td}>{it.status}</td>
                <td style={td}>{(it.final_amount || 0).toLocaleString('ru-RU')} ₽</td>
                <td style={td}>
                  {(it.status === 'Завершен' && it.report_pdf_url)
                    ? <a href={it.report_pdf_url} target="_blank" rel="noreferrer">Скачать PDF</a>
                    : <span style={{opacity:.6}}>Недоступно</span>}
                </td>
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
