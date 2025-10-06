'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import FilterBar from '../../../components/FilterBar';

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeBase(value) {
  if (!value) return '';
  let result = value;
  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  if (result === '/') return '';
  return result;
}

const API_BASE = normalizeBase(RAW_API_BASE);
const PAGE_SIZE = 20;
const PARSER_PAGE_SIZE = 50;
const DEFAULT_SEARCH_TERM = 'vin';
const DASH = '—';
const ARROW_LEFT = '←';
const ARROW_RIGHT = '→';

function readToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

function formatCurrency(value, currency = 'RUB') {
  if (value == null || value === '') return DASH;

  let numeric = null;
  if (typeof value === 'number') {
    numeric = Number.isFinite(value) ? value : null;
  } else if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    numeric = Number.isFinite(parsed) ? parsed : null;
  }

  if (numeric == null) return String(value);

  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

function formatDate(value) {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function formatVehicle(item) {
  if (!item) return DASH;
  const parts = [item.brand, item.model, item.year].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return item.category || DASH;
}

function formatCreatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU');
}

function resolveSearchTerm(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || DEFAULT_SEARCH_TERM;
}

function cleanFilters(input = {}) {
  const result = {};
  Object.entries(input || {}).forEach(([key, rawValue]) => {
    if (rawValue == null) return;
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (value === '') return;
    result[key] = value;
  });
  return result;
}

function formatNumber(value) {
  if (value == null) return DASH;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    try {
      return new Intl.NumberFormat('ru-RU').format(numeric);
    } catch {
      return String(numeric);
    }
  }
  return String(value);
}

export default function AdminParserTradesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [unpublishingId, setUnpublishingId] = useState(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [lastIngest, setLastIngest] = useState(null);
  const [progressSearchTerm, setProgressSearchTerm] = useState(DEFAULT_SEARCH_TERM);
  const [view, setView] = useState('drafts');
  const queryView = router.query?.view;

  useEffect(() => {
    if (!router.isReady) return;
    const rawView = queryView;
    const viewParam = Array.isArray(rawView) ? rawView[0] : rawView;
    const normalized = viewParam === 'published' ? 'published' : 'drafts';
    setView((prev) => (prev === normalized ? prev : normalized));
  }, [router.isReady, queryView]);

  const changeView = useCallback(
    (nextView) => {
      setView(nextView);
      setItems([]);
      setPage(1);
      setPageCount(1);
      setPublishingId(null);
      setUnpublishingId(null);
      setListLoading(true);
      setIngesting(false);
      if (!router.isReady) return;
      const nextQuery = { ...router.query };
      if (nextView === 'published') {
        nextQuery.view = 'published';
      } else {
        delete nextQuery.view;
      }
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    },
    [router],
  );

  const applyProgress = useCallback((progress) => {
    if (!progress || typeof progress !== 'object') {
      setProgressSearchTerm(DEFAULT_SEARCH_TERM);
      setNextOffset(0);
      setLastIngest(null);
      return;
    }

    const toInt = (value, fallback = 0) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const searchTerm =
      typeof progress.search_term === 'string' && progress.search_term.trim()
        ? progress.search_term
        : DEFAULT_SEARCH_TERM;
    setProgressSearchTerm(searchTerm);

    const next = toInt(progress.next_offset, 0);
    setNextOffset(next);

    const lastOffset = toInt(progress.last_offset, 0);
    const received = toInt(progress.last_received, 0);
    const upserted = toInt(progress.last_upserted, 0);
    const limit = toInt(progress.last_limit, PARSER_PAGE_SIZE);
    const totalFoundRaw = progress.total_found;
    const totalFound = totalFoundRaw === null || totalFoundRaw === undefined ? null : toInt(totalFoundRaw, null);

    let hasMore = null;
    if (typeof progress.has_more === 'boolean') {
      hasMore = progress.has_more;
    } else if (totalFound != null) {
      hasMore = next < totalFound;
    }

    const updatedAt = progress.updated_at || null;
    const hasHistory = Boolean(
      updatedAt || received > 0 || upserted > 0 || lastOffset > 0 || (totalFound != null && totalFound > 0),
    );

    setLastIngest(
      hasHistory
        ? {
            offset: lastOffset,
            received,
            upserted,
            limit,
            nextOffset: next,
            totalFound,
            hasMore,
            updatedAt,
            searchTerm,
          }
        : null,
    );
  }, []);

  const fetchProgress = useCallback(
    async (searchTerm) => {
      if (!API_BASE) {
        console.warn('NEXT_PUBLIC_API_BASE is not configured.');
        return;
      }

      const token = readToken();
      if (!token) {
        console.warn('No admin token found. Skip progress fetch.');
        return;
      }

      const params = new URLSearchParams();
      if (typeof searchTerm === 'string' && searchTerm.trim()) {
        params.set('search', resolveSearchTerm(searchTerm));
      }

      const qs = params.toString();
      const url = qs ? `${API_BASE}/api/admin/parser-progress?${qs}` : `${API_BASE}/api/admin/parser-progress`;

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'failed');
        }
        applyProgress(data);
      } catch (error) {
        console.error('fetchProgress error:', error);
      }
    },
    [applyProgress],
  );

  const loadPage = useCallback(
    async (nextPage = 1, filtersOverride) => {
      if (!API_BASE) {
        console.warn('NEXT_PUBLIC_API_BASE is not configured.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Для доступа в раздел авторизуйтесь под админ-аккаунтом.');
        return;
      }

      const params = new URLSearchParams();
      const activeFilters = cleanFilters(filtersOverride ?? filters);
      if (activeFilters.q) params.set('q', activeFilters.q);
      if (activeFilters.region) params.set('region', activeFilters.region);
      if (activeFilters.city) params.set('city', activeFilters.city);
      if (activeFilters.brand) params.set('brand', activeFilters.brand);
      if (activeFilters.trade_type) params.set('trade_type', activeFilters.trade_type);
      if (activeFilters.minPrice) params.set('minPrice', activeFilters.minPrice);
      if (activeFilters.maxPrice) params.set('maxPrice', activeFilters.maxPrice);
      params.set('page', String(nextPage));
      params.set('limit', String(PAGE_SIZE));
      params.set('status', view === 'published' ? 'published' : 'drafts');

      setListLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'Не удалось загрузить список объявлений');
        }

        setItems(Array.isArray(data.items) ? data.items : []);
        setPage(data.page || nextPage);
        setPageCount(data.pageCount || 1);
        setTotalCount(Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
      } catch (error) {
        console.error('loadPage error:', error);
        alert(error.message || 'Ошибка запроса');
      } finally {
        setListLoading(false);
      }
    },
    [filters, view],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (view === 'drafts') {
      const searchTerm = resolveSearchTerm(filters.q || '');
      fetchProgress(searchTerm);
    } else {
      applyProgress(null);
    }
  }, [view, fetchProgress, applyProgress, filters.q]);

  const handleFilterSearch = useCallback((nextFilters) => {
    setFilters(cleanFilters(nextFilters));
    setPage(1);
  }, []);

  const runIngest = useCallback(
    async ({ reset = false } = {}) => {
      if (view !== 'drafts') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно вызвать парсер.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      const searchTerm = resolveSearchTerm(filters.q || '');
      const offsetToUse = reset ? 0 : nextOffset;

      setIngesting(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/actions/ingest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            search: searchTerm,
            limit: PARSER_PAGE_SIZE,
            offset: offsetToUse,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'Не удалось запустить парсер');
        }

        if (data.progress) {
          applyProgress(data.progress);
        } else {
          const baseOffset = Number.isFinite(Number(data.offset)) ? Number(data.offset) : offsetToUse;
          const receivedCount = Number.isFinite(Number(data.received)) ? Number(data.received) : 0;
          const limitUsed = Number.isFinite(Number(data.limit)) ? Number(data.limit) : PARSER_PAGE_SIZE;
          const upsertedCount = Number.isFinite(Number(data.upserted)) ? Number(data.upserted) : 0;
          const fallbackProgress = {
            search_term: searchTerm,
            next_offset: Number.isFinite(Number(data.next_offset))
              ? Number(data.next_offset)
              : baseOffset + (receivedCount || limitUsed),
            last_offset: baseOffset,
            last_received: receivedCount,
            last_upserted: upsertedCount,
            last_limit: limitUsed,
            total_found: data.parser_meta?.total_found ?? null,
            has_more: data.parser_meta?.has_more ?? null,
            updated_at: new Date().toISOString(),
          };
          applyProgress(fallbackProgress);
        }

        alert(
          `Получено: ${Number(data.received) || 0}, сохранено/обновлено: ${Number(data.upserted) || 0}. ` +
            `Текущий offset: ${Number(data.offset) || offsetToUse}, следующий: ${Number(data.next_offset) || nextOffset}.`,
        );
        await loadPage(1);
        await fetchProgress(searchTerm);
      } catch (error) {
        console.error('ingest error:', error);
        alert(`Ошибка: ${error.message || 'ingest failed'}`);
      } finally {
        setIngesting(false);
      }
    },
    [filters, loadPage, nextOffset, applyProgress, fetchProgress, view],
  );

  const publish = useCallback(
    async (id) => {
      if (view !== 'drafts') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно опубликовать объявление.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      setPublishingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/publish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        alert('Объявление опубликовано и доступно в разделе /trades.');
        await loadPage(page);
      } catch (error) {
        console.error('publish error:', error);
        alert(`Ошибка публикации: ${error.message || 'failed'}`);
      } finally {
        setPublishingId(null);
      }
    },
    [page, loadPage, view],
  );

  const unpublish = useCallback(
    async (id) => {
      if (view !== 'published') return;
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно снять объявление с публикации.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      if (typeof window !== 'undefined') {
        const confirmed = window.confirm('Снять объявление с публикации? Оно исчезнет из раздела /trades.');
        if (!confirmed) return;
      }

      setUnpublishingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/unpublish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        alert('Объявление снято с публикации и скрыто из раздела /trades.');
        await loadPage(page);
      } catch (error) {
        console.error('unpublish error:', error);
        alert(`Ошибка снятия с публикации: ${error.message || 'failed'}`);
      } finally {
        setUnpublishingId(null);
      }
    },
    [page, loadPage, view],
  );

  const isPublishedView = view === 'published';
  const pageTitle = isPublishedView ? 'Админка — Опубликованные объявления' : 'Админка — Объявления (из парсера)';
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;
  const ingestPrimaryLabel = ingesting ? 'Загружаем…' : 'Получить новые с Федресурса';
  const ingestMoreLabel = ingesting ? 'Загружаем…' : 'Получить ещё с парсера';
  const ingestDisabled = ingesting;
  const filterInitial = useMemo(() => ({ ...filters }), [filters]);

  return (
    <div className="container">
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">{pageTitle}</h1>
          <p className="admin-page__subtitle">
            {isPublishedView
              ? 'Редактируйте объявления, которые уже опубликованы на сайте.'
              : 'Отслеживайте свежие объявления из парсера и публикуйте лучшие предложения.'}
          </p>
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-segment ${isPublishedView ? '' : 'is-active'}`}
            onClick={() => changeView('drafts')}
            disabled={view === 'drafts'}
          >
            Неопубликованные
          </button>
          <button
            type="button"
            className={`admin-segment ${isPublishedView ? 'is-active' : ''}`}
            onClick={() => changeView('published')}
            disabled={view === 'published'}
          >
            Опубликованные
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <FilterBar
            onSearch={handleFilterSearch}
            initial={filterInitial}
            favoritesCount={0}
            showFavoritesLink={false}
          />
        </div>

        {!isPublishedView ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 12,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="button button-small button-outline"
              onClick={() => runIngest({ reset: true })}
              disabled={ingestDisabled}
            >
              {ingestPrimaryLabel}
            </button>
            <button
              type="button"
              className="button button-small button-outline"
              onClick={() => runIngest({ reset: false })}
              disabled={ingestDisabled}
            >
              {ingestMoreLabel}
            </button>
          </div>
        ) : null}

        {isPublishedView ? (
          <div className="admin-hint-card">
            <div className="admin-hint-card__title">Опубликованные объявления</div>
            <p className="admin-hint-card__text">
              Здесь собраны объявления, которые уже видят пользователи сайта. Вы можете обновить данные или снять лот при необходимости.
            </p>
          </div>
        ) : (
          <div className="admin-hint-card">
            <div className="admin-hint-card__title">Статус загрузки парсера</div>
            <div className="admin-hint-card__meta" style={{ display: 'grid', gap: 8 }}>
              <span>
                Обьявлений в базе парсера: <strong>{formatNumber(lastIngest?.totalFound ?? totalCount ?? 0)}</strong>
              </span>
              <span>
                Обьявлений в категории «Непопубликованные»: <strong>{formatNumber(totalCount)}</strong>
              </span>
              <span>
                Обновлено: {lastIngest?.updatedAt ? formatCreatedAt(lastIngest.updatedAt) || lastIngest.updatedAt : DASH}
              </span>
            </div>
            <div className="admin-hint-card__note">
              Текущий запрос: <strong>{progressSearchTerm}</strong>. Следующий offset <strong>{nextOffset}</strong>.
            </div>
            {!lastIngest ? (
              <div className="admin-hint-card__footer">
                Используйте кнопки выше, чтобы загрузить актуальные объявления по выбранному фильтру.
              </div>
            ) : null}
          </div>
        )}

        <div className="admin-table-card">
          <div className="admin-table-card__scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Заголовок</th>
                  <th>Регион</th>
                  <th>ТС</th>
                  <th>Стартовая цена</th>
                  <th>Окончание</th>
                  <th>Действия</th>
              </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="admin-table__empty" colSpan={6}>
                      {listLoading ? 'Загрузка…' : 'Записей пока нет.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const createdAt = formatCreatedAt(item.created_at);
                    const publishedAt = formatCreatedAt(item.published_at);
                    const isPublishing = publishingId === item.id;
                    const isUnpublishing = unpublishingId === item.id;
                    const detailHref = {
                      pathname: '/admin/listings/[id]',
                      query: isPublishedView ? { id: item.id, view: 'published' } : { id: item.id },
                    };
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="admin-table__title">{item.title || 'Лот'}</div>
                          <div className="admin-table__meta">
                            {item.source_url ? (
                              <a href={item.source_url} target="_blank" rel="noreferrer" className="link">
                                Источник
                              </a>
                            ) : (
                              <span>{DASH}</span>
                            )}
                            {createdAt ? <span>Создано: {createdAt}</span> : null}
                          </div>
                          {publishedAt ? (
                            <div className="admin-table__meta">Опубликовано: {publishedAt}</div>
                          ) : null}
                        </td>
                        <td>{item.region || DASH}</td>
                        <td>
                          <div className="admin-table__value">{formatVehicle(item)}</div>
                          {item.vin ? <div className="admin-table__meta">VIN: {item.vin}</div> : null}
                        </td>
                        <td>{formatCurrency(item.start_price, item.currency || 'RUB')}</td>
                        <td>
                          <div className="admin-table__value">{formatDate(item.date_finish)}</div>
                          {item.trade_place ? <div className="admin-table__meta">{item.trade_place}</div> : null}
                        </td>
                        <td>
                          <div className="admin-table__actions">
                            <Link href={detailHref} className="button button-small button-outline">
                              Редактировать
                            </Link>
                            {isPublishedView ? (
                              <button
                                type="button"
                                className="button button-small button-outline"
                                onClick={() => unpublish(item.id)}
                                disabled={isUnpublishing || listLoading}
                                style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                              >
                                {isUnpublishing ? 'Снимаем…' : 'Снять с публикации'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="button button-small"
                                onClick={() => publish(item.id)}
                                disabled={isPublishing || listLoading}
                              >
                                {isPublishing ? 'Публикуем…' : 'Опубликовать'}
                              </button>
                            )}
                            {item.source_url ? (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="button button-small button-outline"
                              >
                                Источник
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-pagination">
          <button
            type="button"
            className="button button-small button-outline"
            onClick={() => loadPage(page - 1)}
            disabled={!canGoPrev || listLoading}
          >
            {ARROW_LEFT} Назад
          </button>
          <div className="admin-pagination__info">
            Страница {page} из {pageCount}
          </div>
          <button
            type="button"
            className="button button-small button-outline"
            onClick={() => loadPage(page + 1)}
            disabled={!canGoNext || listLoading}
          >
            Вперёд {ARROW_RIGHT}
          </button>
        </div>
      </div>
    </div>
  );
}


