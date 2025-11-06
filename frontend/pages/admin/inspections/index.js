import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

export default function AdminInspectionsList() {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

    async function loadInspections() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) { location.href = '/login?next=/admin/inspections'; return; }
        const url = resolveApiUrl('/api/admin/inspections');
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
  }, [me]);

  const { activeItems, completedItems } = useMemo(() => {
    const active = [];
    const completed = [];
    for (const item of items) {
      if (isCompletedInspection(item)) {
        if (completed.length < 100) completed.push(item);
      } else {
        active.push(item);
      }
    }
    return { activeItems: active, completedItems: completed };
  }, [items]);

  const renderTable = (list) => (
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
          {list.map((it) => {
            const unread = Boolean(it?.admin_unread);
            return (
              <tr key={it.id} style={unread ? rowUnread : undefined}>
                <td style={td}>
                  {unread ? <span style={dot} title="Новый">●</span> : null}
                </td>
                <td style={td}>{new Date(it.created_at).toLocaleString('ru-RU')}</td>
                <td style={td}>{it.user_name || it.user_phone || it.user_email || '—'}</td>
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
  );

  return (
    <AdminLayout me={me} title="Осмотры">
      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 32 }}>
          <section>
            <h2 style={sectionTitle}>В работе</h2>
            {activeItems.length > 0 ? (
              renderTable(activeItems)
            ) : (
              <div style={emptyState}>Заявок в работе нет.</div>
            )}
          </section>

          <section>
            <h2 style={sectionTitle}>Завершены</h2>
            <p style={sectionDescription}>Отображаются последние 100 заявок со статусом «Осмотр завершен».</p>
            {completedItems.length > 0 ? (
              renderTable(completedItems)
            ) : (
              <div style={emptyState}>Завершенных осмотров пока нет.</div>
            )}
          </section>
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
const sectionTitle = { margin: '0 0 8px', fontSize: 20, fontWeight: 700 };
const sectionDescription = { margin: '0 0 16px', color: 'var(--text-muted)' };
const emptyState = { padding: '12px 0', color: 'var(--text-muted)' };

function isCompletedInspection(item) {
  const statusText = (item?.status || '').toString().toLowerCase();
  return statusText.includes('осмотр') && statusText.includes('заверш');
}

