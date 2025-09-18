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
@@ -74,135 +77,211 @@ export default function AdminParserTradesPage() {
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
            search: trimmed || 'vin',
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
          `Текущий offset: ${baseOffset}, следующий: ${next}.`
        );
        await loadPage(1);
      } catch (error) {
        alert(`Ошибка: ${error.message || 'ingest failed'}`);
      } finally {
        setLoading(false);
      }
    },
    [query, loadPage, nextOffset],
  );

  const publish = useCallback(async (id) => {
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно опубликовать объявление.');
      return;
    }

    const token = readToken();
    if (!token) {
      alert('Сначала войдите в админ-аккаунт.');
      return;
    }

    const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(`Ошибка публикации: ${(data && data.error) || 'failed'}`);
      return;
    }

    alert('Объявление опубликовано и доступно в разделе /trades.');
  }, []);

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <h1>Админка — Объявления (из парсера)</h1>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск (название/регион/марка/модель/VIN)"
        />
        <button
          className="button"
          onClick={() => {
            setNextOffset(0);
            setLastIngest(null);
            loadPage(1);
          }}
          disabled={loading}
        >
          Найти
        </button>
        <button
          className="button primary"
          onClick={() => runIngest({ reset: true })}
          disabled={loading}
        >
          Получить новые
        </button>
        <button
          className="button primary"
          onClick={() => runIngest()}
          disabled={loading}
        >
          ПОЛУЧИТЬ ЕЩЁ
        </button>
      </div>

      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Запрос к парсеру выполняется блоками по {PARSER_PAGE_SIZE}. Следующий offset: {nextOffset}.
        {' '}
        {lastIngest?.totalFound ? `Всего найдено: ${lastIngest.totalFound}.` : null}
      </div>

      {lastIngest && (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Последний парсинг: offset {lastIngest.offset}, получено {lastIngest.received},
          {' '}
          обновлено {lastIngest.upserted}. Следующий offset: {lastIngest.nextOffset}.
        </div>
      )}

      {lastIngest && lastIngest.totalFound != null && !lastIngest.hasMore && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Новых объявлений в текущей выборке больше нет. Нажмите «Получить новые», чтобы начать загрузку сначала.
        </div>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Заголовок</th>
              <th>Регион</th>
              <th>ТС</th>
              <th>Стартовая</th>
              <th>Окончание</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.title || 'Лот'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {item.source_url ? (
                      <a href={item.source_url} target="_blank" rel="noreferrer">
                        Источник
                      </a>
                    ) : (
                      DASH
                    )}
