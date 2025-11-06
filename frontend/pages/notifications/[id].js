// pages/notifications/[id].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE;

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch (err) {
    return '';
  }
}

export default function NotificationDetailsPage() {
  const router = useRouter();
  const { id } = router.query || {};
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      location.href = '/login';
      return;
    }

    let aborted = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API}/api/notifications/${id}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Не удалось загрузить уведомление');
        }
        if (!aborted) {
          const notification = data.notification || data;
          setItem(notification);
          try {
            window.dispatchEvent(new Event('notifications-refresh'));
          } catch (dispatchError) {
            console.warn('notifications refresh dispatch error:', dispatchError);
          }
        }
      } catch (err) {
        if (!aborted) {
          setError(err.message || 'Не удалось загрузить уведомление');
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      aborted = true;
    };
  }, [router.isReady, id]);

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => router.push('/notifications')}
          className="button"
          style={{ background: '#f0f0f0', color: '#1f1f1f' }}
        >
          ← Назад к уведомлениям
        </button>
      </div>

      {loading && <div>Загрузка…</div>}
      {error && !loading && <div style={{ color: 'salmon' }}>{error}</div>}

      {!loading && !error && item && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{item.title}</h1>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{formatDate(item.created_at)}</div>
          </div>

          {item.read_at ? (
            <div style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>
              Просмотрено: {formatDate(item.read_at)}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#faad14', fontWeight: 600 }}>
              Не просмотрено
            </div>
          )}

          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontSize: 16,
              color: '#202020',
            }}
          >
            {item.body}
          </div>
        </div>
      )}
    </div>
  );
}
