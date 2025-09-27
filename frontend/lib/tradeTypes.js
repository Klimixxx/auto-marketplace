export const TRADE_TYPE_LABELS = {
  public_offer: 'Публичное предложение',
  open_auction: 'Открытый аукцион',
  auction: 'Аукцион',
  offer: 'Торговое предложение',
};

export function normalizeTradeTypeCode(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (['public_offer', 'public offer', 'public-offer'].includes(lower)) return 'public_offer';
  if (['open_auction', 'open auction', 'open-auction'].includes(lower)) return 'open_auction';
  if (lower === 'offer' || lower.includes('публич') || lower.includes('offer') || lower.includes('предлож')) return 'public_offer';
  if (lower === 'auction' || lower.includes('аукцион') || lower.includes('auction')) return 'open_auction';
  return lower;
}

export function formatTradeTypeLabel(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (TRADE_TYPE_LABELS[lower]) return TRADE_TYPE_LABELS[lower];
  if (lower.includes('публич') || lower.includes('offer') || lower.includes('предлож')) return TRADE_TYPE_LABELS.public_offer;
  if (lower.includes('аукцион') || lower.includes('auction')) return TRADE_TYPE_LABELS.open_auction;
  return null;
}
