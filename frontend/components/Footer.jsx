// frontend/components/Footer.jsx
export default function Footer() {
  const UI = {
    text: 'rgba(255,255,255,0.75)',
    title: '#fff',
    border: 'rgba(255,255,255,0.10)',
    chip: 'rgba(255,255,255,0.06)',
    gradFrom: '#67e8f9',
    gradTo: '#c4b5fd',
    red: '#EF4444',
  };

  const link = (href, label) => (
    <a
      href={href}
      style={{
        color: '#fff',
        textDecoration: 'none',
        opacity: 0.9,
      }}
      onMouseEnter={(e)=> e.currentTarget.style.opacity = 1}
      onMouseLeave={(e)=> e.currentTarget.style.opacity = 0.9}
    >
      {label}
    </a>
  );

  return (
    <footer
      style={{
        marginTop: 28,
        borderTop: `1px solid ${UI.border}`,
        background: 'transparent',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 12px' }}>
        {/* Верхняя часть: 4 колонки */}
        <div
          className="grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* ЛОГО / бренд (слегка опустили, убрали цветной квадрат) */}
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <div
              style={{
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${UI.border}`,
              }}
            >
              {/* квадрат удален */}
              <div style={{ color: UI.title, fontWeight: 900, fontSize: 18 }}>
                AuctionA<span style={{ color: UI.red }}>f</span>to
              </div>
            </div>
            <div style={{ color: UI.text, marginTop: 8, fontSize: 13.5 }}>
              Площадка публичных торгов по автомобилям
            </div>
          </div>

          {/* Страницы (обновили список) */}
          <div style={{ textAlign: 'center' }}>
            <h4 style={headingStyle(UI)}>Страницы</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {link('/profile', 'Личный кабинет')}
              {link('/trades', 'Торги')}
              {link('/inspections', 'Мои осмотры')}
              {link('/support', 'Поддержка')}
            </div>
          </div>

          {/* Соц-сети + контакты */}
          <div style={{ textAlign: 'center' }}>
            <h4 style={headingStyle(UI)}>Соц-сети</h4>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 10 }}>
              <a href="https://t.me/" aria-label="Telegram" style={iconWrap(UI, 'rgba(34, 211, 238, .15)', '#22D3EE')}>
                <TelegramIcon />
              </a>
              <a href="https://instagram.com/" aria-label="Instagram" style={iconWrap(UI, 'rgba(236, 72, 153, .15)', '#E1306C')}>
                <InstagramIcon />
              </a>
              <a href="https://youtube.com/" aria-label="YouTube" style={iconWrap(UI, 'rgba(239, 68, 68, .15)', '#FF0000')}>
                <YoutubeIcon />
              </a>
            </div>
            <div style={{ color: UI.text, fontSize: 13.5, lineHeight: 1.6 }}>
              Тел.: <a href="tel:+79990000000" style={contactLinkStyle}>+7 (999) 000-00-00</a><br/>
              Почта: <a href="mailto:support@auctionafto.ru" style={contactLinkStyle}>support@auctionafto.ru</a>
            </div>
          </div>

          {/* Доп. информация (слегка опустили для визуального центра) */}
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <h4 style={headingStyle(UI)}>Дополнительно</h4>
            <div style={{ color: UI.text, fontSize: 13.5, lineHeight: 1.65 }}>
              Адрес: г. Москва, ул. Пример, 1<br/>
              © 2023—2025 «AuctionAfto»
            </div>
          </div>
        </div>

        {/* Нижняя подпись — как было (простая строка с пунктирной линией сверху) */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: `1px dashed ${UI.border}`,
            textAlign: 'center',
            color: UI.text,
            fontSize: 13.5,
          }}
        >
          Данную платформу разработала студия — <strong style={{ color: '#fff' }}>Timof</strong>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; text-align: center; }
        }
      `}</style>
    </footer>
  );
}

function headingStyle(UI){
  return {
    margin: '0 0 8px',
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    backgroundImage: `linear-gradient(90deg, ${UI.gradFrom}, ${UI.gradTo})`,
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    fontWeight: 900,
  };
}

const contactLinkStyle = {
  color: '#fff',
  textDecoration: 'none',
  opacity: 0.95,
};

function iconWrap(UI, bg, stroke) {
  return {
    width: 42, height: 42, borderRadius: 10,
    display: 'grid', placeItems: 'center',
    background: bg,
    border: `1px solid ${UI.border}`,
    color: stroke,
  };
}

/* ——— SVG иконки соцсетей ——— */
function TelegramIcon(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 3L3 11l6 2 2 6 3-4 5-12z" stroke="#22D3EE" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function InstagramIcon(){
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#E1306C" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="4" stroke="#E1306C" strokeWidth="1.8"/>
      <circle cx="17" cy="7" r="1.2" fill="#E1306C"/>
    </svg>
  );
}
function YoutubeIcon(){
  return (
    <svg width="24" height="17" viewBox="0 0 24 17" fill="none" aria-hidden>
      <path d="M23.2 3.1a3 3 0 00-2.1-2.1C19.3.5 12 .5 12 .5s-7.3 0-9.1.5A3 3 0 00.8 3.1C.3 5 .3 8.5.3 8.5s0 3.5.5 5.4a3 3 0 002.1 2.1c1.8.5 9.1.5 9.1.5s7.3 0 9.1-.5a3 3 0 002.1-2.1c.5-1.9.5-5.4.5-5.4s0-3.5-.5-5.4z" stroke="#FF0000" strokeWidth="1.3"/>
      <path d="M9.75 12.25V4.75L15.5 8.5l-5.75 3.75z" fill="#FF0000"/>
    </svg>
  );
}
