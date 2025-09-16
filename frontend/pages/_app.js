// frontend/pages/_app.js
import { useEffect, useState, useCallback, createContext } from 'react';
import '../styles/globals.css'; // если файла нет — можно удалить эту строку
import Header from '../components/Header';
import Footer from '../components/Footer';
import Router from 'next/router';

// Дадим простой контекст, чтобы страницы/компоненты могли принудительно обновить профиль
export const AuthContext = createContext({
  user: null,
  refreshUser: async () => {},
  setUser: () => {},
});

export default function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // единая функция загрузки профиля
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        setUser(null);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  // 1) первоначальная загрузка после монтирования
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // 2) при смене маршрута — обновим (полезно после редиректа из /login)
  useEffect(() => {
    const onDone = () => fetchUser();
    Router.events.on('routeChangeComplete', onDone);
    return () => Router.events.off('routeChangeComplete', onDone);
  }, [fetchUser]);

  // 3) при возвращении во вкладку / разблокировке — обновим
  useEffect(() => {
    const onFocus = () => fetchUser();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUser();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchUser]);

  // предоставляем способ принудительно обновить профиль из любой страницы
  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, refreshUser, setUser }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Шапка всегда сверху. Передаём реального пользователя */}
        <Header user={user} />

        <main style={{ flex: 1 }}>
          {/* Пока профиль грузится — просто рендерим страницу как есть.
             Если хочешь лоадер — можно добавить спиннер, ориентируясь на loaded */}
          <Component {...pageProps} />
        </main>

        {/* Футер на всех страницах */}
        <Footer />
      </div>
    </AuthContext.Provider>
  );
}
