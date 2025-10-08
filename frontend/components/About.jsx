// frontend/components/About.jsx — светлая версия «О нас»
export default function About() {
const UI = {
  title: 'var(--text-900)',       // чёрный заголовок
  text: 'var(--text-600)',        // черно-серый текст
  cardBg: '#FDFCF9',              // ТЕПЛЫЙ белый, чтобы не сливаться с фоном страницы
  border: 'var(--stats-border)',  // тонкая «тёплая» рамка
  red: '#EF4444',
  button: 'var(--blue)',          // синяя кнопка как «Найти»
  buttonHover: '#1e53d6',         // ховер темнее
};


  return (
    <section style={{ margin: '28px 0 8px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 12px' }}>
        <div
  style={{
    position: 'relative',
    background:
      'linear-gradient(135deg, rgba(42,101,247,0.12) 0%, rgba(42,101,247,0.04) 60%, rgba(103,232,249,0.08) 100%)', // фон как у бейджа «Честные данные»
    border: `1px solid var(--stats-border)`,
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    boxShadow: '0 6px 22px rgba(17,24,39,0.06)', // ← добавить
  }}
>

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
    background: 'transparent',
    overflow: 'hidden',
  }}
>
  <img
    src="/about/car.jpg"
    alt="Спортивное авто"
    style={{ width: '100%', height: 'auto', display: 'block' }}
    loading="eager"
  />
</div>

            </div>

            {/* Текст справа — бренд + описание + CTA */}
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
                Мы — платформа по покупке автомобилей с аукционов. Собираем честные данные, упрощаем участие в торгах
                и помогаем безопасно оформить сделку. Прозрачно, удобно и без лишней бюрократии.
              </p>

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
                  color: '#fff',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid ' + UI.button,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e)=> e.currentTarget.style.background = UI.buttonHover}
                onMouseLeave={(e)=> e.currentTarget.style.background = UI.button}
              >
                Перейти к торгам
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

