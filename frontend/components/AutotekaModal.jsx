import { useEffect, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const AUTOTEKA_ENDPOINT = API_BASE ? `${API_BASE}/api/autoteka` : '/api/autoteka';
const AUTOTEKA_PRICE_ENDPOINT = API_BASE ? `${API_BASE}/api/autoteka/price` : '/api/autoteka/price';
const MAX_LISTING_ID_LENGTH = 160;

function normalizeListingId(value) {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const truncated = Math.trunc(value);
    return truncated > 0 ? String(truncated) : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '');
  if (!compact) return null;

  const clean = compact.replace(/[\u0000-\u001f\u007f]/g, '');
  if (!clean) return null;

  if (/^[0-9]+$/.test(clean)) {
    const digits = clean.replace(/^0+/, '');
    if (!digits) return null;
    if (typeof BigInt === 'function') {
      try {
        const big = BigInt(digits);
        if (big > 0n) return big.toString();
      } catch {
        // ignore and fall through
      }
    }
    return digits;
  }

  return clean.length > MAX_LISTING_ID_LENGTH ? clean.slice(0, MAX_LISTING_ID_LENGTH) : clean;
}

export default function AutotekaModal({ listingId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    async function loadPrice() {
      try {
        setPriceLoading(true);
        const res = await fetch(AUTOTEKA_PRICE_ENDPOINT, { cache: 'no-store' });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) {
          const value = Number(data?.price);
          setPrice(Number.isFinite(value) ? value : null);
        }
      } catch (err) {
        console.warn('Failed to load autoteka price', err);
        if (!ignore) setPrice(null);
      } finally {
        if (!ignore) setPriceLoading(false);
      }
    }
    loadPrice();
    return () => { ignore = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const priceLabel = price != null ? `${price.toLocaleString('ru-RU')} ₽` : 'уточняется';

  async function order() {
    setLoading(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        const nextId = listingId != null ? String(listingId).trim() : '';
        const next = `/trades/${nextId || ''}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }

      const normalizedId = normalizeListingId(listingId);
      if (!normalizedId) {
        setError('Не удалось определить объявление. Обновите страницу и попробуйте ещё раз.');
        return;
      }

      const res = await fetch(AUTOTEKA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: normalizedId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) { setError(data?.message || 'Недостаточно средств, пополните счёт.'); return; }
        if (res.status === 423) { setError(data?.message || 'Баланс заморожен. Свяжитесь с поддержкой.'); return; }
        if (res.status === 400) { setError(data?.message || 'Неверные данные запроса.'); return; }
        if (res.status === 404) { setError(data?.message || 'Объявление не найдено.'); return; }
        if (res.status === 401) {
          const nextId = listingId != null ? String(listingId).trim() : '';
          const next = `/trades/${nextId || ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        setError(data?.message || 'Не удалось оформить заказ. Попробуйте позже.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('autoteka-refresh-count'));
      }
      window.location.href = '/autoteka';
    } catch (err) {
      console.error('autoteka order error', err);
      setError('Сеть недоступна. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.backdrop}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-labelledby="autoteka-title">
        <div style={S.header}>
          <h3 id="autoteka-title" style={S.title}>Заказать отчёт Автотека</h3>
          <button
            onClick={onClose}
            style={S.close}
            aria-label="Закрыть"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'rgba(42,101,247,0.18)';
              event.currentTarget.style.color = 'var(--accent)';
              event.currentTarget.style.borderColor = 'rgba(42,101,247,0.35)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'rgba(42,101,247,0.08)';
              event.currentTarget.style.color = 'var(--text-muted)';
              event.currentTarget.style.borderColor = 'rgba(42,101,247,0.2)';
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <b>Стоимость услуги:</b> {priceLoading ? 'загрузка…' : priceLabel}
        </div>
        <div style={{ color: '#A0A6B0', marginTop: 4 }}>
          Если по этому лоту уже загружен отчёт Автотека, вы получите его мгновенно без ожидания администрации.
        </div>

        <div style={{ marginTop: 12 }}>
          <b>Что входит:</b>
          <ul style={{ marginTop: 6, marginBottom: 0 }}>
            <li>Проверка истории регистраций и ограничений;</li>
            <li>Данные о ДТП и страховых выплатах;</li>
            <li>Пробег и сведения о сервисном обслуживании (если доступны);</li>
            <li>Информация о залогах и розыске;</li>
            <li>Загруженный PDF-отчёт готов к скачиванию.</li>
          </ul>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontWeight: 600 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={order}
            disabled={loading}
            style={S.primary}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--accent-hover)';
              event.currentTarget.style.boxShadow = '0 16px 36px rgba(42,101,247,0.32)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'var(--accent)';
              event.currentTarget.style.boxShadow = '0 14px 32px rgba(42,101,247,0.28)';
            }}
          >
            {loading ? 'Оформляем…' : 'Получить отчёт'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: 'var(--surface-1)',
    color: 'var(--text)',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: 20,
    padding: 28,
    width: 'min(640px, 92vw)',
    boxShadow: '0 28px 60px rgba(15,23,42,0.18)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { margin: 0, fontSize: 24, color: 'var(--text-strong)' },
  close: {
    width: 36,
    height: 36,
    fontSize: 22,
    background: 'rgba(42,101,247,0.08)',
    border: '1px solid rgba(42,101,247,0.2)',
    borderRadius: 10,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all .2s ease',
  },
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '10px 18px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 14px 32px rgba(42,101,247,0.28)',
    transition: 'all .2s ease',
  },
};
