import { useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Signup(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e){
    e.preventDefault(); setErr('');
    const res = await fetch(`${API}/api/auth/signup`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return setErr(data.error||'Ошибка');
    localStorage.setItem('token', data.token);
    alert('Регистрация выполнена'); location.href='/';
  }

  return (
    <div className="container">
      <h1>Регистрация</h1>
      <form onSubmit={submit} className="card" style={{display:'grid', gap:12, maxWidth:420}}>
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div style={{color:'salmon'}}>{err}</div>}
        <button className="button">Создать аккаунт</button>
        <a href="/login">У меня уже есть аккаунт</a>
      </form>
    </div>
  );
}

