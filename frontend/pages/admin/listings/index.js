import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export default function AdminParserTrades() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);

  async function load(p = 1) {
    if (!API_BASE) {
      console.warn('NEXT_PUBLIC_API_BASE не задан. Страница админа не может загрузить данные.');
      return;
    }

    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      if (!token) {
        alert('Для доступа в админку войдите в аккаунт администратора.');
        return;
      }

      const params = new URLSearchParams();
      const search = q.trim();
      if (search) params.set('q', search);
      params.set('page', String(p));
      params.set('limit', '20');

      const res = await fetch(`${API_BASE}/api/admin/parser-trades?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Не удалось загрузить список объявлений');
      }

      setItems(data.items || []);
      setPage(data.page || 1);
      setPageCount(data.pageCount || 1);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runIngest() {
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно вызвать парсер.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) {
      alert('Сначала войдите в админ-аккаунт.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/actions/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ search: q.trim() || 'vin' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Не удалось запустить парсер');
      }

      alert(`Получено: ${data.received}, сохранено/обновлено: ${data.upserted}`);
      await load(1);
    } catch (e) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function publish(id) {
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно опубликовать объявление.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Сначала войдите в админ-аккаунт.');
      return;
    }

    const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return alert(`Ошибка публикации: ${data?.error || 'failed'}`);
    }
    alert('Опубликовано! Доступно на /trades');
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
