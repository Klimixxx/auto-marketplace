import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { resolveApiUrl } from '../../../lib/api';

const STATUS_FLOW = ['В процессе', 'Обработано'];

export default function AdminAutotekaDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [me, setMe] = useState(null);
  const [item, setItem] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);
  const [reportUrl, setReportUrl] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) { router.replace('/login?next=/admin/autoteka-orders'); return; }
      try {
        const res = await fetch(resolveApiUrl('/api/me'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('me');
        const user = await res.json();
        if (user?.role !== 'admin') { router.replace('/'); return; }
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
        if (!token) { router.replace('/login?next=/admin/autoteka-orders'); return; }
        const res = await fetch(resolveApiUrl(`/api/admin/autoteka-orders/${id}`), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (ignore) return;
        setItem(data);
        setReportUrl(data?.report_pdf_url || '');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin-autoteka-refresh'));
        }
      } catch (err) {
        console.error('Failed to load autoteka detail', err);
        if (!ignore) {
          setError('Не удалось загрузить заказ Автотеки');
          router.replace('/admin/autoteka-orders');
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
      const res = await fetch(resolveApiUrl(`/api/admin/autoteka-orders/${id}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'REPORT_URL_REQUIRED') {
          alert('Чтобы пометить заказ как обработанный, сохраните ссылку на отчёт.');
          return;
        }
        throw new Error('status');
      }

      const data = await res.json();
      setItem((prev) => ({
        ...(prev || {}),
        ...data,
        admin_unread: false,
        status: data.status,
      }));

      if (data?.report_pdf_url !== undefined) {
        setReportUrl(data.report_pdf_url || '');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin-autoteka-refresh'));
      }
      alert('Статус обновлён');
    } catch (err) {
      console.error('Failed to update autoteka status', err);
      alert('Ошибка обновления статуса');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveReportLink(e) {
    e.preventDefault();
    const link = reportUrl.trim();
    if (!link) {
      alert('Введите ссылку на отчёт');
      return;
    }

    setReportUrl(link);
    setSavingReport(true);
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(resolveApiUrl(`/api/admin/autoteka-orders/${id}/upload`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ report_url: link }),
      });
      if (!res.ok) throw new Error('upload');

      const data = await res.json();
      setItem((prev) => ({
        ...(prev || {}),
        ...(data?.order || {}),
        admin_unread: false,
      }));

      if (data?.order?.report_pdf_url !== undefined) {
        setReportUrl(data.order.report_pdf_url || '');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin-autoteka-refresh'));
      }
      alert('Ссылка сохранена');
    } catch (err) {
      console.error('Failed to save autoteka report link', err);
      alert('Ошибка сохранения ссылки');
    } finally {
      setSavingReport(false);
    }
  }

  return (
    <AdminLayout me={me} title={item ? `Автотека #${item.id}` : 'Автотека'}>
      {!item && !error && <div>Загрузка…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {item && !error && (
        <div style={{ display: 'grid', gap: 16 }}>
          {item.admin_unread && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.4)',
                background: 'rgba(99,102,241,0.12)',
                color: '#3730a3',
                fontWeight: 600,
              }}
            >
              Новый заказ Автотеки
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
            <div>
              <b>Сумма:</b> {(item.final_amount || 0).toLocaleString('ru-RU')} ₽
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Текущий статус:</b> {item.status}
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Отчёт:</b>{' '}
              {item.report_pdf_url ? (
                <a href={resolveApiUrl(item.report_pdf_url)} target="_blank" rel="noreferrer">Открыть</a>
              ) : (
                <span style={{ opacity: 0.7 }}>не указана ссылка</span>
              )}
            </div>
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
                      borderRadius: 10,
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(99,102,241,0.6)' : 'rgba(148,163,184,0.4)',
                      background: isActive ? 'rgba(99,102,241,0.16)' : 'transparent',
                      color: isActive ? '#3730a3' : '#1f2937',
                      fontWeight: isActive ? 700 : 500,
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ссылка на отчёт:</div>
            <form onSubmit={saveReportLink} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="url"
                value={reportUrl}
                onChange={(event) => setReportUrl(event.target.value)}
                placeholder="https://example.com/report"
                style={{ flex: '1 1 320px', minWidth: 260, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
              <button
                type="submit"
                disabled={savingReport}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: savingReport ? '#cbd5f5' : '#4f46e5',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: savingReport ? 'default' : 'pointer',
                }}
              >
                {savingReport ? 'Сохранение…' : 'Сохранить ссылку'}
              </button>
            </form>
            <div style={{ color: '#6b7280', marginTop: 6, fontSize: 13 }}>
              Эта ссылка будет автоматически доступна всем заказам Автотеки по данному лоту.
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
