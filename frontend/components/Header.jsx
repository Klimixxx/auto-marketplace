// components/Header.jsx
import { useEffect, useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE;

function IconUser({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

function IconBell({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z" fill={color} opacity="0.9"/>
      <path d="M6 9a6 6 0 1 1 12 0c0 3 1.5 4.5 2 5H4c.5-.5 2-2 2-5Z"
            fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Header() {
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const UI = {
    headerBg: 'linear-gradient(90deg, #0B1220 0%, #0E1A2E 100%)',
    headerBorder: 'rgba(255,255,255,0.08)',
    text: '#E6EDF3',
    subtext: '#9BA7B4',
    buttonBg: '#152235',
    buttonHover: '#1A2A44',
    buttonBorder: 'rgba(255,255,255,0.10)',
    accent: '#22C55E',
    chipBg: 'rgba(255,255,255,0.06)',
    chipBorder: 'rgba(255,255,255,0.12)',
    menuBg: '#0F172A',
    menuBorder: 'rgba(255,255,255,0.10)',
    line: 'rgba(255,255,255,0.08)',
    bellBg: '#152235',
    bellBorder: 'rgba(255,255,255,0.10)',
    badgeBg: '#EF4444', // красный бейдж непрочитанных
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setAuthed(Boolean(token));
    if (token && API) {
      fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
        .then(async (r) => {
          let d = null;
          try { d = await r.json(); } catch {}
          if (r.status === 403 && d?.error === 'blocked') {
            localStorage.removeItem('token');
            alert('Ваш аккаунт заблокирован. Свяжитесь с поддержкой.');
            location.href = '/login';
            return null;
          }
          if (!r.ok) return null;
          return d;
        })
        .then(setMe)
        .catch(() => {});
    }
  }, []);

  function logout() {
    localStorage.removeItem('token');
    location.href = '/';
  }

  const username = me?.name || (authed ? 'Аккаунт' : 'Войти');
  const balance = typeof me?.balance === 'number' ? me.balance : 0;
  const fmtRub = new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 });

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: UI.headerBg,
        borderBottom: `1px solid ${UI.headerBorder}`,
        color: UI.text,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* ЛОГО */}
      <a href="/" style={{ display:'flex', alignItems:'center', textDecoration:'none', color: UI.text }}>
        <img src="/logo.png" alt="AuctionAfto" style={{ height: 50, width: 'auto', display:'block' }} />
      </a>

      {/* НАВИГАЦИЯ */}
      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <a href="/trades" style={{ color: UI.subtext, textDecoration: 'none' }}>Торги</a>
        {me?.role === 'admin' && (
          <a href="/admin" style={{ color: UI.subtext, textDecoration: 'none' }}>
            Админ Панель
          </a>
        )}
      </nav>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Баланс (виден, если залогинен) */}
        {me && (
          <div
            title="Актуальный баланс"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: UI.chipBg,
              border: `1px solid ${UI.chipBorder}`,
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            <span style={{ opacity: .85 }}>{fmtRub.format(balance)}</span>
          </div>
        )}

        {/* Колокольчик уведомлений (только если залогинен) */}
        {authed && <NotificationsBell />}

        {/* Аккаунт */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => (authed ? setMenuOpen(o => !o) : (location.href = '/login'))}
            title={authed ? 'Открыть меню' : 'Войти'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: UI.buttonBg,
              border: `1px solid ${UI.buttonBorder}`,
              borderRadius: 10,
              cursor: 'pointer',
              color: UI.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = UI.buttonHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = UI.buttonBg)}
          >
            <span
              style={{
                display: 'inline-flex',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${UI.buttonBorder}`,
              }}
            >
              <IconUser size={16} color={UI.text} />
            </span>
            <span
              style={{
                fontWeight: 700,
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: authed ? UI.text : UI.accent,
              }}
            >
              {username}
            </span>
          </button>

          {/* Выпадающее меню */}
          {authed && menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                background: UI.menuBg,
                border: `1px solid ${UI.menuBorder}`,
                borderRadius: 12,
                boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
                minWidth: 260,
                zIndex: 60,
                overflow: 'hidden',
              }}
            >
              {/* Верхняя плашка: иконка + имя + баланс */}
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                borderBottom:`1px solid ${UI.menuBorder}`, background:'rgba(255,255,255,0.03)'
              }}>
                <span style={{
                  display:'inline-flex', width:34, height:34, borderRadius:'50%',
                  background:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center',
                  border:`1px solid ${UI.menuBorder}`
                }}>
                  <IconUser size={18} color={UI.text} />
                </span>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {username}
                  </div>
                  <div style={{ fontSize:12, opacity:.8 }}>
                    Баланс: <span style={{ color: '#22C55E', fontWeight:700 }}>{fmtRub.format(balance)}</span>
                  </div>
                </div>
              </div>

              {/* Пункты меню */}
              <MenuItem href="/my-trades" text="Мои Торги" />
              <MenuItem href="/account" text="Личный Кабинет" />
              <MenuItem href="/inspections" text="Мои Осмотры" />
              <MenuItem href="/support" text="Поддержка" />
              <MenuItem href="/favorites" text="Избранное" />
              <hr style={{ margin: 0, border: 'none', borderTop: `1px solid ${UI.menuBorder}` }} />
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: UI.text,
                }}
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ===== Колокольчик уведомлений с бейджем ===== */
function NotificationsBell() {
  const API = process.env.NEXT_PUBLIC_API_BASE;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  function cap(n) {
    if (!n) return 0;
    return n > 99 ? '99+' : n;
  }

  // клик вне — закрыть
  useEffect(() => {
    function onDoc(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // слушаем событие «прочитано» со страницы /notifications
  useEffect(() => {
    function onRead() { refreshUnread(); }
    window.addEventListener('notifications-read', onRead);
    return () => window.removeEventListener('notifications-read', onRead);
  }, []);

  useEffect(() => { refreshUnread(); }, []); // стартовая подгрузка счётчика

  function refreshUnread() {
    const token = localStorage.getItem('token');
    if (!token || !API) return;
    fetch(`${API}/api/notifications/unread-count`, { headers: { Authorization:'Bearer '+token } })
      .then(r => r.json())
      .then(d => setUnread(d.count || 0))
      .catch(() => {});
  }

  // при открытии — загрузим последние уведомления
  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('token');
    if (!token || !API) return;
    fetch(`${API}/api/notifications?limit=5`, { headers: { Authorization:'Bearer '+token } })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Уведомления"
        style={{
          position:'relative',
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          width: 40,
          height: 40,
          background: '#152235',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10,
          cursor: 'pointer',
          color: '#E6EDF3',
        }}
      >
        <IconBell />
        {unread ? (
          <span
            style={{
              position:'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 9,
              background: '#EF4444',
              color: 'white',
              fontSize: 11,
              fontWeight: 800,
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow:'0 0 0 2px #0E1A2E', // обводка под фон шапки
            }}
          >
            {cap(unread)}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            width: 320,
            background: 'rgba(15,23,42,1)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 8,
            zIndex: 60,
          }}
        >
          <div style={{ padding: '6px 8px', fontWeight: 700 }}>Уведомления</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
          {items.length === 0 && <div style={{ padding: 10, opacity: .8 }}>Пока пусто</div>}
          {items.map((n) => (
            <a
              key={n.id}
              href="/notifications"
              style={{ display: 'block', padding: '8px 10px', textDecoration: 'none', color: 'inherit', borderRadius: 8 }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{n.title}</div>
              <div style={{ fontSize: 12, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.body}
              </div>
              <div style={{ fontSize: 11, opacity: .6, marginTop: 4 }}>
                {new Date(n.created_at).toLocaleString('ru-RU')}
              </div>
            </a>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
          <a href="/notifications" className="button" style={{ width: '100%', textAlign: 'center' }}>
            Все уведомления
          </a>
        </div>
      )}
    </div>
  );
}

/* ===== Вспомогалки ===== */
function MenuItem({ href, text }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: '12px 14px',
        color: '#E6EDF3',
        textDecoration: 'none',
      }}
    >
      {text}
    </a>
  );
}
