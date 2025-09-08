import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminAdmins() {
  const [me, setMe] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

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
    fetch(`${API}/api/admin/admins`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setAdmins(d.items || []))
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

  return (
    <AdminLayout me={me} title="Администраторы">
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
    </AdminLayout>
  );
}
