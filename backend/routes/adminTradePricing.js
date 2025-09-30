import express from 'express';
import { query } from '../db.js';
import { loadTradePriceTiers, tierToPublicShape } from '../services/tradePricing.js';

const router = express.Router();

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSortOrder(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toRowShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    amount: row.amount != null ? Number(row.amount) : null,
    maxAmount: row.max_amount != null ? Number(row.max_amount) : null,
    sortOrder: row.sort_order != null ? Number(row.sort_order) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listResponse(res) {
  const { rows } = await query('SELECT * FROM trade_pricing_tiers ORDER BY sort_order ASC, max_amount ASC NULLS LAST, id ASC');
  const effective = await loadTradePriceTiers();
  res.json({
    items: rows.map(toRowShape).filter(Boolean),
    effective: effective.map(tierToPublicShape).filter(Boolean),
  });
}

router.get('/', async (_req, res) => {
  try {
    await listResponse(res);
  } catch (error) {
    console.error('admin trade pricing list error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/', async (req, res) => {
  try {
    const label = String(req.body?.label || '').trim();
    if (!label) return res.status(400).json({ error: 'LABEL_REQUIRED' });

    const amount = parseNumeric(req.body?.amount ?? req.body?.price ?? req.body?.basePrice);
    if (amount == null || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'BAD_AMOUNT' });
    }

    const maxAmountInput = req.body?.maxAmount ?? req.body?.max_amount ?? req.body?.limit;
    const maxAmountParsed = parseNumeric(maxAmountInput);
    const maxAmount = maxAmountParsed != null && Number.isFinite(maxAmountParsed) && maxAmountParsed > 0
      ? Math.round(maxAmountParsed)
      : null;

    let sortOrder = parseSortOrder(req.body?.sortOrder ?? req.body?.sort_order);
    if (sortOrder == null) {
      const { rows: [{ max_order }] } = await query(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM trade_pricing_tiers'
      );
      sortOrder = Number(max_order || 0) + 10;
    }

    const inserted = await query(
      `INSERT INTO trade_pricing_tiers (label, amount, max_amount, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
       RETURNING *`,
      [label, Math.round(amount), maxAmount, sortOrder]
    );

    res.json({ item: toRowShape(inserted.rows[0]) });
  } catch (error) {
    console.error('admin trade pricing create error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const labelRaw = req.body?.label;
    const amountRaw = req.body?.amount ?? req.body?.price ?? req.body?.basePrice;
    const maxAmountRaw = req.body?.maxAmount ?? req.body?.max_amount ?? req.body?.limit;
    const sortOrderRaw = req.body?.sortOrder ?? req.body?.sort_order;

    const updates = [];
    const values = [];

    if (labelRaw !== undefined) {
      const label = String(labelRaw || '').trim();
      if (!label) return res.status(400).json({ error: 'LABEL_REQUIRED' });
      values.push(label);
      updates.push(`label = $${values.length}`);
    }

    if (amountRaw !== undefined) {
      const amount = parseNumeric(amountRaw);
      if (amount == null || !Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'BAD_AMOUNT' });
      }
      values.push(Math.round(amount));
      updates.push(`amount = $${values.length}`);
    }

    if (maxAmountRaw !== undefined) {
      const maxAmountParsed = parseNumeric(maxAmountRaw);
      const normalized = maxAmountParsed != null && Number.isFinite(maxAmountParsed) && maxAmountParsed > 0
        ? Math.round(maxAmountParsed)
        : null;
      values.push(normalized);
      updates.push(`max_amount = $${values.length}`);
    }

    if (sortOrderRaw !== undefined) {
      const sortOrderParsed = parseSortOrder(sortOrderRaw);
      if (sortOrderParsed == null) {
        return res.status(400).json({ error: 'BAD_SORT_ORDER' });
      }
      values.push(sortOrderParsed);
      updates.push(`sort_order = $${values.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'NO_FIELDS' });

    values.push(id);
    const updated = await query(
      `UPDATE trade_pricing_tiers
          SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${values.length}
        RETURNING *`,
      values
    );

    if (!updated.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json({ item: toRowShape(updated.rows[0]) });
  } catch (error) {
    console.error('admin trade pricing update error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'BAD_ID' });

    const deleted = await query('DELETE FROM trade_pricing_tiers WHERE id = $1 RETURNING id', [id]);
    if (!deleted.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json({ ok: true });
  } catch (error) {
    console.error('admin trade pricing delete error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
