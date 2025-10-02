import express from 'express';
import { PRO_DISCOUNT_PERCENT, loadTradePricingSettings } from '../services/tradePricing.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const settings = await loadTradePricingSettings();
    res.json({
      depositPercent: settings.depositPercent,
      proDiscountPercent: PRO_DISCOUNT_PERCENT,
    });
  } catch (error) {
    console.error('trade pricing public list error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
