// backend/routes/support.js
import express from 'express';
import multer from 'multer';
import { validate as isUUID } from 'uuid';
import {
  ensureActiveTicketForUser,
  findActiveTicketForUser,
  ensureListingTicketForUser,
  listMessages,
  addMessage,
  markTicketRead,
  canAccessTicket,
  saveUploadedFile,
  fetchTicketById,
  listRecentTicketsForUser,
} from '../services/support.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function parseTicketId(raw) {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getUserId(req) {
  const id = req.user?.id ?? req.userId;
  if (typeof id === 'string' && isUUID(id)) return id;
  return null;
}

router.get('/tickets/open', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const ticket = await findActiveTicketForUser(userId, { type: 'general' });
    if (!ticket) {
      return res.json({ ticket: null, messages: [] });
    }

    const messages = await listMessages(ticket.id, { limit: 200 });
    res.json({ ticket, messages });
  } catch (error) {
    console.error('support get open ticket error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/tickets/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const days = Number.parseInt(req.query.days, 10);
    const limit = Number.parseInt(req.query.limit, 10);
    const tickets = await listRecentTicketsForUser(userId, { days, limit });
    res.json({ tickets });
  } catch (error) {
    console.error('support tickets history error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/open', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const ticket = await ensureActiveTicketForUser(userId, { type: 'general' });
    if (!ticket) {
      return res.status(500).json({ error: 'FAILED_TO_CREATE_TICKET' });
    }
    const messages = await listMessages(ticket.id, { limit: 200 });
    res.json({ ticket, messages });
  } catch (error) {
    console.error('support open ticket error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/listing', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const listingId = req.body?.listingId ?? req.body?.listing_id ?? req.query?.listingId;
    const ticket = await ensureListingTicketForUser(userId, listingId);
    if (!ticket) {
      return res.status(500).json({ error: 'FAILED_TO_CREATE_TICKET' });
    }
    const messages = await listMessages(ticket.id, { limit: 200 });
    res.json({ ticket, messages });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('support open listing ticket error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.get('/tickets/:ticketId', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const allowed = await canAccessTicket(ticketId, { id: userId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    const ticket = await fetchTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ticket });
  } catch (error) {
    console.error('support get ticket error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/tickets/:ticketId/messages', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const allowed = await canAccessTicket(ticketId, { id: userId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    const messages = await listMessages(ticketId, { limit: req.query.limit });
    res.json({ messages });
  } catch (error) {
    console.error('support list messages error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/:ticketId/messages', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const allowed = await canAccessTicket(ticketId, { id: userId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });

    const message = await addMessage(ticketId, {
      senderId: userId,
      senderRole: req.user?.role,
      content: String(req.body?.content || '').trim() || null,
      contentType: req.body?.contentType || 'text',
    });
    res.json({ message });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('support add message error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/:ticketId/read', async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const allowed = await canAccessTicket(ticketId, { id: userId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });

    await markTicketRead(ticketId, { id: userId, role: req.user?.role });
    res.json({ ok: true });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('support mark read error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

router.post('/tickets/:ticketId/attachments', upload.single('file'), async (req, res) => {
  const ticketId = parseTicketId(req.params.ticketId);
  if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const allowed = await canAccessTicket(ticketId, { id: userId, role: req.user?.role });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' });

    const fileMeta = await saveUploadedFile(ticketId, req.file);
    const message = await addMessage(ticketId, {
      senderId: userId,
      senderRole: req.user?.role,
      content: null,
      contentType: fileMeta?.mime,
      fileMeta,
    });
    res.json({ message });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('support attachment upload error:', error);
    res.status(status).json({ error: error.message || 'INTERNAL_ERROR' });
  }
});

export default router;
