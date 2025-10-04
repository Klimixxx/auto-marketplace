import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminNotify() {
  const [me, setMe] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.role !== 'admin') { location.href = '/'; return; }
        setMe(d);
        // автоподстановка из query
        const params = new URLSearchParams(location.search);
        const code = params.get('user_code') || '';
        if (code) setUserCode(code);
      })
      .catch(() => location.href = '/');
  }, []);

  async function send(e){
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      if (!/^\d{6}$/.test(userCode)) throw new Error('Укажите ID (6 цифр)');
      if (!title.trim() || !body.trim()) throw new Error('Введите заголовок и описание');
      const token = localStorage.getItem('token');
      const r = await fetch(`${API}/api/admin/notify`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ user_code: userCode.trim(), title: title.trim(), body: body.trim() })
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Не удалось отправить');
      setMsg('Уведомление отправлено');
      setTitle(''); setBody('');
    } catch (e) { setErr(e.message); }
  }

  return (
    <AdminLayout me={me} title="Отправить уведомление пользователю">
      <form onSubmit={send} style={{ display:'grid', gap:12 }}>
        <div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>ID пользователя (6 цифр)</div>
          <input className="input" value={userCode}
                 onChange={e=>setUserCode(e.target.value.replace(/\D/g,''))} maxLength={6} style={{ width:220 }} />
        </div>

        <div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>Заголовок</div>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Заголовок" />
        </div>

        <div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>Описание</div>
          <textarea className="input" value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder="Текст уведомления" />
        </div>

        {err && <div style={{ color:'salmon' }}>{err}</div>}
        {msg && <div style={{ color:'lightgreen' }}>{msg}</div>}

        <div>
          <button className="button">Отправить</button>
        </div>
      </form>
    </AdminLayout>
  );
}
