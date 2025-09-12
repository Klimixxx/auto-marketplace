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
    <section style={{ margin: '28px 0 8px' }}>
      {/* ширина как у .container / блока статистики */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 12px' }}>
        <div
          style={{
            position: 'relative',
            background: UI.cardBg,
            border: `1px solid ${UI.border}`,
            borderRadius: 16,
            padding: 18,
            overflow: 'hidden',
          }}
        >
          {/* лёгкая внутреняя подсветка, как в других блоках */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -160,
              top: -120,
              width: 560,
              height: 560,
              background: `radial-gradient(560px 340px at 70% 30%, ${UI.gradFrom}22, transparent 60%)`,
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          />

          {/* контент: слева фото, справа текст */}
          <div
            className="about-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 460px) 1fr',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {/* Фото слева */}
            <div>
              <div
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${UI.border}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                {/* Помести файл в /public/about/car.jpg (см. ниже) */}
                <img
                  src="/about/car.jpg"
                  alt="Спортивное авто"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  loading="eager"
                />
              </div>
            </div>

            {/* Текст справа (центрировано по блоку) */}
            <div>
              {/* чип «О нас» */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: UI.chipBg,
                  border: `1px solid ${UI.chipBorder}`,
                  color: UI.text,
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                <Dot /> О нас
              </div>

              <h2
                style={{
                  margin: '0 0 8px',
                  color: UI.title,
                  fontSize: 30,
                  lineHeight: 1.2,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                }}
              >
                AuctionA<span style={{ color: UI.red }}>f</span>to
              </h2>

              <p
                style={{
                  margin: '0 0 12px',
                  color: UI.text,
                  lineHeight: 1.7,
                }}
              >
                Площадка-агрегатор публичных торгов по автомобилям. Собираем лоты с проверенных источников,
                даём данные для решений и делаем путь от поиска до сделки простым и прозрачным.
              </p>

              {/* маркеры-ценности */}
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                <ValueItem>15 торговых площадок — в одном месте</ValueItem>
                <ValueItem>История авто и ключевые показатели</ValueItem>
                <ValueItem>Поддержка сделки на важных этапах</ValueItem>
              </ul>
            </div>
          </div>

          <style jsx>{`
            @media (max-width: 900px) {
              .about-grid { grid-template-columns: 1fr; }
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}

/* ——— мини-компоненты ——— */
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

function ValueItem({ children }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* галочка с градиентной обводкой под стиль Hero */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="gradAboutTick" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          <path d="M5 13l4 4 10-10" stroke="url(#gradAboutTick)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{children}</span>
    </li>
  );
}
