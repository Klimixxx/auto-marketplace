// backend/services/support.js
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { getSocket } from './socket.js';
import { validate as isUUID } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'support');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureAgentId(agentId) {
  if (typeof agentId !== 'string' || !isUUID(agentId)) {
    const err = new Error('INVALID_AGENT');
    err.statusCode = 401;
    throw err;
  }
  return agentId;
}

function mapTicketRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    subject: row.subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    lastMessageAt: row.last_message_at,
    unread: {
      client: toNumber(row.client_unread_count),
      support: toNumber(row.support_unread_count),
    },
    client: {
      id: row.client_id,
      name: row.client_name,
      phone: row.client_phone,
      userCode: row.client_code,
      email: row.client_email,
    },
    assigned: row.assigned_id
      ? {
          id: row.assigned_id,
          name: row.assigned_name,
          phone: row.assigned_phone,
          userCode: row.assigned_code,
          email: row.assigned_email,
        }
      : null,
  };
}

function mapMessageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    sender: row.sender_id
      ? {
          id: row.sender_id,
          name: row.sender_name,
          phone: row.sender_phone,
          userCode: row.sender_code,
        }
      : null,
    content: row.content,
    contentType: row.content_type,
    file: row.file_url
      ? {
          url: row.file_url,
          name: row.file_name,
          size: toNumber(row.file_size, null),
        }
      : null,
    createdAt: row.created_at,
    isSystem: !!row.is_system,
  };
}

const TICKET_SELECT = `
  SELECT
    t.id,
    t.client_id,
    t.assigned_id,
    t.subject,
    t.status,
    t.created_at,
    t.updated_at,
    t.closed_at,
    t.last_message_at,
    t.client_unread_count,
    t.support_unread_count,
    cu.name  AS client_name,
    cu.phone AS client_phone,
    cu.email AS client_email,
    cu.user_code AS client_code,
    au.name  AS assigned_name,
    au.phone AS assigned_phone,
    au.email AS assigned_email,
    au.user_code AS assigned_code
  FROM support_tickets t
  JOIN users cu ON cu.id = t.client_id
  LEFT JOIN users au ON au.id = t.assigned_id
`;

export async function fetchTicketById(ticketId) {
  const { rows } = await query(`${TICKET_SELECT} WHERE t.id = $1`, [ticketId]);
  return mapTicketRow(rows[0]);
}

export async function ensureActiveTicketForUser(clientId) {
  if (typeof clientId !== 'string' || !isUUID(clientId)) {
    const err = new Error('INVALID_USER_ID');
    err.statusCode = 401;
    throw err;
  }

  const existing = await query(
    `${TICKET_SELECT}
     WHERE t.client_id = $1
       AND t.status IN ('open', 'assigned')
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [clientId]
  );
  if (existing.rows[0]) {
    return mapTicketRow(existing.rows[0]);
  }

  const inserted = await query(
    `INSERT INTO support_tickets
       (client_id, status, created_at, updated_at, last_message_at)
     VALUES ($1::uuid, 'open', now(), now(), now())
     RETURNING id`,
    [clientId]
  );

  const ticketId = inserted.rows[0]?.id;
  const created = ticketId ? await fetchTicketById(ticketId) : null;
  if (created) {
    emitTicketToAgents(created, 'created');
  }
  return created;
}

export async function listMessages(ticketId, { limit = 200 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const { rows } = await query(
    `SELECT
        m.id,
        m.ticket_id,
        m.sender_id,
        m.sender_role,
        m.content,
        m.content_type,
        m.file_name,
        m.file_size,
        m.file_url,
        m.created_at,
        m.is_system,
        u.name  AS sender_name,
        u.phone AS sender_phone,
        u.user_code AS sender_code
      FROM support_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2`,
    [ticketId, capped]
  );
  return rows.map(mapMessageRow);
}

async function getTicketParticipants(ticketId) {
  const { rows } = await query(
    `SELECT id, client_id, assigned_id, status
       FROM support_tickets
      WHERE id = $1`,
    [ticketId]
  );
  return rows[0] || null;
}

function normalizeRole(role) {
  return role === 'admin' ? 'support' : 'client';
}

function buildFileInfo(ticketId, originalName) {
  const safeName = path.basename(originalName || 'file');
  const ext = path.extname(safeName);
  const hash = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${hash}${ext}`;
  const dir = path.join(uploadsRoot, String(ticketId));
  ensureDirSync(dir);
  const absolute = path.join(dir, filename);
  const relative = `/uploads/support/${ticketId}/${filename}`;
  return { absolute, relative, filename };
}

function resolveContentType(uploadedMime) {
  if (!uploadedMime) return 'file';
  if (uploadedMime.startsWith('image/')) return 'image';
  if (uploadedMime.startsWith('video/')) return 'video';
  return 'file';
}

export async function saveUploadedFile(ticketId, file) {
  if (!file) throw new Error('FILE_REQUIRED');
  const { absolute, relative } = buildFileInfo(ticketId, file.originalname);
  ensureDirSync(path.dirname(absolute));
  fs.writeFileSync(absolute, file.buffer);
  return { url: relative, size: file.size, name: file.originalname, mime: file.mimetype };
}

async function emitTicketSnapshot(ticketId) {
  const io = getSocket();
  if (!io) return;
  const ticket = await fetchTicketById(ticketId);
  if (!ticket) return;
  io.to(`support:ticket:${ticketId}`).emit('support:ticket', ticket);
  emitTicketToAgents(ticket, 'update');
}

export function emitTicketToAgents(ticket, reason = 'update') {
  const io = getSocket();
  if (!io || !ticket) return;
  io.to('support:agents').emit('support:ticket-update', { ticket, reason });
}

export async function addMessage(ticketId, { senderId, senderRole, content, contentType, fileMeta }) {
  if (senderId && (!isUUID(senderId))) {
    const err = new Error('INVALID_SENDER_ID');
    err.statusCode = 401;
    throw err;
  }

  const participants = await getTicketParticipants(ticketId);
  if (!participants) {
    const err = new Error('TICKET_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }

  const normalizedRole = normalizeRole(senderRole);

  // === АВТО-НАЗНАЧЕНИЕ ДЛЯ САППОРТА ===
  if (normalizedRole === 'support') {
    if (participants.status === 'closed') {
      const err = new Error('TICKET_CLOSED');
      err.statusCode = 409;
      throw err;
    }

    // если тикет никому не назначен — назначаем на отправителя и переводим в assigned
    if (!participants.assigned_id) {
      await query(
        `UPDATE support_tickets
           SET assigned_id = $2::uuid,
               status = 'assigned',
               updated_at = now()
         WHERE id = $1`,
        [ticketId, senderId]
      );
      participants.assigned_id = senderId;
      participants.status = 'assigned';
    } else if (participants.assigned_id !== senderId) {
      // если уже назначен другому — запрещаем отвечать
      const err = new Error('NOT_ASSIGNED');
      err.statusCode = 403;
      throw err;
    }
  }

  if (normalizedRole === 'client' && participants.client_id !== senderId) {
    const err = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }

  if (!content && !fileMeta) {
    const err = new Error('EMPTY_MESSAGE');
    err.statusCode = 400;
    throw err;
  }

  const effectiveContentType = fileMeta?.mime ? resolveContentType(fileMeta.mime) : contentType || 'text';
  const effectiveContent = content || fileMeta?.url || null;

  const { rows: insertedRows } = await query(
    `INSERT INTO support_messages
       (ticket_id, sender_id, sender_role, content, content_type, file_name, file_size, file_url, created_at)
     VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, now())
     RETURNING id`,
    [
      ticketId,
      senderId || null,
      normalizedRole,
      effectiveContent,
      effectiveContentType,
      fileMeta?.name || null,
      fileMeta?.size || null,
      fileMeta?.url || null,
    ]
  );
  const messageId = insertedRows[0]?.id;

  // статус тикета после сообщения
  let statusTransition = participants.status;
  if (normalizedRole === 'client' && participants.status === 'closed') {
    statusTransition = participants.assigned_id ? 'assigned' : 'open';
  }

  const updateQuery = `
    UPDATE support_tickets
       SET
         updated_at = now(),
         last_message_at = now(),
         status = $3,
         client_unread_count = CASE WHEN $2 = 'support' THEN client_unread_count + 1 ELSE 0 END,
         support_unread_count = CASE WHEN $2 = 'client' THEN support_unread_count + 1 ELSE 0 END
     WHERE id = $1`;
  await query(updateQuery, [ticketId, normalizedRole, statusTransition]);

  const message = messageId ? await fetchMessageById(messageId) : null;
  const io = getSocket();
  if (io && message) {
    io.to(`support:ticket:${ticketId}`).emit('support:message', message);
    emitTicketSnapshot(ticketId);
  } else {
    await emitTicketSnapshot(ticketId);
  }

  return message;
}

export async function fetchMessageById(messageId) {
  const { rows } = await query(
    `SELECT
        m.id,
        m.ticket_id,
        m.sender_id,
        m.sender_role,
        m.content,
        m.content_type,
        m.file_name,
        m.file_size,
        m.file_url,
        m.created_at,
        m.is_system,
        u.name  AS sender_name,
        u.phone AS sender_phone,
        u.user_code AS sender_code
      FROM support_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.id = $1
      LIMIT 1`,
    [messageId]
  );
  return mapMessageRow(rows[0]);
}

export async function markTicketRead(ticketId, viewer) {
  const role = normalizeRole(viewer.role);
  const viewerId = viewer.id;
  const participants = await getTicketParticipants(ticketId);
  if (!participants) {
    const err = new Error('TICKET_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }
  if (role === 'client' && participants.client_id !== viewerId) {
    const err = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }
  if (role === 'support' && participants.assigned_id && participants.assigned_id !== viewerId) {
    const err = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }

  const column = role === 'support' ? 'support_unread_count' : 'client_unread_count';
  await query(
    `UPDATE support_tickets
        SET ${column} = 0,
            updated_at = CASE WHEN ${column} <> 0 THEN now() ELSE updated_at END
      WHERE id = $1`,
    [ticketId]
  );
  await emitTicketSnapshot(ticketId);
}

export async function loadAdminOverview(agentId) {
  const validAgentId = ensureAgentId(agentId);
  const queueRows = await query(
    `${TICKET_SELECT}
      WHERE t.status = 'open'
      ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      LIMIT 50`
  );
  const myRows = await query(
    `${TICKET_SELECT}
      WHERE t.status <> 'closed' AND t.assigned_id = $1::uuid
      ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC
      LIMIT 50`,
    [validAgentId]
  );
  return {
    queue: queueRows.rows.map(mapTicketRow),
    my: myRows.rows.map(mapTicketRow),
  };
}

export async function assignTicket(ticketId, agentId) {
  const validAgentId = ensureAgentId(agentId);
  const participants = await getTicketParticipants(ticketId);
  if (!participants) {
    const err = new Error('TICKET_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }
  if (participants.status === 'closed') {
    const err = new Error('TICKET_CLOSED');
    err.statusCode = 409;
    throw err;
  }
  if (participants.assigned_id && participants.assigned_id !== agentId) {
    const err = new Error('ALREADY_ASSIGNED');
    err.statusCode = 409;
    err.meta = { assignedId: participants.assigned_id };
    throw err;
  }
  await query(
    `UPDATE support_tickets
        SET assigned_id = $2::uuid,
            status = 'assigned',
            updated_at = now()
      WHERE id = $1`,
    [ticketId, validAgentId]
  );
  const ticket = await fetchTicketById(ticketId);
  emitTicketSnapshot(ticketId);
  emitTicketToAgents(ticket, 'assigned');
  return ticket;
}

export async function closeTicket(ticketId, agentId) {
  const validAgentId = ensureAgentId(agentId);
  const participants = await getTicketParticipants(ticketId);
  if (!participants) {
    const err = new Error('TICKET_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }
  if (participants.assigned_id !== validAgentId) {
    const err = new Error('NOT_ASSIGNED');
    err.statusCode = 403;
    throw err;
  }
  await query(
    `UPDATE support_tickets
        SET status = 'closed',
            closed_at = now(),
            updated_at = now()
      WHERE id = $1`,
    [ticketId]
  );
  const ticket = await fetchTicketById(ticketId);
  emitTicketSnapshot(ticketId);
  emitTicketToAgents(ticket, 'closed');
  return ticket;
}

export async function canAccessTicket(ticketId, viewer) {
  const participants = await getTicketParticipants(ticketId);
  if (!participants) return false;
  if (viewer.role === 'admin') return true;
  return participants.client_id === viewer.id;
}

export async function canAccessTicket(ticketId, viewer) {
  const participants = await getTicketParticipants(ticketId);
  if (!participants) return false;
  if (viewer.role === 'admin') return true;
  return participants.client_id === viewer.id;
}

export async function loadAdminCounters(agentId) {
  const validAgentId = ensureAgentId(agentId);
  const [queueRes, myUnreadRes, myActiveRes] = await Promise.all([
    query(`SELECT count(*)::int AS cnt FROM support_tickets WHERE status = 'open'`),
    query(
      `SELECT count(*)::int AS cnt
         FROM support_tickets
        WHERE assigned_id = $1::uuid
          AND status <> 'closed'
          AND support_unread_count > 0`,
      [validAgentId]
    ),
    query(
      `SELECT count(*)::int AS cnt
         FROM support_tickets
        WHERE assigned_id = $1::uuid
          AND status <> 'closed'`,
      [validAgentId]
    ),
  ]);
  return {
    queue: toNumber(queueRes.rows[0]?.cnt),
    myUnread: toNumber(myUnreadRes.rows[0]?.cnt),
    myActive: toNumber(myActiveRes.rows[0]?.cnt),
  };
}

export function formatDisplayName(user) {
  if (!user) return '';
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.userCode) return `ID ${user.userCode}`;
  return user.phone || '';
}

export function resolveUploadsRoot() {
  ensureDirSync(uploadsRoot);
  return uploadsRoot;
}
