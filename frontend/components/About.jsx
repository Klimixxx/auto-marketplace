// frontend/components/About.jsx
export default function About() {
  const UI = {
    title: '#ffffff',
    text: 'rgba(255,255,255,0.75)',
    cardBg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
    chipBg: 'rgba(255,255,255,0.06)',
    chipBorder: 'rgba(255,255,255,0.14)',
    gradFrom: '#67e8f9',
    gradTo: '#c4b5fd',
    red: '#EF4444',
  };

  return (
    <section style={{ margin: '24px 0' }}>
      <div
        style={{
          position: 'relative',
          background: UI.cardBg,
          border: `1px solid ${UI.border}`,
          borderRadius: 14,
          padding: 20,
          overflow: 'hidden',
        }}
      >
        {/* мягкий градиентный подсвет внутри, как на остальном сайте */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -120,
            top: -80,
            width: 420,
            height: 420,
            background: `radial-gradient(420px 280px at 70% 30%, ${UI.gradFrom}22, transparent 60%)`,
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1fr',
            gap: 18,
            alignItems: 'center',
          }}
        >
          {/* Левая колонка: лого-вордмарк + текст */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${UI.chipBorder}`,
                color: UI.text,
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              <Dot /> О нас
            </div>

            <h2
              style={{
                margin: '6px 0 10px',
                color: UI.title,
                fontSize: 28,
                lineHeight: 1.2,
                fontWeight: 800,
                letterSpacing: 0.2,
              }}
            >
              AuctionA<span style={{ color: UI.red }}>f</span>to
            </h2>

            <p style={{ margin: 0, color: UI.text, lineHeight: 1.7, maxWidth: 680 }}>
              Мы — агрегатор публичных торгов по автомобилям. Собираем объявления с проверенных площадок,
              помогаем быстро находить лоты и принимать решения на основе данных. Прозрачно, удобно и в одном месте.
            </p>

            {/* мини-чипы с фактами */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Chip>15 площадок</Chip>
              <Chip>История авто</Chip>
              <Chip>Поддержка сделки</Chip>
            </div>
          </div>

          {/* Правая колонка: три лаконичных пункта-ценности */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 10,
            }}
          >
            <ValueCard
              icon={<ShieldIcon />}
              title="Прозрачность"
              text="Достоверные источники и понятные метрики в одном интерфейсе."
            />
            <ValueCard
              icon={<SparkIcon />}
              title="Удобство"
              text="Фильтры, поиск и избранное — без лишних шагов и скрытых действий."
            />
            <ValueCard
              icon={<HandshakeIcon />}
              title="Сопровождение"
              text="Помогаем на этапах подготовки и оформления сделки."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Мелкие сабкомпоненты ——— */
function Chip({ children }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.80)',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}

function ValueCard({ icon, title, text }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 10,
        alignItems: 'flex-start',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        background: 'linear-gradient(90deg,#67e8f9,#c4b5fd)',
        borderRadius: 999,
        display: 'inline-block',
      }}
    />
  );
}

/* ——— Иконки с градиентной обводкой как в Hero ——— */
function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroAbout1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path d="M12 3l7 3v5c0 5-3 8-7 10C8 19 5 16 5 11V6l7-3z" stroke="url(#gradHeroAbout1)" strokeWidth="1.8" />
      <path d="M9 11l2 2 4-4" stroke="url(#gradHeroAbout1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroAbout2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path d="M12 2v6M12 16v6M4 12h6M14 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4" stroke="url(#gradHeroAbout2)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function HandshakeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroAbout3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path d="M7 12l3-3 3 3 4-4" stroke="url(#gradHeroAbout3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l5 5c1 1 3 1 4 0l2-2 2 2c1 1 3 1 4 0l3-3" stroke="url(#gradHeroAbout3)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
