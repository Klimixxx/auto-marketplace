// frontend/pages/index.js
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Hero from '../components/Hero';
import About from '../components/About';

// UI цвета в синхроне со стилем
const UI = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.75)',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.10)',
  red: '#EF4444',
  // градиент как в Hero ("прозрачно и удобно")
  gradFrom: '#67e8f9',
  gradTo: '#c4b5fd',
  button: '#67e8f9',
  buttonHover: '#a5f3fc',
};

const fmt = new Intl.NumberFormat('ru-RU');

// Заглушка модалки (если у тебя есть свой компонент — подключи его вместо этого)
function FirstLoginModal(){ return null; }

// Карточка метрики
function StatCard({ title, value, Icon }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${UI.border}`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon />
      </div>
      <div>
        <div style={{ color: UI.text, fontSize: 13 }}>{title}</div>
        <div style={{ color: UI.title, fontWeight: 800, fontSize: 18, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

/* Иконки (градиент как в Hero) */
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroUsers" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="url(#gradHeroUsers)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="url(#gradHeroUsers)" strokeWidth="1.8" />
    </svg>
  );
}
// Листок (документ) — для "Публичные предложения"
function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroDoc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="url(#gradHeroDoc)" strokeWidth="1.8" />
      <path d="M14 3v6h6" stroke="url(#gradHeroDoc)" strokeWidth="1.8" />
      <path d="M9 13h8M9 17h8" stroke="url(#gradHeroDoc)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function AuctionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroAuc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M7 10l6-6 4 4-6 6-4-4zM3 21h10" stroke="url(#gradHeroAuc)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
// Купюра — для "Стоимость имущества в торгах"
function BanknoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroNote" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <rect x="3" y="7" width="18" height="10" rx="2" stroke="url(#gradHeroNote)" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="2.5" stroke="url(#gradHeroNote)" strokeWidth="1.8"/>
      <path d="M5 9h2M17 9h2M5 15h2M17 15h2" stroke="url(#gradHeroNote)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

/* ===== Новая секция "Обучение" ===== */
function EducationFeature({ title, Icon }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          width: 46, height: 46, borderRadius: 12,
          display: 'grid', placeItems: 'center',
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${UI.border}`,
        }}
      >
        <Icon />
      </div>
      <div style={{ color:'#fff', fontWeight: 800, fontSize: 15.5, lineHeight: 1.25 }}>
        {title}
      </div>
    </div>
  );
}
function LightningIcon(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradLightning" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="url(#gradLightning)" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function InstallmentIcon(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradInstall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      {/* карта + календарь как символ рассрочки */}
      <rect x="3" y="6" width="12" height="8" rx="2" stroke="url(#gradInstall)" strokeWidth="1.8"/>
      <path d="M5 9h8M5 12h3" stroke="url(#gradInstall)" strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="16" y="9" width="5" height="7" rx="1.5" stroke="url(#gradInstall)" strokeWidth="1.8"/>
      <path d="M16 11h5" stroke="url(#gradInstall)" strokeWidth="1.8"/>
    </svg>
  );
}
function CarIcon(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradCar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path d="M3 13l2-4c.5-1 1.5-2 3-2h6c1.5 0 2.5 1 3 2l2 4v3a2 2 0 01-2 2h-1a2 2 0 01-2-2H8a2 2 0 01-2 2H5a2 2 0 01-2-2v-3z" stroke="url(#gradCar)" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="8" cy="16" r="2" stroke="url(#gradCar)" strokeWidth="1.8"/>
      <circle cx="16" cy="16" r="2" stroke="url(#gradCar)" strokeWidth="1.8"/>
    </svg>
  );
}

export default function Home() {
  // если где-то используешь, оставлю стейт
  const [stats, setStats] = useState(null);
  useEffect(() => {
    // можно оставить пустым — значения ниже статичны по задаче
  }, []);

  return (
    <>
      <Hero />
      <About />

      <div className="container">
        <FirstLoginModal />

        {/* Статистика + карта */}
        <section style={{ margin: '22px 0' }}>
          {/* Заголовок по центру и с градиентом */}
          <h2
            style={{
              margin: '0 0 12px',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: 22,
              backgroundImage: `linear-gradient(90deg, ${UI.gradFrom}, ${UI.gradTo})`,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Статистика платформы
          </h2>

          <div
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            {/* сетка статов */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatCard title="Пользователей" value="18790" Icon={UsersIcon} />
              <StatCard title="Публичные предложения" value="2163" Icon={DocumentIcon} />
              <StatCard title="Открытых аукционов" value="5187" Icon={AuctionsIcon} />
              <StatCard title="Стоимость имущества в торгах" value="119.860.294" Icon={BanknoteIcon} />
            </div>

            {/* карта */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1527 / 768',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <img
                src="/maps/russia-fo.svg"
                alt="Карта России по федеральным округам"
                style={{ width: '100%', height: 'auto', display: 'block', background: 'transparent' }}
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* НОВАЯ секция: Обучение */}
        <section style={{ margin: '28px 0' }}>
          <div
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: 12,
              padding: 18,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 18,
              alignItems: 'center',
            }}
          >
            {/* Большая иконка из /public/education/group.png */}
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${UI.border}`,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src="/education/group.png"
                alt="Иконка обучения"
                style={{ width: '80%', height: '80%', objectFit: 'contain', display: 'block' }}
              />
            </div>

            <div>
              <h2 style={{ margin: '0 0 6px', color: UI.title }}>
                Обучение для покупателей авто с торгов
              </h2>
              <p style={{ margin: '0 0 14px', color: UI.text, lineHeight: 1.65, maxWidth: 760 }}>
                Разбираем стратегию поиска и анализа лотов, оценку рисков и юридические нюансы сделки.
                Практика на реальных кейсах и инструкции, с которыми вы уверенно проходите путь от идеи до покупки.
              </p>

              {/* фичи обучения */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <EducationFeature title="Быстрое и эффективное обучение" Icon={LightningIcon} />
                <EducationFeature title="Оплата обучения частями" Icon={InstallmentIcon} />
                <EducationFeature title="Доступ в закрытые чаты продавцов авто" Icon={CarIcon} />
              </div>

              <a
                href="/education"
                role="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: UI.button,
                  color: '#000',
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e)=> (e.currentTarget.style.background = UI.buttonHover)}
                onMouseLeave={(e)=> (e.currentTarget.style.background = UI.button)}
              >
                Узнать больше
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Инфо-блок */}
        <section style={{ margin: '24px 0' }}>
          <div
            className="card"
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h2 style={{ marginTop: 0, color: UI.title }}>Все торги — в одном месте</h2>
            <p style={{ color: UI.text }}>
              Мы агрегируем объявления с разных источников и показываем удобную выдачу по фильтрам.
            </p>
            <p>
              <a className="button" href="/trades" style={{ color: '#fff', background: '#1E90FF', padding: '8px 12px', borderRadius: 8 }}>
                Перейти в каталог →
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
