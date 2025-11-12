import { useEffect, useMemo, useState } from 'react';
import { computeTradeOrderPrice, DEFAULT_DEPOSIT_PERCENT } from '../lib/tradePricing';
import { normalizeTradeTypeCode } from '../lib/tradeTypes';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const TRADE_ORDER_ENDPOINT = API_BASE ? `${API_BASE}/api/trade-orders` : '/api/trade-orders';
const PROFILE_ENDPOINT = API_BASE ? `${API_BASE}/api/me` : '/api/me';
const TRADE_PRICING_ENDPOINT = API_BASE ? `${API_BASE}/api/trade-pricing` : '/api/trade-pricing';
const MAX_LISTING_ID_LENGTH = 160;
const PRICE_KEYS = new Set([
  'current_price',
  'currentPrice',
  'start_price',
  'startPrice',
  'min_price',
  'minPrice',
  'max_price',
  'maxPrice',
  'price',
  'amount',
  'lot_price',
  'lotPrice',
]);

function parseMoneyInput(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyInput(value) {
  const parsed = parseMoneyInput(value);
  if (parsed == null) return '';
  try {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(parsed));
  } catch {
    return String(Math.round(parsed));
  }
}

function collectPriceValues(source, out) {
  if (!source) return;
  if (Array.isArray(source)) {
    source.forEach((item) => collectPriceValues(item, out));
    return;
  }
  if (typeof source !== 'object') return;

  for (const [key, value] of Object.entries(source)) {
    if (PRICE_KEYS.has(key)) {
      out.push(value);
    }
    if (value && typeof value === 'object') {
      collectPriceValues(value, out);
    }
  }
}

function resolveListingTradeType(listing) {
  if (!listing || typeof listing !== 'object') return null;
  const candidates = [
    listing.trade_type_resolved,
    listing.trade_type,
    listing.tradeType,
    listing.type,
    listing.trade_type_label,
    listing.tradeTypeLabel,
    listing.details?.trade_type,
    listing.details?.procedure_type,
    listing.details?.lot_details?.trade_type,
    listing.details?.lot_details?.procedure_type,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTradeTypeCode(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function computePriceFloor(listing) {
  if (!listing || typeof listing !== 'object') return null;
  const candidates = [];

  for (const key of PRICE_KEYS) {
    if (listing[key] !== undefined) {
      candidates.push(listing[key]);
    }
  }

  collectPriceValues(listing.details, candidates);

  const parsed = candidates
    .map((value) => parseMoneyInput(value))
    .filter((value) => value != null && Number.isFinite(value) && value > 0);

  if (!parsed.length) return null;
  return Math.max(...parsed);
}

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
        // ignore
      }
    }
    return digits;
  }

  return clean.length > MAX_LISTING_ID_LENGTH
    ? clean.slice(0, MAX_LISTING_ID_LENGTH)
    : clean;
}

function fmtCurrency(value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(number);
}

export default function TradeOrderModal({ listingId, listing, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [pricingConfig, setPricingConfig] = useState({
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    proDiscountPercent: 30,
    loaded: false,
  });
  const [step, setStep] = useState('overview');
  const [auctionBidLimit, setAuctionBidLimit] = useState('');
  const [publicOfferPrice, setPublicOfferPrice] = useState('');
  const [priceNotes, setPriceNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let ignore = false;

    async function loadProfile() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) { setSubscriptionStatus(null); return; }
      try {
        const res = await fetch(PROFILE_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setSubscriptionStatus(data?.subscription_status || data?.subscriptionStatus || 'free');
      } catch (error) {
        if (!ignore) setSubscriptionStatus(null);
        console.warn('Failed to load profile for trade modal', error);
      }
    }

    loadProfile();
    return () => { ignore = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let ignore = false;

    async function loadPricing() {
      try {
        const res = await fetch(TRADE_PRICING_ENDPOINT, { cache: 'no-store' });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (ignore) return;
        const rawDiscountPercent = Number(data?.proDiscountPercent);
        const rawDepositPercent = Number(data?.depositPercent);
        setPricingConfig({
          depositPercent: Number.isFinite(rawDepositPercent)
            ? rawDepositPercent
            : DEFAULT_DEPOSIT_PERCENT,
          proDiscountPercent: Number.isFinite(rawDiscountPercent) ? rawDiscountPercent : 30,
          loaded: true,
        });
      } catch (error) {
        if (!ignore) {
          setPricingConfig((prev) => ({ ...prev, loaded: true }));
        }
        console.warn('Failed to load trade pricing configuration', error);
      }
    }

    loadPricing();
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const { depositPercent, proDiscountPercent } = pricingConfig;

  useEffect(() => {
    if (!isOpen) return;
    setStep('overview');
    setAuctionBidLimit('');
    setPublicOfferPrice('');
    setPriceNotes('');
    setFieldErr('');
    setErr('');
  }, [isOpen, listingId]);

  const pricing = useMemo(() => {
    return computeTradeOrderPrice(listing || {}, {
      subscriptionStatus: subscriptionStatus || 'free',
      proDiscountPercent: proDiscountPercent ?? 30,
      depositPercent: depositPercent ?? DEFAULT_DEPOSIT_PERCENT,
    });
  }, [listing, subscriptionStatus, proDiscountPercent, depositPercent]);

  const normalizedTradeType = useMemo(() => resolveListingTradeType(listing), [listing]);
  const requiresPricePreferences = normalizedTradeType === 'open_auction' || normalizedTradeType === 'public_offer';
  const priceFloor = useMemo(() => computePriceFloor(listing), [listing]);

  if (!isOpen) return null;

  async function order() {
    if (step === 'overview' && requiresPricePreferences) {
      setFieldErr('');
      setErr('');
      setStep('preferences');
      return;
    }

    setLoading(true);
    setErr('');
    setFieldErr('');
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

      const payload = { listingId: normalizedId };

      const auctionValue = parseMoneyInput(auctionBidLimit);
      const offerValue = parseMoneyInput(publicOfferPrice);
      const trimmedNotes = priceNotes && typeof priceNotes === 'string' ? priceNotes.trim() : '';

      if (normalizedTradeType === 'open_auction') {
        if (auctionValue == null || !Number.isFinite(auctionValue) || auctionValue <= 0) {
          setFieldErr('Укажите максимальную цену, до которой готовы торговаться.');
          return;
        }
        if (priceFloor != null && auctionValue < priceFloor) {
          setFieldErr('Максимальная цена не может быть ниже текущей цены лота.');
          return;
        }
        payload.auctionBidLimit = Math.round(auctionValue);
      } else if (normalizedTradeType === 'public_offer') {
        if (offerValue == null || !Number.isFinite(offerValue) || offerValue <= 0) {
          setFieldErr('Укажите цену, по которой готовы купить лот.');
          return;
        }
        if (priceFloor != null && offerValue < priceFloor) {
          setFieldErr('Цена предложения не может быть ниже установленной организатором.');
          return;
        }
        payload.publicOfferPrice = Math.round(offerValue);
      } else {
        if (auctionValue != null && Number.isFinite(auctionValue) && auctionValue > 0) {
          payload.auctionBidLimit = Math.round(auctionValue);
        }
        if (offerValue != null && Number.isFinite(offerValue) && offerValue > 0) {
          payload.publicOfferPrice = Math.round(offerValue);
        }
      }

      if (normalizedTradeType) {
        payload.tradeType = normalizedTradeType;
      }

      if (trimmedNotes) {
        payload.priceNotes = trimmedNotes;
      }

      const res = await fetch(TRADE_ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) { setErr(data?.message || 'Недостаточно средств, пополните счет'); return; }
        if (res.status === 423) { setErr(data?.message || 'Баланс заморожен. Свяжитесь с поддержкой.'); return; }
        if (res.status === 400) { setErr(data?.message || 'Неверные данные запроса'); return; }
        if (res.status === 404) { setErr(data?.message || 'Объявление не найдено'); return; }
        if (res.status === 401) {
          const nextId = listingId != null ? String(listingId).trim() : '';
          const next = `/trades/${nextId || ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        setErr(data?.message || 'Не удалось оформить сопровождение торгов. Попробуйте позже.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('trade-orders-refresh-count'));
      }

      window.location.href = '/my-trades';
    } catch (error) {
      console.error('trade order error', error);
      setErr('Сеть недоступна. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  const tierLabel = pricing?.tierLabel;
  const finalAmount = pricing?.finalAmount;
  const discountPercent = pricing?.discountPercent ?? 0;
  const estimatedPrice = pricing?.lotPrice;
  const depositAmount = pricing?.depositAmount ?? 0;
  const serviceFeeBeforeDiscount = pricing?.serviceFeeBeforeDiscount ?? 0;
  const serviceFeeAfterDiscount = pricing?.serviceFeeAfterDiscount ?? 0;
  const depositPercentValue = pricing?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
  const hasDeposit = depositAmount > 0;

  return (
    <div style={S.backdrop}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-labelledby="trade-order-title">
        <div style={S.header}>
          <h3 id="trade-order-title" style={S.title}>Заказать сопровождение торгов</h3>
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

        {step === 'overview' ? (
          <>
            <div style={{ marginTop: 12, lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px' }}>
                Мы полностью возьмём на себя участие в торгах: подготовим документы, подадим заявки и будем сопровождать вас до
                завершения сделки.
              </p>
              {tierLabel ? (
                <p style={{ margin: '0 0 4px' }}>
                  <strong>Условия оплаты:</strong> {tierLabel}
                  {estimatedPrice ? ` (оценочная стоимость лота ${fmtCurrency(estimatedPrice)})` : ''}
                </p>
              ) : null}
              {hasDeposit ? (
                <>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Задаток:</strong> {fmtCurrency(depositAmount)}
                  </p>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Комиссия сервиса ({depositPercentValue}%):</strong> {fmtCurrency(serviceFeeBeforeDiscount)}
                    {discountPercent
                      ? ` (для вас ${fmtCurrency(serviceFeeAfterDiscount)} с учётом скидки ${discountPercent}% PRO)`
                      : ''}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Итог к списанию:</strong> {fmtCurrency(finalAmount)}
                  </p>
                </>
              ) : (
                <p style={{ margin: '0 0 4px', color: 'var(--warning)', fontWeight: 600 }}>
                  Не удалось определить сумму задатка для этого лота. Итоговая стоимость может отличаться.
                </p>
              )}
              <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Подписка <b>PRO</b> даёт скидку {(proDiscountPercent ?? 30)}% на нашу комиссию сопровождения торгов.
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <b>Что входит в услугу:</b>
              <ul style={{ marginTop: 6, marginBottom: 0 }}>
                <li>анализ и проверка документов по лоту;</li>
                <li>подготовка заявки и подача в нужный срок;</li>
                <li>сопровождение участия в торгах в режиме реального времени;</li>
                <li>консультация по дальнейшим шагам после победы;</li>
                <li>контроль возврата задатков и подписания документов.</li>
              </ul>
            </div>

            {err && <div style={{ color: 'var(--danger)', marginTop: 10, fontWeight: 600 }}>{err}</div>}

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
                {loading ? 'Оформляем…' : requiresPricePreferences ? 'Продолжить' : 'Заказать сопровождение'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 12, lineHeight: 1.6, display: 'grid', gap: 16 }}>
              {normalizedTradeType === 'open_auction' ? (
                <div>
                  <p style={{ margin: '0 0 8px' }}>
                    Укажите верхнюю границу цены, до которой готовы торговаться в открытом аукционе. Мы не будем превышать это значение
                    без вашего согласования.
                  </p>
                  <label style={S.label}>
                    До какой цены вы готовы торговаться?
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={auctionBidLimit}
                      onChange={(event) => setAuctionBidLimit(event.target.value)}
                      onBlur={() => setAuctionBidLimit((prev) => (prev ? formatMoneyInput(prev) : prev))}
                      placeholder="Например, 3 500 000"
                      style={S.input}
                    />
                  </label>
                  {priceFloor != null ? (
                    <div style={S.hint}>
                      Не ниже {fmtCurrency(Math.round(priceFloor))}
                    </div>
                  ) : null}
                </div>
              ) : normalizedTradeType === 'public_offer' ? (
                <div>
                  <p style={{ margin: '0 0 8px' }}>
                    Укажите цену, по которой вы готовы заключить сделку на публичных торгах. Мы подадим предложение именно на эту сумму.
                  </p>
                  <label style={S.label}>
                    Укажите вашу цену (не ниже указанной организатором)
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={publicOfferPrice}
                      onChange={(event) => setPublicOfferPrice(event.target.value)}
                      onBlur={() => setPublicOfferPrice((prev) => (prev ? formatMoneyInput(prev) : prev))}
                      placeholder="Например, 2 850 000"
                      style={S.input}
                    />
                  </label>
                  {priceFloor != null ? (
                    <div style={S.hint}>
                      Не ниже {fmtCurrency(Math.round(priceFloor))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 8px' }}>
                    Уточните ваши ожидания по цене. Мы учтём пожелания при сопровождении заявки и подтвердим детали с вами.
                  </p>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <label style={S.label}>
                      Максимальная цена
                      <input
                        type="text"
                        inputMode="decimal"
                        value={auctionBidLimit}
                        onChange={(event) => setAuctionBidLimit(event.target.value)}
                        onBlur={() => setAuctionBidLimit((prev) => (prev ? formatMoneyInput(prev) : prev))}
                        placeholder="Если есть ограничение"
                        style={S.input}
                      />
                    </label>
                    <label style={S.label}>
                      Предпочтительная цена
                      <input
                        type="text"
                        inputMode="decimal"
                        value={publicOfferPrice}
                        onChange={(event) => setPublicOfferPrice(event.target.value)}
                        onBlur={() => setPublicOfferPrice((prev) => (prev ? formatMoneyInput(prev) : prev))}
                        placeholder="Если хотите предложить свою цену"
                        style={S.input}
                      />
                    </label>
                  </div>
                </div>
              )}

              <label style={S.label}>
                Дополнительные комментарии
                <textarea
                  value={priceNotes}
                  onChange={(event) => setPriceNotes(event.target.value)}
                  placeholder="Например: готовы повысить ставку после осмотра"
                  rows={3}
                  style={S.textarea}
                />
              </label>
            </div>

            {fieldErr && <div style={{ color: 'var(--danger)', marginTop: 10, fontWeight: 600 }}>{fieldErr}</div>}
            {err && <div style={{ color: 'var(--danger)', marginTop: fieldErr ? 4 : 10, fontWeight: 600 }}>{err}</div>}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  setStep('overview');
                  setFieldErr('');
                }}
                disabled={loading}
                style={S.secondary}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(42,101,247,0.4)';
                  event.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = 'rgba(148,163,184,0.4)';
                  event.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Назад
              </button>
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
                {loading ? 'Оформляем…' : 'Отправить заявку'}
              </button>
            </div>
          </>
        )}
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
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
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid rgba(148,163,184,0.4)',
    borderRadius: 14,
    padding: '12px 20px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'color 0.2s ease, border-color 0.2s ease',
  },
  label: {
    display: 'grid',
    gap: 6,
    fontWeight: 600,
    color: 'var(--text-strong)',
  },
  input: {
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.35)',
    padding: '10px 14px',
    fontSize: 16,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  textarea: {
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.35)',
    padding: '10px 14px',
    fontSize: 16,
    outline: 'none',
    minHeight: 80,
    resize: 'vertical',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  hint: {
    marginTop: 6,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
};

