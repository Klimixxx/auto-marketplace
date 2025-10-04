// frontend/pages/support.js
export default function Support() {
  return (
    <div className="container" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 12px' }}>
      <h1 style={{ marginTop: 0, color: '#fff' }}>Поддержка</h1>
      <p style={{ color: 'rgba(255,255,255,0.75)' }}>
        Если у вас возникли вопросы по работе платформы или торгам — напишите нам. Мы ответим как можно скорее.
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gap: 12,
        maxWidth: 680
      }}>
        <label style={{ color:'#fff' }}>
          Тема обращения
          <input
            placeholder="Например: Не приходит код подтверждения"
            style={{
              marginTop: 6, width:'100%', height:44, borderRadius:10, padding:'0 12px',
              background:'#0B1220', border:'1px solid rgba(255,255,255,0.14)', color:'#E6EDF3'
            }}
          />
        </label>

        <label style={{ color:'#fff' }}>
          Описание
          <textarea
            rows={5}
            placeholder="Опишите проблему как можно подробней…"
            style={{
              marginTop: 6, width:'100%', borderRadius:10, padding:'10px 12px',
              background:'#0B1220', border:'1px solid rgba(255,255,255,0.14)', color:'#E6EDF3', resize:'vertical'
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => alert('Спасибо! Мы получили ваше обращение.')}
          style={{
            height: 44, padding:'0 16px', borderRadius:10,
            background:'#1E90FF', color:'#fff', fontWeight:800, cursor:'pointer', border:'none'
          }}
        >
          Отправить
        </button>

        <div style={{ color:'rgba(255,255,255,0.65)' }}>
          Или свяжитесь с нами: <a href="mailto:support@auctionafto.ru">support@auctionafto.ru</a>
        </div>
      </div>
    </div>
  );
}
