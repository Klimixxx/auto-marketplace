import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

function fmtPrice(value, currency = 'RUB') {
  try {
    if (value == null) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default function AdminParserTradeCard() {
  const router = useRouter();
  const { id } = router.query;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady || !id) return;
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно загрузить данные объявления.');
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    let aborted = false;

    async function fetchItem() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error(data?.error || 'Не удалось загрузить объявление');
        }
        if (!aborted) setItem(data);
      } catch (e) {
        if (!aborted) {
          alert(e.message);
          router.replace('/admin/listings');
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    fetchItem();

    return () => {
      aborted = true;
    };
  }, [router.isReady, id]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/listings" className="link">
            ← Назад
          </Link>
        </div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/listings" className="link">
            ← Назад
          </Link>
        </div>
        <p>Объявление не найдено.</p>
      </div>
    );
  }

  const d = item;

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/admin/listings" className="link">
          ← Назад
        </Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>{d.title || 'Лот'}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>
        {[d.region, d.category].filter(Boolean).join(' • ') || '—'}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          gap: 12,
        }}
      >
        <div className="panel">
          <div className="muted">ТС</div>
          <div className="big">{[d.brand, d.model, d.year].filter(Boolean).join(' ') || '—'}</div>
        </div>
        <div className="panel">
          <div className="muted">VIN</div>
          <div className="big">{d.vin || '—'}</div>
        </div>
        <div className="panel">
          <div className="muted">Стартовая цена</div>
          <div className="big">{fmtPrice(d.start_price)}</div>
        </div>
        <div className="panel">
          <div className="muted">Окончание</div>
          <div className="big">
            {d.date_finish ? new Date(d.date_finish).toLocaleDateString('ru-RU') : '—'}
          </div>
        </div>
      </div>

      {d.lot_details?.description && (
        <section style={{ marginTop: 24 }}>
          <h2>Описание</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{d.lot_details.description}</div>
        </section>
      )}

      {d.lot_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Характеристики</h2>
          <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(d.lot_details).map(([key, value]) => (
              <div
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
              >
                <div className="muted">{key}</div>
                <div style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>
                  {String(value ?? '—')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.contact_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Контакты</h2>
          <div className="panel" style={{ display: 'grid', gap: 6 }}>
            {d.contact_details.organizer_name && (
              <div>
                <span className="muted">Организатор: </span>
                {d.contact_details.organizer_name}
              </div>
            )}
            {d.contact_details.organizer_inn && (
              <div>
                <span className="muted">ИНН: </span>
                {d.contact_details.organizer_inn}
              </div>
            )}
            {d.contact_details.phone && (
              <div>
                <span className="muted">Телефон: </span>
                {d.contact_details.phone}
              </div>
            )}
            {d.contact_details.email && (
              <div>
                <span className="muted">Email: </span>
                <a className="link" href={`mailto:${d.contact_details.email}`}>
                  {d.contact_details.email}
                </a>
              </div>
            )}
            {d.contact_details.address && (
              <div>
                <span className="muted">Адрес: </span>
                {d.contact_details.address}
              </div>
            )}
            {d.contact_details.inspection_procedure && (
              <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                Осмотр: {d.contact_details.inspection_procedure}
              </div>
            )}
          </div>
        </section>
      )}

      {Array.isArray(d.documents) && d.documents.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Документы</h2>
          <ul style={{ paddingLeft: 18 }}>
            {d.documents.map((doc, index) => (
              <li key={index}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="link">
                  {doc.name || doc.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Array.isArray(d.prices) && d.prices.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Периоды цен</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Цена</th>
                  <th>Задаток</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {d.prices.map((price, index) => (
                  <tr key={index}>
                    <td>
                      {[price?.startDate || price?.start_date, price?.endDate || price?.end_date]
                        .filter(Boolean)
                        .join(' — ') || '—'}
                    </td>
                    <td>
                      {fmtPrice(
                        Number(price?.price ?? price?.currentPrice ?? price?.current_price) || null,
                      )}
                    </td>
                    <td>
                      {fmtPrice(
                        Number(price?.deposit ?? price?.depositAmount ?? price?.deposit_amount) || null,
                      )}
                    </td>
                    <td>{price?.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
