import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

/* ------------------ helpers ------------------ */
function collectPhotos(listing) {
  const pools = [
    listing?.photos,
    listing?.details?.photos,
    listing?.details?.lot_details?.photos,
    listing?.details?.lot_details?.images,
  ];
  const out = [];
  const seen = new Set();
  for (const pool of pools) {
    if (!pool) continue;
    const list = Array.isArray(pool) ? pool : [pool];
    for (const entry of list) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        const u = entry.trim();
        if (u && !seen.has(u)) { seen.add(u); out.push(u); }
      } else if (typeof entry === 'object') {
        const u = entry.url || entry.href || entry.link || entry.download_url || entry.src || null;
        if (u && !seen.has(u)) { seen.add(u); out.push(u); }
      }
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function pick(listing, keys = []) {
  const sources = [listing, listing?.details, listing?.details?.lot_details];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    for (const k of keys) {
      const v = s[k];
      if (v != null && v !== '') return v;
    }
  }
  return null;
}

function formatRuDateTime(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function tradeTypeLabel(type) {
  if (!type) return null;
  const lower = String(type).toLowerCase();
  if (lower === 'auction' || lower.includes('аукцион')) return 'Аукцион';
  if (lower === 'offer' || lower.includes('публич')) return 'Торговое предложение';
  return String(type);
}

function fmtPrice(v, cur='RUB') {
  if (v == null || v === '') return null;
  try {
    return new Intl.NumberFormat('ru-RU', { style:'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
  } catch { return `${v} ${cur}`; }
}

/* статус лота: имя + цвет точки как в «Торгах» */
function getStatusName(listing) {
  const raw = pick(listing, ['status','lot_status']) ?? listing?.status;
  const name = typeof raw === 'object' ? (raw?.name || raw?.title) : raw;
  return name || null;
}
function statusDotColor(name) {
  const txt = String(name || '').toLowerCase();
  if (!txt) return '#94a3b8';
  if (txt.includes('открыт')) return '#16a34a';        // открыт приём заявок
  if (txt.includes('заверш')) return '#ef4444';        // торги завершены
  return '#94a3b8';
}

/* ------------------ card ------------------ */
export default function FeaturedCard({ l, detailHref, onFav, fav }) {
  const photos = useMemo(() => collectPhotos(l), [l]);
  const photo = photos[0] || null;

  const [localFav, setLocalFav] = useState(!!fav);
  useEffect(() => { setLocalFav(!!fav); }, [fav]);

  const title = l.title || 'Лот';

  // Верхняя синяя строка: Тип • Регион • Год выпуска (как в «Торгах»)
  const region = l.region || pick(l, ['region']);
  const year = pick(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const rawType = l.trade_type ?? pick(l, ['trade_type', 'type']);
  const eyebrow = [tradeTypeLabel(rawType), region, year ? `${year} г.` : null].filter(Boolean).join(' • ');

  // Цена (текущая/начальная — как есть в данных)
  const currency = l.currency || 'RUB';
  const currentPrice = l.current_price ?? l.price ?? l.start_price ?? pick(l, ['current_price','price','start_price']);
  const priceLabel = fmtPrice(currentPrice, currency);

  // Дата окончания периода
  const dateFinish = pick(l, ['datefinish','dateFinish','date_end','dateEnd','end_date','date_to']);
  const dateFinishLabel = formatRuDateTime(dateFinish);

  // Статус лота
  const lotStatusName = getStatusName(l);
  const lotStatusColor = statusDotColor(lotStatusName);

  // Ссылка «Источник»
  const sourceUrl = pick(l, ['possible_url','source_url','original_url','url','href']) || null;

  const href = detailHref || `/trades/${l.slug || l.id || l.guid || ''}`;

  const toggleFav = (e) => {
    e?.preventDefault?.(); e?.stopPropagation?.();
    setLocalFav(v => !v);
    onFav?.(); // родитель запишет/синхронизирует избранное
  };

  return (
    <article className="f-card">
      <div className="f-photo">
        {photo ? <img src={photo} alt={title} /> : <div className="no-photo">Нет фото</div>}

        {/* В избранное — как в «Торгах» */}
        <button type="button" className="fav-pill" onClick={toggleFav} aria-label={localFav ? 'Удалить из избранного' : 'Добавить в избранное'}>
          <span aria-hidden="true">{localFav ? '★' : '☆'}</span>
          <span>{localFav ? 'В избранном' : 'В избранное'}</span>
        </button>
      </div>

      <div className="f-body">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}

        {/* ЗАГОЛОВОК ВСЕГДА ЧЕРНЫЙ */}
        <Link href={href} className="f-title" title={title}>{title}</Link>

        {/* Окончание периода + статус (как на «Торгах») */}
        <div className="f-info">
          {dateFinishLabel
            ? <div className="f-date">Окончание текущего периода: <b>{dateFinishLabel}</b></div>
            : <span className="f-date muted">Дата не указана</span>}
          {lotStatusName ? (
            <div className="f-status">
              <span className="dot" style={{ background: lotStatusColor }} />
              <span className="text">{lotStatusName}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Низ: слева цена, справа кнопки «Подробнее» и «Источник» */}
      <div className="f-footer">
        {priceLabel ? <div className="f-price" title="Текущая цена">{priceLabel}</div> : <span />}
        <div className="actions">
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn link">Источник</a>
          )}
          <Link href={href} className="btn primary">Подробнее</Link>
        </div>
      </div>

      <style jsx>{`
        .f-card{
          background:#fff;
          border-radius:14px;
          box-shadow:0 1px 2px rgba(15,23,42,.06);
          overflow:hidden;
          display:flex; flex-direction:column;
          transition:transform .18s ease, box-shadow .18s ease;
        }
        .f-card:hover{ transform: translateY(-3px); box-shadow:0 12px 28px rgba(15,23,42,.12); }

        .f-photo{ position:relative; aspect-ratio: 16/9; background:#e6eef8; }
        .f-photo img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .no-photo{ position:absolute; inset:0; display:grid; place-items:center; color:#9aa7b8; font-weight:600; }

        .fav-pill{
          position:absolute; left:10px; top:10px;
          border-radius:10px; border:1px solid #e5e7eb;
          background:#fff; color:#000;
          padding:6px 10px; cursor:pointer;
          display:flex; align-items:center; gap:6px; font-size:13px;
          box-shadow:0 6px 16px rgba(0,0,0,0.08);
        }

        .f-body{ padding:12px 12px 6px; display:grid; gap:6px; }
        .eyebrow{ font-size:12px; font-weight:600; letter-spacing:.2px; color:#1E90FF; }

        .f-title{
          font-weight:700; line-height:1.25; text-decoration:none;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          color:#000 !important;
        }
        .f-title:hover, .f-title:active, .f-title:visited{ color:#000 !important; }

        .f-info{ display:grid; gap:6px; }
        .f-date{ font-size:12px; color:#0f172a; }
        .f-date.muted{ color:#94a3b8; }
        .f-status{ display:flex; align-items:center; gap:8px; font-size:13px; }
        .dot{ width:10px; height:10px; border-radius:50%; flex:0 0 10px; }

        .f-footer{
          padding:8px 12px 12px;
          display:flex; align-items:center; justify-content:space-between; gap:10px;
        }
        .f-price{
          color:#1d4ed8; font-weight:800; font-size:16px; line-height:1;
        }
        .actions{ display:flex; gap:8px; }

        .btn{
          height:36px; border-radius:10px; padding:0 12px; font-weight:700;
          display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
          border:none; cursor:pointer; transition:none;
        }
        .btn.primary{ background:#1E90FF !important; color:#fff !important; }
        .btn.primary:hover, .btn.primary:focus, .btn.primary:active{
          background:#1E90FF !important; color:#fff !important;
          transform:none !important; box-shadow:none !important; filter:none !important;
        }
        .btn.link{
          background:#1E90FF !important; color:#fff !important;
        }
        .btn.link:hover, .btn.link:focus, .btn.link:active{
          background:#1E90FF !important; color:#fff !important;
          transform:none !important; box-shadow:none !important; filter:none !important;
        }
      `}</style>
    </article>
  );
}
