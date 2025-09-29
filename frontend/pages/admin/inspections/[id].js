// pages/admin/inspections/[id].js
import { useEffect, useState } from 'react';
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
              Новая заявка на осмотр
            </div>
          )}

          <div>
            <div>
              <b>Пользователь:</b> {item.user_name || item.user_phone}
            </div>
            <div>
              <b>Подписка:</b> {item.subscription_status}
            </div>
            <div>
              <b>Объявление: </b>
              <a
                href={`/trades/${item.listing_id}`}
                target="_blank"
                rel="noreferrer"
              >
                {item.listing_title || item.listing_id}
              </a>
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Текущий статус:</b> {item.status}
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              Управление статусами:
            </div>
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
          </div>

          <div>
            <div>
              <b>Отчёт (PDF):</b>{' '}
              {item.report_pdf_url ? (
                <a
                  href={resolveApiUrl(item.report_pdf_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть
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
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
