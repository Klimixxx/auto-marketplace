import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';
import { resolveFedresursUrl, resolveTradePlatformUrl } from '../../../lib/listingLinks';

const STATUS_FLOW = [
  'Оплачен/Ожидание модерации',
  'Заявка подтверждена',
  'Подготовка к торгам',
  'Торги завершены',
];

function formatCurrency(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

function parseDepositPercent(serviceTier) {
  if (!serviceTier) return null;
  const match = String(serviceTier).match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
  if (!match) return null;
  const percent = Number(match[1].replace(',', '.'));
  return Number.isFinite(percent) ? percent : null;
}

function calculateDepositAmount(finalAmount, depositPercent, discountPercent) {
  const finalNumber = Number(finalAmount);
  if (!Number.isFinite(finalNumber) || finalNumber <= 0) return null;
  const deposit = Number(depositPercent);
  if (!Number.isFinite(deposit) || deposit <= 0) return null;
  const discount = Number(discountPercent);
  const discountRatio = Number.isFinite(discount) ? Math.min(1, Math.max(0, discount / 100)) : 0;
  const depositRatio = deposit / 100;
  const factor = 1 + depositRatio * (1 - discountRatio);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const raw = finalNumber / factor;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw);
}

export default function AdminTradeOrderDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [me, setMe] = useState(null);
  const [item, setItem] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);

  const listingInfo = useMemo(() => {
    if (!item) return null;
    return {
      details: item.listing_details || null,
      source_url: item.listing_source_url || null,
      sourceUrl: item.listing_source_url || null,
      fedresurs_id: item.listing_source_id || null,
    };
  }, [item]);

  const fedresursUrl = useMemo(() => resolveFedresursUrl(listingInfo), [listingInfo]);
  const tradePlatformUrl = useMemo(() => resolveTradePlatformUrl(listingInfo), [listingInfo]);
  const depositPercent = useMemo(() => parseDepositPercent(item?.service_tier), [item?.service_tier]);
  const depositAmount = useMemo(
    () => calculateDepositAmount(item?.final_amount, depositPercent, item?.discount_percent),
    [item?.final_amount, depositPercent, item?.discount_percent]
  );

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
        <div style={{ display: 'grid', gap: 20 }}>
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

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {item.user_code && (
              <a className="button" href={`/admin/notify?user_code=${item.user_code}`}>
                Отправить уведомление
              </a>
            )}
          </div>

          <Section title="Информация о пользователе">
            <InfoGrid>
              <InfoRow label="Имя" value={item.user_name || '—'} />
              <InfoRow label="ID аккаунта" value={item.user_code || '—'} />
              <InfoRow label="Телефон" value={item.user_phone || '—'} />
              <InfoRow label="Почта" value={item.user_email || '—'} />
            </InfoGrid>
          </Section>

          <Section title="Заявка">
            <InfoGrid>
              <InfoRow
                label="Объявление"
                value={
                  <a href={`/trades/${item.listing_id}`} target="_blank" rel="noreferrer">
                    {item.listing_title || item.listing_id}
                  </a>
                }
              />
              <InfoRow label="Дата подачи заявки" value={formatDate(item.created_at)} />
              <InfoRow label="Текущий статус" value={item.status || '—'} />
              <InfoRow
                label="Указанная стоимость"
                value={item.lot_price_estimate != null ? formatCurrency(item.lot_price_estimate) : '—'}
              />
              <InfoRow label="Сумма задатка" value={depositAmount != null ? formatCurrency(depositAmount) : '—'} />
              <InfoRow label="Тариф" value={item.service_tier || '—'} />
              <InfoRow label="Скидка, %" value={item.discount_percent != null ? item.discount_percent : '—'} />
              <InfoRow label="Итого к оплате" value={formatCurrency(item.final_amount)} />
            </InfoGrid>
          </Section>

          <Section title="Внешние ссылки">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                className="button outline"
                href={fedresursUrl || '#'}
                target="_blank"
                rel="noreferrer"
                style={{ pointerEvents: fedresursUrl ? 'auto' : 'none', opacity: fedresursUrl ? 1 : 0.5 }}
              >
                Перейти на Федресурс
              </a>
              <a
                className="button outline"
                href={tradePlatformUrl || '#'}
                target="_blank"
                rel="noreferrer"
                style={{ pointerEvents: tradePlatformUrl ? 'auto' : 'none', opacity: tradePlatformUrl ? 1 : 0.5 }}
              >
                Перейти на ТП
              </a>
            </div>
          </Section>

          <Section title="Управление статусами">
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
          </Section>

          <div style={{ color: '#64748b', fontSize: 13 }}>
            Последнее обновление: {formatDate(item.updated_at)}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ children }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  let display = value;
  if (display === null || display === undefined || display === '') {
    display = '—';
  }
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{display}</div>
    </div>
  );
}
