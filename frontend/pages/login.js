import { useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Login(){
  const [step, setStep] = useState('phone'); // phone → code
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function requestCode(e){
    e.preventDefault(); setErr('');
    const res = await fetch(`${API}/api/auth/request-code`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) return setErr(data.error||'Ошибка');
    setInfo(`Код отправлен! (тест: ${data.code})`);
    setStep('code');
  }

  async function verifyCode(e){
    e.preventDefault(); setErr('');
    const res = await fetch(`${API}/api/auth/verify-code`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone, code })
    });
    const data = await res.json();
    if (!res.ok) return setErr(data.error||'Ошибка');
    localStorage.setItem('token', data.token);
    alert('Вход выполнен'); location.href='/';
  }

  return (
    <div className="container">
      <h1>Вход по телефону</h1>

      {step==='phone' && (
        <form onSubmit={requestCode} className="card" style={{display:'grid', gap:12, maxWidth:420}}>
          <input className="input" placeholder="+7..." value={phone} onChange={e=>setPhone(e.target.value)} />
          {err && <div style={{color:'salmon'}}>{err}</div>}
          <button className="button">Получить код</button>
        </form>
      )}

      {step==='code' && (
        <form onSubmit={verifyCode} className="card" style={{display:'grid', gap:12, maxWidth:420}}>
          <div>Телефон: {phone}</div>
          <input className="input" placeholder="Код" value={code} onChange={e=>setCode(e.target.value)} />
          {err && <div style={{color:'salmon'}}>{err}</div>}
          {info && <div style={{color:'lightgreen'}}>{info}</div>}
          <button className="button">Войти</button>
        </form>
      )}
    </div>
  );
}
