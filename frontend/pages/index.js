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

  // === Карта России: силуэт + разделение по федеральным округам (SVG) ===
function RussiaSvgFO({ onSelect }) {
  // заглушки-числа
  const numbers = {
    nwfo: '—', // Северо-Запад
    cfo:  '—', // Центр
    mo:   '—', // Московская область
    pfo:  '—', // Приволжье
    ufo:  '—', // Урал
    sfo:  '—', // Сибирь
    dfo:  '—', // Дальний Восток
    yfo:  '—', // Юг
    nfo:  '—', // Северный Кавказ
  };

  const baseStroke = UI.border;
  const hoverStroke = UI.accent;

  const onEnter = (e) => {
    e.currentTarget.style.filter = 'brightness(1.1)';
    e.currentTarget.style.stroke = hoverStroke;
  };
  const onLeave = (e) => {
    e.currentTarget.style.filter = 'brightness(1.0)';
    e.currentTarget.style.stroke = baseStroke;
  };

  const CountBadge = ({ x, y, value }) => (
    <g transform={`translate(${x - 22}, ${y - 14})`}>
      <rect width="44" height="24" rx="8" ry="8"
        fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.35)"/>
      <text x="22" y="16" textAnchor="middle" fontSize="13" fontWeight="700"
        fill={UI.accent} style={{ userSelect: 'none' }}>{value}</text>
    </g>
  );

  return (
    <div style={{
      background: UI.cardBg, border: `1px solid ${UI.border}`,
      borderRadius: 12, padding: 16
    }}>
      <h2 style={{ margin:'0 0 10px 2px', color: UI.title }}>Карта России (демо)</h2>
      <p style={{ margin:'0 0 14px 2px', color: UI.text }}>
        Наведи — подсветка, клик — перейти к торгам по округу. Цифры пока «—».
      </p>

      <div style={{ width:'100%', overflowX:'auto' }}>
        {/* Стилевой градиент под фирстиль */}
        <svg viewBox="0 0 1200 560" width="100%" height="auto" role="img"
             aria-label="Карта России по федеральным округам">
          <defs>
            <linearGradient id="ruGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopOpacity="1" stopColor="#0B1220"/>
              <stop offset="100%" stopOpacity="1" stopColor="#152235"/>
            </linearGradient>
          </defs>

          {/* 1) СИЛУЭТ РОССИИ — упрощённый, но узнаваемый контур */}
          <g transform="translate(8,6) scale(1.02)">
            <path
              d="
                M 30 310
                C 90 290, 150 280, 210 295
                C 250 305, 280 320, 300 330
                C 330 348, 360 350, 390 342
                C 430 330, 470 330, 520 340
                C 560 348, 610 350, 650 340
                C 700 328, 760 320, 820 330
                C 860 336, 900 350, 930 370
                C 950 382, 980 388, 1008 384
                C 1040 378, 1075 392, 1096 410
                C 1118 428, 1132 450, 1144 468
                C 1128 470, 1112 472, 1096 470
                C 1064 466, 1042 466, 1016 472
                C 1000 476, 984 490, 972 504
                C 952 526, 920 532, 888 528
                C 844 522, 810 506, 770 498
                C 736 492, 700 496, 664 504
                C 624 512, 594 516, 560 510
                C 528 504, 504 488, 476 474
                C 452 462, 424 456, 396 456
                C 360 454, 322 460, 286 470
                C 244 482, 210 488, 180 480
                C 152 472, 122 454, 108 428
                C 88 392, 60 360, 38 334
                C 26 320, 24 314, 30 310 Z
              "
              fill="url(#ruGrad)" stroke={baseStroke} strokeWidth="1.5" />

            {/* 2) РАЗДЕЛИТЕЛИ ФЕДЕРАЛЬНЫХ ОКРУГОВ (упрощённые линии), 
                  подобраны так, чтобы визуально соответствовать карте */}
            <g stroke={baseStroke} strokeWidth="1.2" strokeDasharray="6 6" opacity="0.9">
              {/* СЗФО / ЦФО */}
              <path d="M 210 300 C 250 315, 280 328, 300 335" fill="none"/>
              {/* ЦФО / ПФО */}
              <path d="M 330 340 C 360 350, 390 352, 420 346" fill="none"/>
              {/* ПФО / УФО */}
              <path d="M 470 344 C 510 352, 545 354, 580 350" fill="none"/>
              {/* УФО / СФО */}
              <path d="M 620 346 C 660 344, 700 338, 736 336" fill="none"/>
              {/* СФО / ДФО */}
              <path d="M 800 336 C 850 344, 900 360, 940 378" fill="none"/>
              {/* ЮФО / СКФО (юг) */}
              <path d="M 300 360 C 330 372, 350 384, 372 392" fill="none"/>
              {/* ЮФО / ПФО */}
              <path d="M 280 352 C 310 360, 340 364, 360 362" fill="none"/>
            </g>

            {/* 3) ИНТЕРАКТИВНЫЕ “ХИТЗОНЫ” ФО + МО (поверх силуэта) */}
            {/* СЗФО */}
            <g onClick={() => onSelect && onSelect('nwfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 120 315 C 170 300, 210 300, 250 315 C 230 340, 190 350, 150 340 C 130 335, 118 326, 120 315 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={180} y={330} value={numbers.nwfo}/>
              <text x="180" y="318" textAnchor="middle" fontSize="12" fill={UI.title}>СЗФО</text>
            </g>

            {/* ЦФО */}
            <g onClick={() => onSelect && onSelect('cfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 250 315 C 290 330, 330 340, 370 336 C 350 362, 300 368, 270 354 C 258 348, 248 336, 250 315 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={320} y={342} value={numbers.cfo}/>
              <text x="320" y="330" textAnchor="middle" fontSize="12" fill={UI.title}>ЦФО</text>
            </g>

            {/* МО */}
            <g onClick={() => onSelect && onSelect('mo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 350 334 c 10 -4 22 2 24 12 c 2 10 -6 18 -18 20 c -10 2 -18 -6 -16 -16 c 2 -8 4 -12 10 -16 Z"
                    fill="transparent" stroke="transparent"/>
              <text x="362" y="326" textAnchor="middle" fontSize="11" fill={UI.title}>МО</text>
              <CountBadge x={362} y={344} value={numbers.mo}/>
            </g>

            {/* ПФО */}
            <g onClick={() => onSelect && onSelect('pfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 370 336 C 410 350, 450 350, 490 346 C 476 370, 430 378, 396 370 C 380 366, 368 354, 370 336 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={440} y={352} value={numbers.pfo}/>
              <text x="440" y="340" textAnchor="middle" fontSize="12" fill={UI.title}>ПФО</text>
            </g>

            {/* УФО */}
            <g onClick={() => onSelect && onSelect('ufo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 500 344 C 540 350, 580 350, 620 346 C 610 366, 566 374, 536 368 C 516 364, 500 356, 500 344 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={560} y={352} value={numbers.ufo}/>
              <text x="560" y="340" textAnchor="middle" fontSize="12" fill={UI.title}>УФО</text>
            </g>

            {/* СФО */}
            <g onClick={() => onSelect && onSelect('sfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 630 346 C 680 340, 730 336, 780 338 C 770 360, 710 370, 664 366 C 644 364, 632 356, 630 346 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={712} y={354} value={numbers.sfo}/>
              <text x="712" y="342" textAnchor="middle" fontSize="12" fill={UI.title}>СФО</text>
            </g>

            {/* ДФО */}
            <g onClick={() => onSelect && onSelect('dfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 800 338 C 860 350, 910 368, 952 388 C 920 410, 874 412, 840 398 C 822 390, 806 366, 800 338 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={884} y={372} value={numbers.dfo}/>
              <text x="884" y="360" textAnchor="middle" fontSize="12" fill={UI.title}>ДФО</text>
            </g>

            {/* ЮФО */}
            <g onClick={() => onSelect && onSelect('yfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 250 352 C 286 366, 314 374, 336 380 C 310 392, 276 392, 260 382 C 248 374, 244 364, 250 352 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={300} y={376} value={numbers.yfo}/>
              <text x="300" y="364" textAnchor="middle" fontSize="12" fill={UI.title}>ЮФО</text>
            </g>

            {/* СКФО */}
            <g onClick={() => onSelect && onSelect('nfo')}
               onMouseEnter={onEnter} onMouseLeave={onLeave}
               style={{ cursor:'pointer' }}>
              <path d="M 332 384 C 350 392, 366 398, 380 402 C 360 410, 336 410, 326 402 C 320 396, 320 390, 332 384 Z"
                    fill="transparent" stroke="transparent"/>
              <CountBadge x={356} y={404} value={numbers.nfo}/>
              <text x="356" y="392" textAnchor="middle" fontSize="11" fill={UI.title}>СКФО</text>
            </g>
          </g>
        </svg>
      </div>

      {/* легенда */}
      <div style={{
        marginTop:12, display:'flex', gap:10, alignItems:'center',
        color: UI.text, fontSize:13, flexWrap:'wrap'
      }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
          <span style={{
            display:'inline-block', width:12, height:12, borderRadius:4,
            background:'rgba(34,197,94,0.10)',
            border:'1px solid rgba(34,197,94,0.35)'
          }}/>
          Количество объявлений
        </span>
        <span>•</span>
        <span>Клик = перейти к лотам по округу</span>
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
       <RussiaSvgFO onSelect={(code) => router.push(`/trades?region=${encodeURIComponent(code)}`)} />
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
