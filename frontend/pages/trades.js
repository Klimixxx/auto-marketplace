import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || '').replace(/\/$/, '');
const FILTER_KEYS = ['q', 'region_code', 'city', 'brand', 'trade_type', 'minPrice', 'maxPrice'];

function buildApiUrl(path) {
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

function extractFilters(query = {}) {
  const out = {};
  FILTER_KEYS.forEach((key) => {
    const value = query[key];
    if (value == null) return;
    if (key === 'region_code') {
      const list = Array.isArray(value) ? value : [value];
      const normalizedList = list
        .flatMap((entry) => {
          if (entry === null || entry === undefined) return [];
          if (Array.isArray(entry)) return entry;
          const text = typeof entry === 'string' ? entry : String(entry);
          return text
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        })
        .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
        .filter((entry) => entry !== '');
      if (normalizedList.length) {
        out[key] = Array.from(new Set(normalizedList));
      }
      return;
    }
    let valueToUse = value;
    if (Array.isArray(valueToUse)) valueToUse = valueToUse[valueToUse.length - 1];
    if (valueToUse == null) return;
    const normalized = typeof valueToUse === 'string' ? valueToUse.trim() : valueToUse;
    if (normalized === '') return;
    out[key] = normalized;
  });
  if ((!out.region_code || (Array.isArray(out.region_code) && out.region_code.length === 0)) && query.region) {
    const regionValues = Array.isArray(query.region) ? query.region : [query.region];
    const normalized = regionValues
      .flatMap((entry) => {
        if (entry === null || entry === undefined) return [];
        if (Array.isArray(entry)) return entry;
        const text = typeof entry === 'string' ? entry : String(entry);
        return text
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
      })
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
      .filter((entry) => entry !== '');
    if (normalized.length) {
      out.region_code = Array.from(new Set(normalized));
    }
  }
  return out;
}

function cleanFilters(input = {}) {
  const out = {};
  for (const key of FILTER_KEYS) {
    let value = input[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      const normalized = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
        .filter((entry) => entry !== '');
      if (!normalized.length) continue;
      out[key] = Array.from(new Set(normalized));
      continue;
    }
    if (typeof value === 'string') value = value.trim();
    if (value === '') continue;
    out[key] = value;
  }
  return out;
}

function parsePage(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

export default function Trades() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

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
    if (!router.isReady) return;
    const filtersFromQuery = extractFilters(router.query);
    const pageFromQuery = parsePage(router.query?.page);
    setFilters(filtersFromQuery);
    fetchListings(pageFromQuery, filtersFromQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.asPath]);

  useEffect(() => {
    if (!authToken) {
      setFavoriteIds([]);
      return;
    }
    let ignore = false;
    async function loadFavorites() {
      try {
        const res = await fetch(buildApiUrl('/api/me/favorites'), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          if (typeof window !== 'undefined') localStorage.removeItem('token');
          setAuthToken(null);
          return;
        }
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!ignore) {
          const ids = (data.items || []).map((item) => String(item.id));
          setFavoriteIds(ids);
        }
      } catch (err) {
        console.error('Failed to load favorites', err);
      }
    }
    loadFavorites();
    return () => {
      ignore = true;
    };
  }, [authToken]);

  async function fetchListings(pageValue = 1, filtersValue = filters) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filtersValue || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry == null) return;
          const normalized = typeof entry === 'string' ? entry.trim() : String(entry);
          if (normalized === '') return;
          params.append(key, normalized);
        });
        return;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return;
        params.set(key, trimmed);
        return;
      }
      params.set(key, value);
    });
    params.set('page', pageValue);
    params.set('limit', '20');
    params.set('published', 'true');
    const url = buildApiUrl(`/api/listings?${params.toString()}`);

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = await res.json();
      const currentPage = Number(data.page) || pageValue || 1;
      const totalPages = Number(data.pageCount) || 1;
      setItems(data.items || []);
      setPage(currentPage);
      setPageCount(totalPages);
    } catch (err) {
      console.error('Failed to load listings', err);
      setItems([]);
      setPage(1);
      setPageCount(1);
      setError('Не удалось загрузить торги. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(nextFilters) {
    const cleaned = cleanFilters(nextFilters);
    setFilters(cleaned);
    const query = { ...cleaned };
    router.push({ pathname: '/trades', query });
  }

  function goToPage(nextPage) {
    const cleaned = cleanFilters(filters);
    const query = { ...cleaned };
    if (nextPage > 1) {
      query.page = String(nextPage);
    }
    router.push({ pathname: '/trades', query });
  }

  async function toggleFav(listing) {
    const listingId = String(listing.id);
    if (!authToken) {
      const next = `/login?next=${encodeURIComponent(router.asPath || '/trades')}`;
      router.push(next);
      return;
    }

    const isFav = favoriteSet.has(listingId);
    try {
      const res = await fetch(buildApiUrl(`/api/favorites/${listingId}`), {
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
        if (isFav) {
          return prev.filter((id) => id !== listingId);
        }
        if (prev.includes(listingId)) return prev;
        return [...prev, listingId];
      });
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      alert('Не удалось обновить избранное. Попробуйте позже.');
    }
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Торги</h1>
      </div>

      <FilterBar onSearch={handleSearch} initial={filters} favoritesCount={favoriteIds.length} />


      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="big">Загружаем подборку…</div>
            <div className="muted">Пожалуйста, подождите несколько секунд.</div>
          </div>
        ) : error ? (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="big">Что-то пошло не так</div>
            <div className="muted">{error}</div>
          </div>
        ) : items.length ? (
          <div className="grid">
            {items.map((l) => {
              const listingId = String(l.id);
              return (
                <ListingCard
                  key={listingId}
                  l={l}
                  fav={favoriteSet.has(listingId)}
                  onFav={() => toggleFav(l)}
                  detailHref={`/trades/${listingId}`}
                  sourceHref={l.source_url}
                />
              );
            })}
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="big">Предложения скоро появятся</div>
            <div className="muted">Попробуйте изменить параметры поиска.</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          disabled={page <= 1 || loading}
          className="button"
          onClick={() => goToPage(Math.max(1, page - 1))}
        >
          ← Предыдущая
        </button>
        <div style={{ alignSelf: 'center', minWidth: 120, textAlign: 'center' }}>Стр. {page} / {pageCount}</div>
        <button
          disabled={page >= pageCount || loading}
          className="button"
          onClick={() => goToPage(Math.min(pageCount, page + 1))}
        >
          Следующая →
        </button>
      </div>
    </div>
  );
}
