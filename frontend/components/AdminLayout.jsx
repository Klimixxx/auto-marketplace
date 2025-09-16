import { useRouter } from 'next/router';

export default function AdminLayout({ me, title, children }) {
  const router = useRouter();

  const UI = {
    cardBg: '#0F172A',
    border: 'rgba(255,255,255,0.10)',
    title: '#E6EDF3',
    text: '#C7D2DE',
    menuBg: 'rgba(255,255,255,0.03)',
    menuBorder: 'rgba(255,255,255,0.08)',
    link: '#C7D2DE',
    linkActiveBg: 'rgba(34,197,94,0.10)',
    linkActiveBorder: 'rgba(34,197,94,0.30)',
  };

  const NavLink = ({ href, children }) => {
    const active = router.pathname === href;
    return (
      <a
        href={href}
        style={{
          display:'block',
          padding:'10px 12px',
          borderRadius:10,
          textDecoration:'none',
          color: UI.link,
          background: active ? UI.linkActiveBg : 'transparent',
          border: active ? `1px solid ${UI.linkActiveBorder}` : '1px solid transparent',
        }}
      >
        {children}
      </a>
    );
  };

  return (
    <div className="container" style={{ maxWidth: 1280 }}>
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, alignItems:'start' }}>
        <aside>
          <div style={{
            background: UI.menuBg,
            border:`1px solid ${UI.menuBorder}`,
            borderRadius:12,
            padding:14,
            display:'grid',
            gap:12,
            position:'sticky',
            top: 86,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span
                aria-hidden
                style={{
                  display:'inline-flex', width:34, height:34, borderRadius:'50%',
                  background:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center',
                  border:`1px solid ${UI.menuBorder}`
                }}
              >
                <IconUser size={18} color={UI.title} />
              </span>
              <div>
                <div style={{ color: UI.title, fontWeight:700, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {me?.name || 'Администратор'}
                </div>
                <div style={{ color: UI.text, fontSize:12, opacity:.8 }}>ID: {me?.user_code || '—'}</div>
              </div>
            </div>

            <div style={{ height:1, background: UI.menuBorder }} />

            <nav style={{ display:'grid', gap:8 }}>
              <NavLink href="/admin/stats">Статистика</NavLink>
              <NavLink href="/admin/users">Пользователи</NavLink>
              <NavLink href="/admin/admins">Администраторы</NavLink>
              <NavLink href="/admin/listings">Объявления</NavLink>
            </nav>
          </div>
        </aside>

        <main>
          <h1 style={{ color: UI.title, marginBottom: 10 }}>{title}</h1>
          <div style={{ background:UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:16 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function IconUser({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}
