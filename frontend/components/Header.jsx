// frontend/components/Header.jsx
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Router from 'next/router';

const MAXW = 1100;
const API = process.env.NEXT_PUBLIC_API_BASE || ''; // если пусто — относительные пути

const UI = {
  /* Верхняя часть шапки */
  topBg: '#0b0b0f',
  topText: '#f7f7f7',
  topMuted: 'rgba(247,247,247,0.70)',
  topBorder: 'rgba(255,255,255,0.14)',

  /* Нижняя часть шапки */
  baseBg: '#ffffff',
  baseText: '#111827',
  baseBorder: 'rgba(17,24,39,0.08)',

  /* Поля в шапке */
  inputBg: '#f3f4f6',
  inputBorder: 'rgba(17,24,39,0.16)',
  inputBorderFocus: 'rgba(42,101,247,0.45)',
  inputText: '#111827',
  inputPlaceholder: 'rgba(17,24,39,0.45)',

  /* Кнопки */
  btnBg: '#2a65f7',
  btnHover: '#1e53d6',
  btnText: '#ffffff',
  btnSoftBg: 'rgba(42,101,247,0.08)',
  btnSoftText: '#1e53d6',
  btnSoftHoverBg: 'rgba(42,101,247,0.14)',

  /* Ссылки/иконки/меню */
  link: '#2a65f7',
  linkHover: '#1e53d6',
  icon: '#111827',
  iconMuted: 'rgba(17,24,39,0.65)',
  pillBg: 'rgba(255,255,255,0.10)',
  basePillBg: '#f3f4f6',

  /* Фон меню и бордеры */
  menuBg: '#ffffff',
  menuBorder: 'rgba(17,24,39,0.12)',
  menuText: '#111827',

  /* Прочее */
  heroBtn: '#2a65f7',
  heroBtnHover: '#1e53d6',
  red: '#ef4444',
  yellow: '#facc15',
  chipBg: 'rgba(255,255,255,0.12)',
  chipBorder: 'rgba(255,255,255,0.28)',
};

function IconUser({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

/* ===== utils ===== */
function join(path){ return (API ? API.replace(/\/+$/,'') : '') + path; }
async function safeJson(url, opts){
  try { const r = await fetch(url, opts); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
}
function isFiniteNum(x){ return typeof x === 'number' && isFinite(x); }
function countUnreadInArray(arr){
  if (!Array.isArray(arr)) return null;
  let n = 0;
  for (const it of arr){
    const read = it?.read ?? it?.is_read ?? it?.isRead ?? it?.seen ?? it?.is_seen;
    if (read === false || read === 0 || read === '0') n++;
    else if (read === undefined) n++;
  }
  return n;
}
function pickFiniteNumber(values){
  for (const value of values){
    if (isFiniteNum(value)) return value;
  }
  return null;
}
function pickFromCollections(collections){
  for (const set of collections){
    const count = countUnreadInArray(set);
    if (count != null) return count;
  }
  return null;
}
function parseUnreadCount(d){
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
          candidate = pickFromCollections([
            d.items,
            d.rows,
            d.results,
            d.notifications,
          ]);
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
export default function Header() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notif, setNotif] = useState(0);
  const menuRef = useRef(null);

  // профиль
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setAuthed(Boolean(token));
    if (token) {
      fetch(join('/api/me'), { headers: { Authorization: 'Bearer ' + token } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) setMe(d); })
        .catch(() => {});
    } else if (API) {
      fetch(join('/api/me'), { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const user = d?.user ?? d;
          if (user?.id) {
            setMe(user);
            setAuthed(true);
          }
        })
        .catch(() => {});
    }
  }, []);

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
        const headers = { 'Accept':'application/json', ...(token ? { Authorization:'Bearer '+token } : {}) };
        const opts = { method: 'GET', credentials: 'include', headers };
        const paths = ['/api/notifications/unread','/api/notifications/unread-count','/api/notifications/count','/api/notifications?status=unread','/api/notifications'];
        let count = 0;
        for (const p of paths) {
          const res = await safeJson(join(p), opts);
          if (!res) continue;
          const c = parseUnreadCount(res);
          if (typeof c === 'number') { count = c; break; }
        }
        if (!aborted) setNotif(Number(count) || 0);
      } catch {
        if (!aborted) setNotif(0);
      }
    }

    fetchUnread();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchUnread(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(fetchUnread, 60000);
    return () => { aborted = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // при заходе в /notifications обнуляем и помечаем прочитанными
  useEffect(() => {
    const onRoute = async (url) => {
      if (!url.startsWith('/notifications')) return;
      setNotif(0);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = { 'Accept':'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization:'Bearer '+token } : {}) };
        const opts = { method: 'POST', credentials: 'include', headers };
        const markPaths = ['/api/notifications/mark-all-read','/api/notifications/mark_read_all','/api/notifications/read-all'];
        for (const p of markPaths) { await fetch(join(p), opts).catch(() => {}); }
      } catch {}
    };
    Router.events.on('routeChangeComplete', onRoute);
    return () => Router.events.off('routeChangeComplete', onRoute);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    location.href = '/';
  }

  const username = me?.name || (authed ? 'Аккаунт' : 'Войти');
  const balance = typeof me?.balance === 'number' ? me.balance : 0;
  const fmtRub = new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 });

  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const s = q.trim();
    router.push(s ? `/trades?q=${encodeURIComponent(s)}` : '/trades');
  };

  return (
    // нижняя линия у общей шапки скрыта
    <header className="header-solid" style={{ width:'100%', position:'sticky', top:0, zIndex:1000, borderBottom:'none' }}>
      {/* Верхняя шапка: мягкий черный */}
      <div style={{ width:'100%', borderBottom: `1px solid ${UI.topBorder}`, background: UI.topBg, color: UI.topText }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:44,
          display:'grid', gridTemplateColumns:'1fr auto',
          alignItems:'center', gap:12, padding:'0 12px'
        }}>
          <nav style={{ display:'flex', alignItems:'center', gap:18, fontSize:14, color: UI.topText }}>
            <a href="/trades" className="nav-link gradtext">Торги</a>
            <a href="/inspections" className="nav-link gradtext">Мои Осмотры</a>
            <a href="/support" className="nav-link gradtext">Поддержка</a>
            {me?.role === 'admin' && <a href="/admin" className="nav-link gradtext">Админ Панель</a>}
          </nav>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {me && (
              <div style={{
                padding:'6px 10px', borderRadius:10,
                background: UI.chipBg, border:`1px solid ${UI.chipBorder}`, fontWeight:700
              }}>
                Баланс: {fmtRub.format(balance)}
              </div>
            )}

            {/* уведомления — компактнее контейнер */}
            <IconButton ariaLabel="Уведомления" onClick={() => router.push('/notifications')} badge={notif}>
              <BellIcon />
            </IconButton>

            {/* Аккаунт */}
            <div style={{ position:'relative' }} ref={menuRef}>
              <button
                onClick={() => (authed ? setMenuOpen(o => !o) : (location.href = '/login'))}
                title={authed ? 'Открыть меню' : 'Войти'}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                  background: UI.pillBg, border:`1px solid ${UI.topBorder}`, borderRadius:10,
                  cursor:'pointer', color:UI.topText
                }}
              >
                <span style={{
                  display:'inline-flex', width:24, height:24, borderRadius:'50%',
                  background:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center',
                  border:`1px solid ${UI.topBorder}`
                }}>
                  <IconUser size={16} color={UI.topText} />
                </span>
                <span style={{
                  fontWeight:700,
                  maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  color: authed ? UI.topText : UI.yellow
                }}>
                  {username}
                </span>
              </button>

              {authed && menuOpen && (
                <div style={{
                  position:'absolute', right:0, top:'calc(100% + 8px)',
                  background: UI.menuBg, border:`1px solid ${UI.menuBorder}`, borderRadius:12,
                  boxShadow:'0 12px 28px rgba(0,0,0,0.25)', minWidth:260, zIndex:60, overflow:'hidden'
                }}>
                  <MenuItem href="/my-trades" text="Мои Торги" />
                  <MenuItem href="/account" text="Личный Кабинет" />
                  <MenuItem href="/inspections" text="Мои Осмотры" />
                  <MenuItem href="/support" text="Поддержка" />
                  <MenuItem href="/favorites" text="Избранное" />
                  <hr style={{ margin:0, border:'none', borderTop:`1px solid ${UI.menuBorder}` }} />
                  <button onClick={logout}
                    style={{ width:'100%', textAlign:'left', background:'none', border:'none',
                      padding:'12px 14px', cursor:'pointer', color: UI.menuText }}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя шапка */}
      <div style={{ width:'100%', background: UI.baseBg, borderBottom: `1px solid ${UI.baseBorder}` }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:64,
          display:'grid', gridTemplateColumns:'auto 1fr',
          alignItems:'center', gap:16, padding:'0 12px',
          color: UI.baseText
        }}>
          {/* ЛОГО: только текст, сделали чуть крупнее */}
          <Logo onClick={() => router.push('/')} />

          {/* Поисковая группа: input и «Найти» соединены */}
          <div style={{ padding: 0 }}>
            <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:10 }}>
              <button
                type="button" onClick={() => router.push('/trades')}
                style={{
                  display:'inline-flex', alignItems:'center', gap:8,
                  height:44, padding:'0 12px', borderRadius:10,
                  background:UI.basePillBg, color:UI.baseText, cursor:'pointer', whiteSpace:'nowrap',
                  border:`1px solid ${UI.baseBorder}`
                }}
              >
                Все категории
              </button>

              {/* обёртка для связки input + button без зазора */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:0 }}>
                <input
                  value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по объявлениям"
                  style={{
                    height:44, padding:'0 12px',
                    background:UI.inputBg, border:`1px solid ${UI.inputBorder}`,
                    color:UI.inputText, minWidth:200,
                    borderTopLeftRadius:10, borderBottomLeftRadius:10,
                    borderTopRightRadius:0, borderBottomRightRadius:0,
                    borderRight:'none' // чтобы рамка была общей с кнопкой
                  }}
                />
                <button
                  type="submit"
                  style={{
                    height:44, padding:'0 16px',
                    background:UI.heroBtn, color:UI.btnText,
                    cursor:'pointer', border:'1px solid ' + UI.inputBorder,
                    borderLeft:'none',
                    borderTopRightRadius:10, borderBottomRightRadius:10,
                    borderTopLeftRadius:0, borderBottomLeftRadius:0,
                    fontWeight:600 /* вместо 800 — убрали жирный */
                  }}
                  onMouseEnter={(e)=>e.currentTarget.style.background = UI.heroBtnHover}
                  onMouseLeave={(e)=>e.currentTarget.style.background = UI.heroBtn}
                >
                  Найти
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
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      // компактный контейнер под иконку
      style={{
        position:'relative', width:36, height:36, borderRadius:10,
        background:UI.pillBg, border:`1px solid ${UI.topBorder}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', color: UI.topText
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position:'absolute', top:-6, right:-6,
          minWidth:18, height:18, padding:'0 5px',
          background:'#FF4D4F', color:'#fff', borderRadius:999,
          fontSize:11, fontWeight:800, display:'grid', placeItems:'center',
          border:'2px solid #1A1C20', lineHeight:'18px'
        }}>{badgeText}</span>
      )}
    </button>
  );
}
function MenuItem({ href, text }) {
  return (
    <a
      href={href}
      style={{
        display:'block',
        padding:'12px 14px',
        color: UI.menuText,
        textDecoration:'none',
        transition:'background 0.2s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(17,24,39,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {text}
    </a>
  );
}
function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
      <div style={{ color:UI.baseText, fontWeight:900, letterSpacing:.3, fontSize:18 }}>
        AuctionA<span style={{ color:UI.red }}>f</span>to
      </div>
    </div>
  );
}
function BellIcon(){
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 17h14l-2-3v-4a5 5 0 10-10 0v4l-2 3Z" stroke={UI.topText} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 20a2.5 2.5 0 005 0" stroke={UI.topText} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
