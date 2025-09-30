import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { resolveApiUrl } from '../../lib/api';

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat('ru-RU').format(num);
}

export default function AdminTradePricingPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [effective, setEffective] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [createDraft, setCreateDraft] = useState({ label: '', amount: '', maxAmount: '', sortOrder: '' });
  const [creating, setCreating] = useState(false);

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

  async function loadPricing() {
    const token = tokenMemo;
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(resolveApiUrl('/api/admin/trade-pricing'), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 403) { alert('Нет доступа'); window.location.href = '/'; return; }
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setItems(rawItems);
      setEffective(Array.isArray(data?.effective) ? data.effective : []);
      const map = {};
      rawItems.forEach((tier) => {
        map[tier.id] = {
          label: tier.label || '',
          amount: tier.amount != null ? String(tier.amount) : '',
          maxAmount: tier.maxAmount != null ? String(tier.maxAmount) : '',
          sortOrder: tier.sortOrder != null ? String(tier.sortOrder) : '',
        };
      });
      setDrafts(map);
    } catch (err) {
      console.error('Failed to load trade pricing tiers', err);
      setError('Не удалось загрузить тарифы. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    loadPricing();
  }, [me]);

  function updateDraft(id, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  }

  async function saveTier(id) {
    const draft = drafts[id];
    if (!draft) return;
    const token = tokenMemo;
    if (!token) return;
    try {
      setSavingId(id);
      const payload = {
        label: draft.label,
        amount: draft.amount,
        maxAmount: draft.maxAmount === '' ? null : draft.maxAmount,
        sortOrder: draft.sortOrder === '' ? null : draft.sortOrder,
      };
      const res = await fetch(resolveApiUrl(`/api/admin/trade-pricing/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `status ${res.status}`);
      }
      await loadPricing();
    } catch (err) {
      console.error('Failed to save trade tier', err);
      alert('Не удалось сохранить тариф. Проверьте данные и попробуйте снова.');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTier(id) {
    const token = tokenMemo;
    if (!token) return;
    if (!window.confirm('Удалить этот тариф?')) return;
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/trade-pricing/${id}`), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `status ${res.status}`);
      }
      await loadPricing();
    } catch (err) {
      console.error('Failed to delete tier', err);
      alert('Не удалось удалить тариф. Попробуйте позже.');
    }
  }

  async function createTier() {
    const token = tokenMemo;
    if (!token) return;
    const payload = {
      label: createDraft.label,
      amount: createDraft.amount,
      maxAmount: createDraft.maxAmount === '' ? null : createDraft.maxAmount,
      sortOrder: createDraft.sortOrder === '' ? null : createDraft.sortOrder,
    };
    try {
      setCreating(true);
      const res = await fetch(resolveApiUrl('/api/admin/trade-pricing'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `status ${res.status}`);
      }
      setCreateDraft({ label: '', amount: '', maxAmount: '', sortOrder: '' });
      await loadPricing();
    } catch (err) {
      console.error('Failed to create tier', err);
      alert('Не удалось добавить тариф. Убедитесь в корректности данных.');
    } finally {
      setCreating(false);
    }
  }

  const previewTiers = useMemo(() => {
    return effective.map((tier) => {
      const isInfinite = tier.maxAmount == null;
      return {
        ...tier,
        amountFormatted: formatNumber(tier.amount),
        rangeLabel: isInfinite ? 'Без лимита' : `До ${formatNumber(tier.maxAmount)} ₽`,
      };
    });
  }, [effective]);

  return (
    <AdminLayout me={me} title="Тарифы сопровождения торгов">
      {loading && <div>Загрузка…</div>}
      {!loading && error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 24 }}>
          <section>
            <h2 style={{ marginTop: 0 }}>Действующие тарифы</h2>
            {items.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>Тарифы не найдены. Добавьте новый тариф ниже.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={th}>Название</th>
                      <th style={th}>Предел (₽)</th>
                      <th style={th}>Стоимость (₽)</th>
                      <th style={th}>Порядок</th>
                      <th style={th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((tier) => {
                      const draft = drafts[tier.id] || { label: '', amount: '', maxAmount: '', sortOrder: '' };
                      const isSaving = savingId === tier.id;
                      return (
                        <tr key={tier.id}>
                          <td style={td}>
                            <input
                              value={draft.label}
                              onChange={(e) => updateDraft(tier.id, 'label', e.target.value)}
                              style={inputStyle}
                            />
                          </td>
                          <td style={td}>
                            <input
                              value={draft.maxAmount}
                              onChange={(e) => updateDraft(tier.id, 'maxAmount', e.target.value)}
                              placeholder="∞"
                              style={inputStyle}
                            />
                          </td>
                          <td style={td}>
                            <input
                              value={draft.amount}
                              onChange={(e) => updateDraft(tier.id, 'amount', e.target.value)}
                              style={inputStyle}
                            />
                          </td>
                          <td style={td}>
                            <input
                              value={draft.sortOrder}
                              onChange={(e) => updateDraft(tier.id, 'sortOrder', e.target.value)}
                              style={inputStyle}
                            />
                          </td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <button onClick={() => saveTier(tier.id)} disabled={isSaving} className="button button-small">
                              {isSaving ? 'Сохраняем…' : 'Сохранить'}
                            </button>
                            <button
                              onClick={() => deleteTier(tier.id)}
                              className="button button-small button-outline"
                              style={{ marginLeft: 8 }}
                              disabled={isSaving}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 style={{ marginTop: 0 }}>Добавить тариф</h2>
            <div style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
              <label style={labelStyle}>
                Название тарифа
                <input
                  value={createDraft.label}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, label: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Максимальная стоимость лота (₽, оставьте пустым для «без лимита»)
                <input
                  value={createDraft.maxAmount}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxAmount: e.target.value }))}
                  style={inputStyle}
                  placeholder="∞"
                />
              </label>
              <label style={labelStyle}>
                Стоимость услуги (₽)
                <input
                  value={createDraft.amount}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Порядок сортировки (опционально)
                <input
                  value={createDraft.sortOrder}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <div>
                <button onClick={createTier} className="button" disabled={creating}>
                  {creating ? 'Добавляем…' : 'Добавить тариф'}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 style={{ marginTop: 0 }}>Как видит пользователь</h2>
            {previewTiers.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>Будут использованы тарифы по умолчанию.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)' }}>
                {previewTiers.map((tier) => (
                  <li key={`${tier.id || tier.label}`}>
                    <strong>{tier.label}</strong>: {tier.rangeLabel}, стоимость {tier.amountFormatted} ₽
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

const th = {
  textAlign: 'left',
  borderBottom: '1px solid var(--line)',
  padding: '8px',
  fontWeight: 600,
  background: 'var(--surface-2)',
};

const td = {
  borderBottom: '1px solid var(--line)',
  padding: '8px',
  verticalAlign: 'top',
};

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
