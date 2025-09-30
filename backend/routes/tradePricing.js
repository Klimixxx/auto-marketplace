import express from 'express';
import { loadTradePriceTiers, tierToPublicShape, PRO_DISCOUNT_PERCENT } from '../services/tradePricing.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const tiers = await loadTradePriceTiers();
    res.json({
      tiers: tiers.map(tierToPublicShape).filter(Boolean),
      proDiscountPercent: PRO_DISCOUNT_PERCENT,
    });
  } catch (error) {
    console.error('trade pricing public list error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
