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

function getAgentId(req) {
  const id = req.user?.sub ?? req.user?.id ?? req.userId;
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed ? trimmed : null;
}


router.get('/overview', async (req, res) => {
  try {
    const agentId = getAgentId(req);
    if (!agentId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const data = await loadAdminOverview(agentId);
    res.json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support overview error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.get('/counters', async (req, res) => {
  try {
    const agentId = getAgentId(req);
    if (!agentId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const counters = await loadAdminCounters(agentId);
    res.json(counters);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support counters error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/:ticketId/assign', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const agentId = getAgentId(req);
    if (!agentId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const ticket = await assignTicket(ticketId, agentId);
    res.json({ ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support assign error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR', meta: error.meta });
  }
});

router.post('/tickets/:ticketId/close', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const agentId = getAgentId(req);
    if (!agentId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const ticket = await closeTicket(ticketId, agentId);
    res.json({ ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support close error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/:ticketId/read', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const agentId = getAgentId(req);
    if (!agentId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const allowed = await canAccessTicket(ticketId, { id: agentId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    await markTicketRead(ticketId, { id: agentId, role: req.user?.role });
    const ticket = await fetchTicketById(ticketId);
    res.json({ ok: true, ticket });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('admin support read error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

export default router;
