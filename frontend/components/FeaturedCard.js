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
  } catch {
    return `${v} ${cur}`;
  }
}

/* ------------------ card ------------------ */
export default function FeaturedCard({ l, detailHref, onFav, fav }) {
  const photos = useMemo(() => collectPhotos(l), [l]);
  const photo = photos[0] || null;

  const [localFav, setLocalFav] = useState(!!fav);
  useEffect(() => { setLocalFav(!!fav); }, [fav]);

  const title = l.title || 'Лот';
  const description =
    l.description ||
    l.details?.description ||
    l.details?.lot_details?.description ||
    '';

  // Верхняя синяя строка: Тип • Регион • Год выпуска
  const region = l.region || pick(l, ['region']);
  const year = pick(l, ['year', 'production_year', 'manufacture_year', 'year_of_issue', 'productionYear']);
  const rawType = l.trade_type ?? pick(l, ['trade_type', 'type']);
  const eyebrow = [tradeTypeLabel(rawType), region, year ? `${year} г.` : null].filter(Boolean).join(' • ');

  // Цена
  const currency = l.currency || 'RUB';
  const currentPrice = l.current_price ?? l.start_price ?? pick(l, ['current_price','price','start_price']);
  const priceLabel = fmtPrice(currentPrice, currency);

  // Дата
  const dateFinish = pick(l, ['datefinish','dateFinish','date_end','dateEnd','end_date','date_to']);
  const dateFinishLabel = formatRuDateTime(dateFinish);

  const href = detailHref || `/trades/${l.slug || l.id || l.guid || ''}`;

  const toggleFav = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setLocalFav(v => !v);
    onFav?.();           // родитель запишет в localStorage
  };

  return (
    <article className="f-card">
      <div className="f-photo">
        {photo ? (
          <img src={photo} alt={title} />
        ) : (
          <div className="no-photo">Нет фото</div>
        )}

        {/* Пилюля "В избранное" — как в "Торгах" */}
        <button
          type="button"
          className="fav-pill"
          onClick={toggleFav}
          aria-label={localFav ? 'Удалить из избранного' : 'Добавить в избранное'}
        >
          <span aria-hidden="true">{localFav ? '★' : '☆'}</span>
          <span>{localFav ? 'В избранном' : 'В избранное'}</span>
        </button>
      </div>

      <div className="f-body">
        {/* синяя строка */}
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}

        {/* ЧЁРНЫЙ заголовок — зафиксирован жёстко */}
        <Link href={href} className="f-title" title={title}>{title}</Link>

        {description ? <p className="f-desc">{description}</p> : null}

        {/* Дата отдельной строкой (чтобы внизу цена была в одной линии с кнопкой) */}
        <div className="f-date-row">
          {dateFinishLabel
            ? <div className="f-date">Окончание текущего периода: <b>{dateFinishLabel}</b></div>
            : <span className="f-date muted">Дата не указана</span>}
        </div>
      </div>

      {/* НИЖНЯЯ СТРОКА: СЛЕВА ЦЕНА, СПРАВА КНОПКА */}
      <div className="f-footer">
        {priceLabel ? <div className="f-price" title="Текущая цена">{priceLabel}</div> : <span />}
        <Link href={href} className="btn primary more">Подробнее</Link>
      </div>

      <style jsx>{`
        .f-card{
          background:#fff;
          border-radius:14px;
          box-shadow:0 1px 2px rgba(15,23,42,.06);
          overflow:hidden;
          display:flex;
          flex-direction:column;
          transition:transform .18s ease, box-shadow .18s ease;
        }
        .f-card:hover{ transform: translateY(-3px); box-shadow:0 12px 28px rgba(15,23,42,.12); }

        .f-photo{ position:relative; aspect-ratio: 16/9; background:#e6eef8; }
        .f-photo img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .no-photo{ position:absolute; inset:0; display:grid; place-items:center; color:#9aa7b8; font-weight:600; }

        /* Пилюля "В избранное" слева сверху */
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
          font-weight:700; color:#000 !important; /* ЖЁСТКО фиксируем чёрный */
          text-decoration:none; line-height:1.25;
          display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
        }
        .f-desc{
          margin:0; color:#6b7280; font-size:13px; line-height:1.35;
          display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
        }

        .f-date-row{ display:flex; align-items:center; justify-content:space-between; }
        .f-date{ font-size:12px; color:#0f172a; }
        .f-date.muted{ color:#94a3b8; }

        /* Низ: цена + кнопка в ОДНОЙ строке */
        .f-footer{
          padding:8px 12px 12px;
          display:flex; align-items:center; justify-content:space-between; gap:10px;
        }
        .f-price{
          color:#1d4ed8;          /* синий */
          font-weight:800;
          font-size:16px;
          line-height:1;
        }

        .btn{
          height:36px; border-radius:10px; padding:0 12px; font-weight:700; cursor:pointer; border:none;
          display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
          transition: none;         /* убрали анимацию */
        }
        .btn.primary{
          background:#1E90FF; color:#fff;
        }
        /* УБРАЛИ ХОВЕР-АНИМАЦИЮ ПОЛНОСТЬЮ */
        .btn.primary:hover,
        .btn.primary:focus{
          background:#1E90FF !important;
          color:#fff !important;
          transform:none !important;
          box-shadow:none !important;
          filter:none !important;
        }
        .btn.more{ margin-left:auto; }
      `}</style>
    </article>
  );
}
