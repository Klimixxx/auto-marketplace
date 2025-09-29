// frontend/pages/index.js
import { useEffect, useMemo, useState } from 'react';

import Hero from '../components/Hero';
import ListingCard from '../components/ListingCard';
import About from '../components/About';
import { formatTradeTypeLabel } from '../lib/tradeTypes';

import { useRouter } from 'next/router';



const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

const UI = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.75)',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.10)',
  red: '#EF4444',
  gradFrom: '#67e8f9',
  gradTo: '#c4b5fd',
  button: '#67e8f9',
  buttonHover: '#a5f3fc',
};

const fmtNumber = new Intl.NumberFormat('ru-RU');
const fmtCurrency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

function api(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function FirstLoginModal() { return null; }

function StatCard({ title, value, Icon, isCurrency, loading }) {
  const display = loading
    ? '—'
    : (isCurrency ? fmtCurrency.format(value || 0) : fmtNumber.format(value || 0));

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        alignItems: 'center',
        minHeight: 88,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${UI.border}`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon />
      </div>
      <div>
        <div style={{ color: 'var(--text-900)', fontSize: 13 }}>{title}</div>
        <div style={{ color: 'var(--text-900)', fontWeight: 800, fontSize: 18, marginTop: 2 }}>{display}</div>
      </div>
    </div>
  );
}

function RegionBubbleMap({ regions, activeRegion, onHover }) {
  if (!regions.length) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '1527 / 768',
          borderRadius: 16,
          border: `1px solid ${UI.border}`,
          background: 'rgba(255,255,255,0.03)',
          display: 'grid',
          placeItems: 'center',
          color: UI.text,
        }}
      >
        Данные по регионам появятся позже
      </div>
    );
  }

  const width = 620;
  const height = 340;
  const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(regions.length))));
  const rows = Math.ceil(regions.length / columns);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        borderRadius: 16,
        border: `1px solid ${UI.border}`,
        overflow: 'hidden',
        backgroundImage: 'url(/maps/russia-fo.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        aspectRatio: '1527 / 768',
        margin: '0 auto',
      }}
    >
      {regions.map((region, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = ((col + 0.5) / columns) * 100;
        const y = ((row + 0.5) / rows) * 100;
        const isActive = activeRegion?.region === region.region;
        return (
          <button
            key={region.region}
            type="button"
            onMouseEnter={() => onHover(region)}
            onFocus={() => onHover(region)}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: isActive ? 28 : 22,
              height: isActive ? 28 : 22,
              borderRadius: '50%',
              border: `2px solid ${isActive ? '#0f172a' : 'transparent'}`,
              background: isActive ? UI.button : 'rgba(255,255,255,0.35)',
              boxShadow: isActive ? '0 0 18px rgba(103,232,249,0.45)' : '0 2px 6px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, background 0.2s ease',
            }}
            aria-label={region.region}
          />
        );
      })}

      {activeRegion ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            right: 16,
            background: 'rgba(10,14,25,0.78)',
            borderRadius: 12,
            padding: '12px 14px',
            border: `1px solid ${UI.border}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{activeRegion.region}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: UI.text }}>
            <span>Лотов: <strong style={{ color: '#fff' }}>{fmtNumber.format(activeRegion.listings || 0)}</strong></span>
            <span>Сумма: <strong style={{ color: '#fff' }}>{fmtCurrency.format(activeRegion.totalValue || 0)}</strong></span>
            <span>Средняя цена: <strong style={{ color: '#fff' }}>{fmtCurrency.format(activeRegion.averagePrice || 0)}</strong></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RegionList({ regions, activeRegion, onHover }) {
  if (!regions.length) return null;
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${UI.border}`,
        background: UI.cardBg,
        padding: 16,
        maxHeight: 340,
        overflowY: 'auto',
        display: 'grid',
        gap: 10,
      }}
    >
      {regions.map((region) => {
        const isActive = activeRegion?.region === region.region;
        return (
          <button
            key={region.region}
            type="button"
            onMouseEnter={() => onHover(region)}
            onFocus={() => onHover(region)}
            style={{
              textAlign: 'left',
              border: `1px solid ${isActive ? UI.button : UI.border}`,
              background: isActive ? 'rgba(103,232,249,0.12)' : 'rgba(255,255,255,0.03)',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 600 }}>{region.region}</div>
            <div style={{ fontSize: 12, color: UI.text, display: 'flex', gap: 12 }}>
              <span>Лотов: {fmtNumber.format(region.listings || 0)}</span>
              <span>Сумма: {fmtCurrency.format(region.totalValue || 0)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BestOffersCarousel({ items }) {
  const cardWidth = 280;
  const gap = 16;
  const [index, setIndex] = useState(0);

  const visible = Math.min(items.length, 3);
  const maxIndex = Math.max(0, items.length - visible);

  useEffect(() => {
    if (index > maxIndex) setIndex(maxIndex);
  }, [index, maxIndex]);

  if (!items.length) {
    return null;
  }

  const trackWidth = items.length * (cardWidth + gap);
  const offset = index * (cardWidth + gap);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: UI.title }}>Лучшие предложения</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            style={navButtonStyle(index === 0)}
            aria-label="Предыдущие предложения"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
            disabled={index >= maxIndex}
            style={navButtonStyle(index >= maxIndex)}
            aria-label="Следующие предложения"
          >
            →
          </button>
        </div>
      </div>

      <div
        style={{
          overflow: 'hidden',
          borderRadius: 16,
          border: `1px solid ${UI.border}`,
          padding: '12px 8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: `${gap}px`,
            width: trackWidth,
            transform: `translateX(-${offset}px)`,
            transition: 'transform 0.35s ease',
          }}
        >
          {items.map((item) => (
            <BestOfferCard key={item.id} item={item} width={cardWidth} />
          ))}
        </div>
      </div>
    </div>
  );
}

function navButtonStyle(disabled) {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: `1px solid ${UI.border}`,
    background: disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)',
    color: '#fff',
    cursor: disabled ? 'default' : 'pointer',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
  };
}

function resolveCover(listing) {
  const photos = Array.isArray(listing?.photos) ? listing.photos : listing?.details?.photos;
  if (Array.isArray(photos)) {
    for (const photo of photos) {
      if (photo && typeof photo === 'object' && photo.url) return photo.url;
      if (typeof photo === 'string' && photo.trim()) return photo.trim();
    }
  }
  return null;
}

function formatPrice(value, currency = 'RUB') {
  if (value == null) return 'Цена уточняется';
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function BestOfferCard({ item, width }) {
  const cover = resolveCover(item);
  const price = formatPrice(item.current_price ?? item.start_price, item.currency || 'RUB');
  const location = [item.city, item.region].filter(Boolean).join(', ');
  const tradeType = item.trade_type_label
    || formatTradeTypeLabel(item.trade_type_resolved ?? item.trade_type)
    || 'Лот';

  return (
    <article
      style={{
        width: width,
        minWidth: width,
        borderRadius: 14,
        border: `1px solid ${UI.border}`,
        background: 'rgba(13,18,33,0.72)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', paddingBottom: '56%', background: '#0b1220' }}>
        {cover ? (
          <img
            src={cover}
            alt={item.title || 'Лот'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: UI.text }}>
            Нет фото
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            background: 'rgba(15,23,42,0.85)',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 12,
            border: `1px solid ${UI.border}`,
          }}
        >
          {tradeType}
        </span>
      </div>
      <div style={{ padding: '14px 16px', display: 'grid', gap: 8, flex: '1 1 auto' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title || 'Лот'}</div>
        {location ? <div style={{ fontSize: 13, color: UI.text }}>{location}</div> : null}
        <div style={{ fontWeight: 700, fontSize: 16 }}>{price}</div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
          <a
            href={`/trades/${item.id}`}
            style={{
              flex: 1,
              background: UI.button,
              color: '#0f172a',
              borderRadius: 10,
              textAlign: 'center',
              padding: '8px 10px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Подробнее
          </a>
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                border: `1px solid ${UI.border}`,
                borderRadius: 10,
                textAlign: 'center',
                padding: '8px 10px',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Источник
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EducationFeature({ title, Icon }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        alignItems: 'center',
        background: 'rgba(255,255,255,0.04)',   // фон как у статистики
        border: '1px solid rgba(0,0,0,0.15)',   // рамка серо-темная
        borderRadius: 12,
        padding: 14,
        minHeight: 88,                          // выравнивание по высоте
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', // фон иконки как в статистике
          border: '1px solid rgba(0,0,0,0.15)', // рамка иконки
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon />
      </div>
      <div style={{ color: 'var(--text-900)', fontSize: 15.5, fontWeight: 600 }}>
        {title}
      </div>
    </div>
  );
}


/* Иконки (градиент как в Hero) — единичные определения */
function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
            stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11a4 4 0 100-8 4 4 0 000 8z"
            stroke="var(--blue)" strokeWidth="1.8" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroDoc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--blue)" strokeWidth="1.8" />
      <path d="M14 3v6h6" stroke="var(--blue)" strokeWidth="1.8" />
      <path d="M9 13h8M9 17h8" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AuctionsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroAuc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M7 10l6-6 4 4-6 6-4-4zM3 21h10" stroke="url(#gradHeroAuc)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Купюра — для "Стоимость имущества в торгах"
function BanknoteIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroNote" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <rect x="3" y="7" width="18" height="10" rx="2" stroke="var(--blue)" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="2.5" stroke="var(--blue)" strokeWidth="1.8"/>
      <path d="M5 9h2M17 9h2M5 15h2M17 15h2" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

/* Естественные цвета иконок */
function LightningIcon(){
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="#FACC15" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function InstallmentIcon(){
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="12" height="8" rx="2" stroke="#22C55E" strokeWidth="1.8"/>
      <path d="M5 9h8M5 12h3" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="16" y="9" width="5" height="7" rx="1.5" stroke="#22C55E" strokeWidth="1.8"/>
      <path d="M16 11h5" stroke="#22C55E" strokeWidth="1.8"/>
    </svg>
  );
}
function CarIcon(){
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 13l2-4c.5-1 1.5-2 3-2h6c1.5 0 2.5 1 3 2l2 4v3a2 2 0 01-2 2h-1a2 2 0 01-2-2H8a2 2 0 01-2 2H5a2 2 0 01-2-2v-3z" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="8" cy="16" r="2" stroke="#60A5FA" strokeWidth="1.8"/>
      <circle cx="16" cy="16" r="2" stroke="#60A5FA" strokeWidth="1.8"/>
    </svg>
  );
}


export default function Home() {
  const [summary, setSummary] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [activeRegion, setActiveRegion] = useState(null);

  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [errorRecent, setErrorRecent] = useState(null);
  
  const [inspectionsUnread, setInspectionsUnread] = useState(0);

  const router = useRouter();

  // токен авторизации и локальное состояние избранного
  const [authToken, setAuthToken] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // читаем токен из localStorage и следим за изменением
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('token');
    if (stored) setAuthToken(stored);

    const handler = (event) => {
      if (event.key === 'token') {
        setAuthToken(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let ignore = false;

    async function loadUnread() {
      const token = authToken || localStorage.getItem('token');
      if (!token) {
        if (!ignore) setInspectionsUnread(0);
        return;
      }
      try {
        const res = await fetch(api('/api/inspections/unread-count'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          if (!ignore) setInspectionsUnread(0);
          return;
        }
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setInspectionsUnread(Number(data?.count) || 0);
      } catch (err) {
        if (!ignore) setInspectionsUnread(0);
        console.error('Failed to load inspections unread count', err);
      }
    }

    loadUnread();
    const handler = () => loadUnread();
    const interval = setInterval(loadUnread, 60000);
    window.addEventListener('inspections-refresh-count', handler);

    return () => {
      ignore = true;
      clearInterval(interval);
      window.removeEventListener('inspections-refresh-count', handler);
    };
  }, [authToken]);

  // переключение избранного (как в /trades)
  async function toggleFav(listing) {
    const listingId = String(listing.id ?? listing.listing_id ?? listing._id);

    if (!authToken) {
      const next = `/login?next=${encodeURIComponent(router.asPath || '/')}`;
      router.push(next);
      return;
    }

    const isFav = favoriteSet.has(listingId);
    try {
      const res = await fetch(api(`/api/favorites/${listingId}`), {
        method: isFav ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        setAuthToken(null);
        return;
      }
      if (!res.ok) throw new Error('failed');

      setFavoriteIds((prev) => {
        if (isFav) return prev.filter((id) => id !== listingId);
        if (prev.includes(listingId)) return prev;
        return [...prev, listingId];
      });
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      alert('Не удалось обновить избранное. Попробуйте позже.');
    }
  }



  useEffect(() => {
    let ignore = false;
    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const data = await fetch(api('/api/stats/summary')).then((r) => {
          if (!r.ok) throw new Error('summary');
          return r.json();
        });
        if (!ignore) {
          setSummary(data);
          setActiveRegion(data?.regions?.[0] || null);
        }
      } catch (e) {
        console.error('Failed to load summary stats', e);
        if (!ignore) setSummary(null);
      } finally {
        if (!ignore) setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadFeatured() {
      try {
        setLoadingFeatured(true);
        const data = await fetch(api('/api/listings/featured?limit=12')).then((r) => {
          if (!r.ok) throw new Error('featured');
          return r.json();
        });
        if (!ignore) setFeatured(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        console.error('Failed to load featured listings', e);
        if (!ignore) setFeatured([]);
      } finally {
        if (!ignore) setLoadingFeatured(false);
      }
    }
    loadFeatured();
    return () => { ignore = true; };
  }, []);
    // Загружаем ПЕРВЫЕ 6 объявлений как на /trades (published=true, сортировка как в API)
  useEffect(() => {
    let ignore = false;
    async function loadRecent() {
      try {
        setLoadingRecent(true);
        setErrorRecent(null);

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '6');
        params.set('published', 'true');

        const url = api(`/api/listings?${params.toString()}`);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`recent ${res.status}`);
        const data = await res.json();

        if (!ignore) {
          setRecent(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        console.error('Failed to load recent listings', e);
        if (!ignore) {
          setRecent([]);
          setErrorRecent('Не удалось загрузить новые предложения.');
        }
      } finally {
        if (!ignore) setLoadingRecent(false);
      }
    }
    loadRecent();
    return () => { ignore = true; };
  }, []);


  const statsCards = useMemo(() => ([
    { title: 'Пользователей', value: summary?.totalUsers ?? 0, Icon: UsersIcon, isCurrency: false },
    { title: 'Публичные предложения', value: summary?.offersCount ?? 0, Icon: DocumentIcon, isCurrency: false },
    { title: 'Открытых аукционов', value: summary?.auctionsCount ?? 0, Icon: AuctionsIcon, isCurrency: false },
    { title: 'Стоимость имущества в торгах', value: summary?.totalValue ?? 0, Icon: BanknoteIcon, isCurrency: true },
  ]), [summary]);

  const regions = useMemo(() => summary?.regions || [], [summary]);

  return (
    <>
      <Hero listingCount={summary?.totalListings ?? 0} inspectionsUnread={inspectionsUnread} />
      {/* === НОВЫЕ ПРЕДЛОЖЕНИЯ (первые 6 как на /trades) === */}
      {(recent.length || loadingRecent) && (
        <section style={{ margin: '32px 0' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, marginBottom: 12 }}>
              <h2 style={{ color: 'var(--text-1000)', fontSize: 22, fontWeight: 800, margin: 0 }}>
                Новые предложения
              </h2>
              <a
  href="/trades"
  className="button"
  style={{
    textDecoration: 'none',
    background: '#1d4ed8',
    color: '#fff',
    borderRadius: 10,
    padding: '9px 14px',
    fontWeight: 700,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'inline-block'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  }}
>
  Смотреть все →
</a>

            </div>

            {errorRecent ? (
              <div className="panel" style={{ color: 'var(--text-700)' }}>{errorRecent}</div>
            ) : (
              <>
                {loadingRecent ? (
                  <div className="panel" style={{ color: 'var(--text-700)' }}>Загружаем…</div>
                ) : recent.length ? (
                  <div className="recent-grid">
                    {recent.map((l) => {
                      const listingId = String(l.id ?? l.listing_id ?? l._id);
                      return (
                        <ListingCard
                          key={listingId}
                          l={l}
                          fav={favoriteSet.has(listingId)}
                          onFav={() => toggleFav(l)}
                          detailHref={`/trades/${listingId}`}
                          sourceHref={l.source_url}
                          variant="compact"
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="panel" style={{ color: 'var(--text-700)' }}>
                    Предложения скоро появятся
                  </div>
                )}
                <style jsx>{`
                  .recent-grid {
                    display: grid;
                    gap: 16px;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                  }

                  @media (max-width: 1100px) {
                    .recent-grid {
                      grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                  }

                  @media (max-width: 720px) {
                    .recent-grid {
                      grid-template-columns: minmax(0, 1fr);
                    }
                  }
                `}</style>
              </>
            )}
          </div>
        </section>
      )}
     

      <About />

      <div className="container">
        <FirstLoginModal />

      {/* === ОБУЧЕНИЕ — СТАВИМ ВЫШЕ === */}
<section style={{ margin: '32px 0' }}>
<div
  style={{
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 18,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 18,
    alignItems: 'center',
  }}
>

    {/* Левая картинка — рамка как в Hero */}
    <div style={{
   width: 180, height: 180,
   display:'grid', placeItems:'center',
   overflow:'hidden', background:'transparent'
}}>
      <img
        src="/education/group.png"
        alt="Иконка обучения"
        style={{ width: '86%', height: '86%', objectFit: 'contain', display: 'block' }}
      />
    </div>

    <div style={{ textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 6px', color: 'var(--blue)', fontWeight: 800 }}>
        Обучение для покупателей авто с торгов
      </h2>

      <p style={{ margin: '0 auto 14px', color: 'var(--text-600)', lineHeight: 1.65, maxWidth: 760 }}>
        Разбираем стратегию поиска и анализа лотов, оценку рисков и юридические нюансы сделки.
        Практика на реальных кейсах и инструкции, с которыми вы уверенно проходите путь от идеи до покупки.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
          gap: 12,
          marginBottom: 14,
          textAlign: 'left',
        }}
      >
        <EducationFeature title="Быстрое и эффективное обучение" Icon={LightningIcon} />
        <EducationFeature title="Оплата обучения частями" Icon={InstallmentIcon} />
        <EducationFeature title="Доступ в закрытые чаты продавцов авто" Icon={CarIcon} />
      </div>

      <a
        href="/education"
        role="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--blue)',
          color: '#fff',
          fontWeight: 700,
          textDecoration: 'none',
          border: '1px solid var(--blue)',
          cursor: 'pointer',
        }}
      >
        Узнать больше
      </a>
    </div>
  </div>
</section>

{/* === СТАТИСТИКА ПЛАТФОРМЫ — НИЖЕ === */}
<section style={{ margin: '32px 0' }}>
  <div
  style={{
    background: 'rgba(0,0,0,0.04)',    // тот же фон, что в "О нас"
    border: '1px solid rgba(0,0,0,0.15)', // серо-тёмная рамка
    borderRadius: 16,
    padding: 18,
    display: 'grid',
    gap: 18,
  }}
>

    <h2
      style={{
        margin: '0 0 12px',
        textAlign: 'center',
        fontWeight: 900,
        fontSize: 22,
        color: 'var(--blue)',
      }}
    >
      Статистика платформы
    </h2>

    {/* дальше — как у тебя: сетка StatCard и блок карты/списка */}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
      {statsCards.map((card) => (
        <StatCard key={card.title} {...card} loading={loadingSummary} />
      ))}
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap:18 }}>
      <RegionBubbleMap regions={regions} activeRegion={activeRegion} onHover={setActiveRegion} />
      <RegionList regions={regions} activeRegion={activeRegion} onHover={setActiveRegion} />
    </div>
  </div>
</section>


{/* === ЛУЧШИЕ ПРЕДЛОЖЕНИЯ — ОСТАВЛЯЕМ ПОСЛЕ СТАТИСТИКИ === */}
{(featured.length || loadingFeatured) && (
  <section style={{ margin: '32px 0' }}>
    {loadingFeatured && !featured.length ? (
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${UI.border}`,
          padding: '40px 16px',
          textAlign: 'center',
          color: UI.text,
        }}
      >
        Загружаем интересные объявления…
      </div>
    ) : (
      <BestOffersCarousel items={featured} />
    )}
  </section>
)}


        <section style={{ margin: '24px 0 48px' }}>
          <div
            className="card"
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h2 style={{ marginTop: 0, color: UI.title }}>Все торги — в одном месте</h2>
            <p style={{ color: UI.text }}>
              Мы агрегируем объявления с разных источников и показываем удобную выдачу по фильтрам.
            </p>
            <p>
              <a className="button" href="/trades" style={{ color: '#fff', background: '#1E90FF', padding: '8px 12px', borderRadius: 8 }}>
                Перейти в каталог →
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
