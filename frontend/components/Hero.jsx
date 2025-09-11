// frontend/components/Hero.jsx
import { useState } from 'react';
import Router from 'next/router';

const UI = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.80)',
  border: 'rgba(255,255,255,0.12)',
  glass: 'rgba(255,255,255,0.05)',
  button: '#67e8f9', // cyan-300
  buttonHover: '#a5f3fc',
};

export default function Hero() {
  const [q, setQ] = useState('');

  function onSubmit(e){
    e.preventDefault();
    const query = q.trim();
    // Если страницы поиска нет — просто откроем список торгов
    if (!query) {
      Router.push('/trades');
      return;
    }
    Router.push(`/trades?q=${encodeURIComponent(query)}`);
  }

  return (
    <section style={styles.wrap}>
      {/* Фон без фоток: градиенты + тонкая линия-дорога */}
      <div style={styles.bg}>
        <div style={styles.gradientA} />
        <div style={styles.gradientB} />
        <svg viewBox="0 0 1200 320" style={styles.road} aria-hidden>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          <path
            d="M0,240 C200,210 300,300 500,260 C700,220 900,300 1200,240"
            fill="none"
            stroke="url(#g1)"
            strokeWidth="3"
            strokeLinecap="round"
            className="dash"
          />
        </svg>
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
          Собираем лоты из проверенных источников, показываем историю авто и упрощаем путь от поиска до сделки.
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

        <div style={styles.ctaRow} className="cta-row">
          <a href="/trades" style={{...styles.ctaBtn, background:'#fff', color:'#000'}}>Каталог торгов</a>
          <a href="/support" style={{...styles.ctaBtn, border:`1px solid ${UI.border}`, color:'#fff'}}>Поддержка</a>
          <span style={styles.micro}>Без скрытых платежей • Проверка истории • Поддержка сделки</span>
        </div>

        {/* Мини-фичи (3 пункта) */}
        <div style={styles.features} className="features">
          <Feature icon="🔎" title="Честные данные" text="Источники и история авто — в одном месте."/>
          <Feature icon="⚡" title="Быстрый старт" text="Фильтры и поиск без лишних шагов."/>
          <Feature icon="🛡️" title="Безопасность" text="Сопровождаем оформление сделки."/>
        </div>

        <div style={styles.hint}>
          Листайте ниже — статистика платформы
        </div>
      </div>

      <style jsx>{`
        .dash { stroke-dasharray: 12 10; animation: dash 14s linear infinite; }
        @keyframes dash { to { stroke-dashoffset: -440; } }

        @media (max-width: 900px) {
          .features { grid-template-columns: 1fr; }
          .cta-row { gap: 8px; }
          .hero-form { flex-direction: column; align-items: stretch; }
          .hero-form button { width: 100%; }
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
    // отступы сверху/снизу
    padding: '56px 0 28px',
    // full-bleed фон (за пределы .container)
    margin: '0 calc(50% - 50vw)',
  },
  bg: { position:'absolute', inset:0 },
  gradientA: {
    position:'absolute', inset:0,
    background: 'radial-gradient(900px 600px at 20% -10%, #0b1220 0%, #0b1220 35%, #0a0f1a 60%, #0a0f1a 100%)',
    opacity: 1,
  },
  gradientB: {
    position:'absolute', inset:0,
    background: 'radial-gradient(700px 400px at 85% 20%, rgba(103,232,249,0.25), rgba(103,232,249,0) 60%)',
    filter: 'blur(20px)',
    opacity: 0.7,
  },
  road: {
    position:'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: -10,
    width: '1200px',
    height: '200px',
    opacity: 0.45,
    pointerEvents: 'none',
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
    background: UI.glass,
    border: `1px solid ${UI.border}`,
    color: UI.text,
    fontSize: 12,
    backdropFilter: 'blur(6px)',
  },
  pulse: {
    width:8, height:8, borderRadius:999,
    background: '#34d399',
    boxShadow: '0 0 0 0 rgba(52,211,153,0.7)',
    animation: 'pulse 1.8s infinite',
  },
  title: {
    margin: '14px 0 8px',
    fontSize: '38px',
    lineHeight: 1.15,
    color: UI.title,
    fontWeight: 700,
  },
  titleGradient: {
    backgroundImage: 'linear-gradient(90deg, #67e8f9, #c4b5fd)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: {
    color: UI.text,
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
    border: `1px solid ${UI.border}`,
    outline: 'none',
    color: '#fff',
    fontSize: 16,
  },
  button: {
    padding: '14px 16px',
    borderRadius: 14,
    background: UI.button,
    color: '#000',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  ctaRow: {
    marginTop: 14,
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ctaBtn: {
    display: 'inline-block',
    padding: '10px 14px',
    borderRadius: 12,
    textDecoration: 'none',
    fontWeight: 500,
  },
  micro: {
    marginLeft: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
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
    border: `1px solid ${UI.border}`,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: 'grid', placeItems: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${UI.border}`,
    fontSize: 20,
  },
  featureTitle: { color:'#fff', fontWeight:600, fontSize:14, lineHeight:1.2 },
  featureText: { color:'rgba(255,255,255,0.75)', fontSize:13, lineHeight:1.3 },
  hint: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.55)', fontSize: 13,
  },
};
