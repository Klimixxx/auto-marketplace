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

  // === PNG-карта России + SVG-оверлей по федеральным округам ===
function RussiaImageFOOverlay({ onSelect, data = {} }) {
  // Размер исходного PNG (важно для корректного перекрытия)
  const W = 1120; // ширина исходника
  const H = 639;  // высота исходника

  // Заглушки чисел (подставятся из data)
  const num = (k) => (data[k] ?? '—');

  // Зоны — полигоны по ФО (координаты в пикселях под viewBox 1120×639).
  // Эти полигоны уже «лежать» поверх областей на твоей картинке (приближённо).
  // Хочешь точнее — просто подвинь вершины (x,y) нужного полигона.
  const regions = [
    {
      code: 'nwfo',
      title: 'Северо-Западный ФО',
      points: [
        [80,280],[200,240],[280,260],[290,300],[250,330],[190,335],[140,320]
      ],
      label:[210,300],
    },
    {
      code: 'cfo',
      title: 'Центральный ФО',
      points: [
        [250,315],[330,305],[380,315],[370,345],[320,360],[275,348]
      ],
      label:[325,338],
    },
    {
      code: 'mo',
      title: 'Московская область',
      points: [
        [350,327],[365,327],[375,337],[368,350],[352,350],[344,338]
      ],
      label:[360,345],
    },
    {
      code: 'pfo',
      title: 'Приволжский ФО',
      points: [
        [370,320],[460,318],[510,322],[500,350],[430,360],[380,352]
      ],
      label:[440,342],
    },
    {
      code: 'ufo',
      title: 'Уральский ФО',
      points: [
        [508,320],[600,318],[640,320],[630,346],[560,354],[515,346]
      ],
      label:[565,340],
    },
    {
      code: 'sfo',
      title: 'Сибирский ФО',
      points: [
        [640,320],[760,318],[825,324],[812,350],[720,362],[658,352]
      ],
      label:[720,344],
    },
    {
      code: 'dfo',
      title: 'Дальневосточный ФО',
      points: [
        [820,322],[900,340],[980,376],[950,402],[880,392],[840,360]
      ],
      label:[900,368],
    },
    {
      code: 'yfo',
      title: 'Южный ФО',
      points: [
        [265,360],[320,374],[350,384],[322,400],[278,394],[258,378]
      ],
      label:[310,388],
    },
    {
      code: 'nfo',
      title: 'Северо-Кавказский ФО',
      points: [
        [340,388],[376,398],[392,404],[372,416],[340,414],[330,400]
      ],
      label:[364,408],
    },
  ];

  // Тултип
  const [hover, setHover] = useState(null); // {x,y, code,title}
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover((h) => h ? { ...h, x: e.clientX - rect.left, y: e.clientY - rect.top } : h);
  };

  return (
    <div
      style={{
        background: UI.cardBg,
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ margin:'0 0 10px', color: UI.title }}>География объявлений (демо)</h2>
      <p style={{ margin:'0 0 14px', color: UI.text }}>
        Наведи на округ — подсветится и покажет подсказку. Клик — перейти к торгам по округу. Пока вместо цифр — «—».
      </p>

      {/* Контейнер с картой и SVG-оверлеем */}
      <div style={{ position:'relative', width:'100%' }}>
        {/* PNG — фоном (резиново) */}
        <img
          src="/russia-map.png"
          alt="Карта России"
          style={{ width:'100%', height:'auto', display:'block', borderRadius:8 }}
        />

        {/* SVG-слой поверх, во всю ширину контейнера */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%', zIndex:1
          }}
          onMouseMove={onMove}
        >
          {regions.map((r) => {
            const d = r.points.map(p => p.join(',')).join(' ');
            const isHover = hover?.code === r.code;
            return (
              <g key={r.code}>
                {/* активная зона – отдельный, кликабельный путь */}
                <polygon
                  points={d}
                  fill={isHover ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.01)'}
                  stroke={isHover ? UI.accent : 'rgba(255,255,255,0.18)'}
                  strokeWidth={isHover ? 2 : 1}
                  style={{ transition:'all .15s ease', cursor:'pointer', pointerEvents:'auto' }}
                  onMouseEnter={(e) =>
                    setHover({
                      code: r.code,
                      title: r.title,
                      x: 0, y: 0
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect && onSelect(r.code)}
                />
                {/* бейдж со значением */}
                <g transform={`translate(${r.label[0]-22}, ${r.label[1]-14})`} pointerEvents="none">
                  <rect width="44" height="24" rx="8" ry="8"
                        fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.35)"/>
                  <text x="22" y="16" textAnchor="middle"
                        fontSize="13" fontWeight="700" fill={UI.accent}>
                    {num(r.code)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* тултип */}
          {hover && (
            <g transform={`translate(${hover.x + 12}, ${hover.y + 12})`} pointerEvents="none">
              <rect x="0" y="0" width="220" height="54" rx="10" ry="10"
                    fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.15)"/>
              <text x="12" y="22" fontSize="13" fill={UI.title}>{hover.title}</text>
              <text x="12" y="40" fontSize="14" fontWeight="700" fill={UI.accent}>
                Объявлений: {num(hover.code)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Легенда */}
      <div style={{ marginTop:12, color: UI.text, fontSize:13 }}>
        Подсветка — приближённые области по федеральным округам. При необходимости легко «подогнать» точки.
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


           {/* Карта регионов (PNG + overlay) */}
<section style={{ margin: '26px 0' }}>
  <RussiaImageFOOverlay
    onSelect={(code) => router.push(`/trades?region=${encodeURIComponent(code)}`)}
    // когда появятся реальные данные, просто передай объект:
    // data={{ nwfo: 12, cfo: 31, mo: 7, pfo: 18, ufo: 9, sfo: 22, dfo: 4, yfo: 8, nfo: 5 }}
  />
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
