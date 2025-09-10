// frontend/pages/_app.js
import { useEffect, useState } from 'react';
import '../styles/globals.css';
import Header from '../components/Header';

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);

  // Трекинг визита (для графика в админке): 1 раз за сессию
  useEffect(() => {
    try {
      const key = 'visited_once';
      if (!localStorage.getItem(key) && API) {
        fetch(`${API}/api/track/visit`, { method: 'POST' }).catch(() => {});
        localStorage.setItem(key, '1');
      }
    } catch {}
  }, []);

  // Загрузка информации о текущем пользователе
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me'); // эндпоинт для получения профиля
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} />
      <main style={{ flex: 1 }}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
