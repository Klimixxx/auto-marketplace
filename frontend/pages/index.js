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

// === PNG-карта + SVG-оверлей: Рисование границ мышкой (brush) ===
function RussiaDrawOverlay({ onSelect, data = {} }) {
  const W = 1120, H = 639;

  // Когда всё настроишь — поставь false (и панель редактора исчезнет)
  const EDITOR_ENABLED = true;

  // Начальные регионы можешь оставить пустым массивом — будешь рисовать с нуля
  const [regions, setRegions] = useState([
    // Пример стартового (можно удалить в редакторе):
    { code: 'cfo', title: 'Центральный ФО', points: [], label: [560, 300], value: data.cfo ?? '—' },
  ]);

  // Выбор региона, ховер, рисование
  const [selected, setSelected] = useState(0);     // индекс выбранного региона
  const [hover, setHover] = useState(null);        // {code,title,x,y}
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);  // временная линия кисти
  const [lastPush, setLastPush] = useState(null);    // для порога записи точек
  const svgRef = useRef(null);

  const num = (k) => regions.find(r => r.code === k)?.value ?? '—';

  // ——— утилиты координат ———
  function mouseToSvg(evt) {
    const svg = svgRef.current; if (!svg) return {x:0,y:0};
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const inv = svg.getScreenCTM().inverse(); const {x,y} = pt.matrixTransform(inv);
    return { x: Math.max(0, Math.min(W, x)), y: Math.max(0, Math.min(H, y)) };
  }
  function dist(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]); }

  // ——— упрощение полилинии (RDP) ———
  function simplifyRDP(points, epsilon = 2.5){
    if (points.length < 3) return points;
    const lineDist = (p, a, b) => {
      const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
      const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
      const dot = A*C + B*D, lenSq = C*C + D*D;
      let t = lenSq ? dot / lenSq : 0; t = Math.max(0, Math.min(1, t));
      const xx = x1 + t*C, yy = y1 + t*D;
      return Math.hypot(x - xx, y - yy);
    };
    const rdp = (pts, first, last, eps, out) => {
      let idx = -1, maxD = 0;
      for (let i = first + 1; i < last; i++){
        const d = lineDist(pts[i], pts[first], pts[last]);
        if (d > maxD){ idx = i; maxD = d; }
      }
      if (maxD > eps && idx !== -1){
        rdp(pts, first, idx, eps, out);
        rdp(pts, idx, last, eps, out);
      } else {
        out.push(pts[first]);
        out.push(pts[last]);
      }
    };
    const out = [];
    rdp(points, 0, points.length - 1, epsilon, out);
    // rdp дублирует точки на стыках — уберём повторы
    const result = [out[0]];
    for (let i = 1; i < out.length; i++){
      const prev = result[result.length - 1];
      if (prev[0] !== out[i][0] || prev[1] !== out[i][1]) result.push(out[i]);
    }
    return result;
  }

  // ——— рисование кистью ———
  function startDraw(e){
    if (!EDITOR_ENABLED) return;
    if (selected == null) return;
    const p = mouseToSvg(e);
    setIsDrawing(true);
    setDrawPoints([[Math.round(p.x), Math.round(p.y)]]);
    setLastPush([p.x, p.y]);
  }
  function moveDraw(e){
    const p = mouseToSvg(e);
    setHover(h => h ? { ...h, x:p.x, y:p.y } : h);
    if (!isDrawing) return;

    // записываем точку, если мышь реально прошла расстояние (чтобы линия была аккуратной)
    const last = lastPush || [p.x, p.y];
    const threshold = 4.5; // px — регулируй плавность
    if (Math.hypot(p.x - last[0], p.y - last[1]) >= threshold){
      setDrawPoints(prev => [...prev, [Math.round(p.x), Math.round(p.y)]]);
      setLastPush([p.x, p.y]);
    }
  }
  function endDraw(){
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPush(null);
    setRegions(prev => {
      const copy = prev.map(r => ({...r, points: r.points.map(p=>[...p]), label: r.label ? [...r.label] : undefined}));
      const pts = drawPoints;
      if (pts.length >= 3){
        // чуть упростим, чтобы линия стала «ровнее»
        const simplified = simplifyRDP(pts, 2.2);
        // закрыть полигон (соединить конец с началом, если не совпадает)
        const first = simplified[0], last = simplified[simplified.length - 1];
        const closed = dist(first, last) > 2 ? [...simplified, [...first]] : simplified;
        copy[selected].points = closed;
        // если нет бейджа — поставим в центр масс
        if (!copy[selected].label){
          const c = centroid(closed);
          copy[selected].label = [Math.round(c[0]), Math.round(c[1])];
        }
      }
      return copy;
    });
    setDrawPoints([]);
  }

  function centroid(pts){
    let x = 0, y = 0, n = pts.length;
    for (let i = 0; i < n; i++){ x += pts[i][0]; y += pts[i][1]; }
    return [x / n, y / n];
  }

  // ——— действия редактора ———
  function addRegion(){
    setRegions(prev => [
      ...prev,
      {
        code: `r${prev.length + 1}`,
        title: `Регион ${prev.length + 1}`,
        points: [],
        label: [W/2, H/2],
        value: '—',
      }
    ]);
    setSelected(regions.length);
  }
  function addBadgeToSelected(){
    setRegions(prev => {
      const copy = prev.map(r => ({...r}));
      const r = copy[selected];
      if (!r) return copy;
      const c = r.points.length ? centroid(r.points) : r.label || [W/2, H/2];
      r.label = [Math.round(c[0]), Math.round(c[1])];
      return copy;
    });
  }
  function dumpToConsole(){
    const payload = regions.map(({code,title,points,label,value}) => ({code,title,points,label,value}));
    // eslint-disable-next-line no-console
    console.log('%c=== MAP JSON (regions) ===','color:#22C55E;font-weight:bold');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload, null, 2));
    alert('JSON выведен в консоль. Скопируй и вставь в код/БД. После этого поставь EDITOR_ENABLED=false');
  }

  // ——— перетаскивание бейджа мышью ———
  const [dragBadgeIdx, setDragBadgeIdx] = useState(null);
  function onMouseMoveSvg(e){
    moveDraw(e);
    if (dragBadgeIdx != null){
      const p = mouseToSvg(e);
      setRegions(prev => {
        const copy = prev.map(r => ({...r}));
        copy[dragBadgeIdx].label = [Math.round(p.x), Math.round(p.y)];
        return copy;
      });
    }
  }
  function onMouseUpSvg(){
    endDraw();
    setDragBadgeIdx(null);
  }

  return (
    <div style={{ background: UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <h2 style={{ margin:'0 0 6px', color: UI.title }}>География объявлений</h2>
          <p style={{ margin:0, color: UI.text }}>
            {EDITOR_ENABLED
              ? 'Режим редактора: жми «+Граница», веди мышью по контуру региона. Двойной клик не нужен.'
              : 'Наведи — подсветка; клик — переход к торгам по региону.'}
          </p>
        </div>

        {EDITOR_ENABLED && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={addRegion}
              style={{ background: UI.btnBg, color: UI.btnText, border:`1px solid ${UI.inputBorder}`, borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer' }}
              onMouseEnter={(e)=>e.currentTarget.style.background=UI.btnHover}
              onMouseLeave={(e)=>e.currentTarget.style.background=UI.btnBg}
            >+ Регион</button>

            <button
              onMouseDown={(e)=>{ e.preventDefault(); /* просто чтобы кнопка не снимала фокус */ }}
              onClick={()=>setIsDrawing(s => !s)}
              style={{ background: isDrawing ? UI.accent : UI.btnBg, color: isDrawing ? '#0B1220' : UI.btnText,
                       border:`1px solid ${UI.inputBorder}`, borderRadius:10, padding:'8px 12px', fontWeight:700, cursor:'pointer' }}
            >
              {isDrawing ? 'Идёт рисование…' : '+ Граница'}
            </button>

            <button onClick={addBadgeToSelected}
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
          onMouseMove={onMouseMoveSvg}
          onMouseUp={onMouseUpSvg}
          onMouseLeave={onMouseUpSvg}
          onMouseDown={(e)=>{ if (isDrawing) startDraw(e); }}
        >
          {regions.map((r, i) => {
            const isSel = i === selected;
            const hasPoly = r.points && r.points.length >= 3;
            const d = hasPoly ? r.points.map(p => p.join(',')).join(' ') : '';
            const isHover = hover?.code === r.code;

            return (
              <g key={r.code}>
                {/* Полигон региона */}
                {hasPoly && (
                  <polygon
                    points={d}
                    fill={isHover ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.02)'}
                    stroke={isHover ? UI.accent : 'rgba(255,255,255,0.18)'}
                    strokeWidth={isHover ? 2 : 1}
                    style={{ transition:'all .15s ease', cursor: EDITOR_ENABLED ? 'crosshair' : 'pointer', pointerEvents:'auto' }}
                    onMouseEnter={() => setHover({ code:r.code, title:r.title, x:0, y:0 })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => { if (!EDITOR_ENABLED && onSelect) onSelect(r.code); if (EDITOR_ENABLED) setSelected(i); }}
                  />
                )}

                {/* «живой» контур при рисовании по выбранному региону */}
                {isDrawing && isSel && drawPoints.length > 1 && (
                  <polyline
                    points={drawPoints.map(p => p.join(',')).join(' ')}
                    fill="none" stroke={UI.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    pointerEvents="none"
                  />
                )}

                {/* Бейдж + название (если есть label) */}
                {r.label && (
                  <g transform={`translate(${r.label[0]-22}, ${r.label[1]-36})`}>
                    <rect width="44" height="24" rx="8" ry="8"
                          fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.35)"/>
                    <text x="22" y="16" textAnchor="middle" fontSize="13" fontWeight="700" fill={UI.accent}>
                      {r.value ?? '—'}
                    </text>
                    <text x="22" y="36" textAnchor="middle" fontSize="11" fill={UI.title} style={{opacity:.9}}>
                      {r.title}
                    </text>

                    {/* захват для перетаскивания бейджа (только в редакторе) */}
                    {EDITOR_ENABLED && (
                      <rect x="12" y="-10" width="20" height="20" rx="4" ry="4"
                            fill="rgba(255,255,255,0.9)" stroke="#22C55E" strokeWidth="1.2"
                            style={{ cursor:'grab' }}
                            onMouseDown={(e)=>{ e.preventDefault(); setDragBadgeIdx(i); setSelected(i); }}
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* тултип (только в прод-режиме) */}
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

      {/* Правая панель настройки выбранного региона (видна только в редакторе) */}
      {EDITOR_ENABLED && regions[selected] && (
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 320px', gap:12 }}>
          <div style={{ color: UI.text, fontSize:13 }}>
            <div>Как рисовать: нажми «+ Граница» → зажми ЛКМ в начале очертания → веди мышью вдоль границы → отпусти ЛКМ.</div>
            <div style={{ opacity:.85, marginTop:6 }}>Совет: рисуй контур непрерывно; если ошибся — снова нажми «+ Граница» и перерисуй регион — старый контур заменится.</div>
          </div>

          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:12 }}>
            <div style={{ color:UI.title, fontWeight:700, marginBottom:8 }}>Выбранный регион</div>

            <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:6 }}>Выбрать</label>
            <select
              value={selected}
              onChange={(e)=>setSelected(Number(e.target.value))}
              style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8, marginBottom:10 }}
            >
              {regions.map((r,i)=>(<option key={r.code || i} value={i}>{i+1}. {r.title || r.code}</option>))}
            </select>

            <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:6 }}>Код (url-параметр)</label>
            <input
              value={regions[selected].code}
              onChange={(e)=>setRegions(prev=>{ const c=[...prev]; c[selected]={...c[selected], code:e.target.value.trim()||'region'}; return c; })}
              style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8 }}
            />

            <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:10 }}>Название</label>
            <input
              value={regions[selected].title}
              onChange={(e)=>setRegions(prev=>{ const c=[...prev]; c[selected]={...c[selected], title:e.target.value}; return c; })}
              style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8 }}
            />

            <label style={{ display:'block', fontSize:12, opacity:.9, marginTop:10 }}>Количество объявлений</label>
            <input
              value={regions[selected].value}
              onChange={(e)=>setRegions(prev=>{ const c=[...prev]; c[selected]={...c[selected], value:e.target.value}; return c; })}
              style={{ width:'100%', background:UI.inputBg, color:UI.inputText, border:`1px solid ${UI.inputBorder}`, borderRadius:8, padding:8, marginBottom:10 }}
            />

            <button
              onClick={()=>{
                setRegions(prev=>prev.filter((_,i)=>i!==selected));
                setSelected(0);
              }}
              style={{ background:'transparent', color:'#ff8b8b', border:'1px solid rgba(255,0,0,0.35)', borderRadius:10, padding:'8px 12px', fontWeight:700, width:'100%' }}
            >
              Удалить регион
            </button>

            <button
              onClick={()=>{
                setRegions(prev=>{
                  const c = [...prev];
                  if (c[selected]) c[selected] = { ...c[selected], points: [] };
                  return c;
                });
              }}
              style={{ marginTop:8, background:'transparent', color:'#ffcf8b', border:'1px solid rgba(255,187,0,0.35)', borderRadius:10, padding:'8px 12px', fontWeight:700, width:'100%' }}
            >
              Очистить границу
            </button>
          </div>
        </div>
      )}

      {!EDITOR_ENABLED && (
        <div style={{ marginTop:10, color: UI.text, fontSize:13 }}>
          Чтобы снова включить редактор — временно поставь EDITOR_ENABLED=true в компоненте.
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
