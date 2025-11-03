// backend/routes/adminAutotekaSettings.js
import express from 'express';
import { loadAutotekaSettings, normalizeAutotekaPrice, saveAutotekaPrice } from '../services/autotekaSettings.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const settings = await loadAutotekaSettings();
    res.json({ settings });
  } catch (error) {
    console.error('admin autoteka settings get error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/', async (req, res) => {
  try {
    const rawPrice = req.body?.price ?? req.body?.amount ?? req.body?.finalAmount;
    const normalized = normalizeAutotekaPrice(rawPrice);

    const saved = await saveAutotekaPrice(normalized);
    res.json({ settings: saved });
  } catch (error) {
    console.error('admin autoteka settings update error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
