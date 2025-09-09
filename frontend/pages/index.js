import { useState, useEffect, useRef } from 'react';
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

 // === PNG-карта + SVG-оверлей: расширенный редактор ===
function RussiaImageFOOverlay({ onSelect, data = {} }) {
  const W = 1120, H = 639;

  // Вкл/выкл редактора одной переменной (потом просто поставишь false)
  const EDITOR_ENABLED = true; // ← когда всё выровняешь — поменяй на false

  // Начальные зоны (как у тебя были)
  const initialRegions = [
    { code: 'nwfo', title: 'Северо-Западный ФО',
      points: [[80,280],[200,240],[280,260],[290,300],[250,330],[190,335],[140,320]],
      label: [210,300], value: data.nwfo ?? '—',
    },
    { code: 'cfo', title: 'Центральный ФО',
      points: [[250,315],[330,305],[380,315],[370,345],[320,360],[275,348]],
      label: [325,338], value: data.cfo ?? '—',
    },
    { code: 'mo', title: 'Московская область',
      points: [[350,327],[365,327],[375,337],[368,350],[352,350],[344,338]],
      label: [360,345], value: data.mo ?? '—',
    },
    { code: 'pfo', title: 'Приволжский ФО',
      points: [[370,320],[460,318],[510,322],[500,350],[430,360],[380,352]],
      label: [440,342], value: data.pfo ?? '—',
    },
    { code: 'ufo', title: 'Уральский ФО',
      points: [[508,320],[600,318],[640,320],[630,346],[560,354],[515,346]],
      label: [565,340], value: data.ufo ?? '—',
    },
    { code: 'sfo', title: 'Сибирский ФО',
      points: [[640,320],[760,318],[825,324],[812,350],[720,362],[658,352]],
      label: [720,344], value: data.sfo ?? '—',
    },
    { code: 'dfo', title: 'Дальневосточный ФО',
      points: [[820,322],[900,340],[980,376],[950,402],[880,392],[840,360]],
      label: [900,368], value: data.dfo ?? '—',
    },
    { code: 'yfo', title: 'Южный ФО',
      points: [[265,360],[320,374],[350,384],[322,400],[278,394],[258,378]],
      label: [310,388], value: data.yfo ?? '—',
    },
    { code: 'nfo', title: 'Северо-Кавказский ФО',
      points: [[340,388],[376,398],[392,404],[372,416],[340,414],[330,400]],
      label: [364,408], value: data.nfo ?? '—',
    },
  ];

  const [regions, setRegions] = useState(initialRegions);
  const [hover, setHover] = useState(null);           // {code,title,x,y}
  const [selected, setSelected] = useState(0);        // индекс выбранного региона в редакторе
  const [drag, setDrag] = useState(null);             // {type:'vertex'|'label', rIdx, pIdx}
  const [selectedVertex, setSelectedVertex] = useState(null); // {rIdx,pIdx}
  const svgRef = useRef(null);

  // утилиты
  const num = (k) => regions.find(r=>r.code===k)?.value ?? '—';

  function mouseToSvg(evt) {
    const svg = svgRef.current; if (!svg) return {x:0,y:0};
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const inv = svg.getScreenCTM().inverse(); const {x,y} = pt.matrixTransform(inv);
    return { x: Math.max(0, Math.min(W, x)), y: Math.max(0, Math.min(H, y)) };
  }

  function polygonInsertPoint(rIdx, pos) {
    setRegions(prev => {
      const copy = prev.map(r => ({...r, points: r.points.map(p=>[...p])}));
      const pts = copy[rIdx].points;
      if (pts.length < 2) { pts.push([Math.round(pos.x), Math.round(pos.y)]); return copy; }
      // Вставляем в ближайший клик-отрезок
      let bestI = 0, bestDist = Infinity;
      for (let i=0;i<pts.length;i++){
        const a = pts[i], b = pts[(i+1)%pts.length];
        const d = distPointToSegment(pos, {x:a[0],y:a[1]}, {x:b[0],y:b[1]});
        if (d<bestDist){bestDist=d; bestI=i;}
      }
      pts.splice(bestI+1, 0, [Math.round(pos.x), Math.round(pos.y)]);
      return copy;
    });
  }

  function polygonRemovePoint(rIdx, pIdx) {
    setRegions(prev => {
      const copy = prev.map(r => ({...r, points: r.points.map(p=>[...p])}));
      const pts = copy[rIdx].points;
      if (pts.length > 3) { pts.splice(pIdx,1); }
      return copy;
    });
    setSelectedVertex(null);
  }

  // расстояние от точки до отрезка
  function distPointToSegment(p, a, b){
    const A = {x:a.x, y:a.y}, B = {x:b.x, y:b.y};
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = p.x - A.x, APy = p.y - A.y;
    const ab2 = ABx*ABx + ABy*ABy;
    const t = Math.max(0, Math.min(1, (APx*ABx + APy*ABy) / (ab2||1)));
    const cx = A.x + t*ABx, cy = A.y + t*ABy;
    const dx = p.x - cx, dy = p.y - cy;
    return Math.hypot(dx, dy);
  }

  function onSvgMouseMove(e){
    const pos = mouseToSvg(e);
    setHover(h => h ? {...h, x:pos.x, y:pos.y} : h);
    if (drag){
      setRegions(prev => {
        const copy = prev.map(r => ({...r, points: r.points.map(p=>[...p]), label:[...r.label]}));
        const r = copy[drag.rIdx];
        if (drag.type === 'vertex') { r.points[drag.pIdx] = [Math.round(pos.x), Math.round(pos.y)]; }
        else { r.label = [Math.round(pos.x), Math.round(pos.y)]; }
        return copy;
      });
    }
  }
  function onSvgMouseUp(){ setDrag(null); }

  // Добавить новый регион (пустышку в центре)
  function addRegion(){
    const idx = regions.length + 1;
    const newR = {
      code: `r${idx}`,
      title: `Регион ${idx}`,
      points: [[W/2-40,H/2-20],[W/2+40,H/2-20],[W/2+40,H/2+20],[W/2-40,H/2+20]],
      label: [W/2, H/2],
      value: '—',
    };
    setRegions(prev => [...prev, newR]);
    setSelected(regions.length);
  }

  // Добавить подпись/бейдж для выбранного (ставим в центр полигона)
  function addLabelToSelected(){
    const i = selected ?? 0;
    setRegions(prev => {
      const copy = prev.map(r => ({...r, points: r.points.map(p=>[...p]), label:[...r.label]}));
      const r = copy[i];
      const c = centroid(r.points);
      r.label = [Math.round(c[0]), Math.round(c[1])];
      return copy;
    });
  }
  function centroid(pts){
    // простой центр масс
    let x=0,y=0; pts.forEach(p=>{x+=p[0]; y+=p[1];}); return [x/pts.length,y/pts.length];
  }

  // Экспорт
  function dumpToConsole(){
    const payload = regions.map(({code,title,points,label,value}) => ({code,title,points,label,value}));
    console.log('%c=== MAP JSON ===','color:#22C55E;font-weight:bold');
    console.log(JSON.stringify(payload,null,2));
    alert('JSON выведен в консоль. Скопируй и вставь в код/БД.');
  }

  // Рендер бейджа + подписи
  const Badge = ({r}) => (
    <g transform={`translate(${r.label[0]-22}, ${r.label[1]-36})`} pointerEvents="none">
      <rect width="44" height="24" rx="8" ry="8"
            fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.35)"/>
      <text x="22" y="16" textAnchor="middle" fontSize="13" fontWeight="700" fill={UI.accent}>
        {r.value ?? '—'}
      </text>
      {/* название под плашкой */}
      <text x="22" y="36" textAnchor="middle" fontSize="11" fill={UI.title} style={{opacity:.9}}>
        {r.title}
      </text>
    </g>
  );

  return (
    <div style={{ background: UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:16 }}>
      {/* Хедер */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <h2 style={{ margin:'0 0 6px', color: UI.title }}>География объявлений</h2>
          <p style={{ margin:0, color: UI.text }}>
            Наведи — подсветка; клик (вне редактора) — перейти к торгам по региону.
          </p>
        </div>

        {/* Панель редактора (прячется, когда EDITOR_ENABLED=false) */}
        {EDITOR_ENABLED && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={addRegion}
              style={{ background: UI.btnBg, color: UI.btnText, border:`1px solid ${UI.inputBorder}`, borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer' }}
              onMouseEnter={(e)=>e.currentTarget.style.background=UI.btnHover}
              onMouseLeave={(e)=>e.currentTarget.style.background=UI.btnBg}
            >+ Регион</button>

            <button onClick={addLabelToSelected}
              style={{ background: UI.btnBg, color: UI.btnText, border:`1px solid ${UI.inputBorder}`, borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer' }}
              onMouseEnter={(e)=>e.currentTarget.style.background=UI.btnHover}
              onMouseLeave={(e)=>e.currentTarget.style.background=UI.btnBg}
            >+ Бейдж</button>

            <button onClick={dumpToConsole}
              style={{ background: UI.btnBg, color: UI.btnText, border:`1px solid ${UI.inputBorder}`, borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer' }}
              onMouseEnter={(e)=>e.currentTarget.style.background=UI.btnHover}
              onMouseLeave={(e)=>e.currentTarget.style.background=UI.btnBg}
            >Экспорт JSON</button>
          </div>
        )}
      </div>

      {/* Карта */}
      <div style={{ position:'relative', width:'100%', marginTop:12 }}>
        <img src="/russia-map.png" alt="Карта России"
             style={{ width:'100%', height:'auto', display:'block', borderRadius:8, zIndex:0 }}/>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:1 }}
          onMouseMove={onSvgMouseMove} onMouseUp={onSvgMouseUp}
        >
          {regions.map((r, rIdx) => {
            const d = r.points.map(p => p.join(',')).join(' ');
            const isHover = hover?.code === r.code;
            return (
              <g key={r.code}>
                <polygon
                  points={d}
                  fill={isHover ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.01)'}
                  stroke={isHover ? UI.accent : 'rgba(255,255,255,0.18)'}
                  strokeWidth={isHover ? 2 : 1}
                  style={{ transition:'all .15s ease', cursor: EDITOR_ENABLED ? 'crosshair' : 'pointer', pointerEvents:'auto' }}
                  onMouseEnter={() => setHover({ code:r.code, title:r.title, x:0, y:0 })}
                  onMouseLeave={() => setHover(null)}
                  onDoubleClick={(e) => { // ДВОЙНОЙ КЛИК по полигону → ДОБАВИТЬ ТОЧКУ
                    if (!EDITOR_ENABLED) return;
                    const pos = mouseToSvg(e);
                    polygonInsertPoint(rIdx, pos);
                    setSelected(rIdx);
                  }}
                  onClick={() => { // обычный клик вне редактора — перейти
                    if (!EDITOR_ENABLED && onSelect) onSelect(r.code);
                    if (EDITOR_ENABLED) setSelected(rIdx);
                  }}
                />

                {/* Бейдж + подпись */}
                <Badge r={r} />

                {/* Редактор: вершины и перетаскивание бейджа */}
                {EDITOR_ENABLED && (
                  <>
                    {/* Вершины */}
                    {r.points.map(([x,y], pIdx) => {
                      const selectedThis = selectedVertex && selectedVertex.rIdx===rIdx && selectedVertex.pIdx===pIdx;
                      return (
                        <circle key={pIdx} cx={x} cy={y} r={selectedThis?7:6}
                                fill={selectedThis? '#16A34A' : '#22C55E'} stroke="white" strokeWidth="1.6"
                                style={{ cursor:'grab' }}
                                onMouseDown={(e)=>{ e.preventDefault(); setDrag({type:'vertex', rIdx, pIdx}); setSelected(rIdx); setSelectedVertex({rIdx,pIdx}); }}
                                onContextMenu={(e)=>{ // ПКМ по точке → удалить
                                  e.preventDefault(); polygonRemovePoint(rIdx, pIdx);
                                }}
                        />
                      );
                    })}
                    {/* Перетаскивание бейджа */}
                    <rect x={r.label[0]-10} y={r.label[1]-10} width="20" height="20" rx="4" ry="4"
                          fill="rgba(255,255,255,0.8)" stroke="#22C55E" strokeWidth="1.2"
                          style={{ cursor:'grab' }}
                          onMouseDown={(e)=>{ e.preventDefault(); setDrag({type:'label', rIdx}); setSelected(rIdx); }}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* тултип (только когда редактор выключен) */}
          {hover && !EDITOR_ENABLED && (
            <g transform={`translate(${hover.x + 12}, ${hover.y + 12})`} pointerEvents="none">
              <rect x="0" y="0" width="240" height="58" rx="10" ry="10"
                    fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.15)"/>
              <text x="12" y="22" fontSize="13" fill={UI.title}>{hover.title}</text>
              <text x="12" y="40" fontSize="14" fontWeight="700" fill={UI.accent}>
                Объявлений: {num(hover.code)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Правая панель редактирования выбранного региона */}
      {EDITOR_ENABLED && (
        <div style={{
          marginTop:12, display:'grid', gridTemplateColumns:'1fr 320px', gap:12, alignItems:'start'
        }}>
          <div style={{ color: UI.text, fontSize:13 }}>
            <div>Подсказки: двойной клик по области — добавить точку на ближайший отрезок; ПКМ по точке — удалить; тянуть точки/белый квадратик — перетаскивать.</div>
          </div>

          <div style={{
            background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:12, padding:12
          }}>
            <div style={{ color:UI.title, fontWeight:700, marginBottom:8 }}>Выбранный регион</div>
            <select
              value={selected}
              onChange={(e)=>setSelected(Number(e.target.value))}
              style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8, marginBottom:10 }}
            >
              {regions.map((r,i)=>(<option key={r.code} value={i}>{i+1}. {r.title}</option>))}
            </select>

            {regions[selected] && (
              <>
                <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:6 }}>Код (url-параметр)</label>
                <input
                  value={regions[selected].code}
                  onChange={(e)=>setRegions(prev=>{
                    const copy=[...prev]; copy[selected]={...copy[selected], code:e.target.value.trim()||'region'};
                    return copy;
                  })}
                  style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8 }}
                />

                <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:10 }}>Название</label>
                <input
                  value={regions[selected].title}
                  onChange={(e)=>setRegions(prev=>{
                    const copy=[...prev]; copy[selected]={...copy[selected], title:e.target.value};
                    return copy;
                  })}
                  style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8 }}
                />

                <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:10 }}>Количество объявлений</label>
                <input
                  value={regions[selected].value}
                  onChange={(e)=>setRegions(prev=>{
                    const copy=[...prev]; copy[selected]={...copy[selected], value:e.target.value};
                    return copy;
                  })}
                  style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8, marginBottom:10 }}
                />

                <button
                  onClick={()=>{
                    setRegions(prev=>prev.filter((_,i)=>i!==selected));
                    setSelected(0); setSelectedVertex(null);
                  }}
                  style={{ background:'transparent', color:'#ff8b8b', border:'1px solid rgba(255,0,0,0.35)', borderRadius:10, padding:'8px 12px', fontWeight:700, width:'100%' }}
                >
                  Удалить регион
                </button>
              </>
            )}
          </div>
        </div>
      )}
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
