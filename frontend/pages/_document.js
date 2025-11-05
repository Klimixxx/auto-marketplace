import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="ru">
        <Head>
          {/* Preview Bridge: даёт портфолио управлять автоскроллом этого сайта в iframe */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
(function () {
  const ALLOWED_ORIGINS = new Set(["https://studio-landing-sable.vercel.app"]);
  function ok(evt){ try { return ALLOWED_ORIGINS.has(evt.origin); } catch { return false; } }
  function ready(t,o){ try{ t.postMessage({type:"PREVIEW_READY"}, o);}catch{} }
  function pos(t,o){ try{ t.postMessage({type:"PREVIEW_SCROLL_POS", y:window.scrollY, vh:window.innerHeight, h:Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)}, o);}catch{} }
  let raf=null;
  function start(speed){
    stop();
    const s=Math.max(Number(speed)||60,10); // px/s
    let last=performance.now();
    function step(now){
      const dt=(now-last)/1000;
      last=now;
      const maxY=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight;
      const next=Math.min(maxY, window.scrollY + s*dt);
      window.scrollTo({top:next,behavior:"instant"});
      if(next>=maxY){ window.scrollTo({top:0,behavior:"instant"}); }
      raf=requestAnimationFrame(step);
    }
    raf=requestAnimationFrame(step);
  }
  function stop(){ if(raf) cancelAnimationFrame(raf); raf=null; }

  window.addEventListener("message", (e)=>{
    if(!ok(e)) return;
    const d=e.data||{};
    if(d.type==="PREVIEW_PING"){ ready(e.source, e.origin); pos(e.source, e.origin); return; }
    if(d.type==="PREVIEW_SCROLL_TO"){ const y=Math.max(0,Number(d.y)||0); window.scrollTo({top:y,behavior:"instant"}); return; }
    if(d.type==="PREVIEW_SCROLL_GET"){ pos(e.source, e.origin); return; }
    if(d.type==="PREVIEW_AUTOSCROLL_START"){ start(d.speed); return; }
    if(d.type==="PREVIEW_AUTOSCROLL_STOP"){ stop(); return; }
  });

  if(document.readyState==="complete"){
    ALLOWED_ORIGINS.forEach(o=>{ try{ window.parent.postMessage({type:"PREVIEW_READY"}, o);}catch{} });
  } else {
    window.addEventListener("load", ()=>{
      ALLOWED_ORIGINS.forEach(o=>{ try{ window.parent.postMessage({type:"PREVIEW_READY"}, o);}catch{} });
    });
  }
})();
              `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
