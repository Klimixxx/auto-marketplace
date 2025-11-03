-- 014_support_chat.sql (fixed)

-- Тикеты
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,                                           -- int4 ок, локальный PK
  client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- тип совпадает с users.id
  assigned_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,  -- тип совпадает с users.id
  subject TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  closed_at TIMESTAMP NULL,
  last_message_at TIMESTAMP NOT NULL DEFAULT now(),
  client_unread_count INT NOT NULL DEFAULT 0,
  support_unread_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_client ON support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message ON support_tickets(last_message_at DESC NULLS LAST);

-- Сообщения
CREATE TABLE IF NOT EXISTS support_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, -- int -> int, ок
  sender_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,           -- тип как у users.id
  sender_role TEXT NOT NULL,
  content TEXT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  file_name TEXT NULL,
  file_size INT NULL,
  file_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  is_system BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON support_messages(ticket_id, created_at ASC);
