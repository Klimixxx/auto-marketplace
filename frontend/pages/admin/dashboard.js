import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminDashboard() {
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => location.href = '/');
  }, []);

  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem('token');
    fetch(`${API}/api/admin/stats`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setStats).catch(()=>{});
  }, [me]);

  const users = stats?.users ?? 0;

  return (
    <AdminLayout me={me} title="Дешборд">
      {!stats && <div>Загрузка…</div>}
      {stats && (
        <>
          <div style={{ display:'flex', gap:20, marginBottom:12 }}>
            <Stat title="Пользователей" value={users.toLocaleString('ru-RU')} />
          </div>
          <VisitsChart data={stats.visits || []} />
        </>
      )}
    </AdminLayout>
  );
}

function Stat({ title, value }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.03)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, padding:'12px 14px', minWidth:220
    }}>
      <div style={{ fontSize:12, opacity:.8 }}>{title}</div>
      <div style={{ fontSize:24, fontWeight:800 }}>{value}</div>
    </div>
  );
}

function VisitsChart({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d=>d.cnt), 1);
  const w = 800, h = 200, pad = 22;
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
