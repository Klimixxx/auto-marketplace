// pages/admin/inspections/[id].js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

const STATUS_FLOW = [
  'Оплачен/Ожидание модерации',
  'Заказ принят, Приступаем к Осмотру',
  'Производится осмотр',
  'Осмотр завершен',
];

export default function AdminInspectionDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [me, setMe] = useState(null);
  const [item, setItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);

  const notifyHref = useMemo(() => {
    if (!item?.user_code) return '/admin/notify';
    const params = new URLSearchParams({ user_code: item.user_code });
    return `/admin/notify?${params.toString()}`;
  }, [item?.user_code]);

  // Проверка авторизации и роли
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login?next=/admin/inspections');
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

  // Загрузка конкретного осмотра
  useEffect(() => {
    if (!id || !me) return;
    let ignore = false;

    async function loadInspection() {
      try {
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          router.replace('/login?next=/admin/inspections');
          return;
        }
        const res = await fetch(resolveApiUrl(`/api/admin/inspections/${id}`), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (ignore) return;
        setItem(data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin-inspections-refresh'));
        }
      } catch (err) {
        console.error('Failed to load inspection detail', err);
        if (!ignore) {
          setError('Не удалось загрузить осмотр');
          router.replace('/admin/inspections');
        }
      }
    }

    loadInspection();
    return () => {
      ignore = true;
    };
  }, [id, me, router]);

  // Обновление статуса заказа
  async function updateOrderStatus(nextStatus) {
    if (!item || item.status === nextStatus) return;

    const token = localStorage.getItem('token');
    setUpdatingStatus(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/inspections/${id}/status`), {
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
        window.dispatchEvent(new Event('admin-inspections-refresh'));
      }
      alert('Статус обновлён');
    } catch (err) {
      console.error('Failed to update inspection status', err);
      alert('Ошибка обновления статуса');
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Загрузка PDF отчёта
  async function uploadPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('report_pdf', file);

      const res = await fetch(resolveApiUrl(`/api/admin/inspections/${id}/upload`), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      if (!res.ok) throw new Error('upload');

      const data = await res.json();
      setItem((prev) => ({
        ...(prev || {}),
        ...(data?.order || {}),
        admin_unread: false,
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin-inspections-refresh'));
      }
      alert('PDF загружен');
    } catch (err) {
      console.error('Failed to upload inspection PDF', err);
      alert('Ошибка загрузки PDF');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminLayout me={me} title={item ? `Осмотр #${item.id}` : 'Осмотр'}>
      {!item && !error && <div>Загрузка…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {item && !error && (
        <div style={{ display: 'grid', gap: 24 }}>
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
              Новая заявка на осмотр
            </div>
          )}

          <section style={card}>
            <h2 style={sectionTitle}>Информация о пользователе</h2>
            <InfoRow label="Имя" value={item.user_name || 'Не указано'} />
            <InfoRow label="ID аккаунта" value={item.user_code || '—'} />
            <InfoRow label="Номер" value={item.user_phone || '—'} />
            <InfoRow label="Почта" value={item.user_email || '—'} />
            <InfoRow label="Подписка" value={item.subscription_status || '—'} />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Заявка</h2>
            <InfoRow
              label="Объявление"
              value={(
                <a
                  href={`/trades/${item.listing_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.listing_title || item.listing_id}
                </a>
              )}
            />
            <InfoRow label="Дата подачи заявки" value={formatDateTime(item.created_at)} />
            <InfoRow label="Текущий статус" value={item.status || '—'} />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Управление статусами</h2>
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
                      border: isActive
                        ? '1px solid #1E90FF'
                        : '1px solid #d0d0d0',
                      background: isActive ? '#1E90FF' : '#fff',
                      color: isActive ? '#fff' : '#111',
                      cursor:
                        isActive || updatingStatus ? 'default' : 'pointer',
                    }}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Отчёт</h2>
            <div style={{ marginBottom: 12 }}>
              <strong>PDF:</strong>{' '}
              {item.report_pdf_url ? (
                <a
                  href={resolveApiUrl(item.report_pdf_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть отчёт
                </a>
              ) : (
                <span>не загружен</span>
              )}
            </div>
            <input
              type="file"
              accept="application/pdf"
              onChange={uploadPdf}
              disabled={uploading}
            />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Отправить пользователю уведомление</h2>
            <p style={{ margin: '0 0 12px', color: 'var(--text-muted)' }}>
              Перейдите к форме уведомлений, чтобы быстро связаться с пользователем по этому осмотру.
            </p>
            <a className="button" href={notifyHref}>
              Открыть форму уведомления
            </a>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

const card = {
  padding: '16px',
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface-1)',
  display: 'grid',
  gap: 8,
};

const sectionTitle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
};

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </span>
      <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
  );
}

function formatDateTime(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

