'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeBase(value) {
  if (!value) {
    return '';
  }

  let result = value;
  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  if (result === '/') {
    return '';
  }

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
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

function formatCurrency(value, currency = 'RUB') {
  if (value == null || value === '') {
    return DASH;
  }

  let numeric;
  if (typeof value === 'number') {
    numeric = Number.isFinite(value) ? value : null;
  } else if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    numeric = Number.isFinite(parsed) ? parsed : null;
  }

  if (numeric == null) {
    return String(value);
  }

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
  if (!value) {
    return DASH;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('ru-RU');
}

function formatVehicle(item) {
  if (!item) {
    return DASH;
  }
  const parts = [item.brand, item.model, item.year].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }
  return item.category || DASH;
}

function formatCreatedAt(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString('ru-RU');
}

export default function AdminParserTradesPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [lastIngest, setLastIngest] = useState(null);

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

      setLoading(true);
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
        setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const handleSearch = useCallback(() => {
    setNextOffset(0);
    setLastIngest(null);
    loadPage(1);
  }, [loadPage]);

  const runIngest = useCallback(
    async ({ reset = false } = {}) => {
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно вызвать парсер.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      const trimmed = query.trim();
      const offsetToUse = reset ? 0 : nextOffset;

      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/actions/ingest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            search: trimmed || DEFAULT_SEARCH_TERM,
            limit: PARSER_PAGE_SIZE,
            offset: offsetToUse,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error((data && data.error) || 'Не удалось запустить парсер');
        }

        const baseOffset = Number.isFinite(Number(data.offset)) ? Number(data.offset) : offsetToUse;
        const receivedCount = Number.isFinite(Number(data.received)) ? Number(data.received) : 0;
        const limitUsed = Number.isFinite(Number(data.limit)) ? Number(data.limit) : PARSER_PAGE_SIZE;
        const upsertedCount = Number.isFinite(Number(data.upserted)) ? Number(data.upserted) : 0;
        const next = Number.isFinite(Number(data.next_offset))
          ? Number(data.next_offset)
          : baseOffset + (receivedCount || limitUsed);

        const totalFound = Number.isFinite(Number(data.parser_meta?.total_found))
          ? Number(data.parser_meta.total_found)
          : null;
        const hasMore = totalFound == null ? true : next < totalFound;

        setNextOffset(next);
        setLastIngest({
          offset: baseOffset,
          received: receivedCount,
          upserted: upsertedCount,
          limit: limitUsed,
          nextOffset: next,
          totalFound,
          hasMore,
        });

        alert(
          `Получено: ${receivedCount}, сохранено/обновлено: ${upsertedCount}. ` +
            `Текущий offset: ${baseOffset}, следующий: ${next}.`,
        );
        await loadPage(1);
      } catch (error) {
        console.error('ingest error:', error);
        alert(`Ошибка: ${error.message || 'ingest failed'}`);
      } finally {
        setLoading(false);
      }
    },
    [query, loadPage, nextOffset],
  );

  const publish = useCallback(
    async (id) => {
      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно опубликовать объявление.');
        return;
      }

      const token = readToken();
      if (!token) {
        alert('Сначала войдите в админ-аккаунт.');
        return;
      }

      setLoading(true);
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
        setLoading(false);
      }
    },
    [page, loadPage],
  );

  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;
  const publishButtonStyle = loading
    ? { ...PRIMARY_BUTTON_STYLE, opacity: 0.6, cursor: 'not-allowed' }
    : PRIMARY_BUTTON_STYLE;
  const linkButtonStyle = loading
    ? { ...ACTION_BUTTON_STYLE, opacity: 0.6, pointerEvents: 'none' }
    : ACTION_BUTTON_STYLE;

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <h1>Админка — Объявления (из парсера)</h1>

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
        <button
          className="button"
          onClick={handleSearch}
          disabled={loading}
          style={linkButtonStyle}
        >
          Найти
        </button>
        <button
          className="button primary"
          onClick={() => runIngest({ reset: true })}
          disabled={loading}
          style={publishButtonStyle}
        >
          Получить новые
        </button>
        <button
          className="button primary"
          onClick={() => runIngest({ reset: false })}
          disabled={loading}
          style={publishButtonStyle}
        >
          ПОЛУЧИТЬ ЕЩЁ
        </button>
      </div>

      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Запрос к парсеру выполняется блоками по {PARSER_PAGE_SIZE}. Следующий offset: {nextOffset}.{' '}
        {lastIngest?.totalFound ? `Всего найдено: ${lastIngest.totalFound}.` : null}
      </div>

      {lastIngest && (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Последний парсинг: offset {lastIngest.offset}, получено {lastIngest.received}, обновлено {lastIngest.upserted}.{' '}
          Следующий offset: {lastIngest.nextOffset}.
        </div>
      )}

      {lastIngest && lastIngest.totalFound != null && !lastIngest.hasMore && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Новых объявлений в текущей выборке больше нет. Нажмите «Получить новые», чтобы начать загрузку сначала.
        </div>
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
              <th style={TABLE_HEADER_STYLE}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...TABLE_CELL_STYLE, textAlign: 'center', color: '#9aa6b2' }}>
                  {loading ? 'Загрузка…' : 'Записей пока нет.'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const createdAt = formatCreatedAt(item.created_at);
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Link
                          href={`/admin/listings/${item.id}`}
                          className="button"
                          style={linkButtonStyle}
                        >
                          Открыть
                        </Link>
                        <button
                          type="button"
                          className="button primary"
                          style={publishButtonStyle}
                          onClick={() => publish(item.id)}
                          disabled={loading}
                        >
                          Опубликовать
                        </button>
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
        <button
          className="button"
          onClick={() => loadPage(page - 1)}
          disabled={!canGoPrev || loading}
          style={linkButtonStyle}
        >
          {ARROW_LEFT} Назад
        </button>
        <div style={{ color: '#9aa6b2' }}>
          Страница {page} из {pageCount}
        </div>
        <button
          className="button"
          onClick={() => loadPage(page + 1)}
          disabled={!canGoNext || loading}
          style={linkButtonStyle}
        >
          Вперёд {ARROW_RIGHT}
        </button>
      </div>
    </div>
  );
}
