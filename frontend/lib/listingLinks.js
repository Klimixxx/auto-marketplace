export function resolveFedresursUrl(listing) {
  if (!listing) return null;
  const details = listing.details || listing.detailsJson || {};
  const rawPayload = listing.raw_payload || listing.rawPayload || {};
  const fedMeta = details.fedresurs_meta || details.fedresursMeta || rawPayload.fedresurs_data || {};

  const candidates = [
    listing.fedresurs_url,
    listing.fedresursUrl,
    details.fedresurs_url,
    details.fedresursUrl,
    details.lot_details?.fedresurs_url,
    details.lot_details?.fedresursUrl,
    fedMeta.url,
    fedMeta.link,
    fedMeta.card_url,
    fedMeta.cardUrl,
    fedMeta.trade_url,
    fedMeta.tradeUrl,
    fedMeta.possible_url,
    fedMeta.possibleUrl,
    fedMeta.document_url,
    fedMeta.documentUrl,
    fedMeta.links?.card,
    fedMeta.links?.detail,
    fedMeta.links?.self,
    listing.source_url,
    listing.sourceUrl,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFedresursCandidate(candidate);
    if (normalized) return formatFedresursUrl(normalized);
  }

  const idCandidates = [
    listing.fedresurs_id,
    listing.fedresursId,
    fedMeta.guid,
    fedMeta.number,
    fedMeta.id,
  ];

  for (const idCandidate of idCandidates) {
    const text = idCandidate != null ? String(idCandidate).trim() : '';
    if (!text) continue;
    const isGuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text);
    const basePath = isGuid ? 'biddings' : 'trade';
    return `https://fedresurs.ru/${basePath}/${encodeURIComponent(text)}`;
  }

  return null;
}

export function resolveTradePlatformUrl(listing) {
  if (!listing) return null;
  const details = listing.details || listing.detailsJson || {};
  const lotDetails = details.lot_details || details.lotDetails || {};
  const rawPayload = listing.raw_payload || listing.rawPayload || {};
  const parsed = rawPayload.parsed_data || rawPayload.parsedData || details.parsed_data || details.parsedData || {};
  const fedMeta = details.fedresurs_meta || details.fedresursMeta || rawPayload.fedresurs_data || {};

  const candidates = [
    listing.trade_platform_url,
    listing.tradePlatformUrl,
    details.trade_platform_url,
    details.tradePlatformUrl,
    lotDetails.trade_platform_url,
    lotDetails.tradePlatformUrl,
    lotDetails.platform_url,
    lotDetails.platformUrl,
    parsed.trade_platform_url,
    parsed.tradePlatformUrl,
    parsed.platform_url,
    parsed.platformUrl,
    parsed.url,
    fedMeta.platform_url,
    fedMeta.platformUrl,
    fedMeta.links?.platform,
    fedMeta.links?.trading_platform,
    listing.source_url,
    listing.sourceUrl,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeHttpCandidate(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeFedresursCandidate(candidate) {
  if (!candidate) return null;
  const text = String(candidate).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (!lower.includes('fedresurs')) return null;
  return normalizeHttpCandidate(text);
}

function normalizeHttpCandidate(candidate) {
  if (!candidate) return null;
  const text = String(candidate).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return text;
  }
  if (lower.startsWith('//')) {
    return `https:${text}`;
  }
  if (lower.startsWith('www.')) {
    return `https://${text}`;
  }
  if (/^[a-z]+:\/\//.test(lower)) {
    return text;
  }
  return `https://${text.replace(/^\/+/, '')}`;
}

function formatFedresursUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.host.replace(/^www\./i, '').toLowerCase();
    if (host === 'fedresurs.ru') {
      const match = parsed.pathname.match(/\/(?:biddings|trade|trades)\/([^/?#]+)/i);
      if (match && match[1]) {
        parsed.pathname = `/biddings/${match[1]}`;
        return parsed.toString();
      }
    }
  } catch (error) {
    // Ignore URL parsing issues and return the original string.
  }
  return url;
}
