import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AdminLayout from '../../../components/AdminLayout';
import { apiFetch, getToken, resolveApiUrl, resolveSocketUrl } from '../../../lib/api';

const API = process.env.NEXT_PUBLIC_API_BASE;

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

function formatName(user) {
  if (!user) return 'Без имени';
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.userCode) return `ID ${user.userCode}`;
  if (user.phone) return user.phone;
  return 'Без имени';
}

function sortTickets(list = []) {
  return list
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
}

function TicketItem({ ticket, active, onSelect, onAssign, isQueue }) {
  const unread = ticket?.unread?.support || 0;
  const client = ticket?.client;
  return (
    <div
      onClick={() => onSelect(ticket)}
      style={{
        border: `1px solid ${active ? 'var(--accent-200)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: 14,
        background: active ? 'var(--accent-50)' : 'var(--surface-1)',
        cursor: 'pointer',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{formatName(client)}</strong>
        {unread > 0 && (
          <span style={{
            background: 'var(--accent-100)',
            color: 'var(--accent-700)',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 12,
          }}>
            +{unread}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {client?.phone || '—'} · {client?.userCode ? `ID ${client.userCode}` : 'ID отсутствует'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-500)' }}>
        Обновлён: {formatDate(ticket.lastMessageAt || ticket.updatedAt)}
      </div>
      {isQueue && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAssign(ticket); }}
          style={{
            marginTop: 6,
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            borderRadius: 10,
            padding: '6px 10px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Взять тикет
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  const isFile = message?.file && !['image'].includes(message.contentType);
  const isImage = message?.file && message.contentType === 'image';
  const fileUrl = message?.file?.url ? resolveApiUrl(message.file.url) : null;
  return (
    <div style={{ display: 'grid', justifyContent: isOwn ? 'flex-end' : 'flex-start', margin: '4px 0' }}>
      <div
        style={{
          maxWidth: 380,
          background: isOwn ? 'var(--accent-50)' : 'var(--surface-2)',
          color: 'var(--text)',
          padding: '10px 12px',
          borderRadius: 16,
          borderBottomRightRadius: isOwn ? 4 : 16,
          borderBottomLeftRadius: isOwn ? 16 : 4,
          border: `1px solid ${isOwn ? 'var(--accent-200)' : 'var(--border)'}`,
        }}
      >
        {message.content && !message.file && (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{message.content}</p>
        )}
        {isImage && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
            <img src={fileUrl} alt={message.file?.name || 'Вложение'} style={{ maxWidth: 260, borderRadius: 12 }} />
          </a>
        )}
        {isFile && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            📎 {message.file?.name || 'Файл'}
          </a>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(message.createdAt)}</span>
    </div>
  );
}

function dispatchSupportRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin-support-refresh'));
  }
}

export default function AdminSupportPage() {
  const [me, setMe] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [overview, setOverview] = useState({ queue: [], my: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState({});
  const listRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((d) => {
        if (d.role !== 'admin') { location.href = '/'; return; }
        setMe(d);
        setAuthToken(token);
      })
      .catch(() => { location.href = '/'; });
  }, []);

  useEffect(() => {
    if (!me) return;
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/admin/support/overview`, { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((data) => {
        const queue = Array.isArray(data.queue) ? data.queue : [];
        const my = Array.isArray(data.my) ? data.my : [];
        setOverview({ queue: sortTickets(queue), my: sortTickets(my) });
        if (!selectedId) {
          const candidate = my[0] || queue[0] || null;
          setSelectedId(candidate?.id || null);
        }
        dispatchSupportRefresh();
      })
      .catch((err) => console.error('support overview error', err));
  }, [me]);

  useEffect(() => {
    const socketToken = authToken;
    if (!socketToken || socketRef.current) return;
    const socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: socketToken },
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('support:ticket-update', ({ ticket }) => {
      if (!ticket) return;
      setOverview((prev) => updateOverviewWithTicket(prev, ticket, me));
      if (selectedId === ticket.id) {
        setSelectedTicket(ticket);
      }
      dispatchSupportRefresh();
    });
    socket.on('support:ticket', (ticket) => {
      if (ticket && ticket.id === selectedId) {
        setSelectedTicket(ticket);
      }
    });
    socket.on('support:message', (message) => {
      if (message?.ticketId !== selectedId) return;
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
      if (message.senderRole === 'client') {
        markTicketRead(message.ticketId, true);
      }
    });
    socket.on('support:typing', (payload) => {
      if (!payload?.ticketId || payload.ticketId !== selectedId) return;
      if (payload.role === 'support') return;
      setTyping((prev) => {
        const next = { ...prev };
        if (payload.isTyping) {
          next[payload.userId] = payload;
        } else {
          delete next[payload.userId];
        }
        return next;
      });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, me, selectedId]);

  useEffect(() => {
    const found = findTicketInOverview(selectedId, overview);
    if (selectedId && !found) {
      setSelectedTicket(null);
      setSelectedId(null);
    } else if (found) {
      setSelectedTicket(found);
    } else if (!selectedId) {
      const next = overview.my[0] || overview.queue[0] || null;
      if (next) {
        setSelectedId(next.id);
        setSelectedTicket(next);
      }
    }
  }, [overview, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let ignore = false;
    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const res = await apiFetch(`/api/support/tickets/${selectedId}/messages`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!ignore) setMessages(Array.isArray(data.messages) ? data.messages : []);
        await markTicketRead(selectedId);
      } catch (err) {
        console.error('load support messages error', err);
      } finally {
        if (!ignore) setLoadingMessages(false);
      }
    }
    loadMessages();
    const socket = socketRef.current;
    if (socket) socket.emit('support:join', { ticketId: selectedId });
    return () => {
      ignore = true;
      if (socket) socket.emit('support:leave', { ticketId: selectedId });
    };
  }, [selectedId]);

  useEffect(() => {
    setComposer('');
    setTyping({});
  }, [selectedId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selectedId]);

  async function markTicketRead(ticketId, silent) {
    try {
      await apiFetch(`/api/admin/support/tickets/${ticketId}/read`, { method: 'POST' });
      if (!silent) dispatchSupportRefresh();
    } catch (err) {
      console.error('mark support read error', err);
    }
  }

  function handleSelect(ticket) {
    setSelectedId(ticket?.id || null);
  }

  async function handleAssign(ticket) {
    if (!ticket) return;
    try {
      const res = await apiFetch(`/api/admin/support/tickets/${ticket.id}/assign`, { method: 'POST' });
      if (!res.ok) throw new Error('assign failed');
      const data = await res.json();
      setOverview((prev) => updateOverviewWithTicket(prev, data.ticket, me));
      setSelectedId(data.ticket?.id || ticket.id);
      dispatchSupportRefresh();
    } catch (err) {
      console.error('assign ticket error', err);
    }
  }

  async function handleClose(ticket) {
    if (!ticket) return;
    try {
      const res = await apiFetch(`/api/admin/support/tickets/${ticket.id}/close`, { method: 'POST' });
      if (!res.ok) throw new Error('close failed');
      const data = await res.json();
      setOverview((prev) => updateOverviewWithTicket(prev, data.ticket, me));
      setMessages([]);
      dispatchSupportRefresh();
    } catch (err) {
      console.error('close ticket error', err);
    }
  }

  async function sendMessage() {
    if (!selectedId || !composer.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/support/tickets/${selectedId}/messages`, {
        method: 'POST',
        body: { content: composer },
      });
      if (!res.ok) throw new Error('send failed');
      setComposer('');
      const socket = socketRef.current;
      if (socket) socket.emit('support:typing', { ticketId: selectedId, isTyping: false });
    } catch (err) {
      console.error('send support message error', err);
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(event) {
    if (!selectedId) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert('Размер файла не должен превышать 25 МБ.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = getToken();
      const res = await fetch(resolveApiUrl(`/api/support/tickets/${selectedId}/attachments`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error('upload failed');
      await res.json();
    } catch (err) {
      console.error('upload support file error', err);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function handleComposerChange(e) {
    setComposer(e.target.value);
    const socket = socketRef.current;
    if (socket && selectedId) {
      socket.emit('support:typing', { ticketId: selectedId, isTyping: true });
    }
  }

  const typingUsers = useMemo(() => Object.values(typing || {}), [typing]);

  return (
    <AdminLayout me={me} title="Поддержка пользователей">
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Очередь</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {overview.queue.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Свободных тикетов нет.</div>}
              {overview.queue.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  active={selectedId === ticket.id}
                  onSelect={handleSelect}
                  onAssign={handleAssign}
                  isQueue
                />
              ))}
            </div>
          </section>
          <section style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Мои тикеты</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {overview.my.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>У вас нет активных тикетов.</div>}
              {overview.my.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  active={selectedId === ticket.id}
                  onSelect={handleSelect}
                  onAssign={() => {}}
                />
              ))}
            </div>
          </section>
        </div>

        <section style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 20, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          {selectedTicket ? (
            <>
              <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 18 }}>{formatName(selectedTicket.client)}</strong>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {selectedTicket.client?.phone || '—'} · {selectedTicket.client?.userCode ? `ID ${selectedTicket.client.userCode}` : 'ID отсутствует'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-500)' }}>
                    Статус: {selectedTicket.status === 'closed' ? 'Закрыт' : selectedTicket.assigned?.id === me?.id ? 'В работе' : 'В очереди'} · Последнее сообщение {formatDate(selectedTicket.lastMessageAt)}
                  </span>
                  {selectedTicket.assigned && (
                    <span style={{ fontSize: 12, color: 'var(--text-500)' }}>
                      Ответственный: {formatName(selectedTicket.assigned)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {selectedTicket.status !== 'closed' && selectedTicket.assigned?.id !== me?.id && (
                    <button className="button" onClick={() => handleAssign(selectedTicket)} style={{ whiteSpace: 'nowrap' }}>
                      Взять тикет
                    </button>
                  )}
                  {selectedTicket.status !== 'closed' && selectedTicket.assigned?.id === me?.id && (
                    <button className="button" onClick={() => handleClose(selectedTicket)} style={{ whiteSpace: 'nowrap', background: 'var(--danger-500)', borderColor: 'var(--danger-500)' }}>
                      Закрыть тикет
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: connected ? 'var(--green-600)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {connected ? 'online' : 'offline'}
                  </span>
                </div>
              </header>
              <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                {loadingMessages && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загружаем историю...</div>}
                {!loadingMessages && messages.map((message) => (
                  <MessageBubble key={message.id} message={message} isOwn={message.senderRole === 'support'} />
                ))}
                {!loadingMessages && messages.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Сообщений пока нет. Напишите клиенту, чтобы начать диалог.</div>
                )}
                {typingUsers.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 'auto' }}>
                    {typingUsers.map((t) => t.name || 'Клиент').join(', ')} печатает...
                  </div>
                )}
              </div>
              <footer style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'grid', gap: 8 }}>
                <textarea
                  value={composer}
                  onChange={handleComposerChange}
                  rows={3}
                  disabled={selectedTicket.status === 'closed' || sending || uploading || (selectedTicket.assigned?.id && selectedTicket.assigned.id !== me?.id)}
                  placeholder={selectedTicket.status === 'closed' ? 'Тикет закрыт' : selectedTicket.assigned?.id && selectedTicket.assigned.id !== me?.id ? 'Тикет уже взят другим сотрудником' : 'Напишите ответ клиенту...'}
                  style={{
                    resize: 'none',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{
                    display: 'inline-flex',
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    opacity: uploading ? 0.5 : 1,
                  }}>
                    📎
                    <input type="file" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading || selectedTicket.status === 'closed'} />
                  </label>
                  <button
                    className="button"
                    onClick={sendMessage}
                    disabled={!composer.trim() || sending || selectedTicket.status === 'closed' || (selectedTicket.assigned?.id && selectedTicket.assigned.id !== me?.id)}
                    style={{ minWidth: 140 }}
                  >
                    Отправить
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div style={{ padding: 32, color: 'var(--text-muted)' }}>Выберите тикет из списка, чтобы начать переписку.</div>
          )}
        </section>
      </div>
      <style jsx>{`
        .button {
          background: var(--accent);
          border: 1px solid var(--accent);
          border-radius: 12px;
          color: white;
          padding: 8px 14px;
          font-size: 14px;
          cursor: pointer;
        }
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </AdminLayout>
  );
}

function findTicketInOverview(id, overview) {
  if (!id) return null;
  return overview.my.find((t) => t.id === id) || overview.queue.find((t) => t.id === id) || null;
}

function updateOverviewWithTicket(prev, ticket, me) {
  const nextQueue = prev.queue.filter((t) => t.id !== ticket.id);
  const nextMy = prev.my.filter((t) => t.id !== ticket.id);
  if (ticket.status === 'open') {
    nextQueue.push(ticket);
  }
  if (ticket.status !== 'closed' && ticket.assigned?.id === me?.id) {
    nextMy.push(ticket);
  }
  return {
    queue: sortTickets(nextQueue),
    my: sortTickets(nextMy),
  };
}
