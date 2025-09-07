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

export default function Header() {
  const [me, setMe] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const UI = {
    headerBg: 'linear-gradient(90deg, #0B1220 0%, #0E1A2E 100%)',
    headerBorder: 'rgba(255,255,255,0.08)',
    text: '#E6EDF3',
    subtext: '#9BA7B4',
    buttonBg: '#152235',
    buttonHover: '#1A2A44',
    buttonBorder: 'rgba(255,255,255,0.10)',
    accent: '#22C55E',
    menuBg: '#0F172A',
    menuBorder: 'rgba(255,255,255,0.10)',
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setAuthed(Boolean(token));
    if (token && API) {
      fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
        .then(r => (r.ok ? r.json() : null))
        .then(setMe)
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const username = me?.name || (authed ? 'Аккаунт' : 'Войти');
  const balance = typeof me?.balance === 'number' ? me.balance : 0;
  const fmtRub = new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 });

  return (
    <header
      className="header"
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
      <a href="/" style={{ display:'flex', alignItems:'center', textDecoration:'none', color: UI.text }}>
        <img src="/logo.png" alt="AuctionAfto" style={{ height: 50, width: 'auto', display:'block' }} />
      </a>

      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <a href="/trades" style={{ color: UI.subtext, textDecoration: 'none' }}>Торги</a>
        

        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => (authed ? setOpen(o => !o) : (location.href = '/login'))}
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
          {authed && open && (
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
              {/* ВЕРХНЯЯ ПЛАШКА: баланс + иконка + имя */}
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
                    Баланс: <span style={{ color: UI.accent, fontWeight:700 }}>{fmtRub.format(balance)}</span>
                  </div>
                </div>
              </div>

              {/* Пункты меню */}
              <MenuItem href="/trades" text="Мои Торги" />
              <MenuItem href="/account" text="Личный Кабинет" />
              <MenuItem href="/inspections" text="Мои Осмотры" />
              <MenuItem href="/support" text="Поддержка" />
              <MenuItem href="/favorites" text="Избранное" />
              <hr style={{ margin: 0, border: 'none', borderTop: `1px solid ${UI.menuBorder}` }} />
              <button
                onClick={() => { localStorage.removeItem('token'); location.href = '/'; }}
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
      </nav>
    </header>
  );
}

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
