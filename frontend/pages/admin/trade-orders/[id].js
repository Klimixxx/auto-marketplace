import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

const STATUS_FLOW = [
  'Оплачен/Ожидание модерации',
  'Заявка подтверждена',
  'Подготовка к торгам',
  'Торги завершены',
];

function formatCurrency(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
}

export default function AdminTradeOrderDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [me, setMe] = useState(null);
  const [item, setItem] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login?next=/admin/trade-orders');
        return;
      }
      try {
        const res = await fetch(resolveApiUrl('/api/me'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('me');
        const user = await res.json();
        if (user?.role !== 'admin') {
          router.replace('/');
          return;
        }
        setMe(user);
      } catch (err) {
        console.error('Failed to load current admin', err);
        router.replace('/');
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!id || !me) return;
    let ignore = false;

    async function loadOrder() {
      try {
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          router.replace('/login?next=/admin/trade-orders');
          return;
        }
        const res = await fetch(resolveApiUrl(`/api/admin/trade-orders/${id}`), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (ignore) return;
        setItem(data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin-trade-orders-refresh'));
        }
      } catch (err) {
        console.error('Failed to load trade order detail', err);
        if (!ignore) {
          setError('Не удалось загрузить заявку');
          router.replace('/admin/trade-orders');
        }
      }
    }

    loadOrder();
    return () => { ignore = true; };
  }, [id, me, router]);

  async function updateOrderStatus(nextStatus) {
    if (!item || item.status === nextStatus) return;

    const token = localStorage.getItem('token');
    setUpdatingStatus(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/trade-orders/${id}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('status');

      const data = await res.json();
      setItem((prev) => ({
        ...(prev || {}),
        ...data,
        admin_unread: false,
        status: data.status,
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin-trade-orders-refresh'));
      }
      alert('Статус обновлён');
    } catch (err) {
      console.error('Failed to update trade order status', err);
      alert('Ошибка обновления статуса');
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <AdminLayout me={me} title={item ? `Торги #${item.id}` : 'Заявка на торги'}>
      {!item && !error && <div>Загрузка…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {item && !error && (
        <div style={{ display: 'grid', gap: 16 }}>
          {item.admin_unread && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.08)',
                color: '#b91c1c',
                fontWeight: 600,
              }}
            >
              Новая заявка на сопровождение торгов
            </div>
          )}

          <div>
            <div>
              <b>Пользователь:</b> {item.user_name || item.user_phone}
            </div>
            <div>
              <b>Подписка:</b> {item.subscription_status || '—'}
            </div>
            <div>
              <b>Объявление: </b>
              <a href={`/trades/${item.listing_id}`} target="_blank" rel="noreferrer">
                {item.listing_title || item.listing_id}
              </a>
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Текущий статус:</b> {item.status}
            </div>
          </div>

          <div>
            <div><b>Тариф:</b> {item.service_tier || '—'}</div>
            <div><b>Базовая стоимость:</b> {formatCurrency(item.base_price)}</div>
            <div><b>Скидка, %:</b> {item.discount_percent != null ? item.discount_percent : '—'}</div>
            <div><b>Итого к оплате:</b> {formatCurrency(item.final_amount)}</div>
            <div><b>Оценка стоимости лота:</b> {item.lot_price_estimate != null ? formatCurrency(item.lot_price_estimate) : '—'}</div>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Управление статусами:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATUS_FLOW.map((st) => {
                const isActive = item.status === st;
                return (
                  <button
                    key={st}
                    onClick={() => updateOrderStatus(st)}
                    disabled={isActive || updatingStatus}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isActive ? '#2563eb' : 'rgba(148,163,184,0.4)',
                      background: isActive ? 'rgba(37,99,235,0.1)' : 'transparent',
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ color: '#64748b', fontSize: 13 }}>
            Последнее обновление: {new Date(item.updated_at).toLocaleString('ru-RU')}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
