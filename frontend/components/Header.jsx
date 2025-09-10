// components/Header.jsx
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

const MAXW = 1100;
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

export default function Header() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notif] = useState(0);
  const menuRef = useRef(null);

  const UI = {
    topBg: '#1A1C20',
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

  // Грузим профиль
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setAuthed(Boolean(token));
    if (token) {
      fetch(`${API || ''}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
        .then(async r => {
          let d = null; try { d = await r.json(); } catch {}
          if (!r.ok) return null;
          return d;
        })
        .then(d => { if (d) setMe(d); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
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
    <header style={{ width:'100%' }}>
      {/* Верхняя шапка */}
      <div style={{ width:'100%', background: UI.topBg, borderBottom: `1px solid ${UI.border}` }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:44,
          display:'grid', gridTemplateColumns:'1fr auto',
          alignItems:'center', gap:12, padding:'0 12px'
        }}>
          {/* Навигация */}
         <nav style={{ display:'flex', alignItems:'center', gap:18, color:UI.topMuted, fontSize:14 }}>
  <a href="/trades">Торги</a>
  <a href="/inspections">Мои Осмотры</a>
  <a href="/support">Поддержка</a>
  {me?.role === 'admin' && <a href="/admin">Админ Панель</a>}
</nav>


          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Баланс */}
            {me && (
  <div style={{
    padding:'6px 10px', borderRadius:10,
    background: UI.chipBg, border:`1px solid ${UI.chipBorder}`, fontWeight:700
  }}>
    Баланс: {fmtRub.format(balance)}
  </div>
)}


            {/* Уведомления */}
            <IconButton ariaLabel="Уведомления" onClick={() => router.push('/notifications')} badge={notif}>
              <BellIcon />
            </IconButton>

            {/* Аккаунт — твой блок */}
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
                  <div style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                    borderBottom:`1px solid ${UI.menuBorder}`, background:'rgba(255,255,255,0.03)'
                  }}>
                    <span style={{
                      display:'inline-flex', width:34, height:34, borderRadius:'50%',
                      background:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center',
                      border:`1px solid ${UI.menuBorder}`
                    }}>
                      <IconUser size={18} color={UI.topText} />
                    </span>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {me?.name || 'Аккаунт'}
                      </div>
                      <div style={{ fontSize:12, opacity:.8 }}>
                        Баланс: <span style={{ color: UI.yellow, fontWeight:700 }}>{fmtRub.format(balance)}</span>
                      </div>
                    </div>
                  </div>

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
      <div style={{ width:'100%', background: UI.baseBg }}>
        <div style={{
          maxWidth: MAXW, margin:'0 auto', height:64,
          display:'grid', gridTemplateColumns:'auto 1fr',
          alignItems:'center', gap:16, padding:'0 12px'
        }}>
          <Logo onClick={() => router.push('/')} />

          <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10 }}>
            <button
              type="button" onClick={() => router.push('/trades')}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                height:44, padding:'0 12px', borderRadius:10,
                background:UI.pillBg, border:`1px solid ${UI.inputBorder}`,
                color:UI.topText, cursor:'pointer', whiteSpace:'nowrap'
              }}
            >
              <SearchSmallIcon /> Все категории <ChevronDownIcon />
            </button>

            <input
              value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по объявлениям"
              style={{
                height:44, borderRadius:10, padding:'0 12px',
                background:UI.inputBg, border:`1px solid ${UI.inputBorder}`,
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
    </header>
  );
}

/* вспомогательные компоненты */
function IconButton({ ariaLabel, onClick, children, badge }) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        position:'relative', width:40, height:40, borderRadius:10,
        background:'rgba(255,255,255,0.06)', border:`1px solid rgba(255,255,255,0.10)`,
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
          border:'2px solid #1A1C20'
        }}>{badge}</span>
      )}
    </button>
  );
}
function MenuItem({ href, text }) {
  return (
    <a href={href} style={{
      display:'block', padding:'12px 14px', color:'#E6EDF3', textDecoration:'none'
    }}>
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
    <svg width="22" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 17h14l-2-3v-4a5 5 0 10-10 0v4l-2 3Z" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 20a2.5 2.5 0 005 0" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function SearchSmallIcon(){
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#E6EDF3" strokeWidth="1.6" />
      <path d="M20 20L17 17" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChevronDownIcon(){
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="#E6EDF3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
