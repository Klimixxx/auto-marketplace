import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import FirstLoginModal from '../components/FirstLoginModal';
import Image from 'next/image';
import Header from '../components/Header';



const API = process.env.NEXT_PUBLIC_API_BASE;

export default function Home() {
  const [q, setQ] = useState('');
  const [stats, setStats] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!API) return;
    fetch(`${API}/api/public-stats`)
      .then(r => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  function submit(e) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/trades?q=${encodeURIComponent(query)}` : '/trades');
  }

  const UI = {
    cardBg: '#0F172A',
    border: 'rgba(255,255,255,0.10)',
    title: '#E6EDF3',
    text: '#C7D2DE',
    inputBg: '#0B1220',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputText: '#E6EDF3',
    btnBg: '#152235',
    btnHover: '#1A2A44',
    btnText: '#E6EDF3',
    accent: '#22C55E',
    red: '#EF4444',
  };


 
  const fmt = new Intl.NumberFormat('ru-RU');

  return (
    <Header />
    <div className="container" style={{ maxWidth: 1100 }}>
      <FirstLoginModal />

      {/* Поиск */}
      <section style={{ margin: '32px 0' }}>
        <h1 style={{ color: UI.title, marginBottom: 8 }}>Найдите нужный лот</h1>
        <p style={{ color: UI.text, marginTop: 0 }}>Поиск по названию, номеру лота, источнику и т. п.</p>

        <form onSubmit={submit}
          style={{
            background: UI.cardBg, border: `1px solid ${UI.border}`,
            borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'center'
          }}>
          {/* Иконка поиска слева */}
          <span aria-hidden style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${UI.inputBorder}`
          }}>
            <SearchIcon />
          </span>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: Toyota Camry, лот 12345…"
            className="input"
            style={{
              flex: 1, background: UI.inputBg, color: UI.inputText, border: `1px solid ${UI.inputBorder}`,
              borderRadius: 10, padding: '10px 12px'
            }}
          />
          <button className="button" style={{
            background: UI.btnBg, color: UI.btnText, border: `1px solid ${UI.inputBorder}`,
            borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer'
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = UI.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = UI.btnBg)}
          >
            Искать
          </button>
        </form>
      </section>


     {/* Статистика + карта */}
<section style={{ margin: '22px 0' }}>
  <h2 style={{ margin: '0 0 12px 2px', color: UI.title, letterSpacing: .2 }}>
    Статистика платформы
  </h2>
  <div style={{
    background: UI.cardBg,
    border: `1px solid ${UI.border}`,
    borderRadius: 12,
    padding: 16
  }}>
    {/* Сетка со статистикой */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
      gap: 12,
      marginBottom: 20
    }}>
      <StatCard title="Пользователей" value={stats ? fmt.format(stats.users) : '—'} Icon={UsersIcon} />
      <StatCard title="Публичные предложения" value="—" Icon={OffersIcon} />
      <StatCard title="Открытых аукционов" value="—" Icon={AuctionsIcon} />
      <StatCard title="Стоимость имущества в торгах" value="—" Icon={ValueIcon} />
    </div>

    {/* Картинка карты (без заголовка и описания) */}
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1527 / 768', borderRadius: 8, overflow: 'hidden' }}>
      <Image
        src="/fo-map.png"
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
        <div style={{
          background: UI.cardBg,
          border: `1px solid ${UI.border}`,
          borderRadius: 12,
          padding: 18,
          display:'grid', gridTemplateColumns:'auto 1fr', gap:16, alignItems:'center'
        }}>
          <div style={{
            width:56, height:56, borderRadius:14,
            background:'rgba(34,197,94,0.08)',
            border:'1px solid rgba(34,197,94,0.25)',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <EducationIcon />
          </div>

          <div>
            <h2 style={{ margin:'0 0 6px', color: UI.title }}>
              Обучение от платформы{' '}
              <span style={{ color: '#fff' }}>
                AuctionA<span style={{ color: UI.red }}>f</span>to
              </span>
            </h2>
            <p style={{ margin:0, color: UI.text, lineHeight: 1.6 }}>
              Мы готовим серию практических материалов по работе с публичными торгами:
              как находить ликвидные лоты, быстро оценивать цену, оформлять участие и
              снижать риски. В курс войдут разборы реальных кейсов, чек-листы и шаблоны
              для работы с организаторами. Подпишитесь на обновления — старт уже скоро.
            </p>
          </div>
        </div>
      </section>

      {/* Инфо-блок */}
      <section style={{ margin: '24px 0' }}>
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Все торги — в одном месте</h2>
          <p style={{ color: 'var(--muted)' }}>
            Мы агрегируем объявления с разных источников и показываем удобную выдачу по фильтрам.
          </p>
          <p><a className="button" href="/trades">Перейти в каталог →</a></p>
        </div>
      </section>
    </div>
  );
}

/* ——— UI helpers ——— */
function StatCard({ title, value, Icon }) {
  return (
    <div style={{
      display:'flex', gap:12, alignItems:'center',
      background:'rgba(255,255,255,0.03)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, padding:12, minHeight:72
    }}>
      <div style={{
        width:42, height:42, borderRadius:10,
        background:'rgba(34,197,94,0.08)',
        border:'1px solid rgba(34,197,94,0.25)',
        display:'flex', alignItems:'center', justifyContent:'center'
      }}>
        <Icon />
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:12, opacity:.8 }}> {title} </div>
        <div style={{ fontSize:20, fontWeight:800 }}> {value} </div>
      </div>
    </div>
  );
}

/* ——— Icons ——— */
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="11" cy="11" r="7" stroke="#E6EDF3" strokeWidth="1.5" />
      <path d="M20 20L17 17" stroke="#E6EDF3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M7 14c-3 0-5 2-5 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="7" r="3.5" stroke="#22C55E" strokeWidth="1.5"/>
      <path d="M17 14c-1.7 0-3.2.6-4.2 1.8" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="17" cy="7.5" r="3" stroke="#22C55E" strokeWidth="1.5"/>
    </svg>
  );
}
function OffersIcon() {
  // иконка "лист бумаги" с загнутым уголком
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="#22C55E" strokeWidth="1.5"/>
      <path d="M14 3v5h5" stroke="#22C55E" strokeWidth="1.5"/>
      <path d="M9 9h4M9 13h6M9 17h6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function AuctionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M3 21h18" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 10l6 6 3-3-6-6-3 3Z" stroke="#22C55E" strokeWidth="1.5"/>
      <path d="M14 5l5 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ValueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
      <rect x="3" y="7" width="18" height="10" rx="2" stroke="#22C55E" strokeWidth="1.5"/>
      <path d="M7 12h10" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="2" stroke="#22C55E" strokeWidth="1.5"/>
    </svg>
  );
}
function EducationIcon() {
  // «академическая шапочка»
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none">
      <path d="M3 9l9-4 9 4-9 4-9-4Z" stroke="#22C55E" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M7 12v4c0 .8 4 2 5 2s5-1.2 5-2v-4" stroke="#22C55E" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M21 10v5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
