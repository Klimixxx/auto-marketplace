import express from 'express';
import { loadTradePricingSettings, normalizeDepositPercent, saveTradePricingSettings } from '../services/tradePricing.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const settings = await loadTradePricingSettings();
    res.json({ settings });
  } catch (error) {
    console.error('admin trade pricing list error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/', async (req, res) => {
  try {
    const percentRaw = req.body?.depositPercent ?? req.body?.deposit_percent ?? req.body?.percent;
    const normalizedPercent = normalizeDepositPercent(percentRaw);

    if (!Number.isFinite(normalizedPercent)) {
      return res.status(400).json({ error: 'BAD_PERCENT' });
    }

    const saved = await saveTradePricingSettings(normalizedPercent);
    res.json({ settings: saved });
  } catch (error) {
    console.error('admin trade pricing update error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
