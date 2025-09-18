function formatPrice(value, currency = 'RUB') {
  try {
    if (value == null || value === '') return null;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value ? `${value} ${currency}` : null;
  }
}

function pickPhotoUrl(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed || null;
  }
  if (typeof photo === 'object') {
    return photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
  }
  return null;
}

function getCoverPhoto(listing) {
  const photos = Array.isArray(listing?.details?.photos) ? listing.details.photos : [];
  for (const photo of photos) {
    const url = pickPhotoUrl(photo);
    if (url) return url;
  }
  return null;
}

export default function ListingCard({ l, onFav, fav }) {
  const cover = getCoverPhoto(l);
  const price = l.current_price ?? l.start_price;
  const priceLabel = formatPrice(price, l.currency || 'RUB');
  const description = l.description || l.details?.lot_details?.description || '';
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}…` : description;

  return (
    <div className="card">
      {cover && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
          <img
            src={cover}
            alt={l.title || 'Объявление'}
            style={{ width: '100%', height: 160, objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ fontWeight: 600 }}>{l.title}</div>
          <div className="badge" style={{ marginTop: 8 }}>{l.asset_type || '—'}</div>
        </div>
        <button className="button" onClick={onFav}>
          {fav ? '★ В избранном' : '☆ В избранное'}
        </button>
      </div>

      <div style={{ marginTop: 8, color: 'var(--muted)' }}>
        Регион: {l.region || '—'}
        {priceLabel ? ` • Цена: ${priceLabel}` : ''}
      </div>

      {shortDescription && (
        <div style={{ marginTop: 8, fontSize: 14, color: '#333', whiteSpace: 'pre-line' }}>
          {shortDescription}
        </div>
      )}

      {l.source_url && (
        <div style={{ marginTop: 12 }}>
          <a href={l.source_url} target="_blank" rel="noreferrer" className="link">
            Открыть источник →
          </a>
        </div>
      )}
    </div>
  );
}
