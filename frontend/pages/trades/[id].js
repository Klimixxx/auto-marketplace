// pages/trades/[id].js
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE;

function fmtPrice(v, currency = 'RUB') {
  if (v == null) return '—';
  try {
    return new Intl.NumberFormat('ru-RU', { style:'currency', currency, maximumFractionDigits:0 }).format(v);
  } catch {
    return `${v} ${currency}`;
  }
}

export async function getServerSideProps({ params }) {
  const r = await fetch(`${API}/api/listings/${params.id}`, { cache: 'no-store' });
  if (!r.ok) return { notFound: true };
  const item = await r.json();
  return { props: { item } };
}

export default function ListingPage({ item }) {
  const d = item?.details || {};

  return (
    <div className="container" style={{paddingTop:16, paddingBottom:32}}>
      <div style={{marginBottom:12}}>
        <Link href="/trades" className="link">← Назад к списку</Link>
      </div>

      <h1 style={{marginBottom:4}}>{item?.title || 'Лот'}</h1>
      <div style={{color:'#666', marginBottom:12}}>
        {(item?.region || 'Регион не указан')} • {(item?.asset_type || 'тип имущества')}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12}}>
        <div className="panel">
          <div className="muted">Стартовая цена</div>
          <div className="big">{fmtPrice(item?.start_price, item?.currency || 'RUB')}</div>
        </div>
        <div className="panel">
          <div className="muted">Текущая цена</div>
          <div className="big">{fmtPrice(item?.current_price, item?.currency || 'RUB')}</div>
        </div>
      </div>

      {(item?.status || item?.end_date) && (
        <div style={{marginTop:8, color:'#444'}}>
          Статус: {item?.status ?? '—'}
          {item?.end_date ? <> • Окончание: {new Date(item.end_date).toLocaleDateString('ru-RU')}</> : null}
        </div>
      )}

      {item?.source_url && (
        <div style={{marginTop:8}}>
          <a href={item.source_url} target="_blank" rel="noreferrer" className="link">
            Перейти к источнику
          </a>
        </div>
      )}

      {/* Описание */}
      {(item?.description || d?.lot_details?.description) && (
        <section style={{marginTop:24}}>
          <h2>Описание</h2>
          <div style={{whiteSpace:'pre-wrap'}}>{item?.description || d?.lot_details?.description}</div>
        </section>
      )}

      {/* Характеристики */}
      {d?.lot_details && (
        <section style={{marginTop:24}}>
          <h2>Характеристики</h2>
          <div className="panel" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {Object.entries(d.lot_details).map(([k, v]) => (
              <div key={k} style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <div className="muted">{k}</div>
                <div style={{fontWeight:600, textAlign:'right', wordBreak:'break-word'}}>{String(v ?? '—')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Контакты */}
      {d?.contact_details && (
        <section style={{marginTop:24}}>
          <h2>Контакты</h2>
          <div className="panel" style={{display:'grid', gap:6}}>
            {d.contact_details.organizer_name && <div><span className="muted">Организатор: </span>{d.contact_details.organizer_name}</div>}
            {d.contact_details.organizer_inn && <div><span className="muted">ИНН организатора: </span>{d.contact_details.organizer_inn}</div>}
            {d.contact_details.phone && <div><span className="muted">Телефон: </span>{d.contact_details.phone}</div>}
            {d.contact_details.email && (
              <div>
                <span className="muted">Email: </span>
                <a className="link" href={`mailto:${d.contact_details.email}`}>{d.contact_details.email}</a>
              </div>
            )}
            {d.contact_details.address && <div><span className="muted">Адрес: </span>{d.contact_details.address}</div>}
            {d.contact_details.inspection_procedure && (
              <div className="muted" style={{whiteSpace:'pre-wrap'}}>
                Осмотр: {d.contact_details.inspection_procedure}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Документы */}
      {Array.isArray(d?.documents) && d.documents.length > 0 && (
        <section style={{marginTop:24}}>
          <h2>Документы</h2>
          <ul style={{paddingLeft:18}}>
            {d.documents.map((doc, i) => (
              <li key={i}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="link">{doc.name || doc.url}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Периоды цен (Public Offer) */}
      {Array.isArray(d?.prices) && d.prices.length > 0 && (
        <section style={{marginTop:24}}>
          <h2>Периоды цен</h2>
          <div style={{overflowX:'auto'}}>
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
                {d.prices.map((p, i) => (
                  <tr key={i}>
                    <td>{[p?.startDate || p?.start_date, p?.endDate || p?.end_date].filter(Boolean).join(' — ') || '—'}</td>
                    <td>{fmtPrice(Number(p?.price ?? p?.currentPrice ?? p?.current_price) || null, item?.currency || 'RUB')}</td>
                    <td>{fmtPrice(Number(p?.deposit ?? p?.depositAmount ?? p?.deposit_amount) || null, item?.currency || 'RUB')}</td>
                    <td>{p?.note || '—'}</td>
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
