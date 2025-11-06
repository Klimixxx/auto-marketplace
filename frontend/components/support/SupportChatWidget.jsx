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

function formatDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatStatusLabel(status) {
  switch (status) {
    case 'open':
      return 'Ожидает специалиста';
    case 'assigned':
      return 'В работе';
    case 'closed':
      return 'Закрыт';
    default:
      return '—';
  }
}

function formatMessagePreview(message) {
  if (!message) return 'Нет сообщений';
  if (message.isSystem) return message.content || 'Системное уведомление';
  if (message.file) {
    return message.file.name ? `Вложение: ${message.file.name}` : 'Вложение';
  }
  if (message.content && message.content.trim()) {
    const text = message.content.trim();
    return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  }
  return 'Сообщение';
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
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [historyMessagesLoading, setHistoryMessagesLoading] = useState(false);
  const [historyMessagesError, setHistoryMessagesError] = useState(null);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const typingTimeout = useRef(null);
  const previousTicketRef = useRef(null);
  const lastTicketIdRef = useRef(null);
  const lastTicketStatusRef = useRef(null);

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
    if (!authToken) {
      setHistory([]);
      setSelectedHistoryId(null);
      setHistoryMessages([]);
    }
  }, [authToken]);

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
    if (!authToken) return;
    let ignore = false;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await apiFetch('/api/support/tickets/history?days=30');
        if (!res.ok) throw new Error('FAILED');
        const data = await res.json();
        if (ignore) return;
        setHistory(Array.isArray(data?.tickets) ? data.tickets : []);
      } catch (err) {
        console.error('load support history error', err);
        if (!ignore) setHistoryError('Не удалось загрузить историю тикетов.');
      } finally {
        if (!ignore) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => {
      ignore = true;
    };
  }, [authToken, historyReloadKey]);

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

  useEffect(() => {
    const currentId = ticket?.id || null;
    if (currentId && lastTicketIdRef.current !== currentId) {
      setHistoryReloadKey((key) => key + 1);
    }
    if (!currentId && lastTicketIdRef.current) {
      setHistoryReloadKey((key) => key + 1);
    }
    lastTicketIdRef.current = currentId;
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket?.id) {
      lastTicketStatusRef.current = null;
      return;
    }
    if (lastTicketStatusRef.current && lastTicketStatusRef.current !== ticket.status) {
      setHistoryReloadKey((key) => key + 1);
    }
    lastTicketStatusRef.current = ticket.status;
  }, [ticket?.status, ticket?.id]);

  useEffect(() => {
    if (ticket?.id && selectedHistoryId !== ticket.id) {
      setSelectedHistoryId(ticket.id);
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (!history.length) {
      if (selectedHistoryId) setSelectedHistoryId(null);
      return;
    }
    setSelectedHistoryId((prev) => {
      if (prev && history.some((item) => item.id === prev)) return prev;
      if (ticket?.id && history.some((item) => item.id === ticket.id)) return ticket.id;
      return history[0]?.id || null;
    });
  }, [history, ticket?.id]);

  const hasTicket = !!ticket?.id;
  const isTicketClosed = ticket?.status === 'closed';
  const canCompose = !loading && !needsLogin && !isTicketClosed;
  const otherTyping = useMemo(() => Object.values(typing || {}), [typing]);
  const assignedName = formatDisplayName(ticket?.assigned);
  const lastActiveMessage = messages[messages.length - 1] || null;
  const queuePositionRaw = ticket?.queuePosition;
  const queueTotalRaw = ticket?.queueTotal;
  const queuePosition =
    queuePositionRaw != null && Number.isFinite(Number(queuePositionRaw))
      ? Number(queuePositionRaw)
      : null;
  const queueTotal =
    queueTotalRaw != null && Number.isFinite(Number(queueTotalRaw)) ? Number(queueTotalRaw) : null;
  const showQueueInfo = !isTicketClosed && queuePosition != null && queuePosition > 0;
  const selectedHistoryTicket =
    selectedHistoryId && ticket?.id && selectedHistoryId === ticket.id
      ? { ...ticket, lastMessage: lastActiveMessage }
      : history.find((item) => item.id === selectedHistoryId) || null;

  useEffect(() => {
    if (!ticket?.id) return;
    setHistory((prev) => {
      if (!Array.isArray(prev)) return prev;
      const idx = prev.findIndex((item) => item.id === ticket.id);
      if (idx === -1) return prev;
      const updated = prev.slice();
      const lastMessage = messages[messages.length - 1] || null;
      const currentItem = { ...updated[idx], ...ticket };
      if (lastMessage) {
        currentItem.lastMessage = { ...(currentItem.lastMessage || {}), ...lastMessage };
      }
      currentItem.queuePosition = ticket.queuePosition ?? currentItem.queuePosition ?? null;
      currentItem.queueTotal = ticket.queueTotal ?? currentItem.queueTotal ?? null;
      updated[idx] = currentItem;
      return updated;
    });
  }, [messages, ticket]);

  useEffect(() => {
    if (!selectedHistoryId) {
      setHistoryMessages([]);
      setHistoryMessagesError(null);
      return;
    }
    if (needsLogin || !authToken) return;
    if (selectedHistoryId === ticket?.id) {
      setHistoryMessages(messages);
      setHistoryMessagesError(null);
      setHistoryMessagesLoading(false);
      return;
    }
    let ignore = false;
    setHistoryMessagesLoading(true);
    setHistoryMessagesError(null);
    setHistoryMessages([]);
    async function loadMessages() {
      try {
        const res = await apiFetch(`/api/support/tickets/${selectedHistoryId}/messages?limit=200`);
        if (!res.ok) throw new Error('FAILED');
        const data = await res.json();
        if (ignore) return;
        setHistoryMessages(normalizeMessages(data.messages || []));
      } catch (err) {
        console.error('load support ticket history messages error', err);
        if (!ignore) setHistoryMessagesError('Не удалось загрузить переписку.');
      } finally {
        if (!ignore) setHistoryMessagesLoading(false);
      }
    }
    loadMessages();
    return () => {
      ignore = true;
    };
  }, [selectedHistoryId, ticket?.id, needsLogin, authToken]);

  useEffect(() => {
    if (selectedHistoryId === ticket?.id) {
      setHistoryMessages(messages);
    }
  }, [messages, selectedHistoryId, ticket?.id]);

  function handleSelectHistoryTicket(id) {
    setSelectedHistoryId(id);
  }

  function handleRefreshHistory() {
    setHistoryReloadKey((key) => key + 1);
  }

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
        <div className="support-layout">
          <div className="support-panel">
            <div className="support-header">
              <div>
                <strong>Команда сопровождения</strong>
                {assignedName && !isTicketClosed ? (
                  <p>Ваш тикет ведёт {assignedName}. Мы остаёмся на связи.</p>
                ) : (
                  <p>Ответим на вопросы, поможем с документами и торгами.</p>
                )}
                {showQueueInfo && (
                  <p className="queue-info">
                    Ваша позиция в очереди: {queuePosition}
                    {queueTotal && queueTotal > 0 ? ` из ${queueTotal}` : ''}
                  </p>
                )}
                <div className="ticket-closed__text">Если вопрос остался актуален — создайте новое обращение.</div>
                <button type="button" onClick={resetClosedState} className="ticket-closed__action">
                  Начать новый тикет
                </button>
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
                <label className={`attach ${uploading || !hasTicket || !canCompose ? 'disabled' : ''}`}>
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
          <aside className="support-history">
            <div className="history-header">
              <strong>История обращений (30 дней)</strong>
              <button
                type="button"
                className="history-refresh"
                onClick={handleRefreshHistory}
                disabled={historyLoading || needsLogin}
              >
                Обновить
              </button>
            </div>
            {needsLogin ? (
              <p className="muted">Авторизуйтесь, чтобы увидеть историю обращений.</p>
            ) : (
              <div className="history-content">
                {historyError && <p className="error">{historyError}</p>}
                <div className="history-list-wrapper">
                  {historyLoading && history.length === 0 ? (
                    <p className="muted">Загружаем историю...</p>
                  ) : (
                    <ul className="history-list">
                      {history.map((item) => {
                        const isActive = selectedHistoryId === item.id;
                        const itemQueuePos =
                          item.queuePosition != null && Number(item.queuePosition) > 0
                            ? Number(item.queuePosition)
                            : null;
                        const itemQueueTotal =
                          item.queueTotal != null && Number(item.queueTotal) > 0
                            ? Number(item.queueTotal)
                            : null;
                        const timestamp =
                          item.lastMessage?.createdAt || item.updatedAt || item.lastMessageAt || item.createdAt;
                        const specialist = item.assigned ? formatDisplayName(item.assigned) : null;
                        return (
                          <li key={item.id} className={`history-item ${isActive ? 'active' : ''}`}>
                            <button type="button" onClick={() => handleSelectHistoryTicket(item.id)}>
                              <div className="history-item__row">
                                <span className={`history-status status-${item.status || 'unknown'}`}>
                                  {formatStatusLabel(item.status)}
                                </span>
                                <span className="history-time">{formatDateTime(timestamp)}</span>
                              </div>
                              <div className="history-subject">
                                {specialist ? `Специалист: ${specialist}` : 'Ожидает назначения'}
                              </div>
                              <div className="history-preview-text">{formatMessagePreview(item.lastMessage)}</div>
                              {item.status === 'open' && itemQueuePos && (
                                <div className="history-queue">
                                  В очереди: {itemQueuePos}
                                  {itemQueueTotal ? ` из ${itemQueueTotal}` : ''}
                                </div>
                              )}
                            </button>
                          </li>
                        );
                      })}
                      {!historyLoading && history.length === 0 && (
                        <li className="history-info">Нет обращений за последние 30 дней.</li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="history-preview">
                  <div className="history-preview__header">
                    <strong>Переписка</strong>
                    {selectedHistoryTicket && (
                      <span className="history-preview__meta">
                        {formatStatusLabel(selectedHistoryTicket.status)}
                        {selectedHistoryTicket.assigned
                          ? ` • ${formatDisplayName(selectedHistoryTicket.assigned)}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <div className="history-preview__body">
                    {historyMessagesLoading && <p className="muted">Загружаем переписку...</p>}
                    {historyMessagesError && <p className="error">{historyMessagesError}</p>}
                    {!selectedHistoryTicket &&
                      !historyMessagesLoading &&
                      !historyMessagesError && (
                        <p className="muted">Выберите обращение, чтобы увидеть переписку.</p>
                      )}
                    {!historyMessagesLoading && !historyMessagesError && historyMessages.length === 0 && (
                      <p className="muted">Нет сообщений для выбранного тикета.</p>
                    )}
                    {!historyMessagesLoading &&
                      !historyMessagesError &&
                      historyMessages.map((msg) => (
                        <MessageBubble
                          key={`${selectedHistoryId || 'history'}-${msg.id}`}
                          message={msg}
                          isOwn={msg.senderRole !== 'support'}
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
      <style jsx>{`
        .support-chat {
          position: sticky;
          top: 20px;
          max-width: 960px;
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
        .support-layout {
          margin-top: 12px;
          display: grid;
          gap: 16px;
          align-items: stretch;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .support-panel {
          background: ${palette.surface};
          border: 1px solid ${palette.border};
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          min-height: clamp(520px, 60vh, 640px);
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
        .queue-info {
          margin-top: 6px;
          font-size: 13px;
          color: var(--accent-700, ${palette.primary});
          font-weight: 600;
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
        .support-history {
          background: ${palette.surface};
          border: 1px solid ${palette.border};
          border-radius: 20px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: clamp(520px, 60vh, 640px);
          box-shadow: var(--shadow-md);
        }
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }
        .history-header strong {
          font-size: 16px;
        }
        .history-refresh {
          border: 1px solid ${palette.border};
          border-radius: 10px;
          background: ${palette.surfaceAlt};
          color: ${palette.text};
          padding: 4px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .history-refresh:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .history-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          min-height: 0;
        }
        .history-list-wrapper {
          background: ${palette.surfaceAlt};
          border: 1px solid ${palette.border};
          border-radius: 16px;
          padding: 14px;
          display: grid;
          align-content: start;
          gap: 12px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .history-list-wrapper p {
          margin: 0;
          font-size: 13px;
          color: ${palette.muted};
        }
        .history-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .history-item button {
          width: 100%;
          text-align: left;
          border: 1px solid ${palette.border};
          border-radius: 14px;
          background: ${palette.surfaceAlt};
          padding: 10px 12px;
          display: grid;
          gap: 6px;
          cursor: pointer;
        }
        .history-item.active button {
          border-color: ${palette.primary};
          box-shadow: 0 0 0 2px rgba(42, 101, 247, 0.12);
        }
        .history-item__row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          color: ${palette.muted};
        }
        .history-status {
          font-weight: 600;
        }
        .history-time {
          font-size: 11px;
          color: ${palette.muted};
        }
        .history-subject {
          font-size: 12px;
          color: ${palette.text};
        }
        .history-preview-text {
          font-size: 12px;
          color: ${palette.muted};
        }
        .history-queue {
          font-size: 11px;
          color: ${palette.primary};
          font-weight: 600;
        }
        .history-info {
          font-size: 12px;
          color: ${palette.muted};
          padding: 8px;
          text-align: center;
        }
        .history-preview {
          background: ${palette.surfaceAlt};
          border: 1px solid ${palette.border};
          border-radius: 16px;
          padding: 14px;
          display: grid;
          gap: 10px;
          flex-shrink: 0;
        }
        .history-preview__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: ${palette.muted};
        }
        .history-preview__meta {
          font-size: 12px;
          color: ${palette.muted};
        }
        .history-preview__body {
          display: grid;
          gap: 8px;
        }
        @media (max-width: 1024px) {
          .support-layout {
            grid-template-columns: 1fr;
          }
          .support-panel,
          .support-history {
            min-height: 0;
          }
        }
        @media (max-width: 768px) {
          .support-chat {
            width: 100%;
          }
          .support-body {
            max-height: 320px;
          }
        }
      `}</style>
    </div>
  );
}
