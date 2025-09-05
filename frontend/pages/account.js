// pages/account.js
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Account() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Не удалось загрузить профиль'); return d; })
      .then(setMe)
      .catch(e => setErr(e.message));
  }, []);

  async function updateField(field) {
    setErr(''); setMsg('');
    const label = field === 'name' ? 'Имя или Username'
                 : field === 'email' ? 'Почта'
                 : 'Телефон (+79XXXXXXXXX)';
    const current = field === 'phone' ? me?.phone : me?.[field] || '';
    const value = prompt(`Введите ${label}`, current || '');
    if (value === null) return; // отменил
    try {
      const token = localStorage.getItem('token');
      const body = { [field]: value };
      const res = await fetch(`${API}/api/me`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось сохранить');

      setMe(data.user);
      setMsg('Сохранено');
      // если вернулся новый токен (меняли телефон) — обновим его
      if (data.token) localStorage.setItem('token', data.token);
      // чтобы шапка обновила имя — можно перезагрузить:
      // location.reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  const Section = ({ title, children }) => (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{title}</h2>
      <div className="card" style={{ display: 'grid', gap: 10, padding: 16 }}>
        {children}
      </div>
    </section>
  );

  const Row = ({ label, value, actionText, onClick }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontWeight: 600 }}>{value || '—'}</div>
      </div>
      {onClick && (
        <button className="button" onClick={onClick} style={{ padding: '8px 12px' }}>
          {actionText}
        </button>
      )}
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1>Личный кабинет</h1>

      {err && <div style={{ color: 'salmon' }}>{err}</div>}
      {msg && <div style={{ color: 'lightgreen' }}>{msg}</div>}
      {!me && !err && <div>Загрузка…</div>}

      {me && (
        <>
          <Section title="Информация об аккаунте">
            <Row label="ID пользователя" value={me.user_code} />
            <Row label="Имя" value={me.name} actionText="Изменить" onClick={() => updateField('name')} />
            <Row
              label="Телефон"
              value={me.phone}
              actionText="Изменить"
              onClick={() => updateField('phone')}
            />
            <Row
              label="Почта"
              value={me.email}
              actionText={me.email ? 'Изменить' : 'Добавить'}
              onClick={() => updateField('email')}
            />
          </Section>
        </>
      )}
    </div>
  );
}
