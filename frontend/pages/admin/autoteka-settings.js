import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { resolveApiUrl } from '../../lib/api';

export default function AdminAutotekaSettings() {
  const [me, setMe] = useState(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) { location.href = '/login?next=/admin/autoteka-settings'; return; }
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

    async function loadSettings() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { location.href = '/login?next=/admin/autoteka-settings'; return; }
        const res = await fetch(resolveApiUrl('/api/admin/autoteka-settings'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) {
          const value = Number(data?.settings?.price);
          setPrice(Number.isFinite(value) ? String(value) : '');
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load autoteka settings', err);
        if (!ignore) setError('Не удалось загрузить настройки.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSettings();
    return () => { ignore = true; };
  }, [me]);

  async function saveSettings(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login?next=/admin/autoteka-settings'; return; }

    setSaving(true);
    setError(null);
    setSavedMessage('');
    try {
      const amount = Number(price);
      const res = await fetch(resolveApiUrl('/api/admin/autoteka-settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ price: amount }),
      });
      if (!res.ok) throw new Error('status');
      const data = await res.json();
      const saved = Number(data?.settings?.price);
      setPrice(Number.isFinite(saved) ? String(saved) : String(amount));
      setSavedMessage('Сохранено');
      setTimeout(() => setSavedMessage(''), 2500);
    } catch (err) {
      console.error('Failed to save autoteka settings', err);
      setError('Не удалось сохранить настройки.');
    } finally {
      setSaving(false);
    }
  }

  const priceValue = Number(price);
  const pricePreview = Number.isFinite(priceValue) ? priceValue.toLocaleString('ru-RU') + ' ₽' : '—';

  return (
    <AdminLayout me={me} title="Настройки Автотеки">
      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>}

      {!loading && !error && (
        <form onSubmit={saveSettings} style={{ maxWidth: 360, display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Стоимость отчёта, ₽</span>
            <input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 16,
              }}
            />
          </label>

          <div style={{ color: '#6b7280', fontSize: 13 }}>
            Текущая стоимость: <b>{pricePreview}</b>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>

          {savedMessage && <div style={{ color: '#16a34a', fontWeight: 600 }}>{savedMessage}</div>}
        </form>
      )}
    </AdminLayout>
  );
}
