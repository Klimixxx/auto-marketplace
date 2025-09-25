// frontend/components/Hero.jsx
import { useState } from 'react';
import Router from 'next/router';

const UI = {
  title: '#0f172a',
  text: '#374151',
  muted: 'rgba(55,65,81,0.75)',
  border: 'rgba(17,24,39,0.10)',
  badgeBg: 'rgba(15,23,42,0.06)',
  badgeBorder: 'rgba(15,23,42,0.12)',
  featureBg: '#ffffff',
  featureIconBg: '#f3f4f6',
  button: '#2a65f7',
  buttonHover: '#1e53d6',
  accent: '#ef4444',
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
          <span style={styles.badgeLabel}>Объявлений</span>
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
          <button type="submit" style={styles.button}>Найти</button>
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
    background: '#f8f5ec',
  },
  inner: {
    position:'relative',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 16px',
    color: UI.text,
  },
  badge: {
    display: 'inline-flex',
    alignItems:'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 999,
    background: UI.badgeBg,
    border: `1.5px solid ${UI.badgeBorder}`,
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
    fontWeight: 900,
    fontSize: 15.5,
    backgroundImage: 'linear-gradient(90deg,#ef4444,#f97316)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    letterSpacing: 0.3,
    fontVariantNumeric: 'tabular-nums',
  },
  badgeLabel: { color: UI.muted },
  title: {
    margin: '14px 0 8px',
    fontSize: '38px',
    lineHeight: 1.15,
    color: UI.title,
    fontWeight: 700,
  },
  titleGradient: {
    color: UI.accent,
    fontWeight: 800,
  },
  form: { marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    padding: '14px 14px',
    borderRadius: 14,
    background: '#ffffff',
    border: `1px solid ${UI.border}`,
    outline: 'none',
    color: UI.title,
    fontSize: 16,
  },
  button: {
    padding: '14px 16px',
    borderRadius: 14,
    background: UI.button,
    color: '#ffffff',
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
    background: UI.featureBg,
    border: `1px solid ${UI.border}`,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: 'grid', placeItems: 'center',
    background: UI.featureIconBg,
    border: `1px solid ${UI.border}`,
    fontSize: 20,
  },
  featureTitle: { color:UI.title, fontWeight:600, fontSize:14, lineHeight:1.2 },
  featureText: { color:UI.text, fontSize:13, lineHeight:1.3 },
};
