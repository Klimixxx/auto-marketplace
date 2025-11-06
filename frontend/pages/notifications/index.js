// pages/notifications/index.js
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE;

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch (err) {
    return '';
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) {
      location.href = '/login';
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setErr('');

    try {
      const response = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка загрузки уведомлений');

      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      const unread = list.filter((item) => !item.read_at).length;
      setUnreadCount(unread);
    } catch (error) {
      setErr(error.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => load({ silent: true });
    window.addEventListener('notifications-refresh', handler);
    return () => window.removeEventListener('notifications-refresh', handler);
  }, [load]);

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1>Уведомления</h1>

      {unreadCount > 0 && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(255, 77, 79, 0.08)',
            border: '1px solid rgba(255, 77, 79, 0.25)',
            borderRadius: 10,
            color: '#a8071a',
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Непрочитанных уведомлений: {unreadCount}
        </div>
      )}

      {loading && <div>Загрузка…</div>}
      {err && <div style={{ color: 'salmon' }}>{err}</div>}
      {!loading && !err && items.length === 0 && <div>Пока пусто</div>}

      {items.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => {
            const unread = !item.read_at;
            return (
              <Link key={item.id} href={`/notifications/${item.id}`} legacyBehavior>
                <a
                  className="card"
                  style={{
                    padding: 16,
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    border: unread ? '1px solid rgba(255, 77, 79, 0.45)' : undefined,
                    boxShadow: unread ? '0 0 0 3px rgba(255, 77, 79, 0.08)' : undefined,
                    background: unread ? 'rgba(255, 255, 255, 0.96)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {unread && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#ff4d4f',
                            boxShadow: '0 0 0 2px rgba(255, 77, 79, 0.35)',
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(item.created_at)}</div>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      color: '#39424c',
                      fontSize: 15,
                      lineHeight: 1.45,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.body}
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1890ff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Подробнее
                    <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                      →
                    </span>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
