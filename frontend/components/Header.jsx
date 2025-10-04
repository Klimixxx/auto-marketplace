// frontend/components/Header.jsx
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Router from 'next/router';


const MAXW = 1100;
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');


const UI = {
  // Черный фон для верхней шапки
  topBg: '#000000',
  topText: '#ffffff',
  topMuted: 'rgba(255,255,255,0.7)',
  border: 'rgba(255,255,255,0.1)',
  baseBg: 'var(--surface-1)',

  inputBg: '#ffffff',
  inputBorder: 'var(--border)',
  inputBorderFocus: 'var(--outline)',
  inputText: 'var(--text)',
  inputPlaceholder: 'var(--text-muted)',

  btnBg: 'var(--accent)',
  btnHover: 'var(--accent-hover)',
  btnText: 'var(--text-on-accent)',
  btnSoftBg: 'rgba(42,101,247,0.08)',
  btnSoftText: 'var(--accent)',
  btnSoftHoverBg: 'rgba(42,101,247,0.16)',

  navLinkColor: '#2a65f7',
  navLinkHover: '#1f4fe3',

  link: 'var(--accent)',
  linkHover: 'var(--accent-hover)',
  icon: '#ffffff',
  iconMuted: 'rgba(255,255,255,0.7)',

  menuBg: 'var(--surface-1)',
  menuBorder: 'rgba(15,23,42,0.08)',

  heroBtn: 'var(--accent)',
  heroBtnHover: 'var(--accent-hover)',
  red: '#ef4444',
  yellow: '#facc15',
  chipBg: 'rgba(42,101,247,0.12)',
  chipBorder: 'rgba(42,101,247,0.24)',
  notice: 'var(--accent)',
  pillBg: 'rgba(42,101,247,0.10)',
};


function IconUser({ size = 20, color = '#ffffff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}


/* ===== utils ===== */
function join(path) {
  if (!path) return API_BASE || '';
  return API_BASE ? `${API_BASE}${path}` : path;
}
async function safeJson(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
function isFiniteNum(x) {
  return typeof x === 'number' && isFinite(x);
}
function parseBalance(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
function countUnreadInArray(arr) {
  if (!Array.isArray(arr)) return null;
  let n = 0;
  for (const it of arr) {
    const read = it?.read ?? it?.is_read ?? it?.isRead ?? it?.seen ?? it?.is_seen;
    if (read === false || read === 0 || read === '0') n++;
    else if (read === undefined) n++;
  }
  return n;
}
function pickFiniteNumber(values) {
  for (const value of values) {
    if (isFiniteNum(value)) return value;
  }
  return null;
}
function pickFromCollections(collections) {
  for (const set of collections) {
    const count = countUnreadInArray(set);
    if (count != null) return count;
  }
  return null;
}
function parseUnreadCount(d) {
  let result = 0;
  let resolved = false;

  if (typeof d === 'number') {
    result = d;
    resolved = true;
  } else if (Array.isArray(d)) {
    result = d.length;
    resolved = true;
  } else if (d && typeof d === 'object') {
    const direct = pickFiniteNumber([d.count, d.unread, d.unreadCount]);
    if (direct != null) {
      result = direct;
      resolved = true;
    } else {
      let candidate = null;

      if (d.data && typeof d.data === 'object') {
        const nestedDirect = pickFiniteNumber([d.data.count, d.data.unread, d.data.unreadCount]);
        if (nestedDirect != null) {
          result = nestedDirect;
          resolved = true;
        } else {
          candidate = pickFromCollections([
            d.data.items,
            d.data.rows,
            d.data.results,
            d.data.notifications,
          ]);
        }
      }

      if (!resolved) {
        if (candidate == null) {
          candidate = pickFromCollections([d.items, d.rows, d.results, d.notifications]);
        }
        if (candidate != null) {
          result = candidate;
          resolved = true;
        }
      }
    }
  }

  if (!resolved && !isFiniteNum(result)) {
    result = 0;
  }

  return isFiniteNum(result) ? result : 0;
}


/* ===== Header ===== */
export default function Header({ user }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notif, setNotif] = useState(0);
  const [tradeUnread, setTradeUnread] = useState(0);
  const [inspectionUnread, setInspectionUnread] = useState(0);
  const menuRef = useRef(null);

  // профиль
  useEffect(() => {
    if (user && user.id) {
      setMe(user);
      setAuthed(true);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setAuthed(Boolean(token));
    if (token) {
      fetch(join('/api/me'), { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setMe(d);
        })
        .catch(() => {});
    } else if (API_BASE) {
      fetch(join('/api/me'), { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const fetchedUser = d?.user ?? d;
          if (fetchedUser?.id) {
            setMe(fetchedUser);
            setAuthed(true);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // клик вне меню
  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // unread badge
  useEffect(() => {
    let aborted = false;

    async function fetchUnread() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = {
          Accept: 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        };
        const opts = { method: 'GET', credentials: 'include', headers };
        const paths = [
          '/api/notifications/unread',
          '/api/notifications/unread-count',
          '/api/notifications/count',
          '/api/notifications?status=unread',
          '/api/notifications',
        ];
        let count = 0;
        for (const p of paths) {
          const res = await safeJson(join(p), opts);
          if (!res) continue;
          const c = parseUnreadCount(res);
          if (typeof c === 'number') {
            count = c;
            break;
          }
        }
        if (!aborted) setNotif(Number(count) || 0);
      } catch {
        if (!aborted) setNotif(0);
      }
    }

    fetchUnread();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(fetchUnread, 60000);
    return () => {
      aborted = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let ignore = false;

    async function load() {
      if (ignore) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) { setInspectionUnread(0); return; }
      try {
        const res = await fetch(join('/api/inspections/unread-count'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setInspectionUnread(Number(data?.count) || 0);
      } catch (err) {
        if (!ignore) setInspectionUnread(0);
        console.warn('Failed to load inspection counter', err);
      }
    }

    load();
    const handler = () => load();
    window.addEventListener('inspections-refresh-count', handler);

    return () => {
      ignore = true;
      window.removeEventListener('inspections-refresh-count', handler);
    };
  }, [authed]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let ignore = false;

    async function load() {
      if (ignore) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) { setTradeUnread(0); return; }
      try {
        const res = await fetch(join('/api/trade-orders/unread-count'), {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('status ' + res.status);
        const data = await res.json();
        if (!ignore) setTradeUnread(Number(data?.count) || 0);
      } catch (err) {
        if (!ignore) setTradeUnread(0);
        console.warn('Failed to load trade orders counter', err);
      }
    }

    load();
    const handler = () => load();
    window.addEventListener('trade-orders-refresh-count', handler);

    return () => {
      ignore = true;
      window.removeEventListener('trade-orders-refresh-count', handler);
    };
  }, [authed]);

  // при заходе в /notifications обнуляем и помечаем прочитанными
  useEffect(() => {
    const onRoute = async (url) => {
      if (!url.startsWith('/notifications')) return;
      setNotif(0);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        };
        const opts = { method: 'POST', credentials: 'include', headers };
        const markPaths = [
          '/api/notifications/mark-all-read',
          '/api/notifications/mark_read_all',
          '/api/notifications/read-all',
        ];
        for (const p of markPaths) {
          await fetch(join(p), opts).catch(() => {});
        }
      } catch {}
    };
    Router.events.on('routeChangeComplete', onRoute);
    return () => Router.events.off('routeChangeComplete', onRoute);
  }, []);

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      setMe(null);
      setAuthed(false);
      location.href = '/';
    }
  }

  const username = me?.name || (authed ? 'Аккаунт' : 'Войти');
  const balance = parseBalance(me?.balance);
  const fmtRub = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  });

  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const s = q.trim();
    router.push(s ? `/trades?q=${encodeURIComponent(s)}` : '/trades');
  };

  const renderNavLink = (href, label, badge = 0) => {
    const badgeValue = Number(badge) || 0;
    const badgeText = badgeValue > 99 ? '99+' : String(badgeValue);
    
    const baseStyle = {
      color: '#2a65f7 !important',
      textDecoration: 'none !important',
      display: 'inline-flex !important',
      alignItems: 'center !important',
      gap: '6px !important',
      fontWeight: '600 !important',
      padding: '8px 0 !important',
      background: 'transparent !important',
      border: 'none !important',
      borderRadius: '0 !important',
      transition: 'color 0.2s ease !important',
    };
    
    return (
      <a
        href={href}
        style={baseStyle}
        onMouseEnter={(event) => {
          event.currentTarget.style.setProperty('color', '#1f4fe3', 'important');
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.setProperty('color', '#2a65f7', 'important');
        }}
      >
        <span style={{ color: 'inherit !important' }}>{label}</span>
        {badgeValue > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              background: '#ff4444 !important',
              color: '#fff !important',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {badgeText}
          </span>
        )}
      </a>
    );
  };
  

  return (
    <header
      className="header-solid"
      style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000, borderBottom: 'none' }}
    >
      {/* Верхняя шапка - черный фон */}
      <div
        style={{
          width: '100%',
          borderBottom: `1px solid ${UI.border}`,
          background: UI.topBg,
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            maxWidth: MAXW,
            margin: '0 auto',
            height: 56,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 16,
            padding: '0 16px',
            color: UI.topText,
          }}
        >
          <nav style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 14 }}>
            {renderNavLink('/trades', 'Торги')}
            {renderNavLink('/my-trades', 'Мои Торги', tradeUnread)}
            {renderNavLink('/inspections', 'Мои Осмотры', inspectionUnread)}
            {renderNavLink('/support', 'Поддержка')}
            {me?.role === 'admin' && (
              renderNavLink('/admin', 'Админ Панель')
            )}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {me && (
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Баланс: {fmtRub.format(balance)}
              </div>
            )}

            <IconButton ariaLabel="Уведомления" onClick={() => router.push('/notifications')} badge={notif}>
              <BellIcon />
            </IconButton>

            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => (authed ? setMenuOpen((o) => !o) : (location.href = '/login'))}
                title={authed ? 'Открыть меню' : 'Войти'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  event.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  event.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                >
                  <IconUser size={16} color="#ffffff" />
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#ffffff',
                  }}
                >
                  {username}
                </span>
              </button>

              {authed && menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    background: UI.menuBg,
                    border: `1px solid ${UI.menuBorder}`,
                    borderRadius: 16,
                    boxShadow: '0 26px 48px rgba(15,23,42,0.14)',
                    minWidth: 260,
                    zIndex: 60,
                    overflow: 'hidden',
                  }}
                >
                  <MenuItem href="/my-trades" text="Мои Торги" badge={tradeUnread} />
                  <MenuItem href="/account" text="Личный Кабинет" />
                  <MenuItem href="/inspections" text="Мои Осмотры" badge={inspectionUnread} />
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
                      color: 'var(--text-900)',
                      fontWeight: 600,
                    }}
                  >
                    Выход
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя шапка */}
      <div className="header--bottom" style={{ width: '100%', borderBottom: 'none', background: 'inherit' }}>
        <div
          style={{
            maxWidth: MAXW,
            margin: '0 auto',
            height: 64,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            alignItems: 'center',
            gap: 16,
            padding: '0 12px',
          }}
        >
          <Logo onClick={() => router.push('/')} />

          <div style={{ padding: 0 }}>
            <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push('/trades')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  background: UI.btnBg,
                  color: UI.btnText,
                  border: '1px solid ' + UI.btnBg,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
              >
                Все категории
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0 }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск по объявлениям"
                  style={{
                    height: 44,
                    padding: '0 12px',
                    background: UI.inputBg,
                    border: `1px solid ${UI.inputBorder}`,
                    color: UI.inputText,
                    minWidth: 200,
                    borderTopLeftRadius: 10,
                    borderBottomLeftRadius: 10,
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    height: 44,
                    padding: '0 16px',
                    background: UI.btnBg,
                    color: UI.btnText,
                    cursor: 'pointer',
                    border: '1px solid ' + UI.btnBg,
                    borderLeft: 'none',
                    borderTopRightRadius: 10,
                    borderBottomRightRadius: 10,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
                >
                  Поиск
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}


/* ===== sub-components ===== */
function IconButton({ ariaLabel, onClick, children, badge }) {
  const badgeText = badge > 99 ? '99+' : String(badge || '');
  const handleMouseEnter = (event) => {
    event.currentTarget.style.background = 'rgba(255,255,255,0.15)';
    event.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
  };
  const handleMouseLeave = (event) => {
    event.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    event.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
  };

  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#ffffff',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
      {badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            background: '#FF4D4F',
            color: '#fff',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            border: '2px solid #000000',
            lineHeight: '18px',
          }}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
}


function MenuItem({ href, text, badge = 0 }) {
  const value = Number(badge) || 0;
  const badgeText = value > 99 ? '99+' : String(value);
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '12px 16px',
        color: 'var(--text-strong)',
        textDecoration: 'none',
        fontWeight: 600,
        transition: 'background 0.2s ease, color 0.2s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'rgba(42,101,247,0.08)';
        event.currentTarget.style.color = 'var(--accent)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = 'var(--text-strong)';
      }}
    >
      <span>{text}</span>
      {value > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 999,
            background: 'rgba(239,68,68,0.9)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {badgeText}
        </span>
      )}
    </a>
  );
}


function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <div style={{ color: 'var(--text-strong)', fontWeight: 900, letterSpacing: 0.3, fontSize: 18 }}>
        AuctionA<span style={{ color: '#ef4444' }}>f</span>to
      </div>
    </div>
  );
}


function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 17h14l-2-3v-4a5 5 0 10-10 0v4l-2 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 20a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
