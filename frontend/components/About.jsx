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
      {/* Центрируем и сужаем блок — не на всю ширину */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 12px' }}>
        <div
          style={{
            position: 'relative',
            background: UI.cardBg,
            border: `1px solid ${UI.border}`,
            borderRadius: 16,
            padding: 22,
            overflow: 'hidden',
          }}
        >
          {/* мягкая подсветка как на остальных блоках */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -140,
              top: -120,
              width: 520,
              height: 520,
              background: `radial-gradient(520px 320px at 70% 30%, ${UI.gradFrom}22, transparent 60%)`,
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          />

          {/* декоративный силуэт авто (подложка) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              opacity: 0.18,
            }}
          >
            <CarSilhouette />
          </div>

          {/* Контент — всё по центру */}
          <div style={{ position: 'relative' }}>
            {/* чип секции */}
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
                margin: '0 auto 12px',
              }}
            >
              <Dot /> О нас
            </div>

            {/* бренд-вордмарк */}
            <h2
              style={{
                margin: '0 0 8px',
                color: UI.title,
                fontSize: 30,
                lineHeight: 1.2,
                fontWeight: 900,
                letterSpacing: 0.2,
                textAlign: 'center',
              }}
            >
              AuctionA<span style={{ color: UI.red }}>f</span>to
            </h2>

            {/* краткое описание площадки */}
            <p
              style={{
                margin: '0 auto 14px',
                color: UI.text,
                lineHeight: 1.7,
                maxWidth: 700,
                textAlign: 'center',
              }}
            >
              Площадка-агрегатор публичных торгов по автомобилям: собираем лоты с проверенных источников,
              даём данные для решений и делаем путь от поиска до сделки простым и прозрачным.
            </p>

            {/* мини-плашка «аукционная» с молотком и лотом — подчёркиваем тематику */}
            <div
              style={{
                margin: '0 auto 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(255,255,255,0.05)',
                border: `1px dashed ${UI.border}`,
                padding: '8px 12px',
                borderRadius: 12,
              }}
            >
              <GavelIcon />
              <span style={{ color: '#fff', fontWeight: 700, letterSpacing: 0.3 }}>
                Аукционная экосистема
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: UI.chipBg,
                  border: `1px solid ${UI.chipBorder}`,
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 12,
                }}
              >
                LOT&nbsp;#A-1042
              </span>
            </div>

            {/* три ценности — компактно и по центру */}
            <div
              className="about-values"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                gap: 10,
                maxWidth: 760,
                margin: '0 auto',
              }}
            >
              <ValueCard
                icon={<BadgeIcon />}
                title="15 площадок"
                text="Агрегируем торги с ведущих источников."
              />
              <ValueCard
                icon={<TachoIcon />}
                title="История авто"
                text="Данные и показатели — в одном месте."
              />
              <ValueCard
                icon={<ShieldIcon />}
                title="Поддержка сделки"
                text="Помогаем на важных этапах покупки."
              />
            </div>
          </div>

          {/* адаптив */}
          <style jsx>{`
            @media (max-width: 900px) {
              .about-values { grid-template-columns: 1fr; }
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}

/* ——— Сабкомпоненты ——— */
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

/* ——— Иконки (градиент как в Hero) ——— */
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

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutShield')}
      <path d="M12 3l7 3v5c0 5-3 8-7 10C8 19 5 16 5 11V6l7-3z" stroke="url(#aboutShield)" strokeWidth="1.8" />
    </svg>
  );
}
function TachoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutTacho')}
      <path d="M12 20a8 8 0 100-16 8 8 0 000 16z" stroke="url(#aboutTacho)" strokeWidth="1.8" />
      <path d="M12 12l4-2" stroke="url(#aboutTacho)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BadgeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutBadge')}
      <path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1 3-6z" stroke="url(#aboutBadge)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function GavelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {grad('aboutGavel')}
      <path d="M14 3l4 4-6 6-4-4 6-6z" stroke="url(#aboutGavel)" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M3 21l8-8" stroke="url(#aboutGavel)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M15 14l6 6" stroke="url(#aboutGavel)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

/* ——— Декоративный силуэт авто (тонкая обводка) ——— */
function CarSilhouette() {
  return (
    <svg width="520" height="200" viewBox="0 0 520 200" fill="none" aria-hidden>
      {grad('aboutCar')}
      {/* упрощённая линия кузова седана */}
      <path
        d="M20 130 C60 90, 120 70, 200 70
           C260 70, 320 80, 360 98
           L420 100 C460 102, 480 115, 500 130
           L500 145 L20 145 Z"
        stroke="url(#aboutCar)" strokeWidth="1.8" fill="none" />
      {/* колёса */}
      <circle cx="150" cy="145" r="18" stroke="url(#aboutCar)" strokeWidth="1.6" />
      <circle cx="390" cy="145" r="18" stroke="url(#aboutCar)" strokeWidth="1.6" />
    </svg>
  );
}
