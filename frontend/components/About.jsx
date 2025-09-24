// frontend/components/About.jsx
export default function About() {
  const UI = {
    title: '#0f172a',
    text: '#475569',
    muted: '#64748b',
    cardBg: '#ffffff',
    cardSubtle: '#f1f5f9',
    border: 'rgba(15,23,42,0.08)',
    gradFrom: '#2563eb',
    gradTo: '#7c3aed',
    red: '#EF4444',
    button: '#2563eb',
    buttonHover: '#1d4ed8',
    buttonText: '#ffffff',
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
            boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
          }}
        >
          {/* мягкая подсветка */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -160,
              top: -120,
              width: 560,
              height: 560,
              background: `radial-gradient(560px 340px at 70% 30%, ${UI.gradFrom}20, transparent 60%)`,
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          />

          {/* сетка: слева фото, справа текст + кнопка */}
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
                  background: UI.cardSubtle,
                  border: `1px solid ${UI.border}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                {/* Положи файл в /public/about/car.jpg */}
                <img
                  src="/about/car.jpg"
                  alt="Спортивное авто"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  loading="eager"
                />
              </div>
            </div>

            {/* Текст справа — центрируем бренд и абзац */}
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
                  margin: '0 auto 16px',
                  color: UI.text,
                  lineHeight: 1.7,
                  maxWidth: 700,
                }}
              >
                Площадка-агрегатор публичных торгов по автомобилям. Собираем лоты с проверенных источников,
                даём данные для решений и делаем путь от поиска до сделки простым и прозрачным.
              </p>

              {/* CTA: Перейти к торгам */}
              <a
                href="/trades"
                role="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: UI.button,
                  color: UI.buttonText,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 16px 32px rgba(37,99,235,0.25)',
                }}
                onMouseEnter={(e)=> e.currentTarget.style.background = UI.buttonHover}
                onMouseLeave={(e)=> e.currentTarget.style.background = UI.button}
              >
                Перейти к торгам
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" stroke={UI.buttonText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
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
