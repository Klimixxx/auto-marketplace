import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

export default function AdminInspectionsList() {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) { location.href = '/login?next=/admin/inspections'; return; }
      try {
        const res = await fetch(resolveApiUrl('/api/me'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('me');
        const user = await res.json();
        if (user?.role !== 'admin') { location.href = '/'; return; }
        setMe(user);
      } catch (err) {
        console.error('Failed to load current admin', err);
        location.href = '/';
      }
    })();
  }, []);

  useEffect(() => {
    if (!me) return;
    let ignore = false;

    async function loadStatuses() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(resolveApiUrl('/api/admin/inspections/statuses'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setStatuses(Array.isArray(data?.statuses) ? data.statuses : []);
      } catch (err) {
        console.error('Failed to load inspection statuses', err);
        if (!ignore) setStatuses([]);
      }
    }

    loadStatuses();
    return () => { ignore = true; };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let ignore = false;

    async function loadInspections() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) { location.href = '/login?next=/admin/inspections'; return; }
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        const url = resolveApiUrl(`/api/admin/inspections${params.toString() ? `?${params}` : ''}`);
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 403) { alert('Нет доступа'); location.href = '/'; return; }
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (ignore) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin-inspections-refresh'));
        }
      } catch (err) {
        console.error('Failed to load admin inspections', err);
        if (!ignore) {
          setError('Не удалось загрузить заказы на осмотр. Попробуйте позже.');
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadInspections();
    return () => { ignore = true; };
  }, [me, statusFilter]);

  const options = useMemo(() => {
    const base = new Set(['all']);
    statuses.forEach((st) => { if (st) base.add(st); });
    items.forEach((item) => { if (item?.status) base.add(item.status); });
    return Array.from(base);
  }, [statuses, items]);

  return (
    <AdminLayout me={me} title="Осмотры">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }} htmlFor="statusFilter">Фильтр по статусу:</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', minWidth: 220 }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'Все статусы' : opt}
            </option>
          ))}
        </select>
      </div>

      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div>Заказы на осмотр не найдены.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Дата</th>
                <th style={th}>Пользователь</th>
                <th style={th}>Подписка</th>
                <th style={th}>Объявление</th>
                <th style={th}>Статус</th>
                <th style={th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const unread = Boolean(it?.admin_unread);
                return (
                  <tr key={it.id} style={unread ? rowUnread : undefined}>
                    <td style={td}>
                      {unread ? <span style={dot} title="Новый">●</span> : null}
                    </td>
                    <td style={td}>{new Date(it.created_at).toLocaleString('ru-RU')}</td>
                    <td style={td}>{it.user_name || it.user_phone}</td>
                    <td style={td}>{it.subscription_status}</td>
                    <td style={td}>
                      <a href={`/trades/${it.listing_id}`} target="_blank" rel="noreferrer">
                        {it.listing_title || it.listing_id}
                      </a>
                    </td>
                    <td style={td}>{it.status}</td>
                    <td style={td}>
                      <a href={`/admin/inspections/${it.id}`} style={unread ? linkUnread : undefined}>перейти на осмотр</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

const th = { textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px', fontWeight: 600 };
const td = { borderBottom: '1px solid #f3f3f3', padding: '8px', verticalAlign: 'top' };
const rowUnread = { background: 'rgba(239,68,68,0.08)' };
const dot = { color: '#ef4444', fontSize: 18, lineHeight: 1 };
const linkUnread = { fontWeight: 700 };
