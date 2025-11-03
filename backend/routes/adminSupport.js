// backend/routes/adminSupport.js
import express from 'express';
import {
  loadAdminOverview,
  assignTicket,
  closeTicket,
  loadAdminCounters,
  markTicketRead,
  canAccessTicket,
  fetchTicketById,
} from '../services/support.js';

const router = express.Router();

function parseTicketId(raw) {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}

router.get('/support/overview', async (req, res) => {
  try {
    const data = await loadAdminOverview(Number(req.userId));
    res.json(data);
  } catch (error) {
    console.error('admin support overview error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/support/counters', async (req, res) => {
  try {
    const counters = await loadAdminCounters(Number(req.userId));
    res.json(counters);
  } catch (error) {
    console.error('admin support counters error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/support/tickets/:ticketId/assign', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const ticket = await assignTicket(ticketId, Number(req.userId));
    res.json({ ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support assign error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR', meta: error.meta });
  }
});

router.post('/support/tickets/:ticketId/close', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const ticket = await closeTicket(ticketId, Number(req.userId));
    res.json({ ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support close error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.post('/support/tickets/:ticketId/read', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const allowed = await canAccessTicket(ticketId, { id: Number(req.userId), role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    await markTicketRead(ticketId, { id: Number(req.userId), role: req.user?.role });
    const ticket = await fetchTicketById(ticketId);
    res.json({ ok: true, ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support read error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

export default router;
