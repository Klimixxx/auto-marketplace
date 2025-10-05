import { useState, useEffect } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const INSPECTION_ENDPOINT = API_BASE ? `${API_BASE}/api/inspections` : '/api/inspections';
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
        // ignore and fall through to returning the digit string
      }
    }
    return digits;
  }

  return clean.length > MAX_LISTING_ID_LENGTH
    ? clean.slice(0, MAX_LISTING_ID_LENGTH)
    : clean;
}

export default function InspectionModal({ listingId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  async function order() {
    setLoading(true);
    setErr('');
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
        setErr('Не удалось определить объявление. Обновите страницу и попробуйте ещё раз.');
        return;
      }
      const res = await fetch(INSPECTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: normalizedId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) {
          setErr(data?.message || 'Недостаточно средств, пополните счет');
          return;
        }
        if (res.status === 423) {
          setErr(data?.message || 'Баланс заморожен. Свяжитесь с поддержкой.');
          return;
        }
        if (res.status === 400) { setErr(data?.message || 'Неверные данные запроса'); return; }
        if (res.status === 404) { setErr(data?.message || 'Объявление не найдено'); return; }
        if (res.status === 401) {
          const nextId = listingId != null ? String(listingId).trim() : '';
          const next = `/trades/${nextId || ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        setErr(data?.message || 'Не удалось оформить заказ на осмотр. Попробуйте позже.');
        return;
      }
      window.location.href = '/inspections';
    } catch {
      setErr('Сеть недоступна. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.backdrop}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-labelledby="inspection-title">
        <div style={S.header}>
          <h3 id="inspection-title" style={S.title}>Заказать отчет по осмотру данной машины</h3>
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

        <div style={{marginTop:12}}>
          <b>Стоимость услуги:</b> 12 000 ₽
          <div style={{color:'#A0A6B0'}}>С подпиской <b>PRO</b> действует <b>50%</b> скидка на любой осмотр</div>
        </div>

        <div style={{marginTop:12}}>
          <b>Пример отчета по машине</b><br/>
          <a
            href="/reports/example_car_report.pdf"
            target="_blank"
            rel="noreferrer"
            style={S.link}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'rgba(42,101,247,0.16)';
              event.currentTarget.style.borderColor = 'rgba(42,101,247,0.35)';
              event.currentTarget.style.color = 'var(--accent-hover)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'rgba(42,101,247,0.08)';
              event.currentTarget.style.borderColor = 'rgba(42,101,247,0.25)';
              event.currentTarget.style.color = 'var(--accent)';
            }}
          >
            Открыть пример (PDF)
          </a>
        </div>

        <div style={{marginTop:12}}>
          <b>Минимальное содержание Отчета:</b>
          <ul style={{marginTop:6, marginBottom:0}}>
            <li>не менее 10 фотографий автомобиля снаружи;</li>
            <li>не менее 2 фото салона автомобиля;</li>
            <li>4 фото колёс с видимыми арками;</li>
            <li>карта лакокрасочного покрытия автомобиля;</li>
            <li>видеоматериалы;</li>
          </ul>
        </div>

        {err && <div style={{ color: 'var(--danger)', marginTop: 8, fontWeight: 600 }}>{err}</div>}

        <div style={{marginTop:14, display:'flex', justifyContent:'flex-end', gap:8}}>
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
            {loading ? 'Оформляем…' : 'Заказать отчет'}
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
    width: 'min(720px, 92vw)',
    boxShadow: '0 28px 60px rgba(15,23,42,0.18)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { margin: 0, fontSize: 24, color: 'var(--text-strong)' },
  close: {
    width: 36,
    height: 36,
    fontSize: 22,
    background: 'rgba(42,101,247,0.08)',
    color: 'var(--text-muted)',
    border: '1px solid rgba(42,101,247,0.2)',
    borderRadius: 12,
    cursor: 'pointer',
    lineHeight: '32px',
    display: 'grid',
    placeItems: 'center',
    transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(42,101,247,0.25)',
    color: 'var(--accent)',
    padding: '10px 14px',
    borderRadius: 12,
    textDecoration: 'none',
    background: 'rgba(42,101,247,0.08)',
    fontWeight: 600,
    transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  },
  primary: {
    background: 'var(--accent)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 14,
    padding: '12px 20px',
    cursor: 'pointer',
    fontWeight: 600,
    boxShadow: '0 14px 32px rgba(42,101,247,0.28)',
    transition: 'background 0.2s ease, box-shadow 0.2s ease',
  }
};

