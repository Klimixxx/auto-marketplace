import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FirstLoginModal from '../components/FirstLoginModal';

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Home() {
  const [q, setQ] = useState('');
  const [stats, setStats] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!API) return;
    fetch(`${API}/api/public-stats`)
      .then(r => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  function submit(e) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/trades?q=${encodeURIComponent(query)}` : '/trades');
  }

  const UI = {
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
  };

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <FirstLoginModal />

      {/* Поиск */}
      <section style={{ margin: '32px 0' }}>
        <h1 style={{ color: UI.title, marginBottom: 8 }}>Найдите нужный лот</h1>
        <p style={{ color: UI.text, marginTop: 0 }}>Поиск по названию, номеру лота, источнику и т. п.</p>

        <form onSubmit={submit}
          style={{
            background: UI.cardBg, border: `1px solid ${UI.border}`,
            borderRadius: 12, padding: 14, display: 'flex', gap: 10
          }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: Toyota Camry, лот 12345…"
            className="input"
            style={{
              flex: 1, background: UI.inputBg, color: UI.inputText, border: `1px solid ${UI.inputBorder}`,
              borderRadius: 10, padding: '10px 12px'
            }}
          />
          <button className="button" style={{
            background: UI.btnBg, color: UI.btnText, border: `1px solid ${UI.inputBorder}`,
            borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer'
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
          >
            Искать
          </button>
        </form>
      </section>

      {/* Статистика платформы */}
      <section style={{ margin: '20px 0' }}>
        <div style={{
          background: UI.cardBg,
          border: `1px solid ${UI.border}`,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          gap: 20,
          alignItems: 'center'
        }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 12, color: UI.text, opacity: 0.7 }}>Пользователей</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: UI.title }}>
              {stats ? stats.users.toLocaleString('ru-RU') : '—'}
            </div>
          </div>
          {/* Здесь позже добавим остальные метрики */}
        </div>
      </section>

      {/* Инфо-блок */}
      <section style={{ margin: '24px 0' }}>
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Все торги — в одном месте</h2>
          <p style={{ color: 'var(--muted)' }}>
            Мы агрегируем объявления с разных источников и показываем удобную выдачу по фильтрам.
          </p>
          <p><a className="button" href="/trades">Перейти в каталог →</a></p>
        </div>
      </section>
    </div>
  );
}
