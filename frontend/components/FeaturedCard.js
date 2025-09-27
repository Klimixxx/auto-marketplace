// frontend/components/FeaturedCard.js
import Link from 'next/link';
import { useMemo, useState } from 'react';

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

/* ------------------ card ------------------ */
export default function FeaturedCard({ l, detailHref, onFav, fav }) {
  const [hover, setHover] = useState(false);
  const photos = useMemo(() => collectPhotos(l), [l]);
  const photo = photos[0] || null;

  const title = l.title || 'Лот';
  const description =
    l.description ||
    l.details?.description ||
    l.details?.lot_details?.description ||
    '';

  const dateFinish = pick(l, ['datefinish','dateFinish','date_end','dateEnd','end_date','date_to']);
  const dateFinishLabel = formatRuDateTime(dateFinish);

  const href = detailHref || `/trades/${l.slug || l.id || l.guid || ''}`;

  return (
    <article
      className="f-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="f-photo">
        {photo ? (
          <img src={photo} alt={title} />
        ) : (
          <div className="no-photo">Нет фото</div>
        )}

        {/* избранное в углу фото */}
        {onFav ? (
          <button
            type="button"
            className="fav"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFav(); }}
            aria-label={fav ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            {fav ? '❤️' : '🤍'}
          </button>
        ) : null}
      </div>

      <div className="f-body">
        <Link href={href} className="f-title" title={title}>
          {title}
        </Link>

        {description ? (
          <p className="f-desc">{description}</p>
        ) : null}

        <div className="f-meta">
          {dateFinishLabel ? (
            <div className="f-date">
              Окончание текущего периода: <b>{dateFinishLabel}</b>
            </div>
          ) : <span className="f-date muted">Дата не указана</span>}
        </div>
      </div>

      <div className="f-actions">
        {onFav ? (
          <button
            type="button"
            className="btn ghost"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFav(); }}
          >
            {fav ? 'В избранном' : 'В избранное'}
          </button>
        ) : null}

        <Link href={href} className="btn primary more">
          Подробнее
        </Link>
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
        .fav{
          position:absolute; right:10px; top:10px; height:32px; min-width:32px;
          border-radius:999px; border:1px solid #e5e7eb; background:#fff; padding:0 10px;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          box-shadow:0 6px 14px rgba(0,0,0,.08);
        }

        .f-body{ padding:12px 12px 6px; display:grid; gap:6px; }
        .f-title{
          font-weight:700; color:#0f172a; text-decoration:none; line-height:1.25;
          display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
        }
        .f-desc{
          margin:0; color:#6b7280; font-size:13px; line-height:1.35;
          display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
        }
        .f-meta{ display:flex; justify-content:space-between; align-items:center; }
        .f-date{ font-size:12px; color:#0f172a; }
        .f-date.muted{ color:#94a3b8; }

        .f-actions{
          padding:8px 12px 12px;
          display:flex; gap:8px; align-items:center; justify-content:space-between;
        }
        .btn{
          height:36px; border-radius:10px; padding:0 12px; font-weight:700; cursor:pointer; border:none;
          display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
          transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
        }
        .btn.primary{ background:#1E90FF; color:#fff; }
        .btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 22px rgba(30,144,255,.32); filter:brightness(1.03); }
        .btn.ghost{ background:#f3f4f6; color:#111827; border:1px solid #e5e7eb; }
        .btn.ghost:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(17,24,39,.08); background:#fff; }
        .btn.more{ margin-left:auto; }
      `}</style>
    </article>
  );
}
