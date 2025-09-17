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

  const runIngest = useCallback(async () => {
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно вызвать парсер.');
      return;
    }

    const token = readToken();
    if (!token) {
      alert('Сначала войдите в админ-аккаунт.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/actions/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ search: query.trim() || 'vin' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error((data && data.error) || 'Не удалось запустить парсер');
      }

      alert(`Получено: ${data.received}, сохранено/обновлено: ${data.upserted}`);
      await loadPage(1);
    } catch (error) {
      alert(`Ошибка: ${error.message || 'ingest failed'}`);
    } finally {
      setLoading(false);
    }
  }, [query, loadPage]);

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
        <button className="button" onClick={() => loadPage(1)} disabled={loading}>
          Найти
        </button>
        <button className="button primary" onClick={runIngest} disabled={loading}>
          Спарсить объявления
        </button>
      </div>

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
                  </div>
                </td>
                <td>{item.region || DASH}</td>
                <td>
                  {[item.brand, item.model, item.year].filter(Boolean).join(' ') || DASH}
                  <br />
                  {item.vin || ''}
                </td>
                <td>{item.start_price ?? DASH}</td>
                <td>{item.date_finish ? new Date(item.date_finish).toLocaleDateString('ru-RU') : DASH}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link href={`/admin/listings/${item.id}`} className="button">
                    Открыть
                  </Link>{' '}
                  <button className="button primary" onClick={() => publish(item.id)}>
                    Выложить
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>
                  Пусто
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="button" onClick={() => loadPage(page - 1)} disabled={loading || page <= 1}>
          {ARROW_LEFT} Назад
        </button>
        <div style={{ alignSelf: 'center' }}>Стр. {page} / {pageCount}</div>
        <button className="button" onClick={() => loadPage(page + 1)} disabled={loading || page >= pageCount}>
          Вперёд {ARROW_RIGHT}
        </button>
      </div>
    </div>
  );
}
