// components/FirstLoginModal.jsx
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function FirstLoginModal() {
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !API) return;
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setMe(u);
        if (u && !u.name) setOpen(true); // нет имени → показать модалку
      })
      .catch(()=>{});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (!name.trim()) { setErr('Введите имя или username'); return; }
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type':'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить профиль');
      setOk('Профиль сохранён'); setOpen(false);
      // опционально перезагрузить, чтобы шапка подтянула имя
      location.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:999
    }}>
      <form onSubmit={saveProfile} style={{
        background:'#fff', borderRadius:12, padding:20, width:'min(480px, 92vw)',
        display:'grid', gap:12
      }}>
        <h3>Завершите регистрацию</h3>
        <label>Имя или Username <span style={{color:'#d33'}}>*</span></label>
        <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Например: Klim" />

        <label>Почта (необязательно)</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />

        {err && <div style={{color:'salmon'}}>{err}</div>}
        {ok && <div style={{color:'lightgreen'}}>{ok}</div>}

        <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
          <button type="button" className="button" onClick={()=>setOpen(false)} style={{opacity:.7}}>Позже</button>
          <button className="button" disabled={saving}>{saving ? 'Сохраняю…' : 'Закончить регистрацию'}</button>
        </div>
      </form>
    </div>
  );
}
