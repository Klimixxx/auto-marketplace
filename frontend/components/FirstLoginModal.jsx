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

  // Цвета модалки
  const UI = {
    overlay: 'rgba(0,0,0,0.55)',
    cardBg: '#0F172A',
    border: 'rgba(255,255,255,0.10)',
    title: '#E6EDF3',
    text: '#C7D2DE',
    inputBg: '#0B1220',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputText: '#E6EDF3',
    btnBg: '#152235',
    btnHover: '#1A2A44',
    btnText: '#E6EDF3',
    accent: '#22C55E'
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !API) return;
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => (r.ok ? r.json() : null))
      .then(u => {
        setMe(u);
        if (u && !u.name) setOpen(true);
        if (u?.name) setName(u.name);
        if (u?.email) setEmail(u.email);
      })
      .catch(() => {});
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
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить профиль');
      setOk('Профиль сохранён');
      setOpen(false);
      location.reload(); // чтобы шапка подтянула имя
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: UI.overlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
    }}>
      <form onSubmit={saveProfile} style={{
        background: UI.cardBg,
        color: UI.text,
        border: `1px solid ${UI.border}`,
        borderRadius: 14,
        padding: 20,
        width: 'min(520px, 92vw)',
        display: 'grid',
        gap: 12,
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
      }}>
        <h3 style={{ margin: 0, color: UI.title }}>Завершите регистрацию</h3>

        <label>Имя или Username <span style={{ color: UI.accent }}>*</span></label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Например: Klim"
          style={{
            background: UI.inputBg,
            color: UI.inputText,
            border: `1px solid ${UI.inputBorder}`,
            borderRadius: 10,
            padding: '10px 12px'
          }}
        />

        <label>Почта (необязательно)</label>
        <input
          className="input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            background: UI.inputBg,
            color: UI.inputText,
            border: `1px solid ${UI.inputBorder}`,
            borderRadius: 10,
            padding: '10px 12px'
          }}
        />

        {err && <div style={{ color: '#f88' }}>{err}</div>}
        {ok && <div style={{ color: UI.accent }}>{ok}</div>}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="button"
            onClick={() => setOpen(false)}
            style={{
              background: 'transparent',
              border: `1px solid ${UI.inputBorder}`,
              color: UI.text,
              padding: '10px 12px',
              borderRadius: 10
            }}
          >
            Позже
          </button>
          <button
            className="button"
            disabled={saving}
            style={{
              background: UI.btnBg,
              border: `1px solid ${UI.inputBorder}`,
              color: UI.btnText,
              padding: '10px 12px',
              borderRadius: 10,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
          >
            {saving ? 'Сохраняю…' : 'Закончить регистрацию'}
          </button>
        </div>
      </form>
    </div>
  );
}
