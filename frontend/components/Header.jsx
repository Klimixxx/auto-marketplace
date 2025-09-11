// components/Header.jsx
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Router from 'next/router';

const MAXW = 1100;
const API = process.env.NEXT_PUBLIC_API_BASE || ''; // если пусто — пойдём относительным путём

/* ===== helpers for UI ===== */
const UI = {
  topBg: '#0d0d0d', // мягкий чёрный для верхней шапки (БЫЛО: #1A1C20)
  topText: '#E6EDF3',
  topMuted: 'rgba(230,237,243,0.75)',
  border: 'rgba(255,255,255,0.10)',
  baseBg: 'transparent',
  inputBg: '#0B1220',
  inputText: '#E6EDF3',
  inputBorder: 'rgba(255,255,255,0.14)',
  pillBg: 'rgba(255,255,255,0.06)',
  blue: '#1E90FF',
  blueHover: '#1683ea',
  red: '#FF4D4F',
  yellow: '#FACC15',
  chipBg: 'rgba(255,255,255,0.06)',
  chipBorder: 'rgba(255,255,255,0.12)',
  menuBg: '#0F172A',
  menuBorder: 'rgba(255,255,255,0.10)',
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

/* ===== utils: запросы/парсинг ===== */
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
    else if (read === undefined) n++; // если эндпоинт уже отдаёт только непрочитанные
  }
  return n;
}
function parseUnreadCount(d){
  if (typeof d === 'number') return d;
  if (Array.isArray(d)) return d.length;
  if (!d || typeof d !== 'object') return 0;

  if (isFiniteNum(d.count)) return d.count;
  if (isFiniteNum(d.unread)) return d.unread;
  if (isFiniteNum(d.unreadCount)) return d.unreadCount;

  if (d.data){
    if (isFiniteNum(d.data.count)) return d.data.count;
    if (isFiniteNum(d.data.unread)) return d.data.unread;
    if (isFiniteNum(d.data.unreadCount)) return d.data.unreadCount;
    const arrD = d.data.items || d.data.rows || d.data.results || d.data.notifications;
    const byD = countUnreadInArray(arrD);
    if (byD != null) return byD;
  }

  const arr = d.items || d.rows || d.results || d.notifications;
  const byArr = countUnreadInArray(arr);
  if (byArr != null) return byArr;

  return 0;
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
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMe(d); })
        .catch(() => {});
    } else {
      // fallback на куки-сессию
      fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.user) { setMe(d.user); setAuthed(true); }})
        .catch(() => {});
    }
  }, []);

  // закрывать меню по клику вне
  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ===== unread badge: грузим/обновляем =====
  useEffect(() => {
    let aborted = false;

    async function fetchUnread() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = {
          'Accept': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        };
        const opts = { method: 'GET', credentials: 'include', headers };

        // пробуем несколько путей
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

  // обнуляем при заходе в /notifications, помечаем прочитанными
  useEffect(() => {
    const onRoute = async (url) => {
      if (!url.startsWith('/notifications')) return;
      setNotif(0);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        };
        const opts = { method: 'POST', credentials: 'include', headers };

        const markPaths = [
          '/api/notifications/mark-all-read',
          '/api/notifications/mark_read_all',
          '/api/notifications/read-all',
        ];
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
    // снимаем нижнюю линию у нижней шапки: borderBottom:'none' перекроет header-solid
    <header className="header-solid" style={{ width: '100%', position:'sticky', top:0, zIndex:1000, borderBottom:'none' }}>
      {/* Верхняя шапка — фон мягкий черный */}
      <div style={{ width:'100%', borderBottom: `1px solid ${UI.border}`, background: UI.topBg }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:44,
          display:'grid', gridTemplateColumns:'1fr auto',
          alignItems:'center', gap:12, padding:'0 12px'
        }}>
          <nav style={{ display:'flex', alignItems:'center', gap:18, fontSize:14 }}>
            <a href="/trades" className="nav-link gradtext">Торги</a>
            <a href="/inspections" className="nav-link gradtext">Мои Осмотры</a>
            <a href="/support" className="nav-link gradtext">Поддержка</a>
            {me?.role === 'admin' && <a href="/admin" className="nav-link gradtext">Админ Панель</a>}
          </nav>

          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {me && (
              <div style={{
                padding:'6px 10px', borderRadius:10,
                background: UI.chipBg, border:`1px solid ${UI.chipBorder}`, fontWeight:700
              }}>
                Баланс: {fmtRub.format(balance)}
              </div>
            )}

            <IconButton ariaLabel="Уведомления" onClick={() => router.push('/notifications')} badge={notif}>
              <BellIcon />
            </IconButton>

            {/* ТВОЙ БЛОК АККАУНТА ОСТАВЛЕН */}
            <div style={{ position:'relative' }} ref={menuRef}>
              <button
                onClick={() => (authed ? setMenuOpen(o => !o) : (location.href = '/login'))}
                title={authed ? 'Открыть меню' : 'Войти'}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                  background: UI.pillBg, border:`1px solid ${UI.border}`, borderRadius:10,
                  cursor:'pointer', color:UI.topText
                }}
              >
                <span style={{
                  display:'inline-flex', width:26, height:26, borderRadius:'50%',
                  background:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center',
                  border:`1px solid ${UI.border}`
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
                      padding:'12px 14px', cursor:'pointer', color: UI.topText }}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя шапка */}
      <div style={{ width:'100%' }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:64,
          display:'grid', gridTemplateColumns:'auto 1fr',
          alignItems:'center', gap:16, padding:'0 12px'
        }}>
          <Logo onClick={() => router.push('/')} />

          {/* УБРАЛИ «рамку»: снят класс header-searchbar и любые границы/фон у контейнера */}
          <div style={{ padding: 0 }}>
            <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10 }}>
              <button
                type="button" onClick={() => router.push('/trades')}
                style={{
                  display:'inline-flex', alignItems:'center', gap:8,
                  height:44, padding:'0 12px', borderRadius:10,
                  background:UI.pillBg, /* нет внешней рамки контейнера */
                  color:UI.topText, cursor:'pointer', whiteSpace:'nowrap', border:'none'
                }}
              >
                <SearchSmallIcon /> Все категории <ChevronDownIcon />
              </button>
              <input
                value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по объявлениям"
                style={{
                  height:44, borderRadius:10, padding:'0 12px',
                  background:UI.inputBg, /* оставляем собственную четкую рамку инпута */
                  border:`1px solid ${UI.inputBorder}`,
                  color:UI.inputText, minWidth:200
                }}
              />
              <button type="submit"
                style={{
                  height:44, padding:'0 16px', borderRadius:10,
                  background:UI.blue, color:'#fff', fontWeight:800, cursor:'pointer', border:'none'
                }}
                onMouseEnter={(e)=>e.currentTarget.style.background = UI.blueHover}
                onMouseLeave={(e)=>e.currentTarget.style.background = UI.blue}
              >
                Найти
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ===== UI sub-components ===== */
function IconButton({ ariaLabel, onClick, children, badge }) {
  const badgeText = badge > 99 ? '99+' : String(badge || '');
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        position:'relative', width:40, height:40, borderRadius:10,
        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer'
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
    <a href={href} style={{ display:'block', padding:'12px 14px', color:'#E6EDF3', textDecoration:'none' }}>
      {text}
    </a>
  );
}
function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
      <div style={{
        width:28, height:28, borderRadius:8,
        background:'linear-gradient(135deg,#22C55E 0%,#10B981 100%)',
        display:'grid', placeItems:'center', color:'#0B1220', fontWeight:900, fontSize:14
      }}>A</div>
      <div style={{ color:'#fff', fontWeight:900, letterSpacing:.3 }}>
        AuctionA<span style={{ color:'#EF4444' }}>f</span>to
      </div>
    </div>
  );
}
function BellIcon(){
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 17h14l-2-3v-4a5 5 0 10-10 0v4l-2 3Z" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 20a2.5 2.5 0 005 0" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function SearchSmallIcon(){
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="#E6EDF3" strokeWidth="1.6" />
      <path d="M20 20L17 17" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChevronDownIcon(){
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="#E6EDF3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
