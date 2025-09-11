// frontend/pages/index.js
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Header from '../components/Header';

// ====== UI (как в проекте) ======
const UI = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.75)',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.10)',
  inputBg: '#0B1220',
  inputText: '#E6EDF3',
  inputBorder: 'rgba(255,255,255,0.12)',
  btnBg: '#1E90FF',
  btnHover: '#1683ea',
  btnText: '#fff',
  red: '#EF4444',
};

// Форматер чисел
const fmt = new Intl.NumberFormat('ru-RU');

// ====== Вспомогательные компоненты (как у тебя) ======
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
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.25)',
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

// Иконки
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="#22C55E" strokeWidth="1.8" />
    </svg>
  );
}
function OffersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 7h18M3 12h18M3 17h18" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function AuctionsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M7 10l6-6 4 4-6 6-4-4zM3 21h10" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MoneyBagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 3c0 1.657 1.343 3 3 3s3-1.343 3-3" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 9h10c1.657 0 3 1.343 3 3 0 0-1 8-8 8s-8-8-8-8c0-1.657 1.343-3 3-3Z" stroke="#22C55E" strokeWidth="1.8" />
      <path d="M9 13h6M9 16h6" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function EducationIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="#22C55E" strokeWidth="1.8" />
      <path d="M21 10v4l-9 5-9-5v-4" stroke="#22C55E" strokeWidth="1.8" />
    </svg>
  );
}

// Модалка первого входа (как в проекте; если у тебя другой путь — подправь импорт выше)
function FirstLoginModal() {
  return null; // у тебя своя реализация/импорт — оставь как есть, либо замени на свой компонент
}

// ====== Главная ======
export default function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Заглушка: имитируем загрузку статистики
    setTimeout(() => {
      setStats({ users: 1240 });
    }, 200);
  }, []);

  return (
    <>
      <div className="container" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 12px' }}>
        <FirstLoginModal />

        {/* Статистика + карта (единый блок) */}
        <section style={{ margin: '22px 0' }}>
          <h2 style={{ margin: '0 0 12px 2px', color: UI.title, letterSpacing: 0.2 }}>Статистика платформы</h2>

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
              <StatCard title="Пользователей" value={stats ? fmt.format(stats.users) : '—'} Icon={UsersIcon} />
              <StatCard title="Публичные предложения" value="—" Icon={OffersIcon} />
              <StatCard title="Открытых аукционов" value="—" Icon={AuctionsIcon} />
              <StatCard title="Стоимость имущества в торгах" value="—" Icon={MoneyBagIcon} />
            </div>

            {/* карта без заголовка */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1527 / 768',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <Image
                src="/fo-map.png" // положи картинку в frontend/public/fo-map.png
                alt="Карта России по федеральным округам"
                fill
                sizes="(max-width: 1100px) 100vw, 1100px"
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
        </section>

        {/* Обучение */}
        <section style={{ margin: '28px 0' }}>
          <div
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: 12,
              padding: 18,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EducationIcon />
            </div>

            <div>
              <h2 style={{ margin: '0 0 6px', color: UI.title }}>
                Обучение от платформы{' '}
                <span style={{ color: '#fff' }}>
                  AuctionA<span style={{ color: UI.red }}>f</span>to
                </span>
              </h2>
              <p style={{ margin: 0, color: UI.text, lineHeight: 1.6 }}>
                Мы готовим серию практических материалов по работе с публичными торгами…
              </p>
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
              <a className="button" href="/trades" style={{ color: UI.btnText, background: UI.btnBg, padding: '8px 12px', borderRadius: 8 }}>
                Перейти в каталог →
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
