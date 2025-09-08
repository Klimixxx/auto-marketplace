import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Admin() {
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // guard: впускаем только админа
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.role !== 'admin') { location.href = '/'; return; }
        setMe(d);
      })
      .catch(() => location.href = '/');
  }, []);

  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem('token');
    Promise.all([
      fetch(`${API}/api/admin/stats`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/api/admin/admins`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ])
      .then(([s, a]) => { setStats(s); setAdmins(a.items || []); })
      .catch(()=>{});
  }, [me]);

  async function addAdmin(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/add`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ user_code: code.trim() })
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Ошибка');
      setMsg('Админ добавлен'); setCode('');
      setAdmins(prev => prev.some(p => p.user_code === d.user.user_code) ? prev : [d.user, ...prev]);
    } catch (e) { setErr(e.message); }
  }

  const UI = {
    cardBg: '#0F172A', border: 'rgba(255,255,255,0.10)', title: '#E6EDF3', text: '#C7D2DE'
  };

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <h1 style={{ color: UI.title, marginBottom: 10 }}>Админ Панель</h1>

      {/* Дешборд */}
      <section style={{ margin:'16px 0' }}>
        <div style={{ background:UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:16 }}>
          <h3 style={{ marginTop:0 }}>Дешборд</h3>
          {!stats && <div>Загрузка…</div>}
          {stats && (
            <>
              <div style={{ display:'flex', gap:20, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:12, opacity:.8 }}>Пользователей</div>
                  <div style={{ fontSize:24, fontWeight:800 }}>{stats.users?.toLocaleString('ru-RU')}</div>
                </div>
              </div>
              <VisitsChart data={stats.visits || []} />
            </>
          )}
        </div>
      </section>

      {/* Администраторы */}
      <section style={{ margin:'16px 0' }}>
        <div style={{ background:UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:16 }}>
          <h3 style={{ marginTop:0 }}>Администраторы</h3>
          <form onSubmit={addAdmin} style={{ display:'flex', gap:8, margin:'8px 0 14px' }}>
            <input
              className="input"
              placeholder="ID пользователя (6 цифр)"
              value={code}
              onChange={e=>setCode(e.target.value.replace(/\D/g,''))}
              maxLength={6}
              style={{ width:220 }}
            />
            <button className="button">Добавить</button>
          </form>
          {err && <div style={{ color:'salmon' }}>{err}</div>}
          {msg && <div style={{ color:'lightgreen' }}>{msg}</div>}

          <div style={{ borderTop:'1px solid var(--line)' }}>
            {admins.map(a => (
              <div key={a.user_code}
                   style={{ padding:'8px 0', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between' }}>
                <div><b>{a.name || 'Без имени'}</b> · {a.phone || '—'} · ID: {a.user_code}</div>
                <div style={{ fontSize:12, opacity:.8 }}>{new Date(a.created_at).toLocaleDateString('ru-RU')}</div>
              </div>
            ))}
            {admins.length === 0 && <div>Пока нет админов.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

/* Простой столбиковый график на SVG */
function VisitsChart({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d=>d.cnt), 1);
  const w = 700, h = 160, pad = 20;
  const bar = (w - pad*2) / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} aria-label="Визиты за 30 дней">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      {data.map((d,i) => {
        const x = pad + i*bar + 2;
        const bh = Math.round((d.cnt / max) * (h - pad*2));
        const y = h - pad - bh;
        return <rect key={d.day} x={x} y={y} width={bar-4} height={bh} rx="3" fill="rgba(34,197,94,0.6)" />;
      })}
      <text x={w-pad} y={h-6} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.6)">
        последние 30 дней
      </text>
    </svg>
  );
}
