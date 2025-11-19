import computeTradeTiming, { parseDateLike } from './tradeTiming';

function deriveSortTimestamp(listing, timing) {
  const details = listing?.details && typeof listing.details === 'object' ? listing.details : {};
  const lotDetails = details?.lot_details && typeof details.lot_details === 'object' ? details.lot_details : {};
  const candidates = [
    timing?.nextChangeDate,
    timing?.finishDate,
    timing?.startDate,
    listing?.sort_date,
    listing?.sortDate,
    listing?.date_start,
    listing?.dateStart,
    listing?.date_finish,
    listing?.dateFinish,
    listing?.created_at,
    listing?.createdAt,
    listing?.updated_at,
    listing?.updatedAt,
    listing?.published_at,
    listing?.publishedAt,
    details?.date_start,
    details?.dateStart,
    details?.date_finish,
    details?.dateFinish,
    lotDetails?.date_start,
    lotDetails?.dateStart,
    lotDetails?.date_finish,
    lotDetails?.dateFinish,
  ];

  let best = null;
  for (const candidate of candidates) {
    const date = candidate instanceof Date ? candidate : parseDateLike(candidate);
    if (!(date instanceof Date)) continue;
    const time = date.getTime();
    if (!Number.isFinite(time)) continue;
    if (best == null || time > best) {
      best = time;
    }
  }
  return best;
}

export function sortListingsByRelevance(listings) {
  if (!Array.isArray(listings)) return [];
  const now = new Date();
  return listings
    .map((item, index) => {
      const timing = computeTradeTiming(item, now);
      const statusKey = timing?.status?.key;
      const isFinished = statusKey === 'finished';
      const timestamp = deriveSortTimestamp(item, timing);
      return {
        item,
        index,
        isFinished,
        timestamp: timestamp != null ? timestamp : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.isFinished !== b.isFinished) {
        return a.isFinished ? 1 : -1;
      }
      if (a.timestamp !== b.timestamp) {
        return (b.timestamp ?? Number.NEGATIVE_INFINITY) - (a.timestamp ?? Number.NEGATIVE_INFINITY);
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

export { deriveSortTimestamp };
