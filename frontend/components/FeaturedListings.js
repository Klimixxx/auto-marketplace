// components/FeaturedListings.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Если ListingCard лежит в другом месте — поправь путь импорта:
import ListingCard from './ListingCard';

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export default function FeaturedListings({ listings: initial }) {
  const [listings, setListings] = useState(initial || []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (initial && initial.length) return; // уже передали сверху
      try {
        // Берём ПЕРВЫЕ 6, чтобы отрисовать ровно как на "Торги"
        const res = await fetch(api('/api/listings?limit=6'));
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        if (!ignore) setListings(items.slice(0, 6));
      } catch (e) {
        console.error('Featured load error:', e);
      }
    }

    load();
    return () => { ignore = true; };
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
          {listings.map((lot) => {
            const key =
              lot?.id ?? lot?.guid ?? lot?.slug ?? lot?.lot_id ?? lot?.lotId ?? lot?.number ?? Math.random();
            // ВАЖНО: рендерим РОВНО ListingCard, как на "Торги"
            return (
              <ListingCard
                key={String(key)}
                listing={lot}   // основной проп
                lot={lot}       // на случай, если внутри ожидается lot
                item={lot}      // и такой тоже иногда встречался
              />
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .featured { padding: 18px 0 8px; }
        .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 12px; }
        .header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          margin-bottom: 12px;
        }
        .title { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
        .all-link {
          color: #1E90FF; font-weight: 700; text-decoration: none;
        }
        /* Сетка под карточки — аккуратно, чтобы не ломать стили ListingCard */
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px)  { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
