import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { resolveApiUrl } from '../../lib/api';

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('ru-RU');
}

export default function AdminInspectionPricing() {
  const [me, setMe] = useState(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login?next=/admin/inspection-pricing'; return; }
      try {
        const res = await fetch(resolveApiUrl('/api/me'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const user = await res.json();
        if (user?.role !== 'admin') { window.location.href = '/'; return; }
        setMe(user);
      } catch (err) {
        console.error('Failed to load current admin', err);
        window.location.href = '/';
      }
    })();
  }, []);

  useEffect(() => {
    if (!me) return;
    let ignore = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        if (!token) { window.location.href = '/login?next=/admin/inspection-pricing'; return; }
        const res = await fetch(resolveApiUrl('/api/admin/inspection-settings'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) {
          const value = Number(data?.settings?.price);
          setPrice(Number.isFinite(value) ? String(value) : '');
        }
      } catch (err) {
        console.error('Failed to load inspection pricing', err);
        if (!ignore) setError('Не удалось загрузить стоимость осмотра.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSettings();
    return () => { ignore = true; };
  }, [me]);

  async function handleSave(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login?next=/admin/inspection-pricing'; return; }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const amount = Number(price);
      const res = await fetch(resolveApiUrl('/api/admin/inspection-settings'), {
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
      console.error('Failed to save inspection price', err);
      setError('Не удалось сохранить стоимость. Попробуйте позже.');
    } finally {
      setSaving(false);
    }
  }

  const priceNumber = Number(price);
  const formattedPrice = Number.isFinite(priceNumber) ? `${formatPrice(priceNumber)} ₽` : '—';
  const proPrice = Number.isFinite(priceNumber)
    ? `${formatPrice(Math.round(priceNumber / 2))} ₽`
    : '—';

  return (
    <AdminLayout me={me} title="Стоимость осмотра">
      {loading && <div>Загрузка…</div>}
      {!loading && error && (
        <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>
      )}

      {!loading && !error && (
        <form onSubmit={handleSave} style={{ maxWidth: 420, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Стоимость базового осмотра, ₽</span>
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

          <div style={{
            display: 'grid',
            gap: 6,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(37,99,235,0.06)',
            color: '#1e3a8a',
            fontSize: 14,
          }}>
            <div>Текущая стоимость: <b>{formattedPrice}</b></div>
            <div>Для подписки PRO применяется скидка 50% — <b>{proPrice}</b>.</div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="button"
            style={{ width: 'fit-content', padding: '10px 20px' }}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>

          {savedMessage && <div style={{ color: '#16a34a', fontWeight: 600 }}>{savedMessage}</div>}
        </form>
      )}
    </AdminLayout>
  );
}
