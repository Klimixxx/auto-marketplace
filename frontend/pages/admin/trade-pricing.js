import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { resolveApiUrl } from '../../lib/api';
import { DEFAULT_DEPOSIT_PERCENT } from '../../lib/tradePricing';

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
}

function parsePercentInput(value) {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [integer = '', ...rest] = cleaned.split('.');
  const fraction = rest.join('');
  return fraction ? `${integer}.${fraction}` : integer;
}

function computeExample(depositPercent) {
  const percent = Number.isFinite(depositPercent) ? depositPercent : DEFAULT_DEPOSIT_PERCENT;
  const depositAmount = 100_000;
  const serviceFee = Math.round((depositAmount * percent) / 100);
  const final = depositAmount + serviceFee;
  return { depositAmount, serviceFee, final };
}

export default function AdminTradePricingPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login?next=/admin/trade-pricing'; return; }
      try {
        const res = await fetch(resolveApiUrl('/api/me'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const user = await res.json();
        if (!user || user.role !== 'admin') { window.location.href = '/'; return; }
        setMe(user);
      } catch (err) {
        console.error('Failed to load current admin', err);
        window.location.href = '/';
      }
    })();
  }, []);

  const tokenMemo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, [me]);

  async function loadSettings() {
    const token = tokenMemo;
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setSavedMessage('');
      const res = await fetch(resolveApiUrl('/api/admin/trade-pricing'), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 403) { alert('Нет доступа'); window.location.href = '/'; return; }
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      const percent = Number(data?.settings?.depositPercent);
      if (Number.isFinite(percent)) {
        setDepositPercent(String(percent));
      } else {
        setDepositPercent(String(DEFAULT_DEPOSIT_PERCENT));
      }
    } catch (err) {
      console.error('Failed to load trade pricing settings', err);
      setError('Не удалось загрузить настройки. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function saveSettings() {
    const token = tokenMemo;
    if (!token) return;
    const percentValue = depositPercent === '' ? DEFAULT_DEPOSIT_PERCENT : Number(depositPercent);
    if (!Number.isFinite(percentValue)) {
      alert('Введите корректное значение процента.');
      return;
    }
    try {
      setSaving(true);
      setSavedMessage('');
      const res = await fetch(resolveApiUrl('/api/admin/trade-pricing'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ depositPercent: percentValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `status ${res.status}`);
      }
      const data = await res.json();
      const savedPercent = Number(data?.settings?.depositPercent);
      if (Number.isFinite(savedPercent)) {
        setDepositPercent(String(savedPercent));
      }
      setSavedMessage('Настройки сохранены.');
    } catch (err) {
      console.error('Failed to save trade pricing settings', err);
      alert('Не удалось сохранить процент. Попробуйте позже.');
    } finally {
      setSaving(false);
    }
  }

  const percentNumber = Number(depositPercent);
  const example = computeExample(Number.isFinite(percentNumber) ? percentNumber : DEFAULT_DEPOSIT_PERCENT);

  return (
    <AdminLayout me={me} title="Настройки сопровождения торгов">
      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>

          <h2 style={{ marginTop: 0 }}>Процент к задатку</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Клиент оплачивает задаток лота и нашу комиссию, рассчитанную как фиксированный процент от суммы задатка.
            </p>
            <label style={labelStyle}>
              Процент к задатку, %
              <input
                value={depositPercent}
                onChange={(e) => setDepositPercent(parsePercentInput(e.target.value))}
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={saveSettings} className="button" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
              {savedMessage && <span style={{ color: '#10b981' }}>{savedMessage}</span>}
            </div>
          </section>

          <section>
            <h2 style={{ marginTop: 0 }}>Пример расчёта</h2>
            <p style={{ margin: '0 0 8px' }}>
              При задатке {formatNumber(example.depositAmount)} ₽ комиссия составит {formatNumber(example.serviceFee)} ₽.
            </p>
            <p style={{ margin: 0 }}>
              Клиенту к оплате: {formatNumber(example.final)} ₽ (задаток + комиссия).
            </p>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-1)',
  color: 'var(--text)',
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontWeight: 600,
  color: 'var(--text)',
};
