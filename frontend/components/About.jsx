// frontend/components/About.jsx
export default function About() {
  const UI = {
    title: '#ffffff',
    text: 'rgba(255,255,255,0.75)',
    cardBg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
    gradFrom: '#67e8f9',
    gradTo:   '#c4b5fd',
    red: '#EF4444',
  };

  return (
    <section style={{ margin: '28px 0 8px' }}>
      {/* ширина как у "Статистика платформы" */}
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
          {/* мягкая внутреняя подсветка */}
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

          {/* контент: слева фото, справа текст + особенности */}
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

            {/* Правая колонка */}
            <div style={{ textAlign: 'center' }}>
              {/* бренд */}
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
                  margin: '0 auto 16px',
                  color: UI.text,
                  lineHeight: 1.7,
                  maxWidth: 700,
                }}
              >
                Площадка-агрегатор публичных торгов по автомобилям. Собираем лоты с проверенных источников,
                даём данные для решений и делаем путь от поиска до сделки простым и прозрачным.
              </p>

              {/* WOW-особенности */}
              <div
                className="featureRow"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                  gap: 12,
                  maxWidth: 780,
                  margin: '0 auto',
                  textAlign: 'left',
                }}
              >
                <FeatureTile
                  icon={<GlobeGridIcon/>}
                  title="Все торговые площадки в одном месте"
                />
                <FeatureTile
                  icon={<SpeedoIcon/>}
                  title="История авто и ключевые показатели"
                />
                <FeatureTile
                  icon={<HandshakeIcon/>}
                  title="Полностью проведем за вас сделку"
                />
              </div>
            </div>
          </div>

          {/* анимации и эффекты */}
          <style jsx>{`
            @media (max-width: 900px) {
              .about-grid { grid-template-columns: 1fr; }
              .featureRow { grid-template-columns: 1fr; }
            }
            /* "сияние" по диагонали при ховере */
            .tile:hover::after {
              opacity: 1;
              transform: translateX(140%);
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}

/* ===== Плашка особенности с "вау"-эффектом ===== */
function FeatureTile({ icon, title }) {
  const gradBorder =
    'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04)) padding-box,' +
    'linear-gradient(90deg, #67e8f9, #c4b5fd) border-box';

  return (
    <div
      className="tile"
      style={{
        position: 'relative',
        border: '1px solid transparent',
        borderRadius: 14,
        background: gradBorder,
        padding: 12,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        alignItems: 'center',
        gap: 12,
        transition: 'transform .25s ease, box-shadow .25s ease',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 0 rgba(103,232,249,0)',
      }}
      onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 0 0 1px rgba(103,232,249,.18), 0 18px 40px rgba(0,0,0,.35)'; }}
      onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 0 rgba(103,232,249,0)'; }}
    >
      {/* световой "блик", который скользит при ховере */}
      <span
        aria-hidden
        style={{
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        style={{
          content: '""',
          position: 'absolute',
          top: -40,
          left: -140,
          width: 200,
          height: 200,
          transform: 'translateX(-140%) rotate(20deg)',
          background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
          filter: 'blur(2px)',
          opacity: 0,
          transition: 'transform .6s ease, opacity .6s ease',
        }}
      />
      {/* иконка в "светящемся" кольце */}
      <div
        style={{
          width: 46, height: 46, borderRadius: 12,
          display: 'grid', placeItems: 'center',
          background: 'radial-gradient(90px 60px at 50% 20%, rgba(103,232,249,.12), rgba(0,0,0,0))',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {icon}
      </div>

      {/* текст особенности — чисто белый */}
      <div style={{ color:'#fff', fontWeight: 900, fontSize: 15.5, lineHeight: 1.25 }}>
        {title}
      </div>
    </div>
  );
}

/* ===== Иконки с градиентным штрихом (как в Hero) ===== */
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
function GlobeGridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('g1')}
      <circle cx="12" cy="12" r="9" stroke="url(#g1)" strokeWidth="1.8"/>
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="url(#g1)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function SpeedoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('g2')}
      <path d="M12 20a8 8 0 100-16 8 8 0 000 16z" stroke="url(#g2)" strokeWidth="1.8"/>
      <path d="M12 12l4-2" stroke="url(#g2)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function HandshakeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('g3')}
      <path d="M7 12l3-3 3 3 4-4" stroke="url(#g3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12l5 5c1 1 3 1 4 0l2-2 2 2c1 1 3 1 4 0l3-3" stroke="url(#g3)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
