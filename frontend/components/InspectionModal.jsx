import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeListingId(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  const asNumber = Number(str);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.trunc(asNumber);
  }

  const parsed = Number.parseInt(str, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
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
        const next = `/trades/${Number(listingId) || ''}`;
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
      const res = await fetch(`${API}/api/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: Number(listingId) })
        body: JSON.stringify({ listingId: normalizedId })
      });
      if (!res.ok) {
        if (res.status === 402) {
          const data = await res.json().catch(() => ({}));
          setErr(data?.message || 'Недостаточно средств, пополните счет');
          return;
        }
        if (res.status === 400) { setErr('Неверные данные запроса'); return; }
        if (res.status === 404) { setErr('Объявление не найдено'); return; }
        if (res.status === 401) {
          const next = `/trades/${Number(listingId) || ''}`;
          const nextId = listingId != null ? String(listingId).trim() : '';
          const next = `/trades/${nextId || ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        setErr('Ошибка. Попробуйте позже.');
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
          <button onClick={onClose} style={S.close} aria-label="Закрыть">×</button>
        </div>

        <div style={S.section}>
          <div style={S.priceRow}>
            <div><b>Стоимость услуги:</b> <span style={S.price}>12 000 ₽</span></div>
