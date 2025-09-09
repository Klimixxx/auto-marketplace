import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FirstLoginModal from '../components/FirstLoginModal';

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

    // === Карта России (тайловая, по федеральным округам + МО) ===
  // === Карта России (SVG по федеральным округам + МО) ===
  function RussiaSvgMap({ onSelect }) {
    // Заглушки-числа для каждого региона (потом подставим реальные)
    const numbers = {
      nwfo: '—', // Северо-Западный ФО
      cfo:  '—', // Центральный ФО
      mo:   '—', // Московская область (отдельно)
      pfo:  '—', // Приволжский ФО
      ufo:  '—', // Уральский ФО
      sfo:  '—', // Сибирский ФО
      dfo:  '—', // Дальневосточный ФО
      yfo:  '—', // Южный ФО
      nfo:  '—', // Северо-Кавказский ФО
    };

    // Универсальный стилевой хелпер для регионов
    const regionBase = {
      fill: UI.cardBg,
      stroke: UI.border,
      strokeWidth: 1.2,
      transition: 'transform 160ms ease, fill 160ms ease, stroke 160ms ease',
      cursor: 'pointer',
    };

    // Ховер-эффекты через обработчики (чтобы не тащить CSS)
    const onEnter = (e) => {
      e.currentTarget.style.transform = 'scale(1.04)';
      e.currentTarget.style.stroke = UI.accent;
      e.currentTarget.style.fill = UI.btnHover;
    };
    const onLeave = (e) => {
      e.currentTarget.style.transform = 'scale(1.0)';
      e.currentTarget.style.stroke = UI.border;
      e.currentTarget.style.fill = UI.cardBg;
    };

    // Вспомогательная плашка-число
    const CountBadge = ({ x, y, value }) => (
      <g transform={`translate(${x - 22}, ${y - 14})`}>
        <rect width="44" height="24" rx="8" ry="8"
          fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.35)" />
        <text x="22" y="16" textAnchor="middle"
          fontSize="13" fontWeight="700" fill={UI.accent}
          style={{ userSelect: 'none' }}>
          {value}
        </text>
      </g>
    );

    return (
      <div
        style={{
          background: UI.cardBg,
          border: `1px solid ${UI.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ margin: '0 0 10px 2px', color: UI.title }}>
          География объявлений (демо)
        </h2>
        <p style={{ margin: '0 0 14px 2px', color: UI.text }}>
          Наведи курсор — регион слегка увеличится. Клик — переход к торгам по региону. Пока вместо цифр — «—».
        </p>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          {/* ВАЖНО: это стилизованная упрощённая карта по ФО — контуры подобраны так,
             чтобы визуально напоминать РФ и не выглядели «квадратами». */}
          <svg
            viewBox="0 0 1200 560"
            width="100%"
            height="auto"
            role="img"
            aria-label="Карта России по федеральным округам"
          >
            {/* —— СЕВЕРО-ЗАПАДНЫЙ ФО —— */}
            <g transform="translate(150,170)" onClick={() => onSelect && onSelect('nwfo')}>
              <path
                d="M 0 40
                   C 10 10, 70 0, 110 10
                   C 160 20, 150 60, 120 80
                   C 95 98, 60 95, 35 85
                   C 10 75, -8 62, 0 40 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              {/* Подпись */}
              <text x="70" y="60" textAnchor="middle" fontSize="12" fill={UI.title}>СЗФО</text>
              <CountBadge x={70} y={78} value={numbers.nwfo} />
            </g>

            {/* —— ЦЕНТРАЛЬНЫЙ ФО —— */}
            <g transform="translate(260,215)" onClick={() => onSelect && onSelect('cfo')}>
              <path
                d="M 0 40
                   C 18 12, 70 6, 108 18
                   C 148 30, 150 66, 118 86
                   C 88 104, 42 104, 20 90
                   C -2 76, -8 62, 0 40 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="76" y="62" textAnchor="middle" fontSize="12" fill={UI.title}>ЦФО</text>
              <CountBadge x={76} y={80} value={numbers.cfo} />
            </g>

            {/* —— МОСКОВСКАЯ ОБЛАСТЬ (как отдельная точка) —— */}
            <g transform="translate(360,258)" onClick={() => onSelect && onSelect('mo')}>
              <path
                d="M 0 0
                   c 14 -4, 28 4, 28 18
                   c 0 12, -12 20, -24 16
                   c -12 -4, -18 -18, -4 -34 Z"
                style={{ ...regionBase, strokeDasharray: '2 2' }}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="18" y="-8" textAnchor="middle" fontSize="11" fill={UI.title}>МО</text>
              <CountBadge x={18} y="12" value={numbers.mo} />
            </g>

            {/* —— ПРИВОЛЖСКИЙ ФО —— */}
            <g transform="translate(370,235)" onClick={() => onSelect && onSelect('pfo')}>
              <path
                d="M 0 48
                   C 30 20, 90 10, 140 26
                   C 170 36, 190 60, 168 84
                   C 148 106, 100 110, 60 102
                   C 32 96, 12 78, 0 48 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="98" y="70" textAnchor="middle" fontSize="12" fill={UI.title}>ПФО</text>
              <CountBadge x={98} y={90} value={numbers.pfo} />
            </g>

            {/* —— ЮЖНЫЙ ФО —— */}
            <g transform="translate(300,300)" onClick={() => onSelect && onSelect('yfo')}>
              <path
                d="M 0 30
                   C 22 10, 70 6, 96 16
                   C 118 24, 118 48, 98 64
                   C 78 80, 40 82, 18 70
                   C -2 58, -6 44, 0 30 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="62" y="52" textAnchor="middle" fontSize="12" fill={UI.title}>ЮФО</text>
              <CountBadge x={62} y={70} value={numbers.yfo} />
            </g>

            {/* —— СЕВЕРО-КАВКАЗСКИЙ ФО —— */}
            <g transform="translate(380,310)" onClick={() => onSelect && onSelect('nfo')}>
              <path
                d="M 0 22
                   C 14 8, 38 6, 56 12
                   C 70 16, 72 32, 58 42
                   C 44 52, 22 52, 8 44
                   C -2 36, -4 28, 0 22 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="36" y="36" textAnchor="middle" fontSize="11" fill={UI.title}>СКФО</text>
              <CountBadge x={36} y={54} value={numbers.nfo} />
            </g>

            {/* —— УРАЛЬСКИЙ ФО —— */}
            <g transform="translate(540,210)" onClick={() => onSelect && onSelect('ufo')}>
              <path
                d="M 0 54
                   C 20 24, 70 8, 112 20
                   C 146 30, 162 64, 138 88
                   C 116 110, 70 116, 36 106
                   C 16 100, 6 78, 0 54 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="88" y="72" textAnchor="middle" fontSize="12" fill={UI.title}>УФО</text>
              <CountBadge x={88} y={92} value={numbers.ufo} />
            </g>

            {/* —— СИБИРСКИЙ ФО —— */}
            <g transform="translate(660,210)" onClick={() => onSelect && onSelect('sfo')}>
              <path
                d="M 0 60
                   C 30 26, 110 10, 190 30
                   C 246 44, 258 86, 218 112
                   C 182 136, 108 140, 54 126
                   C 24 118, 6 92, 0 60 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="138" y="84" textAnchor="middle" fontSize="12" fill={UI.title}>СФО</text>
              <CountBadge x={138} y={104} value={numbers.sfo} />
            </g>

            {/* —— ДАЛЬНЕВОСТОЧНЫЙ ФО —— */}
            <g transform="translate(900,200)" onClick={() => onSelect && onSelect('dfo')}>
              <path
                d="M 0 50
                   C 40 18, 110 0, 170 16
                   C 210 26, 226 60, 198 86
                   C 168 114, 104 124, 56 114
                   C 20 106, 4 80, 0 50 Z"
                style={regionBase}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              />
              <text x="120" y="74" textAnchor="middle" fontSize="12" fill={UI.title}>ДФО</text>
              <CountBadge x={120} y={96} value={numbers.dfo} />
            </g>
          </svg>
        </div>

        {/* Легенда */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            color: UI.text,
            fontSize: 13,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 4,
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.35)',
              }}
            />
            Количество объявлений
          </span>
          <span>•</span>
          <span>Клик = перейти к лотам по региону</span>
        </div>
      </div>
    );
  }


  

  const fmt = new Intl.NumberFormat('ru-RU');

  return (
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

      {/* Статистика платформы */}
      <section style={{ margin: '22px 0' }}>
        <h2 style={{ margin: '0 0 12px 2px', color: UI.title, letterSpacing: .2 }}>Статистика платформы</h2>
        <div style={{
          background: UI.cardBg,
          border: `1px solid ${UI.border}`,
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
            gap: 12
          }}>
            <StatCard
              title="Пользователей"
              value={stats ? fmt.format(stats.users) : '—'}
              Icon={UsersIcon}
            />
            <StatCard
              title="Публичные предложения"
              value="—"
              Icon={OffersIcon}
            />
            <StatCard
              title="Открытых аукционов"
              value="—"
              Icon={AuctionsIcon}
            />
            <StatCard
              title="Стоимость имущества в торгах"
              value="—"
              Icon={ValueIcon}
            />
          </div>
        </div>
      </section>
            {/* Карта регионов (демо) */}
      <section style={{ margin: '26px 0' }}>
       <RussiaSvgMap onSelect={(code) => router.push(`/trades?region=${encodeURIComponent(code)}`)} />
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
