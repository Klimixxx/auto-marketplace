// components/FeaturedListings.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FeaturedCard from './FeaturedCard';

function api(path) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export default function FeaturedListings({ listings: initial }) {
  const [listings, setListings] = useState(initial || []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (initial && initial.length) return; // уже передали
      try {
        const res = await fetch(api('/api/listings?limit=6'));
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        if (!ignore) setListings(items.slice(0, 6));
      } catch (e) { /* необязательно логировать */ }
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
          {listings.slice(0, 6).map((l) => (
            <FeaturedCard
              key={l.id || l.guid || l.slug}
              l={l}
              detailHref={`/trades/${l.slug || l.id || l.guid || ''}`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .featured{ padding: 18px 0 8px; }
        .container{ width:100%; max-width:1200px; margin:0 auto; padding:0 12px; }
        .header{
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          margin-bottom:12px;
        }
        .title{
          margin:0;
          font-size:22px; font-weight:800; color:#0f172a; letter-spacing:.2px;
        }
        .all-link{
          color:#1E90FF; font-weight:700; text-decoration:none;
          transition:opacity .15s ease, transform .15s ease;
        }
        .all-link:hover{ opacity:.9; transform: translateY(-1px); }

        .grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap:16px;
        }
        @media (max-width: 1000px){
          .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 640px){
          .grid{ grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
