// frontend/components/Hero.jsx
import { useState } from 'react';
import Router from 'next/router';

const UI = {
  title: '#111827',
  text: 'rgba(17,24,39,0.80)',
  border: 'rgba(17,24,39,0.12)',
  glass: 'rgba(17,24,39,0.04)',    // лёгкое «стекло» под светлый фон
  button: '#2a65f7',
  buttonHover: '#1e53d6',
  btnBg: 'var(--blue)',
  btnText: '#ffffff',
  btnHover: '#1e53d6',

};


const fmt = new Intl.NumberFormat('ru-RU');

export default function Hero({ listingCount = 0 }) {
  const [q, setQ] = useState('');

  function onSubmit(e){
    e.preventDefault();
    const query = q.trim();
    if (!query) return Router.push('/trades');
    Router.push(`/trades?q=${encodeURIComponent(query)}`);
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.inner}>
        {/* Бейдж с количеством объявлений */}
        <div style={styles.badge}>
          <span style={styles.pulse} />
          <span style={styles.badgeNum}>{fmt.format(Math.max(0, listingCount))}</span>
          <span style={styles.badgeLabel}>Объявлений ждут своих покупателей</span>
        </div>

        <h1 style={styles.title}>
          Автомобили с аукционов —{' '}
          <span style={styles.titleGradient}>прозрачно и удобно</span>
        </h1>

        {/* подзаголовок убран ранее по задаче */}

        <form onSubmit={onSubmit} style={styles.form} className="hero-form">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Марка, модель или VIN…"
            aria-label="Поиск"
            style={styles.input}
          />
          <button
  type="submit"
  style={styles.button}
  onMouseEnter={(e)=> (e.currentTarget.style.background = UI.btnHover)}
  onMouseLeave={(e)=> (e.currentTarget.style.background = UI.btnBg)}
>
  Найти
</button>

        </form>

        <div style={styles.features} className="features">
          <Feature icon="🔎" title="Честные данные" text="Источники и история авто — в одном месте."/>
          <Feature icon="⚡" title="Быстрый старт" text="Фильтры и поиск без лишних шагов."/>
          <Feature icon="🛡️" title="Безопасность" text="Сопровождаем оформление сделки."/>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .features { grid-template-columns: 1fr; }
          .hero-form { flex-direction: column; align-items: stretch; }
          .hero-form button { width: 100%; }
        }
        @keyframes pulseKey {
          0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
      `}</style>
    </section>
  );
}

function Feature({ icon, title, text }){
  return (
    <div style={styles.feature}>
      <div style={styles.featureIcon}>{icon}</div>
      <div>
        <div style={styles.featureTitle}>{title}</div>
        <div style={styles.featureText}>{text}</div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    padding: '56px 0 28px',
    margin: '0 calc(50% - 50vw)',
    background: 'transparent',
  },
  inner: {
    position:'relative',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 16px',
  },
  badge: {
    display: 'inline-flex',
    alignItems:'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 999,
    background: UI.glass,
    border: '1.5px solid var(--stats-border)',
    color: UI.text,
    fontSize: 13.5,
    backdropFilter: 'blur(6px)',
  },
  pulse: {
    width:8, height:8, borderRadius:999,
    background: '#34d399',
    animation: 'pulseKey 1.8s infinite',
  },
  badgeNum: {
  fontWeight: 800,
  fontSize: 15.5,
  color: 'var(--blue)',             // СИНИЙ как «прозрачно и удобно»
  letterSpacing: 0.3,
  fontVariantNumeric: 'tabular-nums',
},

  badgeLabel: { color: 'var(--text-900)' },  // ЧЁРНЫЙ для "Объявлений"
    title: {
    margin: '14px 0 8px',
    fontSize: '38px',
    lineHeight: 1.15,
    color: '#111827',      // ЧЁРНЫЙ для "Автомобили с аукционов —"
    fontWeight: 700,
  },
  titleGradient: {
    color: '#2a65f7',      // СИНИЙ для "прозрачно и удобно"
  },

  form: { marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' },
input: {
  flex: 1,
  padding: '14px 14px',
  borderRadius: 14,
  background: '#FFFFFF',
  border: `1px solid ${UI.border}`,
  outline: 'none',
  color: '#111827',
  fontSize: 16,
},

  button: {
  padding: '14px 16px',
  borderRadius: 14,
  background: UI.btnBg,            // как в шапке
  color: UI.btnText,               // белый текст
  fontWeight: 600,
  border: '1px solid ' + UI.btnBg, // рамка в тон
  cursor: 'pointer',
  },
  features: {
    marginTop: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
    gap: 10,
  },
  feature: {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: 12,
  borderRadius: 14,
  background: 'var(--card-bg)',               // МЯГКИЙ ФОН карточки
  border: '1px solid var(--stats-border)',     // ТОНКАЯ РАМКА карточки
},

  featureIcon: {
  width: 40, height: 40, borderRadius: 10,
  display: 'grid', placeItems: 'center',
  background: 'rgba(17,24,39,0.04)',
  border: '1px solid var(--stats-border)',
  fontSize: 20,
},

  featureTitle: { color: 'var(--text-900)', fontWeight: 700, fontSize: 14, lineHeight: 1.2 },
  featureText: { color: 'var(--text-600)', fontSize: 13, lineHeight: 1.4 },
};
