'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

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
const PARSER_PAGE_SIZE = 15;
const DASH = '\u2014';
const ARROW_LEFT = '\u2190';
const ARROW_RIGHT = '\u2192';
const DEFAULT_SEARCH_TERM = 'vin';

const ACTION_BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #253041',
  background: '#1e293b',
  color: 'inherit',
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

const PRIMARY_BUTTON_STYLE = {
  ...ACTION_BUTTON_STYLE,
  background: '#2563eb',
  borderColor: '#2563eb',
  color: '#fff',
};

const TABLE_HEADER_STYLE = {
  textAlign: 'left',
  padding: '12px 8px',
  fontWeight: 600,
  fontSize: 13,
  color: '#9aa6b2',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const TABLE_CELL_STYLE = {
  padding: '12px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
};

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

export default function AdminParserTradesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
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
    async (nextPage = 1) => {
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
      const trimmed = query.trim();
      if (trimmed) {
        params.set('q', trimmed);
      }
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
      } catch (error) {
        console.error('loadPage error:', error);
        alert(error.message || 'Ошибка запроса');
      } finally {
        setListLoading(false);
      }
    },
    [query, view],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (view === 'drafts') {
      fetchProgress();
    } else {
      applyProgress(null);
    }
  }, [view, fetchProgress, applyProgress]);

  const handleSearch = useCallback(() => {
    loadPage(1);
    if (view === 'drafts') {
      fetchProgress(resolveSearchTerm(query));
    }
  }, [loadPage, fetchProgress, query, view]);

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

      const searchTerm = resolveSearchTerm(query);
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
    [query, loadPage, nextOffset, applyProgress, fetchProgress, view],
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
  const toggleFeatured = useCallback(
    async (id, nextState) => {
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      setFeaturingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/listings/${id}/feature`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ is_featured: nextState }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.error) || 'failed');
        }

        setItems((prev) => prev.map((item) => (
          item.id === id ? { ...item, is_featured: nextState } : item
        )));
      } catch (error) {
        console.error('feature toggle error:', error);
        alert('Не удалось обновить статус «Лучшее предложение».');
      } finally {
        setFeaturingId(null);
      }
    },
    [setItems],
  );

  

  const isPublishedView = view === 'published';
  const pageTitle = isPublishedView ? 'Админка — Опубликованные объявления' : 'Админка — Объявления (из парсера)';
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;
  const searchButtonStyle = listLoading ? { ...ACTION_BUTTON_STYLE, opacity: 0.6, pointerEvents: 'none' } : ACTION_BUTTON_STYLE;
  const ingestButtonStyle = ingesting ? { ...PRIMARY_BUTTON_STYLE, opacity: 0.6, cursor: 'not-allowed' } : PRIMARY_BUTTON_STYLE;
  const linkButtonStyle = listLoading ? { ...ACTION_BUTTON_STYLE, opacity: 0.6, pointerEvents: 'none' } : ACTION_BUTTON_STYLE;
  const resolveTabStyle = (tabKey) => (tabKey === view ? { ...PRIMARY_BUTTON_STYLE, cursor: 'default' } : ACTION_BUTTON_STYLE);

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <h1>{pageTitle}</h1>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button"
          onClick={() => changeView('drafts')}
          disabled={view === 'drafts'}
          style={resolveTabStyle('drafts')}
        >
          Неопубликованные
        </button>
        <button
          type="button"
          className="button"
          onClick={() => changeView('published')}
          disabled={view === 'published'}
          style={resolveTabStyle('published')}
        >
          Опубликованные
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSearch();
            }
          }}
          placeholder="Поиск (название/регион/марка/модель/VIN)"
          style={{ flex: '1 1 240px' }}
        />
        <button className="button" onClick={handleSearch} disabled={listLoading} style={searchButtonStyle}>
          Найти
        </button>
        {isPublishedView ? null : (
          <>
            <button
              className="button primary"
              onClick={() => runIngest({ reset: true })}
              disabled={ingesting}
              style={ingestButtonStyle}
            >
              Получить новые
            </button>
            <button
              className="button primary"
              onClick={() => runIngest({ reset: false })}
              disabled={ingesting}
              style={ingestButtonStyle}
            >
              ПОЛУЧИТЬ ЕЩЁ
            </button>
          </>
        )}
      </div>

      {isPublishedView ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Здесь отображаются объявления, которые уже опубликованы на сайте. Откройте карточку, чтобы отредактировать данные
          или переопубликовать их при необходимости.
        </div>
      ) : (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Запрос к парсеру выполняется блоками по {PARSER_PAGE_SIZE}. Текущий поисковый запрос:{' '}
            <span style={{ fontWeight: 600 }}>{progressSearchTerm}</span>. Следующий offset: {nextOffset}.{' '}
            {lastIngest?.totalFound ? `Всего найдено: ${lastIngest.totalFound}.` : null}
          </div>

          {lastIngest && (
            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              Последний парсинг ({lastIngest.searchTerm || progressSearchTerm}): offset {lastIngest.offset}, получено{' '}
              {lastIngest.received}, обновлено {lastIngest.upserted}. Следующий offset: {lastIngest.nextOffset}.
            </div>
          )}

          {lastIngest && lastIngest.totalFound != null && lastIngest.hasMore === false && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Новых объявлений в текущей выборке больше нет. Нажмите «Получить новые», чтобы начать загрузку сначала.
            </div>
          )}
        </>
      )}

      <div
        className="table-wrapper"
        style={{
          marginTop: 16,
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid #253041',
          background: '#0f1522',
        }}
      >
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={TABLE_HEADER_STYLE}>Заголовок</th>
              <th style={TABLE_HEADER_STYLE}>Регион</th>
              <th style={TABLE_HEADER_STYLE}>ТС</th>
              <th style={TABLE_HEADER_STYLE}>Стартовая</th>
              <th style={TABLE_HEADER_STYLE}>Окончание</th>
              <th style={TABLE_HEADER_STYLE}>Лучшее</th>
              <th style={TABLE_HEADER_STYLE}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...TABLE_CELL_STYLE, textAlign: 'center', color: '#9aa6b2' }}>
                  {listLoading ? 'Загрузка…' : 'Записей пока нет.'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const createdAt = formatCreatedAt(item.created_at);
                const publishedAt = formatCreatedAt(item.published_at);
                const isPublishing = publishingId === item.id;
                const isFeatured = Boolean(item.is_featured);
                const isFeaturing = featuringId === item.id;
                const publishButtonStyle =
                  isPublishing || listLoading
                    ? { ...PRIMARY_BUTTON_STYLE, opacity: 0.6, cursor: 'not-allowed' }
                    : PRIMARY_BUTTON_STYLE;
                const featureButtonStyle = (isFeaturing || listLoading)
                  ? { ...ACTION_BUTTON_STYLE, opacity: 0.6, cursor: 'not-allowed' }
                  : {
                      ...ACTION_BUTTON_STYLE,
                      background: isFeatured ? '#0f766e' : '#1e293b',
                      borderColor: isFeatured ? '#0f766e' : '#253041',
                      color: '#fff',
                    };
                const detailHref = {
                  pathname: '/admin/listings/[id]',
                  query: isPublishedView ? { id: item.id, view: 'published' } : { id: item.id },
                };
                return (
                  <tr key={item.id}>
                    <td style={TABLE_CELL_STYLE}>
                      <div style={{ fontWeight: 600 }}>{item.title || 'Лот'}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {item.source_url ? (
                          <a href={item.source_url} target="_blank" rel="noreferrer" className="link">
                            Источник
                          </a>
                        ) : (
                          DASH
                        )}
                        {createdAt ? ` • Создано: ${createdAt}` : null}
                      </div>
                      {publishedAt ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Опубликовано: {publishedAt}
                        </div>
                      ) : null}
                    </td>
                    <td style={TABLE_CELL_STYLE}>{item.region || DASH}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <div>{formatVehicle(item)}</div>
                      {item.vin ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          VIN: {item.vin}
                        </div>
                      ) : null}
                    </td>
                    <td style={TABLE_CELL_STYLE}>{formatCurrency(item.start_price, item.currency || 'RUB')}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <div>{formatDate(item.date_finish)}</div>
                      {item.trade_place ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{item.trade_place}</div>
                      ) : null}
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      <button
                        type="button"
                        style={featureButtonStyle}
                        onClick={() => toggleFeatured(item.id, !isFeatured)}
                        disabled={isFeaturing || listLoading}
                      >
                        {isFeatured ? 'В лучших' : 'Добавить'}
                      </button>
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Link href={detailHref} className="button" style={linkButtonStyle}>
                          Редактировать
                        </Link>
                        {isPublishedView ? null : (
                          <button
                            type="button"
                            className="button primary"
                            style={publishButtonStyle}
                            onClick={() => publish(item.id)}
                            disabled={isPublishing || listLoading}
                          >
                            Опубликовать
                          </button>
                        )}
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="button"
                            style={linkButtonStyle}
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

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button className="button" onClick={() => loadPage(page - 1)} disabled={!canGoPrev || listLoading} style={linkButtonStyle}>
          {ARROW_LEFT} Назад
        </button>
        <div style={{ color: '#9aa6b2' }}>
          Страница {page} из {pageCount}
        </div>
        <button className="button" onClick={() => loadPage(page + 1)} disabled={!canGoNext || listLoading} style={linkButtonStyle}>
          Вперёд {ARROW_RIGHT}
        </button>
      </div>
    </div>
  );
}
