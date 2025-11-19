// frontend/components/Hero.jsx
import { useState, useRef, useEffect } from 'react';
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

export default function Hero({ inspectionsUnread = 0, tradeOrdersUnread = 0 }) {

  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  // Фразы для "магической" печати в placeholder
  const demoQueries = useRef([
    'Toyota Camry 2018',
    'VIN: WDBUF56X48B123456',
    'BMW X5 F15',
    'LADA GRANTA',
    'Hyundai Solaris 2020',
    'Mercedes E Class',
    
  ]);

  // Анимация "печатающегося" placeholder — работает, пока юзер не начал ввод
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const idlePH = 'Марка, модель, или VIN…';
    const typeSpeed = 100;                 // скорость печати (мс/символ)
    const deleteSpeed = 40;               // скорость удаления (мс/символ)
    const holdAfterTypeMs = 10000;         // пауза после печати
    const delayBetweenQueriesMs = 15000;  // 30 сек до следующей фразы

    let timers = [];
    let stopped = false;
    let idx = 0;
    const initialPH = input.placeholder || idlePH;

    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const stopAll = () => { stopped = true; clearTimers(); input.placeholder = idlePH; };
    const isUserBusy = () => document.activeElement === input || (input.value && input.value.length > 0);

    const typeText = (text) => new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (stopped || isUserBusy()) return resolve('stopped');
        input.placeholder = text.slice(0, i + 1);
        i++;
        if (i >= text.length) {
          timers.push(setTimeout(() => resolve('done'), holdAfterTypeMs));
        } else {
          timers.push(setTimeout(tick, typeSpeed));
        }
      };
      tick();
    });

    const deleteText = () => new Promise((resolve) => {
      const run = () => {
        if (stopped || isUserBusy()) return resolve('stopped');
        const cur = input.placeholder || '';
        if (cur.length === 0) return resolve('done');
        input.placeholder = cur.slice(0, -1);
        timers.push(setTimeout(run, deleteSpeed));
      };
      run();
    });

    const wait = (ms) => new Promise((r) => {
      const t = setTimeout(r, ms);
      timers.push(t);
    });

    const loop = async () => {
      // стартовое состояние
      input.placeholder = idlePH;
      while (!stopped) {
        const list = demoQueries.current && demoQueries.current.length ? demoQueries.current : [idlePH];
        const phrase = list[idx % list.length];

        const typed = await typeText(phrase);
        if (typed === 'stopped') break;

        const deleted = await deleteText();
        if (deleted === 'stopped') break;

        idx++;
        // Пауза до следующей фразы (с проверкой «занятости» пользователя)
        let waited = 0;
        const step = 200;
        while (waited < delayBetweenQueriesMs && !stopped && !isUserBusy()) {
          await wait(step);
          waited += step;
        }
      }
    };

    // Слушатели: если пользователь начал ввод/фокус — останавливаем «магию»
    const onFocus = () => stopAll();
    const onInput = () => stopAll();
    input.addEventListener('focus', onFocus, { passive: true });
    input.addEventListener('input', onInput, { passive: true });

    loop();

    return () => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('input', onInput);
      clearTimers();
      stopped = true;
      input.placeholder = initialPH;
    };
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return Router.push('/trades');
    Router.push({
      pathname: '/trades',
      query: { q: query },
    });
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.inner}>
        {inspectionsUnread > 0 && (
          <a href="/inspections" style={styles.alert}>
            <span>Новые обновления осмотров</span>
            <span style={styles.alertCount}>{inspectionsUnread > 99 ? '99+' : inspectionsUnread}</span>
          </a>
        )}
        {tradeOrdersUnread > 0 && (
          <a href="/my-trades" style={{ ...styles.alert, background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>
            <span>Есть новости по вашим торгам</span>
            <span style={styles.alertCount}>{tradeOrdersUnread > 99 ? '99+' : tradeOrdersUnread}</span>
          </a>
        )}

        <h1 style={styles.title}>
          Автомобили с аукционов —{' '}
          <span style={styles.titleGradient}>прозрачно и удобно</span>
        </h1>

        <form onSubmit={onSubmit} style={styles.form} className="hero-form">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Марка, модель, или VIN…"
            aria-label="Поиск"
            style={styles.input}
          />
          <button
            type="submit"
            style={styles.button}
            onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
          >
            Найти
          </button>
        </form>

         <div style={styles.features} className="features">
          <Feature icon="🔎" title="Честные данные" text="Источники и история авто — в одном месте." />
          <Feature icon="⚡" title="Быстрый старт" text="Фильтры и поиск без лишних шагов." />
          <Feature icon="🛡️" title="Безопасность" text="Сопровождаем оформление сделки." />
          <Feature icon="🧰" title="Осмотры машины" text="Оценивайте состояние авто по свежим отчётам." />
          <Feature icon="📑" title="Автотека" text="Получайте проверенные данные из официальных баз." />
          <Feature icon="🎓" title="Обучение" text="Научим подбирать авто и участвовать в торгах." />
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

function Feature({ icon, title, text }) {
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
    padding: 14, 
    borderRadius: 14, 
    background:
      'linear-gradient(135deg, rgba(42,101,247,0.12) 0%, rgba(42,101,247,0.04) 60%, rgba(103,232,249,0.08) 100%)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  },
  featureIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    lineHeight: 1,
  },
  featureTitle: { color: 'var(--text-900)', fontWeight: 700, fontSize: 14, lineHeight: 1.2 },
  featureText: { color: 'var(--text-600)', fontSize: 13, lineHeight: 1.4 },
  alert: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(37,99,235,0.35)',
    background: 'rgba(37,99,235,0.12)',
    color: '#1d4ed8',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  alertCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    padding: '2px 10px',
    borderRadius: 999,
    background: '#1d4ed8',
    color: '#fff',
    fontSize: 14,
  },
};

















