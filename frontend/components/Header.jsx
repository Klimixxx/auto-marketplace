// components/Header.jsx
import { useEffect, useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Header() {
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !API) return;
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(()=>{});
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const username = me?.name || 'Аккаунт';

  return (
    <header className="header" style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 16px', borderBottom:'1px solid #eee'
    }}>
      <a href="/" style={{fontWeight:700}}>Auto Auctions Hub</a>

      <nav style={{display:'flex', gap:16, alignItems:'center'}}>
        <a href="/trades">Торги</a>
        <a href="/account">Кабинет</a>

        {/* Меню аккаунта */}
        <div ref={ref} style={{position:'relative'}}>
          <button onClick={()=>setOpen(o=>!o)} style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
            border:'1px solid #ddd', borderRadius:8, background:'#fff', cursor:'pointer'
          }}>
            <span style={{
              display:'inline-flex', width:24, height:24, borderRadius:'50%',
              border:'1px solid #ddd', alignItems:'center', justifyContent:'center'
            }}>👤</span>
            <span style={{fontWeight:600, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {username}
            </span>
          </button>

          {open && (
            <div style={{
              position:'absolute', right:0, top:'calc(100% + 8px)',
              background:'#fff', border:'1px solid #ddd', borderRadius:10,
              boxShadow:'0 8px 24px rgba(0,0,0,0.08)', minWidth:220, zIndex:20
            }}>
              <MenuItem href="/trades" text="Мои Торги" />
              <MenuItem href="/account" text="Личный Кабинет" />
              <MenuItem href="/settings" text="Настройки" />
              <MenuItem href="/support" text="Поддержка" />
              <MenuItem href="/favorites" text="Избранное" />
              <hr style={{margin:'8px 0', border:'none', borderTop:'1px solid #eee'}} />
              <button
                onClick={() => { localStorage.removeItem('token'); location.href='/'; }}
                style={{width:'100%', textAlign:'left', background:'none', border:'none', padding:'10px 12px', cursor:'pointer'}}
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
    <a href={href} style={{display:'block', padding:'10px 12px'}}>
      {text}
    </a>
  );
}
