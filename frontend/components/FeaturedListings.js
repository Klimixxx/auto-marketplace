// frontend/components/FeaturedListings.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ListingCard from './ListingCard'; // ← тот самый компонент со страницы "Торги"

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export default function FeaturedListings({ listings: initial }) {
  // если что-то придёт сверху — возьмём первые 6, иначе подгрузим сами
  const [listings, setListings] = useState(
    Array.isArray(initial) ? initial.slice(0, 6) : []
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      if (initial && initial.length) return;
      try {
        const res = await fetch(api('/api/listings?limit=6'));
        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        if (alive) setListings(items.slice(0, 6));
      } catch (e) {
        console.error('Featured listings load failed:', e);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [initial]);

  if (!listings?.length) return null;

  return (
    <section className="featured">
      <div className="container">
        <div className="header">
          <h2 className="title">Интересные предложения</h2>
          <Link href="/trades" className="all-link">Все предложения</Link>
        </div>

        <div className="grid">
          {listings.map((lot, i) => {
            const key =
              lot?.id ??
              lot?.guid ??
              lot?.slug ??
              lot?.lot_id ??
              lot?.lotId ??
              lot?.number ??
              `k${i}`;

            // РЕНДЕРИМ РОВНО ListingCard, как на "Торги"
            return (
              <ListingCard
                key={String(key)}
                listing={lot}
                lot={lot}
                item={lot}
              />
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .featured { padding: 18px 0 8px; }
        .container { width:100%; max-width:1200px; margin:0 auto; padding:0 12px; }
        .header {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          margin-bottom:12px;
        }
        .title { margin:0; font-size:22px; font-weight:800; color:#0f172a; }
        .all-link { color:#1E90FF; font-weight:700; text-decoration:none; }

        /* сетка под те же карточки, что и на "Торги" */
        .grid {
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:16px;
        }
        @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 640px)  { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
