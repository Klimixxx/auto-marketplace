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

function normalizePhoto(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed ? { url: trimmed } : null;
  }
  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
    if (!url) return null;
    const title = photo.title || photo.name || photo.caption || null;
    return title ? { url, title } : { url };
  }
  return null;
}

function collectPhotos(details) {
  const list = [];
  const seen = new Set();
  const sources = [
    details?.photos,
    details?.lot_details?.photos,
    details?.lot_details?.images,
    details?.lot_details?.gallery,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const photo of source) {
      const normalized = normalizePhoto(photo);
      if (normalized && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        list.push(normalized);
      }
    }
  }

  return list;
}

export async function getServerSideProps({ params }) {
  const r = await fetch(`${API}/api/listings/${params.id}`, { cache: 'no-store' });
  if (!r.ok) return { notFound: true };
  const item = await r.json();
  return { props: { item } };
}

export default function ListingPage({ item }) {
  const d = item?.details || {};
  const photos = collectPhotos(d);

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

      {photos.length > 0 && (
        <section style={{marginTop:24}}>
          <h2>Фотографии</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12}}>
            {photos.map((photo, index) => (
              <div key={photo.url || index} className="panel" style={{padding:8}}>
                <img
                  src={photo.url}
                  alt={photo.title || `Фото ${index + 1}`}
                  style={{width:'100%', height:200, objectFit:'cover', borderRadius:8}}
                />
                <div className="muted" style={{marginTop:6, fontSize:12, wordBreak:'break-word'}}>
                  {photo.title || photo.url}
                </div>
              </div>
            ))}
          </div>
        </section>
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
