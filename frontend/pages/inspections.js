import { useEffect, useMemo, useState } from 'react';
import { apiFetch, getToken, resolveApiUrl } from '../lib/api';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const token = getToken();
      if (!token) { window.location.href = '/login?next=/inspections'; return; }
      try {
        const res = await apiFetch('/api/inspections/statuses');
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setStatuses(Array.isArray(data?.statuses) ? data.statuses : []);
      } catch (err) {
        console.error('Failed to load inspection statuses', err);
        if (!ignore) setStatuses([]);
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const token = getToken();
      if (!token) { window.location.href = '/login?next=/inspections'; return; }

      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('markViewed', '1');
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

        const res = await apiFetch(`/api/inspections/me?${params.toString()}`);
        if (res.status === 401) { window.location.href = '/login?next=/inspections'; return; }
        if (!res.ok) throw new Error('status ' + res.status);

        const data = await res.json();
        if (ignore) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('inspections-refresh-count'));
        }
      } catch (err) {
        console.error('Failed to load inspections:', err);
        if (!ignore) {
          setError('Не удалось загрузить ваши осмотры. Попробуйте позже.');
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [statusFilter]);

  const options = useMemo(() => {
    const set = new Set(['all']);
    statuses.forEach((st) => { if (st) set.add(st); });
    items.forEach((item) => { if (item?.status) set.add(item.status); });
    return Array.from(set);
  }, [statuses, items]);

  if (loading) return <div className="container" style={{ maxWidth: 800, padding: 16 }}>Загрузка…</div>;

  return (
    <div className="container" style={{ maxWidth: 1000, padding: 16 }}>
      <h1>Мои Осмотры</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label htmlFor="statusFilter" style={{ fontWeight: 600 }}>Фильтр по статусу:</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d0d0d0', minWidth: 220 }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'Все статусы' : opt}
            </option>
          ))}
        </select>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>}

      {items.length === 0 && !error && (
        <div>Осмотры не найдены.</div>
      )}

      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Дата</th>
                <th style={th}>Объявление</th>
                <th style={th}>Статус</th>
                <th style={th}>Сумма</th>
                <th style={th}>Отчёт</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const unread = Boolean(it?.user_unread);
                return (
                  <tr key={it.id} style={unread ? rowUnread : undefined}>
                    <td style={td}>{unread ? <span style={dot} title="Новый">●</span> : null}</td>
                    <td style={td}>{new Date(it.created_at).toLocaleString('ru-RU')}</td>
                    <td style={td}>
                      <a href={`/trades/${it.listing_id}`} target="_blank" rel="noreferrer">
                        {it.listing_title || it.listing_id}
                      </a>
                    </td>
                    <td style={td}>{it.status}</td>
                    <td style={td}>{(it.final_amount || 0).toLocaleString('ru-RU')} ₽</td>
                    <td style={td}>
                      {(it.status === 'Осмотр завершен' && it.report_pdf_url)
                        ? <a href={resolveApiUrl(it.report_pdf_url)} target="_blank" rel="noreferrer">Скачать PDF</a>
                        : <span style={{ opacity: .6 }}>Недоступно</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { textAlign:'left', borderBottom:'1px solid #eee', padding:'8px' };
const td = { borderBottom:'1px solid #f3f3f3', padding:'8px' };
const rowUnread = { background: 'rgba(37,99,235,0.08)' };
const dot = { color: '#2563eb', fontSize: 18, lineHeight: 1 };
