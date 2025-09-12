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
                {/* Помести файл в /public/about/car.jpg */}
                <img
                  src="/about/car.jpg"
                  alt="Спортивное авто"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  loading="eager"
                />
              </div>
            </div>

            {/* Текст справа — центрируем логотип и абзац */}
            <div style={{ textAlign: 'center' }}>
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
                  margin: '0 auto 14px',
                  color: UI.text,
                  lineHeight: 1.7,
                  maxWidth: 700,
                }}
              >
                Площадка-агрегатор публичных торгов по автомобилям. Собираем лоты с проверенных источников,
                даём данные для решений и делаем путь от поиска до сделки простым и прозрачным.
              </p>

              {/* Особенности — белым цветом и с иконками */}
              <div
                className="about-features"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 10,
                  maxWidth: 720,
                  margin: '0 auto',
                  textAlign: 'left',
                }}
              >
                <FeatureItem
                  icon={<GridIcon />}
                  text="Все торговые площадки в одном месте"
                />
                <FeatureItem
                  icon={<GaugeIcon />}
                  text="История авто и ключевые показатели"
                />
                <FeatureItem
                  icon={<HandsIcon />}
                  text="Полностью проведем за вас сделку"
                />
              </div>
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

/* ——— Особенность с иконкой — белый текст ——— */
function FeatureItem({ icon, text }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          width: 42, height: 42, borderRadius: 10,
          display: 'grid', placeItems: 'center',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 15.5,
          lineHeight: 1.25,
          color: '#fff', // ← белый цвет для текста особенностей
        }}
      >
        {text}
      </div>
    </div>
  );
}

/* ——— Иконки с тем же градиентом, что и в Hero ——— */
function grad(id) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="100%" stopColor="#c4b5fd" />
      </linearGradient>
    </defs>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutGrid')}
      <path d="M3 3h8v8H3V3zM13 3h8v8h-8V3zM3 13h8v8H3v-8zM13 13h8v8h-8v-8z" stroke="url(#aboutGrid)" strokeWidth="1.8" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutGauge')}
      <path d="M12 20a8 8 0 100-16 8 8 0 000 16z" stroke="url(#aboutGauge)" strokeWidth="1.8" />
      <path d="M12 12l4-2" stroke="url(#aboutGauge)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function HandsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutHands')}
      <path d="M7 12l3-3 3 3 4-4" stroke="url(#aboutHands)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l5 5c1 1 3 1 4 0l2-2 2 2c1 1 3 1 4 0l3-3" stroke="url(#aboutHands)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
