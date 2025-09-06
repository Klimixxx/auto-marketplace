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

  function setUser(u){ setMe(u); }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1>Личный кабинет</h1>

      {err && <div style={{ color: 'salmon' }}>{err}</div>}
      {msg && <div style={{ color: 'lightgreen' }}>{msg}</div>}
      {!me && !err && <div>Загрузка…</div>}

      {me && (
        <>
          <Section title="Информация об аккаунте">
            <StaticRow label="ID пользователя" value={me.user_code} />
            <EditRow label="Имя" field="name" value={me.name} onSaved={setUser} />
            <EditRow label="Телефон" field="phone" value={me.phone} type="tel" onSaved={(u, token) => {
              setUser(u); if (token) localStorage.setItem('token', token);
            }} />
            <EditRow label="Почта" field="email" value={me.email} type="email" addText="Добавить" onSaved={setUser} />
          </Section>

          <Section title="Баланс">
            <BalanceRow balance={me.balance ?? 0} onChange={(newBal)=> setUser({ ...me, balance: newBal })} />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{title}</h2>
      <div className="card" style={{ display: 'grid', gap: 10, padding: 16 }}>
        {children}
      </div>
    </section>
  );
}

function StaticRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontWeight: 600 }}>{value || '—'}</div>
      </div>
      <div />
    </div>
  );
}

function EditRow({ label, field, value, type='text', addText='Изменить', onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ setVal(value || ''); }, [value]);

  async function save() {
    setErr(''); setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/me`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ [field]: val })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось сохранить');
      onSaved(data.user, data.token);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        {!editing ? (
          <div style={{ fontWeight: 600, overflow:'hidden', textOverflow:'ellipsis' }}>{value || '—'}</div>
        ) : (
          <input
            className="input"
            type={type}
            value={val}
            onChange={(e)=>setVal(e.target.value)}
            placeholder={label}
            style={{ width: '100%' }}
          />
        )}
        {err && <div style={{ color:'salmon', fontSize:12 }}>{err}</div>}
      </div>
      {!editing ? (
        <button className="button" onClick={()=>setEditing(true)}>
          {value ? 'Изменить' : addText}
        </button>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          <button className="button" onClick={save} disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
          <button className="button" onClick={()=>{ setEditing(false); setVal(value||''); }} style={{opacity:.8}}>Отмена</button>
        </div>
      )}
    </div>
  );
}

function BalanceRow({ balance, onChange }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const fmt = new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:2 });

  async function topUp() {
    setErr(''); setSaving(true);
    try {
      const val = parseFloat(String(amount).replace(',', '.'));
      if (!val || val <= 0) throw new Error('Введите сумму больше 0');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/me/balance-add`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount: val })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось пополнить');
      onChange(data.balance);
      setEditing(false);
      setAmount('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Актуальный баланс</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt.format(balance || 0)}</div>
      </div>
      {!editing ? (
        <button className="button" onClick={()=>setEditing(true)}>Пополнить баланс</button>
      ) : (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input
            className="input"
            placeholder="Сумма, ₽"
            value={amount}
            onChange={(e)=>setAmount(e.target.value)}
            style={{ width: 140 }}
          />
          <button className="button" onClick={topUp} disabled={saving}>{saving ? 'Провожу…' : 'Пополнить'}</button>
          <button className="button" onClick={()=>{setEditing(false); setAmount('');}} style={{opacity:.8}}>Отмена</button>
          {err && <div style={{ color:'salmon', fontSize:12 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
