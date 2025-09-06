// pages/login.js
import { useState, useEffect, useRef } from 'react';
import PhoneInput, { toE164Ru } from '../components/PhoneInput';


const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Login() {
  const [step, setStep] = useState('phone'); // 'phone' → 'code'
  const [phoneLocal, setPhoneLocal] = useState(''); // только 10 цифр без +7
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // сек до повторной отправки
  const codeInputRef = useRef(null);

  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function requestCode(e) {
  e?.preventDefault?.();
  if (!API) return setErr('API_BASE не задан. Установи NEXT_PUBLIC_API_BASE.');
  setErr(''); setInfo(''); setLoading(true);
  try {
    // <<< ВАЖНО: строим E.164 из локальных 10 цифр
    const phone = toE164Ru(phoneLocal);
    if (!phone) {
      setErr('Введите номер полностью (10 цифр)');
      setLoading(false);
      return;
    }

    const res = await fetch(`${API}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Не удалось отправить SMS');
    }
    setStep('code');
    setCooldown(30);
    setInfo(data.dry ? `Код отправлен! (тест: ${data.test})` : 'Код отправлен!');
  } catch (e) {
    setErr(e.message || 'Ошибка');
  } finally {
    setLoading(false);
  }
}


  async function verifyCode(e) {
  e.preventDefault();
  if (!API) return setErr('API_BASE не задан. Установи NEXT_PUBLIC_API_BASE.');
  setErr(''); setLoading(true);
  try {
    // <<< та же логика: из 10 локальных цифр делаем +7XXXXXXXXXX
    const phone = toE164Ru(phoneLocal);
    if (!phone) {
      setErr('Номер неполный');
      setLoading(false);
      return;
    }

    const res = await fetch(`${API}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Ошибка проверки кода');
    }
    localStorage.setItem('token', data.token);
    window.location.href = '/';
  } catch (e) {
    setErr(e.message || 'Ошибка проверки кода');
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="container" style={{ maxWidth: 520, margin: '80px auto' }}>
      <h1>Вход по телефону</h1>

      {step === 'phone' && (
        <form onSubmit={requestCode} className="card" style={{ display: 'grid', gap: 12 }}>
          <PhoneInput
  value={phoneLocal}
  onChange={setPhoneLocal}
  autoFocus
/>

          {err && <div style={{ color: 'salmon' }}>{err}</div>}
          <button className="button" disabled={loading || phoneLocal.length !== 10}>
  {loading ? 'Отправляю…' : 'Получить код'}
</button>

        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyCode} className="card" style={{ display: 'grid', gap: 12 }}>
          <div>Телефон: <b>{toE164Ru(phoneLocal) || ''}</b></div>
          <input
            ref={codeInputRef}
            className="input"
            placeholder="Код из SMS"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            style={{ letterSpacing: 2, textAlign: 'center' }}
          />
          {cooldown > 0 && (
            <div style={{ color: '#f78f8f' }}>
              Подождите {cooldown} сек перед повторной отправкой
            </div>
          )}
          {info && <div style={{ color: 'lightgreen' }}>{info}</div>}
          {err && <div style={{ color: 'salmon' }}>{err}</div>}

          <button className="button" disabled={loading}>
            {loading ? 'Проверяю…' : 'Войти'}
          </button>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <button
              type="button"
              className="button"
              onClick={() => setStep('phone')}
              style={{ opacity: 0.8 }}
            >
              Изменить номер
            </button>
            <button
              type="button"
              className="button"
              onClick={() => cooldown === 0 && requestCode()}
              disabled={cooldown > 0 || loading}
              title={cooldown > 0 ? `Можно через ${cooldown} сек` : 'Отправить код ещё раз'}
            >
              Отправить код ещё раз
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
