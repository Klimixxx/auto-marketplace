import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

export default function AdminTradeOrdersList() {
  const [me, setMe] = useState(null);
  const [inProgressItems, setInProgressItems] = useState([]);
  const [completedItems, setCompletedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) { location.href = '/login?next=/admin/trade-orders'; return; }
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

    async function loadOrders() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) { location.href = '/login?next=/admin/trade-orders'; return; }
        const headers = { Authorization: 'Bearer ' + token };
        const inProgressUrl = resolveApiUrl(`/api/admin/trade-orders?exclude_status=${encodeURIComponent('Торги завершены')}`);
        const completedUrl = resolveApiUrl(`/api/admin/trade-orders?status=${encodeURIComponent('Торги завершены')}&limit=100`);

        const [inProgressRes, completedRes] = await Promise.all([
          fetch(inProgressUrl, { headers }),
          fetch(completedUrl, { headers }),
        ]);

        if (inProgressRes.status === 403 || completedRes.status === 403) {
          alert('Нет доступа');
          location.href = '/';
          return;
        }

        if (!inProgressRes.ok) throw new Error('status ' + inProgressRes.status);
        if (!completedRes.ok) throw new Error('status ' + completedRes.status);

        const [inProgressData, completedData] = await Promise.all([
          inProgressRes.json(),
          completedRes.json(),
        ]);

        if (ignore) return;
        setInProgressItems(Array.isArray(inProgressData?.items) ? inProgressData.items : []);
        setCompletedItems(Array.isArray(completedData?.items) ? completedData.items : []);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin-trade-orders-refresh'));
        }
      } catch (err) {
        console.error('Failed to load admin trade orders', err);
        if (!ignore) {
          setError('Не удалось загрузить заявки на торги. Попробуйте позже.');
          setInProgressItems([]);
          setCompletedItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOrders();
    return () => { ignore = true; };
  }, [me]);

  const tabs = useMemo(
    () => [
      {
        key: 'in-progress',
        label: `В работе (${inProgressItems.length})`,
        description: null,
        emptyText: 'Нет заявок в работе.',
        list: inProgressItems,
      },
      {
        key: 'completed',
        label: `Завершены (${completedItems.length})`,
        description: 'Отображаются последние 100 заявок со статусом «Торги завершены».',
        emptyText: 'Нет завершённых заявок.',
        list: completedItems,
      },
    ],
    [inProgressItems, completedItems],
  );

  const [activeTab, setActiveTab] = useState('in-progress');

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.key === activeTab) || tabs[0],
    [tabs, activeTab],
  );

  return (
    <AdminLayout me={me} title="Сопровождение торгов">
      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div style={tabsContainer}>
            {tabs.map((tab) => {
              const isActive = currentTab && tab.key === currentTab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={isActive ? tabButtonActive : tabButton}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <section>
            <h2 style={sectionTitle}>{currentTab?.key === 'in-progress' ? 'В работе' : 'Завершены'}</h2>
            {currentTab?.description ? (
              <p style={sectionDescription}>{currentTab.description}</p>
            ) : null}
            {(currentTab?.list?.length ?? 0) > 0 ? (
              <OrdersTable items={currentTab.list} />
            ) : (
              <div style={emptyState}>{currentTab?.emptyText || 'Нет данных.'}</div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

function OrdersTable({ items }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}></th>
            <th style={th}>Дата</th>
            <th style={th}>Пользователь</th>
            <th style={th}>Объявление</th>
            <th style={th}>Статус</th>
            <th style={th}>Сумма</th>
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
                <td style={td}>
                  <a href={`/trades/${it.listing_id}`} target="_blank" rel="noreferrer">
                    {it.listing_title || it.listing_id}
                  </a>
                </td>
                <td style={td}>{it.status}</td>
                <td style={td}>{formatCurrency(it.final_amount)}</td>
                <td style={td}>
                  <a href={`/admin/trade-orders/${it.id}`} style={unread ? linkUnread : undefined}>перейти в заявку</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCurrency(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
}

const th = { textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px', fontWeight: 600 };
const td = { borderBottom: '1px solid #f3f3f3', padding: '8px', verticalAlign: 'top' };
const rowUnread = { background: 'rgba(239,68,68,0.08)' };
const dot = { color: '#ef4444', fontSize: 18, lineHeight: 1 };
const linkUnread = { fontWeight: 700 };
const sectionTitle = { margin: '0 0 8px', fontSize: 20, fontWeight: 700 };
const sectionDescription = { margin: '0 0 16px', color: 'var(--text-muted)' };
const emptyState = { padding: '12px 0', color: 'var(--text-muted)' };
const tabsContainer = {
  display: 'flex',
  gap: 8,
  borderBottom: '1px solid #eee',
  flexWrap: 'wrap',
};
const tabButton = {
  border: 'none',
  background: 'transparent',
  padding: '8px 12px',
  fontSize: 14,
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
};
const tabButtonActive = {
  ...tabButton,
  borderBottomColor: '#ef4444',
  color: '#ef4444',
  fontWeight: 600,
};

