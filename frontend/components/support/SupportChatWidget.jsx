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

function formatTime(v){ if(!v) return ''; try{ return new Date(v).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}catch{return '';} }
function formatDisplayName(u){ if(!u) return ''; if(u.name?.trim()) return u.name.trim(); if(u.userCode) return `ID ${u.userCode}`; if(u.phone) return u.phone; return ''; }
function formatDateTime(v){ if(!v) return ''; try{ return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';} }
function formatStatusLabel(s){ return s==='open'?'Ожидает специалиста':s==='assigned'?'В работе':s==='closed'?'Закрыт':'—'; }
function formatMessagePreview(m){ if(!m) return 'Нет сообщений'; if(m.isSystem) return m.content||'Системное уведомление'; if(m.file) return m.file.name?`Вложение: ${m.file.name}`:'Вложение'; if(m.content?.trim()){const t=m.content.trim(); return t.length>140?`${t.slice(0,137)}…`:t;} return 'Сообщение'; }
function normalizeMessages(list=[]){ return list.filter(Boolean).slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)); }
function formatTicketType(type){ return type === 'listing' ? 'По объявлению' : 'Общий вопрос'; }

function MessageBubble({ message, isOwn }) {
  if (message?.isSystem || message?.senderRole === 'system' || message?.contentType === 'system') {
    return (
      <div className="system-message">
        <span>{message?.content}</span>
        <style jsx>{`
          .system-message{display:grid;justify-content:center;margin:10px 0;}
          .system-message span{background:rgba(42,101,247,.08);color:var(--accent-700,${palette.primary});padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;text-align:center;}
        `}</style>
      </div>
    );
  }
  const isFile = message?.file && message.contentType !== 'image';
  const isImage = message?.file && message.contentType === 'image';
  const fileUrl = message?.file?.url ? resolveApiUrl(message.file.url) : null;

  return (
    <div className={`bubble ${isOwn ? 'own' : 'remote'}`}>
      <div className="bubble-body">
        {message.content && !message.file && <p className="bubble-text">{message.content}</p>}
        {isImage && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="bubble-image-link">
            <img src={fileUrl} alt={message.file?.name || 'Вложение'} />
          </a>
        )}
        {isFile && fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="bubble-file">📎 {message.file?.name || 'Файл'}</a>
        )}
      </div>
      <span className="bubble-time">{formatTime(message.createdAt)}</span>
      <style jsx>{`
        .bubble{display:grid;justify-content:${isOwn?'flex-end':'flex-start'};margin:4px 0;}
        .bubble-body{max-width:320px;background:${isOwn?'var(--accent-50)':palette.surfaceAlt};color:${palette.text};padding:10px 12px;border-radius:16px;border-bottom-${isOwn?'right':'left'}-radius:4px;border:1px solid ${isOwn?'var(--accent-200)':palette.border};box-shadow:var(--shadow-xs);}
        .bubble-text{margin:0;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.4;}
        .bubble-time{display:inline-block;margin-top:2px;font-size:11px;color:${palette.muted};}
        .bubble-file{color:${palette.primary};text-decoration:none;font-size:14px;}
        .bubble-file:hover{text-decoration:underline;}
        .bubble-image-link{display:inline-block;border-radius:12px;overflow:hidden;border:1px solid ${palette.border};}
        .bubble-image-link img{max-width:260px;display:block;}
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
  const [initialTicketId, setInitialTicketId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [historyMessagesLoading, setHistoryMessagesLoading] = useState(false);
  const [historyMessagesError, setHistoryMessagesError] = useState(null);
  const [historyViewMode, setHistoryViewMode] = useState(false);

  const socketRef = useRef(null);
  const listRef = useRef(null);
  const typingTimeout = useRef(null);
  const previousTicketRef = useRef(null);
  const lastTicketIdRef = useRef(null);
  const lastTicketStatusRef = useRef(null);

  // Derived (до эффектов)
  const hasTicket = !!ticket?.id;
  const isTicketClosed = ticket?.status === 'closed';
  const otherTyping = useMemo(() => Object.values(typing || {}), [typing]);
  const assignedName = formatDisplayName(ticket?.assigned);
  const lastActiveMessage = messages[messages.length - 1] || null;
  const queuePosition = ticket?.queuePosition != null && Number.isFinite(Number(ticket.queuePosition)) ? Number(ticket.queuePosition) : null;
  const queueTotal = ticket?.queueTotal != null && Number.isFinite(Number(ticket.queueTotal)) ? Number(ticket.queueTotal) : null;
  const showQueueInfo = !isTicketClosed && queuePosition != null && queuePosition > 0;
  const selectedHistoryTicket =
    selectedHistoryId && ticket?.id && selectedHistoryId === ticket.id
      ? { ...ticket, lastMessage: lastActiveMessage }
      : history.find((i) => i.id === selectedHistoryId) || null;
  const isViewingHistory = Boolean(historyViewMode && selectedHistoryId && (!ticket?.id || selectedHistoryId !== ticket.id));
  const canCompose = !loading && !needsLogin && !isTicketClosed && !isViewingHistory;

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search || '');
      const rawId = params.get('ticketId');
      const parsed = Number(rawId);
      if (Number.isFinite(parsed) && parsed > 0) setInitialTicketId(parsed);
    }
    const t=getToken(); if(!t){ setNeedsLogin(true); return; } setAuthToken(t);
  }, []);
  useEffect(() => { if(!authToken){ setHistory([]); setSelectedHistoryId(null); setHistoryMessages([]); setHistoryViewMode(false);} }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    let ignore=false;
    (async () => {
      setLoading(true);
      setError(null);
      try{
        if(initialTicketId){
          const ticketRes = await apiFetch(`/api/support/tickets/${initialTicketId}`);
          if(!ticketRes.ok) throw new Error('FAILED');
          const ticketData = await ticketRes.json();
          const messagesRes = await apiFetch(`/api/support/tickets/${initialTicketId}/messages`);
          if(!messagesRes.ok) throw new Error('FAILED');
          const messagesData = await messagesRes.json();
          if(ignore) return;
          setTicket(ticketData.ticket||null);
          setMessages(normalizeMessages(messagesData.messages||[]));
          setSelectedHistoryId(initialTicketId);
          setHistoryViewMode(false);
          return;
        }
        const res=await apiFetch('/api/support/tickets/open');
        if(!res.ok) throw new Error('FAILED');
        const data=await res.json();
        if(ignore) return;
        setTicket(data.ticket||null);
        setMessages(normalizeMessages(data.messages||[]));
      }catch(e){
        if(initialTicketId){ setInitialTicketId(null); }
        if(!ignore) setError('Не удалось загрузить чат поддержки.');
        console.error(e);
      }finally{ if(!ignore) setLoading(false); }
    })();
    return ()=>{ ignore=true; };
  }, [authToken, initialTicketId]);

  useEffect(() => {
    if (!authToken) return;
    let ignore=false;
    (async () => {
      setHistoryLoading(true); setHistoryError(null);
      try{
        const res=await apiFetch('/api/support/tickets/history?days=30');
        if(!res.ok) throw new Error('FAILED');
        const data=await res.json();
        if(ignore) return;
        setHistory(Array.isArray(data?.tickets)?data.tickets:[]);
      }catch(e){ if(!ignore) setHistoryError('Не удалось загрузить историю тикетов.'); }
      finally{ if(!ignore) setHistoryLoading(false); }
    })();
    return ()=>{ ignore=true; };
  }, [authToken, historyReloadKey]);

  useEffect(() => {
    if (!authToken || !isClient || socketRef.current) return;
    const socket = io(resolveSocketUrl(), { transports:['websocket','polling'], withCredentials:true, auth:{ token:authToken }});
    socketRef.current = socket;
    const onC = () => setConnected(true);
    const onD = () => setConnected(false);
    socket.on('connect', onC);
    socket.on('disconnect', onD);
    socket.on('support:message', (m)=>{
      setMessages(prev => prev.some(x=>x.id===m.id)?prev:normalizeMessages([...prev,m]));
      if (m.senderRole === 'support') setTyping({});
    });
    socket.on('support:ticket', (p)=>{ if(p) setTicket(p); });
    socket.on('support:typing', (p)=>{
      setTyping(prev=>{
        const next={...prev};
        if(!p?.userId) return next;
        if(p.isTyping) next[p.userId]=p; else delete next[p.userId];
        return next;
      });
    });
    return ()=>{ socket.off('connect', onC); socket.off('disconnect', onD); socket.disconnect(); socketRef.current=null; };
  }, [authToken, isClient]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !ticket?.id) return;
    s.emit('support:join', { ticketId: ticket.id });
    return () => { s.emit('support:leave', { ticketId: ticket.id }); };
  }, [ticket?.id]);

  useEffect(() => {
    if (!listRef.current) return;
    if (isViewingHistory) { listRef.current.scrollTop = listRef.current.scrollHeight; return; }
    listRef.current.scrollTop = showClosedBanner ? 0 : listRef.current.scrollHeight;
  }, [messages.length, historyMessages.length, isOpen, showClosedBanner, isViewingHistory]);

  useEffect(() => {
    if (!ticket?.id || !isOpen || !ticket?.unread?.client) return;
    const controller=new AbortController();
    const t=setTimeout(()=>{ apiFetch(`/api/support/tickets/${ticket.id}/read`,{method:'POST'}).catch(()=>{}); },250);
    return ()=>{ clearTimeout(t); controller.abort(); };
  }, [ticket?.id, ticket?.unread?.client, isOpen]);

  useEffect(() => {
    const prev = previousTicketRef.current;
    if (ticket?.status === 'closed') {
      if (!prev || prev.status !== 'closed') setMessages([]);
      setTyping({}); setShowClosedBanner(true);
      setClosedInfo({ closedAt: ticket?.closedAt || ticket?.updatedAt || ticket?.lastMessageAt, assignedName: formatDisplayName(ticket?.assigned) });
    } else { setShowClosedBanner(false); setClosedInfo(null); }
    previousTicketRef.current = ticket;
  }, [ticket]);

  useEffect(() => {
    const id = ticket?.id || null;
    if (id && lastTicketIdRef.current !== id) setHistoryReloadKey(k=>k+1);
    if (!id && lastTicketIdRef.current) setHistoryReloadKey(k=>k+1);
    lastTicketIdRef.current = id;
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket?.id) { lastTicketStatusRef.current = null; return; }
    if (lastTicketStatusRef.current && lastTicketStatusRef.current !== ticket.status) setHistoryReloadKey(k=>k+1);
    lastTicketStatusRef.current = ticket.status;
  }, [ticket?.status, ticket?.id]);

  useEffect(() => { if (ticket?.id && selectedHistoryId !== ticket.id) setSelectedHistoryId(ticket.id); }, [ticket?.id, selectedHistoryId]);

  useEffect(() => {
    if (!history.length) { if (selectedHistoryId) setSelectedHistoryId(null); return; }
    setSelectedHistoryId(prev => {
      if (prev && history.some(i=>i.id===prev)) return prev;
      if (ticket?.id && history.some(i=>i.id===ticket.id)) return ticket.id;
      return history[0]?.id || null;
    });
  }, [history, ticket?.id]);

  useEffect(() => {
    if (!historyViewMode) return;
    if (!selectedHistoryId) { setHistoryViewMode(false); return; }
    if (ticket?.id && selectedHistoryId === ticket.id) setHistoryViewMode(false);
  }, [historyViewMode, selectedHistoryId, ticket?.id]);

  useEffect(() => { if (needsLogin) setHistoryViewMode(false); }, [needsLogin]);

  useEffect(() => {
    if (!selectedHistoryId) { setHistoryMessages([]); setHistoryMessagesError(null); return; }
    if (needsLogin || !authToken) return;
    if (selectedHistoryId === ticket?.id) { setHistoryMessages(messages); setHistoryMessagesError(null); setHistoryMessagesLoading(false); return; }
    let ignore=false;
    setHistoryMessagesLoading(true); setHistoryMessagesError(null); setHistoryMessages([]);
    (async ()=>{
      try{
        const res=await apiFetch(`/api/support/tickets/${selectedHistoryId}/messages?limit=200`);
        if(!res.ok) throw new Error('FAILED');
        const data=await res.json();
        if(ignore) return;
        setHistoryMessages(normalizeMessages(data.messages||[]));
      }catch(e){ if(!ignore) setHistoryMessagesError('Не удалось загрузить переписку.'); }
      finally{ if(!ignore) setHistoryMessagesLoading(false); }
    })();
    return ()=>{ ignore=true; };
  }, [selectedHistoryId, ticket?.id, needsLogin, authToken]);

  useEffect(() => { if (selectedHistoryId === ticket?.id) setHistoryMessages(messages); }, [messages, selectedHistoryId, ticket?.id]);

  function handleSelectHistoryTicket(id){ setSelectedHistoryId(id); setHistoryMessagesError(null); setHistoryViewMode(true); }
  function handleRefreshHistory(){ setHistoryReloadKey(k=>k+1); }
  function handleExitHistoryView(){ setHistoryViewMode(false); setSelectedHistoryId(ticket?.id || null); }
  function resetClosedState(){
    const s=socketRef.current; if(s && ticket?.id) s.emit('support:leave',{ticketId:ticket.id});
    setTicket(null); setMessages([]); setShowClosedBanner(false); setClosedInfo(null); setComposer(''); previousTicketRef.current=null; setHistoryViewMode(false); setInitialTicketId(null);
  }

  async function sendMessage(){
    if(!composer.trim()) return;
    setSending(true);
    try{
      let currentTicket=ticket;
      if(!currentTicket?.id){
        const ensureRes=await apiFetch('/api/support/tickets/open',{method:'POST'});
        if(!ensureRes.ok) throw new Error('ensure failed');
        const ensureData=await ensureRes.json();
        currentTicket=ensureData.ticket||null;
        if(currentTicket){ setTicket(currentTicket); setMessages(normalizeMessages(ensureData.messages||[])); }
      }
      if(!currentTicket?.id) throw new Error('no ticket');
      const res=await apiFetch(`/api/support/tickets/${currentTicket.id}/messages`,{method:'POST',body:{content:composer}});
      if(!res.ok) throw new Error('send failed');
      setComposer('');
      const s=socketRef.current; if(s) s.emit('support:typing',{ticketId:currentTicket.id,isTyping:false});
    }catch(e){ console.error(e); setError('Не удалось отправить сообщение.'); setTimeout(()=>setError(null),3000); }
    finally{ setSending(false); }
  }

  async function handleFileUpload(e){
    if(!ticket?.id) return;
    const file=e.target.files?.[0]; if(!file) return;
    if(file.size>25*1024*1024){ setError('Размер файла не должен превышать 25 МБ.'); setTimeout(()=>setError(null),3000); return; }
    setUploading(true);
    try{
      const fd=new FormData(); fd.append('file',file);
      const token=getToken();
      const res=await fetch(resolveApiUrl(`/api/support/tickets/${ticket.id}/attachments`),{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:fd});
      if(!res.ok) throw new Error('upload failed');
      await res.json();
    }catch(e){ console.error(e); setError('Не удалось загрузить файл.'); setTimeout(()=>setError(null),4000); }
    finally{ setUploading(false); e.target.value=''; }
  }

  function handleInputChange(e){
    setComposer(e.target.value);
    const s=socketRef.current; if(!s || !ticket?.id) return;
    if(typingTimeout.current) clearTimeout(typingTimeout.current);
    s.emit('support:typing',{ticketId:ticket.id,isTyping:true});
    typingTimeout.current=setTimeout(()=>{ s.emit('support:typing',{ticketId:ticket.id,isTyping:false}); },1500);
  }

  const unreadCount = ticket?.unread?.client || 0;
  if (!isClient) return null;

  return (
    <div className="support-chat">
      <button className="support-toggle" onClick={()=>setIsOpen(p=>!p)}>
        <span>Чат с поддержкой</span>
        {unreadCount>0 && <span className="badge">{unreadCount}</span>}
        <span className={`status ${connected?'online':'offline'}`}>{connected?'online':'offline'}</span>
      </button>

      {isOpen && (
        <div className="support-layout">
          {/* LEFT: main panel (фиксировано слева) */}
          <div className="support-panel">
            <div className="support-header">
              {isViewingHistory ? (
                <div className="history-view-header">
                  <strong>Переписка из истории</strong>
                  {selectedHistoryTicket ? (
                    <>
                      <p>
                        {formatStatusLabel(selectedHistoryTicket.status)}
                        {selectedHistoryTicket.assigned ? ` • ${formatDisplayName(selectedHistoryTicket.assigned)}` : ''}
                      </p>
                      <div className="ticket-meta-row">
                        <span className={`ticket-type ${selectedHistoryTicket.type === 'listing' ? 'listing' : 'general'}`}>
                          {formatTicketType(selectedHistoryTicket.type)}
                        </span>
                        {selectedHistoryTicket.listing ? (
                          <div className="ticket-listing">
                            <a
                              href={`/trades/${selectedHistoryTicket.listing.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ticket-link"
                            >
                              Объявление №{selectedHistoryTicket.listing.id}
                            </a>
                            {selectedHistoryTicket.listing.title && (
                              <span className="ticket-listing__title">{selectedHistoryTicket.listing.title}</span>
                            )}
                            {selectedHistoryTicket.listing.region && (
                              <span className="ticket-region">{selectedHistoryTicket.listing.region}</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <p className="history-view-meta">
                        {selectedHistoryTicket.lastMessage?.createdAt || selectedHistoryTicket.updatedAt
                          ? `Обновлено ${formatDateTime(
                              selectedHistoryTicket.lastMessage?.createdAt ||
                                selectedHistoryTicket.updatedAt ||
                                selectedHistoryTicket.lastMessageAt
                            )}`
                          : 'Обращение создано'}
                      </p>
                    </>
                  ) : (
                    <p>Выберите обращение в списке, чтобы просмотреть переписку.</p>
                  )}
                </div>
              ) : (
                <div>
                  <strong>Команда сопровождения</strong>
                  {assignedName && !isTicketClosed ? (
                    <p>Ваш тикет ведёт {assignedName}. Мы остаёмся на связи.</p>
                  ) : (
                    <p>Ответим на вопросы, поможем с документами и торгами.</p>
                  )}
                  {ticket && (
                    <div className="ticket-meta-row">
                      <span className={`ticket-type ${ticket.type === 'listing' ? 'listing' : 'general'}`}>
                        {formatTicketType(ticket.type)}
                      </span>
                      {ticket.listing ? (
                        <div className="ticket-listing">
                          <a href={`/trades/${ticket.listing.id}`} target="_blank" rel="noreferrer" className="ticket-link">
                            Объявление №{ticket.listing.id}
                          </a>
                          {ticket.listing.title && (
                            <span className="ticket-listing__title">{ticket.listing.title}</span>
                          )}
                          {ticket.listing.region && <span className="ticket-region">{ticket.listing.region}</span>}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {showQueueInfo && (
                    <p className="queue-info">
                      Ваша позиция в очереди: {queuePosition}
                      {queueTotal && queueTotal > 0 ? ` из ${queueTotal}` : ''}
                    </p>
                  )}
                  {isTicketClosed && (
                    <>
                      <div className="ticket-closed__text">Если вопрос остался актуален — создайте новое обращение.</div>
                      <button type="button" onClick={resetClosedState} className="ticket-closed__action">Начать новый тикет</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="support-body" ref={listRef}>
              {needsLogin ? (
                <p className="muted">Авторизуйтесь, чтобы написать в поддержку.</p>
              ) : isViewingHistory ? (
                <>
                  {historyMessagesLoading && <p className="muted">Загружаем переписку...</p>}
                  {historyMessagesError && <p className="error">{historyMessagesError}</p>}
                  {!historyMessagesLoading && !historyMessagesError && historyMessages.length === 0 && (
                    <p className="muted">Нет сообщений для выбранного тикета.</p>
                  )}
                  {!historyMessagesLoading && !historyMessagesError &&
                    historyMessages.map((msg)=>(
                      <MessageBubble key={`${selectedHistoryId||'history'}-${msg.id}`} message={msg} isOwn={msg.senderRole!=='support'} />
                    ))}
                </>
              ) : (
                <>
                  {showClosedBanner && (
                    <div className="ticket-closed">
                      <div className="ticket-closed__title">ТИКЕТ ЗАКРЫТ</div>
                      {closedInfo?.assignedName && (<div className="ticket-closed__text">Специалист {closedInfo.assignedName} завершил обращение.</div>)}
                      {closedInfo?.closedAt && (<div className="ticket-closed__text">Закрыт в {formatTime(closedInfo.closedAt)}</div>)}
                      <div className="ticket-closed__text">Если вопрос остался актуален — создайте новое обращение.</div>
                      <button type="button" onClick={resetClosedState} className="ticket-closed__action">Начать новый тикет</button>
                    </div>
                  )}
                  {loading && <p className="muted">Загружаем историю...</p>}
                  {!loading && messages.map((m)=>(<MessageBubble key={m.id} message={m} isOwn={m.senderRole!=='support'} />))}
                  {!loading && messages.length===0 && !showClosedBanner && (
                    <p className="muted">Опишите свой вопрос — специалист подключится в течение нескольких минут.</p>
                  )}
                  {otherTyping.length>0 && !showClosedBanner && (<div className="typing">{otherTyping.map(t=>t.name||'Специалист').join(', ')} печатает...</div>)}
                </>
              )}
            </div>

            {/* При просмотре истории — композер скрыт */}
            {!isViewingHistory && (
              <div className="support-composer">
                <textarea
                  placeholder={needsLogin?'Необходимо авторизоваться':isTicketClosed?'Диалог завершён — создайте новый тикет':'Напишите сообщение...'}
                  value={composer}
                  onChange={handleInputChange}
                  disabled={!canCompose || sending || uploading}
                  rows={2}
                />
                <div className="composer-actions">
                  <label className={`attach ${uploading || !hasTicket || !canCompose ? 'disabled' : ''}`}>
                    📎
                    <input type="file" onChange={handleFileUpload} disabled={uploading || !hasTicket || !canCompose}/>
                  </label>
                  <button onClick={sendMessage} disabled={!composer.trim() || sending || !canCompose}>Отправить</button>
                </div>
                {error && <div className="error">{error}</div>}
              </div>
            )}
          </div>

          {/* RIGHT: history column */}
          <aside className="support-history">
            <div className="history-header">
              <strong>История обращений (30 дней)</strong>
              <button type="button" className="history-refresh" onClick={handleRefreshHistory} disabled={historyLoading || needsLogin}>Обновить</button>
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
                        const itemQueuePos = item.queuePosition != null && Number(item.queuePosition) > 0 ? Number(item.queuePosition) : null;
                        const itemQueueTotal = item.queueTotal != null && Number(item.queueTotal) > 0 ? Number(item.queueTotal) : null;
                        const timestamp = item.lastMessage?.createdAt || item.updatedAt || item.lastMessageAt || item.createdAt;
                        const specialist = item.assigned ? formatDisplayName(item.assigned) : null;
                        return (
                          <li key={item.id} className={`history-item ${isActive ? 'active' : ''}`}>
                            <button type="button" onClick={() => handleSelectHistoryTicket(item.id)}>
                              <div className="history-item__row">
                                <span className={`history-type ${item.type === 'listing' ? 'listing' : 'general'}`}>
                                  {formatTicketType(item.type)}
                                </span>
                                <span className={`history-status status-${item.status || 'unknown'}`}>{formatStatusLabel(item.status)}</span>
                                <span className="history-time">{formatDateTime(timestamp)}</span>
                              </div>
                              <div className="history-subject">{specialist ? `Специалист: ${specialist}` : 'Ожидает назначения'}</div>
                              <div className="history-preview-text">{formatMessagePreview(item.lastMessage)}</div>
                              {item.listing ? (
                                <div className="history-listing">
                                  <a
                                    href={`/trades/${item.listing.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ticket-link"
                                  >
                                    Объявление №{item.listing.id}
                                  </a>
                                  {item.listing.region && <span className="history-region">{item.listing.region}</span>}
                                </div>
                              ) : null}
                              {item.status === 'open' && itemQueuePos && (
                                <div className="history-queue">В очереди: {itemQueuePos}{itemQueueTotal ? ` из ${itemQueueTotal}` : ''}</div>
                              )}
                            </button>
                          </li>
                        );
                      })}
                      {!historyLoading && history.length === 0 && (<li className="history-info">Нет обращений за последние 30 дней.</li>)}
                    </ul>
                  )}
                </div>

                <div className="history-preview">
                  <div className="history-preview__header">
                    <strong>Переписка</strong>
                    {selectedHistoryTicket && (
                      <span className="history-preview__meta">
                        {formatStatusLabel(selectedHistoryTicket.status)}
                        {selectedHistoryTicket.assigned ? ` • ${formatDisplayName(selectedHistoryTicket.assigned)}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="history-preview__body">
                    {isViewingHistory ? (
                      <>
                        <p className="muted">Переписка открыта в основном окне.</p>
                        <button type="button" className="history-preview__action" onClick={handleExitHistoryView}>Вернуться к текущему чату</button>
                      </>
                    ) : (
                      <p className="muted">Выберите обращение, чтобы просмотреть переписку в основном окне.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <style jsx>{`
        .support-chat{position:sticky;top:20px;max-width:960px;margin:0 auto;}
        .support-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:${palette.surface};border:1px solid ${palette.border};border-radius:16px;font-size:16px;font-weight:600;cursor:pointer;color:${palette.text};box-shadow:var(--shadow-sm);}
        .support-toggle:hover{border-color:${palette.primary};}
        .badge{min-width:22px;padding:2px 8px;border-radius:999px;background:${palette.badgeBg};color:${palette.badgeText};font-size:12px;text-align:center;}
        .status{font-size:12px;text-transform:uppercase;letter-spacing:.04em;}
        .status.online{color:var(--green-600);} .status.offline{color:${palette.muted};}
        .ticket-meta-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;}
        .ticket-type{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.01em;background:var(--surface-2);color:${palette.text};border:1px solid ${palette.border};}
        .ticket-type.listing{background:var(--accent-50);color:var(--accent-800, ${palette.primary});border-color:var(--accent-200);}
        .ticket-listing{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
        .ticket-link{color:${palette.primary};font-weight:600;text-decoration:none;}
        .ticket-link:hover{text-decoration:underline;}
        .ticket-listing__title{color:${palette.text};font-size:13px;}
        .ticket-region{padding:2px 8px;border-radius:10px;background:var(--surface-2);color:${palette.text};font-size:12px;}
        .history-type{padding:2px 8px;border-radius:999px;font-size:11px;border:1px solid ${palette.border};text-transform:uppercase;letter-spacing:.03em;color:${palette.text};}
        .history-type.listing{background:var(--accent-50);border-color:var(--accent-200);color:var(--accent-800, ${palette.primary});}
        .history-listing{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;align-items:center;}
        .history-region{font-size:12px;color:${palette.text};background:var(--surface-2);padding:2px 8px;border-radius:10px;}

        /* ——— ЛЕЙАУТ: фиксируем две колонки и запрещаем перенос ——— */
        .support-layout{
          margin-top:12px;
          display:flex;
          flex-wrap:nowrap;            /* фикс: не переносим колонки */
          justify-content:center;
          align-items:flex-start;
          gap:24px;
        }

        .support-panel{
          order:1;
          flex:1 1 auto;               /* занимает всё оставшееся место */
          min-width:420px;              /* чтобы не схлопывалась */
          background:${palette.surface};
          border:1px solid ${palette.border};
          border-radius:20px;
          display:flex;flex-direction:column;
          min-height:clamp(520px,60vh,640px);
          max-height:640px;
          box-shadow:var(--shadow-md);
          overflow:hidden;
        }

        .support-header{padding:16px 20px;border-bottom:1px solid ${palette.border};flex-shrink:0;}
        .support-header strong{display:block;margin-bottom:4px;font-size:16px;}
        .support-header p{margin:0;font-size:13px;color:${palette.muted};}
        .history-view-header{display:grid;gap:8px;}
        .history-view-meta{font-size:12px;color:${palette.muted};}
        .queue-info{margin-top:6px;font-size:13px;color:var(--accent-700,${palette.primary});font-weight:600;}

        .support-body{flex:1;min-height:0;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:8px;}

        .ticket-closed{border:1px dashed var(--accent-200);border-radius:16px;padding:18px 16px;background:var(--accent-50);display:grid;gap:8px;text-align:center;}
        .ticket-closed__title{font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-700);}
        .ticket-closed__text{font-size:13px;color:var(--text-600);}
        .ticket-closed__action{margin-top:4px;border:none;border-radius:12px;background:${palette.primary};color:#fff;padding:8px 14px;font-size:13px;cursor:pointer;}
        .ticket-closed__action:hover{opacity:.9;}

        .muted{font-size:13px;color:${palette.muted};}
        .typing{font-size:12px;color:${palette.primary};margin-top:auto;}

        .support-composer{padding:12px 18px 18px;border-top:1px solid ${palette.border};display:grid;gap:8px;flex-shrink:0;background:${palette.surface};}
        textarea{resize:none;width:100%;border-radius:12px;border:1px solid ${palette.border};padding:10px 12px;font-size:14px;outline:none;background:${palette.surfaceAlt};color:${palette.text};}
        textarea:focus{border-color:${palette.primary};box-shadow:0 0 0 2px rgba(42,101,247,.1);}
        .composer-actions{display:flex;justify-content:space-between;align-items:center;}
        .attach{display:inline-flex;width:36px;height:36px;border-radius:12px;border:1px solid ${palette.border};align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;background:${palette.surface};}
        .attach:hover{border-color:${palette.primary};}
        .attach.disabled{opacity:.5;cursor:not-allowed;}
        .attach input{display:none;}
        .composer-actions button{background:${palette.primary};border:none;color:#fff;padding:9px 18px;border-radius:12px;font-size:14px;cursor:pointer;}
        .composer-actions button:disabled{opacity:.6;cursor:not-allowed;}
        .error{font-size:12px;color:var(--danger-600,#d1434b);}

        /* ——— ПРАВАЯ КОЛОНКА: фиксированная ширина ——— */
        .support-history{
          order:2;
          flex:0 0 360px;              /* фикс: ширина 360px, не сжимать/не растить */
          min-width:340px;
          max-width:420px;
          background:${palette.surface};
          border:1px solid ${palette.border};
          border-radius:20px;
          padding:16px;
          display:flex;flex-direction:column;gap:16px;
          min-height:clamp(520px,60vh,640px);
          max-height:640px;
          box-shadow:var(--shadow-md);
          overflow:hidden;
        }

        .history-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;flex-shrink:0;}
        .history-header strong{font-size:16px;}
        .history-refresh{border:1px solid ${palette.border};border-radius:10px;background:${palette.surfaceAlt};color:${palette.text};padding:4px 10px;font-size:12px;cursor:pointer;}
        .history-refresh:disabled{opacity:.6;cursor:not-allowed;}

        .history-content{display:flex;flex-direction:column;gap:16px;flex:1;min-height:0;}
        .history-list-wrapper{background:${palette.surfaceAlt};border:1px solid ${palette.border};border-radius:16px;padding:14px;display:grid;align-content:start;gap:12px;flex:1 1 auto;min-height:0;max-height:100%;overflow-y:auto;}
        .history-list-wrapper p{margin:0;font-size:13px;color:${palette.muted};}
        .history-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;}
        .history-item button{width:100%;text-align:left;border:1px solid ${palette.border};border-radius:14px;background:${palette.surface};padding:10px 12px;display:grid;gap:6px;cursor:pointer;}
        .history-item.active button{border-color:${palette.primary};box-shadow:0 0 0 2px rgba(42,101,247,.12);}
        .history-item__row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:${palette.muted};}
        .history-status{font-weight:600;}
        .history-time{font-size:11px;color:${palette.muted};}
        .history-subject{font-size:12px;color:${palette.text};}
        .history-preview-text{font-size:12px;color:${palette.muted};}
        .history-queue{font-size:11px;color:${palette.primary};font-weight:600;}
        .history-info{font-size:12px;color:${palette.muted};padding:8px;text-align:center;}

        .history-preview{background:${palette.surfaceAlt};border:1px solid ${palette.border};border-radius:16px;padding:14px;display:grid;gap:10px;flex-shrink:0;}
        .history-preview__header{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:${palette.muted};}
        .history-preview__meta{font-size:12px;color:${palette.muted};}
        .history-preview__body{display:grid;gap:8px;}
        .history-preview__action{justify-self:start;border:1px solid ${palette.border};border-radius:10px;background:${palette.surface};color:${palette.text};padding:6px 12px;font-size:12px;cursor:pointer;transition:border-color .2s;}
        .history-preview__action:hover{border-color:${palette.primary};}

        /* Мобильная/планшетная адаптация — разрешаем стек */
        @media (max-width: 1024px){
          .support-layout{flex-direction:column;flex-wrap:nowrap;align-items:center;}
          .support-panel,.support-history{min-height:0;max-height:none;width:100%;max-width:520px;}
          .support-panel{min-width:0;}
          .support-history{flex:0 1 auto;min-width:0;}
          .history-list-wrapper{max-height:clamp(240px,45vh,420px);}
          .support-body{max-height:clamp(240px,45vh,420px);}
        }
        @media (max-width:768px){
          .support-chat{width:100%;}
          .support-body{max-height:320px;}
        }
      `}</style>
    </div>
  );
}
