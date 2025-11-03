// frontend/components/support/SupportChatWidget.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiFetch, getToken, resolveApiUrl, resolveSocketUrl } from '../../lib/api';

const palette = {
  primary: 'var(--accent)',
  surface: 'var(--surface-1)',
  surfaceAlt: 'var(--surface-2)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  badgeBg: 'var(--accent-100)',
  badgeText: 'var(--accent-700)',
};

function formatTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDisplayName(user) {
  if (!user) return '';
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.userCode) return `ID ${user.userCode}`;
  if (user.phone) return user.phone;
  return '';
}


function normalizeMessages(list = []) {
  return list
    .filter(Boolean)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function MessageBubble({ message, isOwn }) {
  if (message?.isSystem || message?.senderRole === 'system' || message?.contentType === 'system') {
    return (
      <div className="system-message">
        <span>{message?.content}</span>
        <style jsx>{`
          .system-message {
            display: grid;
            justify-content: center;
            margin: 10px 0;
          }
          .system-message span {
            background: rgba(42, 101, 247, 0.08);
            color: var(--accent-700, ${palette.primary});
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 600;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }
  const isFile = message?.file && !['image'].includes(message.contentType);
  const isImage = message?.file && message.contentType === 'image';
  const fileUrl = message?.file?.url ? resolveApiUrl(message.file.url) : null;
  return (
    <div className={`bubble ${isOwn ? 'own' : 'remote'}`}>
      <div className="bubble-body">
        {message.content && !message.file && (
          <p className="bubble-text">{message.content}</p>
        )}
        {isImage && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="bubble-image-link">
            <img src={fileUrl} alt={message.file?.name || 'Вложение'} />
          </a>
        )}
        {isFile && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="bubble-file">
            📎 {message.file?.name || 'Файл'}
          </a>
        )}
      </div>
      <span className="bubble-time">{formatTime(message.createdAt)}</span>
      <style jsx>{`
        .bubble {
          display: grid;
          justify-content: ${isOwn ? 'flex-end' : 'flex-start'};
          margin: 4px 0;
        }
        .bubble-body {
          max-width: 320px;
          background: ${isOwn ? 'var(--accent-50)' : palette.surfaceAlt};
          color: ${palette.text};
          padding: 10px 12px;
          border-radius: 16px;
          border-bottom-${isOwn ? 'right' : 'left'}-radius: 4px;
          border: 1px solid ${isOwn ? 'var(--accent-200)' : palette.border};
          box-shadow: var(--shadow-xs);
        }
        .bubble-text {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 14px;
          line-height: 1.4;
        }
        .bubble-time {
          display: inline-block;
          margin-top: 2px;
          font-size: 11px;
          color: ${palette.muted};
        }
        .bubble-file {
          color: ${palette.primary};
          text-decoration: none;
          font-size: 14px;
        }
        .bubble-file:hover {
          text-decoration: underline;
        }
        .bubble-image-link {
          display: inline-block;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid ${palette.border};
        }
        .bubble-image-link img {
          max-width: 260px;
          display: block;
        }
      `}</style>
    </div>
  );
}

export default function SupportChatWidget() {
  const [isClient, setIsClient] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState({});
  const [connected, setConnected] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [showClosedBanner, setShowClosedBanner] = useState(false);
  const [closedInfo, setClosedInfo] = useState(null);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const typingTimeout = useRef(null);
  const previousTicketRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
    const token = getToken();
    if (!token) {
      setNeedsLogin(true);
      return;
    }
    setAuthToken(token);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let ignore = false;
    async function loadTicket() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/support/tickets/open');
        if (!res.ok) throw new Error('FAILED');
        const data = await res.json();
        if (ignore) return;
        setTicket(data.ticket || null);
        setMessages(normalizeMessages(data.messages || []));
      } catch (err) {
        if (!ignore) setError('Не удалось загрузить чат поддержки.');
        console.error('load support ticket error', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadTicket();
    return () => {
      ignore = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !isClient) return;
    if (socketRef.current) return;
    const baseUrl = resolveSocketUrl();
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: authToken },
    });
    socketRef.current = socket;
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('support:message', (message) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return normalizeMessages([...prev, message]);
      });
      if (message.senderRole === 'support') {
        setTyping({});
      }
    });
    socket.on('support:ticket', (payload) => {
      if (payload) {
        setTicket(payload);
      }
    });
    socket.on('support:typing', (payload) => {
      setTyping((prev) => {
        const next = { ...prev };
        if (!payload?.userId) return next;
        if (payload.isTyping) {
          next[payload.userId] = payload;
        } else {
          delete next[payload.userId];
        }
        return next;
      });
    });
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, isClient]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ticket?.id) return;
    socket.emit('support:join', { ticketId: ticket.id });
    return () => {
      socket.emit('support:leave', { ticketId: ticket.id });
    };
  }, [ticket?.id]);

  useEffect(() => {
    if (!listRef.current) return;
    if (showClosedBanner) {
      listRef.current.scrollTop = 0;
    } else {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, isOpen, showClosedBanner]);

  useEffect(() => {
    if (!ticket?.id || !isOpen) return;
    if (!ticket?.unread?.client) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      apiFetch(`/api/support/tickets/${ticket.id}/read`, { method: 'POST' }).catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ticket?.id, ticket?.unread?.client, isOpen]);

  useEffect(() => {
    const previous = previousTicketRef.current;
    const isClosed = ticket?.status === 'closed';
    if (isClosed) {
      if (!previous || previous.status !== 'closed') {
        setMessages([]);
      }
      setTyping({});
      setShowClosedBanner(true);
      setClosedInfo({
        closedAt: ticket?.closedAt || ticket?.updatedAt || ticket?.lastMessageAt,
        assignedName: formatDisplayName(ticket?.assigned),
      });
    } else {
      setShowClosedBanner(false);
      setClosedInfo(null);
    }
    previousTicketRef.current = ticket;
  }, [ticket]);

  const hasTicket = !!ticket?.id;
  const isTicketClosed = ticket?.status === 'closed';
  const canCompose = !loading && !needsLogin && !isTicketClosed;
  const otherTyping = useMemo(() => Object.values(typing || {}), [typing]);
  const assignedName = formatDisplayName(ticket?.assigned);

  function resetClosedState() {
    const socket = socketRef.current;
    if (socket && ticket?.id) {
      socket.emit('support:leave', { ticketId: ticket.id });
    }
    setTicket(null);
    setMessages([]);
    setShowClosedBanner(false);
    setClosedInfo(null);
    setComposer('');
    previousTicketRef.current = null;
  }

  async function sendMessage() {
    if (!composer.trim()) return;
    setSending(true);
    try {
      let currentTicket = ticket;
      if (!currentTicket?.id) {
        const ensureRes = await apiFetch('/api/support/tickets/open', { method: 'POST' });
        if (!ensureRes.ok) throw new Error('ensure failed');
        const ensureData = await ensureRes.json();
        currentTicket = ensureData.ticket || null;
        if (currentTicket) {
          setTicket(currentTicket);
          setMessages(normalizeMessages(ensureData.messages || []));
        }
      }
      if (!currentTicket?.id) throw new Error('no ticket');
      const res = await apiFetch(`/api/support/tickets/${currentTicket.id}/messages`, {
        method: 'POST',
        body: { content: composer },
      });
      if (!res.ok) throw new Error('send failed');
      setComposer('');
      const socket = socketRef.current;
      if (socket) socket.emit('support:typing', { ticketId: currentTicket.id, isTyping: false });
    } catch (err) {
      console.error('send support message error', err);
      setError('Не удалось отправить сообщение.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSending(false);
    }
  }

  async function handleFileUpload(event) {
    if (!ticket?.id) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError('Размер файла не должен превышать 25 МБ.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(resolveApiUrl(`/api/support/tickets/${ticket.id}/attachments`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('upload failed');
      await res.json();
    } catch (err) {
      console.error('support upload error', err);
      setError('Не удалось загрузить файл.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function handleInputChange(e) {
    setComposer(e.target.value);
    const socket = socketRef.current;
    if (!socket || !ticket?.id) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socket.emit('support:typing', { ticketId: ticket.id, isTyping: true });
    typingTimeout.current = setTimeout(() => {
      socket.emit('support:typing', { ticketId: ticket.id, isTyping: false });
    }, 1500);
  }

  const unreadCount = ticket?.unread?.client || 0;

  if (!isClient) return null;

  return (
    <div className="support-chat">
      <button className="support-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <span>Чат с поддержкой</span>
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        <span className={`status ${connected ? 'online' : 'offline'}`}>{connected ? 'online' : 'offline'}</span>
      </button>
      {isOpen && (
        <div className="support-panel">
          <div className="support-header">
            <div>
              <strong>Команда сопровождения</strong>
              {assignedName && !isTicketClosed ? (
                <p>Ваш тикет ведёт {assignedName}. Мы остаёмся на связи.</p>
              ) : (
                <p>Ответим на вопросы, поможем с документами и торгами.</p>
              )}
            </div>
          </div>
          <div className="support-body" ref={listRef}>
            {showClosedBanner && (
              <div className="ticket-closed">
                <div className="ticket-closed__title">ТИКЕТ ЗАКРЫТ</div>
                {closedInfo?.assignedName && (
                  <div className="ticket-closed__text">Специалист {closedInfo.assignedName} завершил обращение.</div>
                )}
                {closedInfo?.closedAt && (
                  <div className="ticket-closed__text">Закрыт в {formatTime(closedInfo.closedAt)}</div>
                )}
                <div className="ticket-closed__text">Если вопрос остался актуален — создайте новое обращение.</div>
                <button type="button" onClick={resetClosedState} className="ticket-closed__action">
                  Начать новый тикет
                </button>
              </div>
            )}
            {loading && <p className="muted">Загружаем историю...</p>}
            {needsLogin && <p className="muted">Авторизуйтесь, чтобы написать в поддержку.</p>}
            {!loading && !needsLogin && messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.senderRole !== 'support'} />
            ))}
            {!loading && messages.length === 0 && !needsLogin && !showClosedBanner && (
              <p className="muted">Опишите свой вопрос — специалист подключится в течение нескольких минут.</p>
            )}
            {otherTyping.length > 0 && !showClosedBanner && (
              <div className="typing">
                {otherTyping.map((t) => t.name || 'Специалист').join(', ')} печатает...
              </div>
            )}
          </div>
          <div className="support-composer">
            <textarea
              placeholder={
                needsLogin
                  ? 'Необходимо авторизоваться'
                  : isTicketClosed
                  ? 'Диалог завершён — создайте новый тикет'
                  : 'Напишите сообщение...'
              }
              value={composer}
              onChange={handleInputChange}
              disabled={!canCompose || sending || uploading}
              rows={2}
            />
            <div className="composer-actions">
              <label
                className={`attach ${uploading || !hasTicket || !canCompose ? 'disabled' : ''}`}
              >
                📎
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading || !hasTicket || !canCompose}
                />
              </label>
              <button onClick={sendMessage} disabled={!composer.trim() || sending || !canCompose}>
                Отправить
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      )}
      <style jsx>{`
        .support-chat {
          position: sticky;
          top: 20px;
          max-width: 420px;
          margin: 0 auto;
        }
        .support-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: ${palette.surface};
          border: 1px solid ${palette.border};
          border-radius: 16px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          color: ${palette.text};
          box-shadow: var(--shadow-sm);
        }
        .support-toggle:hover {
          border-color: ${palette.primary};
        }
        .badge {
          min-width: 22px;
          padding: 2px 8px;
          border-radius: 999px;
          background: ${palette.badgeBg};
          color: ${palette.badgeText};
          font-size: 12px;
          text-align: center;
        }
        .status {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .status.online {
          color: var(--green-600);
        }
        .status.offline {
          color: ${palette.muted};
        }
        .support-panel {
          margin-top: 12px;
          background: ${palette.surface};
          border: 1px solid ${palette.border};
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          height: 540px;
          box-shadow: var(--shadow-md);
        }
        .support-header {
          padding: 16px 20px;
          border-bottom: 1px solid ${palette.border};
        }
        .support-header strong {
          display: block;
          margin-bottom: 4px;
          font-size: 16px;
        }
        .support-header p {
          margin: 0;
          font-size: 13px;
          color: ${palette.muted};
        }
        .support-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 18px;
          display: flex;
          flex-direction: column;
        }
        .ticket-closed {
          border: 1px dashed var(--accent-200);
          border-radius: 16px;
          padding: 18px 16px;
          margin-bottom: 16px;
          background: var(--accent-50);
          display: grid;
          gap: 8px;
          text-align: center;
        }
        .ticket-closed__title {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-700);
        }
        .ticket-closed__text {
          font-size: 13px;
          color: var(--text-600);
        }
        .ticket-closed__action {
          margin-top: 4px;
          border: none;
          border-radius: 12px;
          background: ${palette.primary};
          color: #fff;
          padding: 8px 14px;
          font-size: 13px;
          cursor: pointer;
        }
        .ticket-closed__action:hover {
          opacity: 0.9;
        }
        .muted {
          font-size: 13px;
          color: ${palette.muted};
        }
        .typing {
          font-size: 12px;
          color: ${palette.primary};
          margin-top: auto;
        }
        .support-composer {
          padding: 12px 18px 18px;
          border-top: 1px solid ${palette.border};
          display: grid;
          gap: 8px;
        }
        textarea {
          resize: none;
          width: 100%;
          border-radius: 12px;
          border: 1px solid ${palette.border};
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
        }
        textarea:focus {
          border-color: ${palette.primary};
          box-shadow: 0 0 0 2px rgba(42, 101, 247, 0.1);
        }
        .composer-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .attach {
          display: inline-flex;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid ${palette.border};
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .attach:hover {
          border-color: ${palette.primary};
        }
        .attach.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .attach input {
          display: none;
        }
        .composer-actions button {
          background: ${palette.primary};
          border: none;
          color: white;
          padding: 9px 18px;
          border-radius: 12px;
          font-size: 14px;
          cursor: pointer;
        }
        .composer-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          font-size: 12px;
          color: var(--danger-600, #d1434b);
        }
        @media (max-width: 768px) {
          .support-chat {
            width: 100%;
          }
          .support-panel {
            height: 420px;
          }
        }
      `}</style>
    </div>
  );
}
