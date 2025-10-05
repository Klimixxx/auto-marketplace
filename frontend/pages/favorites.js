import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import ListingCard from '../components/ListingCard';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || '').replace(/\/$/, '');

function buildApiUrl(path) {
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('token');
    if (stored) setAuthToken(stored);

    const handler = (event) => {
      if (event.key === 'token') {
        setAuthToken(event.newValue || null);
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (!authToken) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    let ignore = false;
    async function loadFavorites() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildApiUrl('/api/me/favorites'), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          if (typeof window !== 'undefined') window.localStorage.removeItem('token');
          setAuthToken(null);
          return;
        }
        if (!res.ok) throw new Error('Не удалось загрузить избранные объявления');
        const data = await res.json();
        if (!ignore) {
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (err) {
        console.error('Failed to load favorites', err);
        if (!ignore) {
          setError('Не удалось загрузить избранные. Попробуйте позже.');
          setItems([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadFavorites();
    return () => {
      ignore = true;
    };
  }, [authToken]);

  const favoriteIds = useMemo(() => new Set(items.map((item) => String(item.id))), [items]);

  async function toggleFavorite(listing) {
    if (!authToken) {
      router.push(`/login?next=${encodeURIComponent('/favorites')}`);
      return;
    }

    const listingId = String(listing.id);

    try {
      const res = await fetch(buildApiUrl(`/api/favorites/${listingId}`), {
        method: favoriteIds.has(listingId) ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.localStorage.removeItem('token');
        setAuthToken(null);
        return;
      }
      if (!res.ok) throw new Error('failed');

      setItems((prev) => {
        if (!favoriteIds.has(listingId)) {
          return prev.some((item) => String(item.id) === listingId) ? prev : [...prev, listing];
        }
        return prev.filter((item) => String(item.id) !== listingId);
      });
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      alert('Не удалось обновить избранное. Попробуйте позже.');
    }
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: 12 }}>Избранные объявления</h1>

      {!authToken ? (
        <div className="panel" style={{ display: 'grid', gap: 12 }}>
          <div className="big">Войдите, чтобы увидеть избранное</div>
          <div className="muted">Сохраняйте интересные лоты и быстро возвращайтесь к ним.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/login" className="button">Войти</Link>
            <Link href="/trades" className="button button-outline">Перейти к торгам</Link>
          </div>
        </div>
      ) : (
        <div className="favorite-grid">
          {loading ? (
            <div className="panel" style={{ textAlign: 'center' }}>
              <div className="big">Загружаем ваши избранные лоты…</div>
              <div className="muted">Пожалуйста, подождите несколько секунд.</div>
            </div>
          ) : error ? (
            <div className="panel" style={{ textAlign: 'center' }}>
              <div className="big">Что-то пошло не так</div>
              <div className="muted">{error}</div>
            </div>
          ) : items.length ? (
            <div className="grid">
              {items.map((item) => {
                const listingId = String(item.id);
                return (
                  <ListingCard
                    key={listingId}
                    l={item}
                    fav={favoriteIds.has(listingId)}
                    onFav={() => toggleFavorite(item)}
                    detailHref={`/trades/${listingId}`}
                    sourceHref={item.source_url}
                    favoriteContext="collection"
                  />
                );
              })}
            </div>
          ) : (
            <div className="panel" style={{ textAlign: 'center' }}>
              <div className="big">Вы ещё не добавили объявления</div>
              <div className="muted">Перейдите на страницу торгов и добавьте интересующие лоты в избранное.</div>
              <div style={{ marginTop: 12 }}>
                <Link href="/trades" className="button">Перейти к торгам</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
