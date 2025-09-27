// components/FeaturedListings.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
// 👇 Если ListingCard лежит в другой папке — поправьте путь
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
      if (initial && initial.length) return; // уже передали с сервера
      try {
        // Берём первые 6 — как “витрину”
        const res = await fetch(api('/api/listings?limit=6'));
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        if (!ignore) setListings(items.slice(0, 6));
      } catch (e) {
        // не критично — просто не покажем блок
        console.error('Failed to load featured listings', e);
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
          {listings.slice(0, 6).map((lot) => {
            const key =
              lot?.id ?? lot?.guid ?? lot?.slug ?? lot?.lot_id ?? lot?.lotId ?? lot?.number ?? Math.random();
            // ⬇️ Передаём lot сразу под несколькими именами — ваш ListingCard возьмёт нужное
            return (
              <ListingCard
                key={String(key)}
                listing={lot}
                lot={lot}
                item={lot}
                data={lot}
              />
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .featured { padding: 18px 0 8px; }
        .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 12px; }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .title {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: .2px;
        }
        .all-link {
          color: #1E90FF;
          font-weight: 700;
          text-decoration: none;
          transition: opacity .15s ease, transform .15s ease;
        }
        .all-link:hover { opacity: .9; transform: translateY(-1px); }

        /* Сетка карточек — как на Торгах: 3 / 2 / 1 */
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1000px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
