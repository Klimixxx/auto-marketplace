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

  const UI = {
    pageBg: 'linear-gradient(90deg, #0B1220 0%, #0E1A2E 100%)', // фон страницы как в шапке
    title: '#E6EDF3',
    muted: 'var(--muted)',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBorder: 'rgba(255,255,255,0.08)',
    accent: '#22C55E',
    inputBorder: 'rgba(255,255,255,0.12)',
  };

  return (
    <div style={{ background: UI.pageBg, minHeight: '100vh', padding: '16px 0 40px' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        {/* Заголовок + иконка аккаунта слева */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${UI.inputBorder}`,
            }}
          >
            <IconUser size={18} color={UI.title} />
          </span>
          <h1 style={{ margin: 0, color: UI.title }}>Личный кабинет</h1>
        </div>

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

            {/* Поддержка с копированием и переходом по ссылке */}
            <Section title="Поддержка">
              <SupportItem
                icon={<TelegramIcon/>}
                label="Telegram"
                value="@auctionafto"
                copyText="@auctionafto"
                href="https://t.me/auctionafto"
              />
              <SupportItem
                icon={<MailIcon/>}
                label="Почта"
                value="tklimov01@gmail.com"
                copyText="tklimov01@gmail.com"
                href="mailto:tklimov01@gmail.com"
              />
              <SupportItem
                icon={<WhatsAppIcon/>}
                label="WhatsApp"
                value="+7 985 619-93-59"
                copyText="+79856199359"
                href="https://wa.me/79856199359"
              />
              <SupportItem
                icon={<ClockIcon/>}
                label="Время работы"
                value="Пн.–Пят. 10:00–20:00"
                copyText="Пн.–Пят. 10:00–20:00"
              />
            </Section>
          </>
        )}
      </div>
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

/* ——— Support with copy ——— */
function SupportItem({ icon, label, value, copyText, href }) {
  const [copied, setCopied] = useState(false);

  const body = (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      background:'rgba(255,255,255,0.03)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, padding:12, position:'relative'
    }}>
      <div style={{
        width:38, height:38, borderRadius:10,
        background:'rgba(34,197,94,0.08)',
        border:'1px solid rgba(34,197,94,0.25)',
        display:'flex', alignItems:'center', justifyContent:'center'
      }}>
        {icon}
      </div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, color:'var(--muted)' }}>{label}</div>
        {/* делаем текст селектируемым для ручного копирования */}
        <div style={{ fontWeight:700, userSelect:'text', overflow:'hidden', textOverflow:'ellipsis' }}>
          {value}
        </div>
      </div>
      <button
        className="button"
        onClick={(e)=> {
          e.preventDefault(); e.stopPropagation();
          const text = (copyText ?? value) || '';
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(()=>setCopied(true));
          } else {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            setCopied(true);
          }
          setTimeout(()=>setCopied(false), 1200);
        }}
        style={{ padding: '6px 10px' }}
        title="Скопировать"
      >
        {copied ? 'Скопировано' : 'Копировать'}
      </button>
    </div>
  );

  // Если есть ссылка — оборачиваем, но кнопка "Копировать" не даёт переходить (stopPropagation выше)
  return href
    ? <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration:'none', color:'inherit' }}>{body}</a>
    : body;
}

/* ——— Icons ——— */
function IconUser({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6Z"
        transform="translate(0,4)" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M3 20c1.5-3.5 5-5 9-5s7.5 1.5 9 5" fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}
function TelegramIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M21 5L3 11l6 2" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 5l-6 16-3-7" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function MailIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#22C55E" strokeWidth="1.6"/>
      <path d="M3 7l9 6 9-6" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function WhatsAppIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M5 19l1.5-3.5A8 8 0 1 1 12 20a8.3 8.3 0 0 1-3.5-.8L5 19Z" stroke="#22C55E" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M9.5 9.5c.3 1.4 1.7 3 3.2 3.2M9 8c.5-.5 1.7-.5 2 0 .2.3 0 1-.3 1.3M12.7 12.7c.4.3 1 .5 1.3.3.5-.3.5-1.5 0-2" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function ClockIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="12" r="8" stroke="#22C55E" strokeWidth="1.6"/>
      <path d="M12 7v5l3 2" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
