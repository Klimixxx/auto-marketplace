// frontend/components/Header.jsx
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const MAXW = 1100;

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
};

function IconUser({ size = 16, color = '#E6EDF3' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

export default function Header({ user }) {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [notif] = useState(0); // по умолчанию непрочитанных нет
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [width, setWidth] = useState(0);

  const acctRef = useRef(null);
  const notifRef = useRef(null);
  const moreRef = useRef(null);

  const displayName = (user?.fullName || user?.name || user?.username || user?.email || null);
  const authed = !!user; // ключевое поведение: если есть user — считаем авторизованным

  useEffect(() => {
    const update = () => setWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const go = (path) => router.push(path);
  const submit = (e) => {
    e.preventDefault();
    const s = q.trim();
    router.push(s ? `/trades?q=${encodeURIComponent(s)}` : '/trades');
  };

  const isNarrow = width && width < 980;

  async function logoutUser() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (e) {
      console.error('Ошибка выхода', e);
    }
  }

  return (
    <header style={{ width: '100%' }}>
      {/* Верхняя шапка */}
      <div style={{ width: '100%', background: UI.topBg, borderBottom: `1px solid ${UI.border}` }}>
        <div style={{
          maxWidth: MAXW, margin: '0 auto', height: 44,
          display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: 12, padding: '0 12px'
        }}>
          <TopLeftNav
            isNarrow={isNarrow}
            onGo={go}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            moreRef={moreRef}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BalancePill onClick={() => go('/balance')} />

            <div ref={notifRef} style={{ position: 'relative' }}>
              <IconButton ariaLabel="Уведомления" onClick={() => setNotifOpen(o => !o)} badge={notif}>
                <BellIcon />
              </IconButton>
              {notifOpen && (
                <Dropdown style={{ right: 0, minWidth: 280 }}>
                  <DropdownHeader title="Уведомления" />
                  <DropdownItem onClick={() => go('/notifications')}>Новых уведомлений нет</DropdownItem>
                </Dropdown>
              )}
            </div>

            {/* ИКОНКА АККАУНТА — как раньше: если не залогинен → /login, иначе открывает меню */}
            <div ref={acctRef} style={{ position: 'relative' }}>
              <button
                onClick={() => (authed ? setAcctOpen(o => !o) : go('/login'))}
                title={authed ? (displayName || 'Аккаунт') : 'Войти'}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  background:UI.pillBg, border:`1px solid ${UI.border}`,
                  borderRadius:999, padding:'6px 10px',
                  color:UI.topText, cursor:'pointer'
                }}
              >
                <span style={{
                  display:'inline-flex', width:26, height:26, borderRadius:'50%',
                  background:'rgba(255,255,255,0.06)',
                  alignItems:'center', justifyContent:'center',
                  border:`1px solid ${UI.border}`
                }}>
                  <IconUser />
                </span>
                <span style={{
                  fontSize:13, maxWidth:140, overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap'
                }}>
                  {authed ? (displayName || 'Аккаунт') : 'Войти'}
                </span>
                <ChevronDownIcon />
              </button>

              {acctOpen && authed && (
                <Dropdown style={{ right: 0, minWidth: 220 }}>
                  {/* аватарка + имя сверху */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 12px',
                    borderBottom:`1px solid ${UI.border}`
                  }}>
                    <span style={{
                      width:32, height:32, borderRadius:999,
                      background:'rgba(255,255,255,0.06)',
                      display:'grid', placeItems:'center', color:'#fff', fontWeight:800,
                      border:`1px solid ${UI.border}`
                    }}>
                      <IconUser />
                    </span>
                    <span style={{ color:'#fff', fontWeight:700 }}>
                      {displayName || 'Аккаунт'}
                    </span>
                  </div>

                  <DropdownItem onClick={() => go('/account')}>Личный кабинет</DropdownItem>
                  <DropdownItem onClick={() => go('/inspections')}>Мои осмотры</DropdownItem>
                  <DropdownItem onClick={() => go('/favorites')}>Избранное</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={() => go('/admin')}>Админ-панель</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={logoutUser}>Выйти</DropdownItem>
                </Dropdown>
              )}

              {!authed && acctOpen && (
                <Dropdown style={{ right: 0, minWidth: 200 }}>
                  <DropdownItem onClick={() => go('/login')}>Войти</DropdownItem>
                </Dropdown>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя шапка */}
      <div style={{ width: '100%', background: UI.baseBg }}>
        <div style={{
          maxWidth: MAXW, margin: '0 auto',
          height: 64, display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center', gap: 16, padding: '0 12px'
        }}>
          <Logo onClick={() => go('/')} />

          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10 }}>
            <button
              type="button" onClick={() => go('/trades')}
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

            <button
              type="submit"
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

/* ────────────── Подкомпоненты ────────────── */

function TopLeftNav({ isNarrow, onGo, menuOpen, setMenuOpen, moreRef }) {
  const links = [
    { label: 'Админ-панель', href: '/admin' },
    { label: 'Торги', href: '/trades' },
    { label: 'Помощь', href: '/help' },
    { label: 'Мои осмотры', href: '/inspections' },
  ];
  const visible = isNarrow ? links.slice(0, 2) : links;
  const hidden = isNarrow ? links.slice(2) : [];

  return (
    <nav style={{ display:'flex', alignItems:'center', gap:18, color:UI.topMuted, fontSize:14 }}>
      {visible.map((l) => (
        <a key={l.href} onClick={() => onGo(l.href)} style={{ cursor:'pointer' }}>{l.label}</a>
      ))}
      {hidden.length > 0 && (
        <div ref={moreRef} style={{ position:'relative' }}>
          <a onClick={() => setMenuOpen(o=>!o)} style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
            Ещё <ChevronDownIcon />
          </a>
          {menuOpen && (
            <Dropdown style={{ left:0, minWidth:180 }}>
              {hidden.map((l)=>(
                <DropdownItem key={l.href} onClick={() => onGo(l.href)}>{l.label}</DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>
      )}
    </nav>
  );
}

function BalancePill({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:'6px 10px', borderRadius:10, background:UI.pillBg,
        border:`1px solid ${UI.border}`, color:UI.topText, fontWeight:700, fontSize:13, cursor:'pointer'
      }}
    >
      Баланс: 0 ₽
    </button>
  );
}

function IconButton({ ariaLabel, onClick, children, badge }) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        position:'relative', width:34, height:34, borderRadius:10,
        background:UI.pillBg, border:`1px solid ${UI.border}`,
        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position:'absolute', top:-6, right:-6,
          minWidth:18, height:18, padding:'0 5px',
          background:UI.red, color:'#fff', borderRadius:999, fontSize:11, fontWeight:800,
          display:'grid', placeItems:'center', border:'2px solid ' + UI.topBg
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ui helpers */
function Dropdown({ children, style }) {
  return (
    <div style={{
      position:'absolute', top:'calc(100% + 8px)', ...style,
      background:'#0F172A', border:'1px solid rgba(255,255,255,0.10)',
      borderRadius:12, padding:8, boxShadow:'0 12px 30px rgba(0,0,0,0.35)', zIndex:50
    }}>
      {children}
    </div>
  );
}
function DropdownHeader({ title }) {
  return <div style={{ padding:'8px 10px', color:'#cbd5e1', fontSize:12, textTransform:'uppercase', letterSpacing:.5 }}>{title}</div>;
}
function DropdownItem({ children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ padding:'10px 12px', borderRadius:8, color:'#E6EDF3', cursor:'pointer' }}
      onMouseEnter={(e)=> (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e)=> (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}
function DropdownDivider(){ return <div style={{ height:1, background:'rgba(255,255,255,0.08)', margin:'6px 4px' }} />; }

/* Логотип + иконки */
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
