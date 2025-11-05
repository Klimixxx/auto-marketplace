<script
  dangerouslySetInnerHTML={{
    __html: `
(function () {
  var PORTFOLIO = "https://studio-landing-sable.vercel.app";

  var raf = null, auto = false, speed = 30, last = 0;

  function step(now){
    if(!auto) return;
    if(!last) last = now;
    var dt = (now - last) / 1000;
    last = now;

    var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var maxY = Math.max(0, docH - window.innerHeight);
    var next = Math.min(maxY, window.scrollY + speed * dt);

    window.scrollTo({ top: next, behavior: "instant" });
    if (next >= maxY - 1) {
      window.scrollTo({ top: 0, behavior: "instant" });
      last = now;
    }
    raf = requestAnimationFrame(step);
  }

  function startAuto(s){
    stopAuto();
    auto = true;
    speed = isFinite(Number(s)) && Number(s) > 0 ? Number(s) : 30;
    last = 0;
    raf = requestAnimationFrame(step);
  }
  function stopAuto(){ auto=false; if(raf) cancelAnimationFrame(raf); raf=null; }

  window.addEventListener("message", function(e){
    if(e.origin !== PORTFOLIO) return;
    var d = e.data || {};
    if(d.type === "PREVIEW_PING"){ try{ e.source.postMessage({ type: "PREVIEW_READY" }, PORTFOLIO); }catch{}; return; }
    if(d.type === "PREVIEW_AUTOSCROLL_START"){ startAuto(d.speed); return; }
    if(d.type === "PREVIEW_AUTOSCROLL_STOP"){ stopAuto(); return; }
    if(d.type === "PREVIEW_SCROLL_GET"){
      try{
        var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        e.source.postMessage({ type: "PREVIEW_SCROLL_POS", y: window.scrollY, vh: window.innerHeight, h: h }, PORTFOLIO);
      }catch{}
      return;
    }
  });

  function ready(){ try{ window.parent.postMessage({ type: "PREVIEW_READY" }, PORTFOLIO); }catch{} }
  if (document.readyState === "complete") ready(); else window.addEventListener("load", ready);
})();
    `
  }}
/>
