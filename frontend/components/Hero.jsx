// frontend/components/Hero.jsx
import { useState } from 'react';
import Router from 'next/router';

const UI = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.80)',
  border: 'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.05)',
  button: '#67e8f9', // cyan-300
};

export default function Hero() {
  const [q, setQ] = useState('');

  function onSubmit(e){
    e.preventDefault();
    const query = q.trim();
    if (!query) return Router.push('/trades');
    Router.push(`/trades?q=${encodeURIComponent(query)}`);
  }

  return (
    <section style={styles.wrap}>
      {/* Фон без фото: два градиента (стационарные) */}
      <div style={styles.bg}>
        <div style={styles.gradientA} />
        <div style={styles.gradientB} />
      </div>

      <div style={styles.inner}>
        <div style={styles.badge}>
          <span style={styles.pulse} />
          <span>Бета-версия • сделки из аукционов</span>
        </div>

        <h1 style={styles.title}>
          Автомобили с аукционов —{' '}
          <span style={styles.titleGradient}>прозрачно и удобно</span>
        </h1>

        <p style={styles.subtitle}>
          Собираем лоты из проверенных торговых площадок, показываем историю авто и упрощаем путь от поиска до сделки.
        </p>

        <form onSubmit={onSubmit} style={styles.form} className="hero-form">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Марка, модель или VIN…"
            aria-label="Поиск"
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Найти</button>
        </form>

        {/* Мини-фичи (оставили) */}
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
    margin: '0 calc(50% - 50vw)', // full-bleed
  },
  bg: { position:'absolute', inset:0 },
  gradientA: {
    position:'absolute', inset:0,
    background: 'radial-gradient(900px 600px at 20% -10%, #0b1220 0%, #0b1220 35%, #0a0f1a 60%, #0a0f1a 100%)',
  },
  gradientB: {
    position:'absolute', inset:0,
    background: 'radial-gradient(700px 400px at 85% 20%, rgba(103,232,249,0.25), rgba(103,232,249,0) 60%)',
    filter: 'blur(20px)',
    opacity: 0.7,
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
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${'rgba(255,255,255,0.12)'}`,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    backdropFilter: 'blur(6px)',
  },
  pulse: {
    width:8, height:8, borderRadius:999,
    background: '#34d399',
    animation: 'pulseKey 1.8s infinite',
  },
  title: {
    margin: '14px 0 8px',
    fontSize: '38px',
    lineHeight: 1.15,
    color: '#fff',
    fontWeight: 700,
  },
  titleGradient: {
    backgroundImage: 'linear-gradient(90deg, #67e8f9, #c4b5fd)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    maxWidth: 720,
    fontSize: 18,
  },
  form: {
    marginTop: 18,
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '14px 14px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid rgba(255,255,255,0.12)`,
    outline: 'none',
    color: '#fff',
    fontSize: 16,
  },
  button: {
    padding: '14px 16px',
    borderRadius: 14,
    background: '#67e8f9',
    color: '#000',
    fontWeight: 600,
    border: 'none',
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
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(255,255,255,0.12)`,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: 'grid', placeItems: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid rgba(255,255,255,0.12)`,
    fontSize: 20,
  },
  featureTitle: { color:'#fff', fontWeight:600, fontSize:14, lineHeight:1.2 },
  featureText: { color:'rgba(255,255,255,0.75)', fontSize:13, lineHeight:1.3 },
};
