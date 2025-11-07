import express from 'express';
import {
  loadInspectionSettings,
  normalizeInspectionPrice,
  saveInspectionPrice,
} from '../services/inspectionSettings.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const settings = await loadInspectionSettings();
    res.json({ settings });
  } catch (error) {
    console.error('admin inspection settings get error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.put('/', async (req, res) => {
  try {
    const rawPrice = req.body?.price ?? req.body?.amount ?? req.body?.finalAmount;
    const normalized = normalizeInspectionPrice(rawPrice);
    const saved = await saveInspectionPrice(normalized);
    res.json({ settings: saved });
  } catch (error) {
    console.error('admin inspection settings update error:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
