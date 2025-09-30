import express from 'express';
import { pool, query } from '../db.js';

const router = express.Router();

const INITIAL_STATUS = 'Оплачен/Ожидание модерации';
const PRO_DISCOUNT_PERCENT = 30;

const PRICE_TIERS = [
  { max: 500_000, amount: 15000, label: 'Лот до 500 000 ₽' },
  { max: 1_500_000, amount: 25000, label: 'Лот до 1 500 000 ₽' },
  { max: 3_000_000, amount: 35000, label: 'Лот до 3 000 000 ₽' },
  { max: Number.POSITIVE_INFINITY, amount: 50000, label: 'Лот свыше 3 000 000 ₽' },
];

const PRICE_DETAIL_KEYS = [
  'current_price', 'currentPrice', 'current_price_number',
  'start_price', 'startPrice', 'starting_price', 'startingPrice',
  'min_price', 'minPrice', 'minimal_price', 'minimalPrice',
  'max_price', 'maxPrice', 'maximum_price', 'maximumPrice',
  'price', 'amount', 'value', 'sum', 'lot_price', 'lotPrice',
  'assessment_price', 'appraised_price', 'appraised_value',
  'deposit', 'deposit_amount', 'depositAmount', 'guarantee_deposit', 'guaranteeDeposit',
];

const MAX_LISTING_ID_LENGTH = 160;

function normalizeListingId(value) {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const truncated = Math.trunc(value);
    return truncated > 0 ? String(truncated) : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '');
  if (!compact) return null;

  const clean = compact.replace(/[\u0000-\u001f\u007f]/g, '');
  if (!clean) return null;

  if (/^[0-9]+$/.test(clean)) {
    const digits = clean.replace(/^0+/, '');
    if (!digits) return null;
    if (typeof BigInt === 'function') {
      try {
        const big = BigInt(digits);
        if (big > 0n) return big.toString();
      } catch {
        // fall through
      }
    }
    return digits;
  }

  return clean.length > MAX_LISTING_ID_LENGTH
    ? clean.slice(0, MAX_LISTING_ID_LENGTH)
    : clean;
}

function parseMoneyLike(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;

  const cleaned = String(value)
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function findNumeric(values) {
  for (const value of values) {
    const parsed = parseMoneyLike(value);
    if (parsed != null && Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function collectDetailCandidates(details) {
  if (!details || typeof details !== 'object') return [];
  const stack = [details];
  const candidates = [];
  const seen = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    for (const key of Object.keys(current)) {
      const value = current[key];
      if (value && typeof value === 'object') {
        stack.push(value);
      }
      if (PRICE_DETAIL_KEYS.includes(key)) {
        candidates.push(value);
      }
    }
  }
  return candidates;
}

function resolveLotPrice(listing) {
  if (!listing) return null;

  const candidates = [];
  const fields = [
    'current_price',
    'start_price',
    'min_price',
    'max_price',
    'price',
    'amount',
    'lot_price',
    'lotPrice',
  ];

  for (const field of fields) {
    if (listing[field] !== undefined) candidates.push(listing[field]);
  }

  const detailCandidates = collectDetailCandidates(listing.details);
  candidates.push(...detailCandidates);

  return findNumeric(candidates);
}

function computePricing(listing, subscriptionStatus) {
  const lotPrice = resolveLotPrice(listing);
  let tier = PRICE_TIERS[PRICE_TIERS.length - 1];

  if (lotPrice != null && Number.isFinite(lotPrice)) {
    for (const candidate of PRICE_TIERS) {
      if (lotPrice <= candidate.max) {
        tier = candidate;
        break;
      }
    }
  } else {
    tier = PRICE_TIERS[1] || PRICE_TIERS[0];
  }

  const basePrice = tier.amount;
  const normalizedSubscription = String(subscriptionStatus || 'free').trim().toLowerCase();
  const discountPercent = normalizedSubscription === 'pro' ? PRO_DISCOUNT_PERCENT : 0;
  const finalAmount = Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));

  return {
    basePrice,
    discountPercent,
    finalAmount,
    tierLabel: tier.label,
    lotPriceEstimate: lotPrice != null && Number.isFinite(lotPrice) ? Math.round(lotPrice) : null,
  };
}

function userUnreadCondition(alias = 'o') {
  return `(${alias}.user_last_viewed_at IS NULL OR ${alias}.user_last_viewed_at < ${alias}.updated_at)`;
}

async function fetchStatuses() {
  const sql = `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'trade_order_status'
    ORDER BY e.enumsortorder
  `;
  const r = await query(sql);
  return r.rows.map((x) => x.enumlabel);
}

router.post('/', async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'No user' });

  const rawId = req.body?.listingId ?? req.body?.listing_id ?? req.query?.listingId;
  const listingId = normalizeListingId(rawId);
  if (!listingId) return res.status(400).json({ error: 'listingId required' });

  let client;
  let transactionStarted = false;

  try {
    const listingQuery = await query(
      `SELECT id, title, start_price, current_price, min_price, max_price, price, amount, details
         FROM listings
        WHERE id::text = $1 OR source_id = $1
        LIMIT 1`,
      [listingId]
    );
    const listing = listingQuery.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const userQuery = await client.query(
      `SELECT id, balance, subscription_status, balance_frozen
         FROM users
        WHERE id::text = $1
        FOR UPDATE`,
      [String(userId)]
    );
    const user = userQuery.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.balance_frozen) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(423)
        .json({ error: 'BALANCE_FROZEN', message: 'Баланс пользователя заморожен' });
    }

    const pricing = computePricing(listing, user.subscription_status);

    const currentBalanceRaw = user.balance;
    const currentBalance = parseMoneyLike(currentBalanceRaw);
    if (currentBalance == null || !Number.isFinite(currentBalance) || currentBalance < pricing.finalAmount) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res
        .status(402)
        .json({ error: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств, пополните счет' });
    }

    const nextBalance = Number((currentBalance - pricing.finalAmount).toFixed(2));

    await client.query(
      'UPDATE users SET balance = $1, updated_at = now() WHERE id::text = $2',
      [nextBalance, String(userId)]
    );

    const inserted = await client.query(
      `INSERT INTO trade_orders (
         user_id, listing_id, status, base_price, discount_percent, final_amount, service_tier, lot_price_estimate, user_last_viewed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
       RETURNING *`,
      [
        String(userId),
        String(listing.id),
        INITIAL_STATUS,
        pricing.basePrice,
        pricing.discountPercent,
        pricing.finalAmount,
        pricing.tierLabel,
        pricing.lotPriceEstimate,
      ]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({ ok: true, order: inserted.rows[0] });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('trade order rollback error:', rollbackError);
      }
    }
    console.error('create trade order error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', text: String(error) });
  } finally {
    if (client) client.release();
  }
});

router.get('/statuses', async (_req, res) => {
  try {
    const statuses = await fetchStatuses();
    res.json({ statuses });
  } catch (error) {
    console.error('trade orders statuses error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const sql = `SELECT COUNT(*)::int AS count FROM trade_orders o WHERE o.user_id::text = $1 AND ${userUnreadCondition('o')}`;
    const r = await query(sql, [String(userId)]);
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error('trade orders unread count error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });

    const { status, markViewed } = req.query || {};
    const params = [String(userId)];
    const where = ['o.user_id::text = $1'];

    if (typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      where.push(`o.status = $${params.length}::trade_order_status`);
    }

    const sql = `
      SELECT o.*, ${userUnreadCondition('o')} AS user_unread,
             l.title AS listing_title
        FROM trade_orders o
        JOIN listings l ON l.id = o.listing_id
       WHERE ${where.join(' AND ')}
       ORDER BY o.created_at DESC
    `;
    const q = await query(sql, params);

    if (markViewed && String(markViewed).trim() !== '') {
      await query('UPDATE trade_orders SET user_last_viewed_at = now() WHERE user_id::text = $1', [String(userId)]);
    }

    res.json({ items: q.rows });
  } catch (error) {
    console.error('my trade orders error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export { computePricing };
export default router;
