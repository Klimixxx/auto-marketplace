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
      .then((r) => r.json())
      .then((d) => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => { location.href = '/'; });
  }, []);

  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem('token');
    fetch(`${API}/api/admin/admins`, { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((d) => setAdmins(d.items || []))
      .catch(() => {});
  }, [me]);

  async function addAdmin(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ user_code: code.trim() }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Ошибка');
      setMsg('Админ добавлен');
      setCode('');
      setAdmins((prev) => (prev.some((p) => p.user_code === d.user.user_code) ? prev : [d.user, ...prev]));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function removeAdmin(codeToRemove) {
    if (!codeToRemove) return;
    const confirmed = window.confirm('Убрать администратора?');
    if (!confirmed) return;
    setErr('');
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/admins/${codeToRemove}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Ошибка');
      setAdmins((prev) => prev.filter((p) => p.user_code !== codeToRemove));
      setMsg('Администратор удалён');
    } catch (e) {
      setErr(e.message);
    }
  }

  const myCode = me?.user_code;

  return (
    <AdminLayout me={me} title="Администраторы">
      <form onSubmit={addAdmin} style={{ display: 'flex', gap: 8, margin: '8px 0 14px' }}>
        <input
          className="input"
          placeholder="ID пользователя (6 цифр)"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
          style={{ width: 220 }}
        />
        <button className="button">Добавить</button>
      </form>
      {err && <div style={{ color: 'salmon' }}>{err}</div>}
      {msg && <div style={{ color: 'lightgreen' }}>{msg}</div>}

      <div style={{ borderTop: '1px solid var(--line)' }}>
        {admins.map((a) => {
          const isSelf = Boolean(myCode && myCode === a.user_code);
          return (
            <div
              key={a.user_code}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <b>{a.name || 'Без имени'}</b> · {a.phone || '—'} · ID: {a.user_code}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{new Date(a.created_at).toLocaleDateString('ru-RU')}</div>
                <button
                  type="button"
                  onClick={() => removeAdmin(a.user_code)}
                  disabled={isSelf}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #ef4444',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: isSelf ? 'not-allowed' : 'pointer',
                    opacity: isSelf ? 0.5 : 1,
                  }}
                >
                  Убрать
                </button>
              </div>
            </div>
          );
        })}
        {admins.length === 0 && <div>Пока нет админов.</div>}
      </div>
    </AdminLayout>
  );
}
