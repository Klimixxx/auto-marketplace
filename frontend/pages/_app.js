import { useEffect } from 'react';
import '../styles/globals.css';
import Header from '../components/Header';

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function MyApp({ Component, pageProps }) {
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

  return (
    <>
      <Header />
      <Component {...pageProps} />
    </>
  );
}
