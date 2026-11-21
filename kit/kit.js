/* Desk kit v2 — shared behaviour. Exposes window.Desk. No dependencies, works from file://. */
(function(){
  "use strict";
  var Desk = window.Desk = window.Desk || {};
  var HEB = /[֐-׿]/;

  Desk.$ = function(sel, root){ return (root||document).querySelector(sel); };
  Desk.$$ = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
  Desk.esc = function(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); };

  /* ---------- storage (may throw in some contexts) ---------- */
  Desk.store = {
    get:function(k){ try{ return window.localStorage.getItem(k); }catch(e){ return null; } },
    set:function(k,v){ try{ window.localStorage.setItem(k,v); }catch(e){} }
  };

  /* ---------- theme ---------- */
  Desk.theme = {
    init:function(){
      var saved = Desk.store.get("desk-theme");
      var prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      Desk.theme.set(saved || prefers, false);
      Desk.$$(".theme-btn").forEach(function(b){
        b.addEventListener("click", function(){ Desk.theme.set(document.documentElement.dataset.theme==="dark"?"light":"dark", true); });
      });
    },
    set:function(t, persist){
      document.documentElement.dataset.theme = t;
      Desk.$$(".theme-btn").forEach(function(b){
        b.textContent = t==="dark" ? "☀" : "☾";
        b.setAttribute("aria-label", t==="dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה");
      });
      if(persist) Desk.store.set("desk-theme", t);
      document.dispatchEvent(new CustomEvent("desk:theme",{detail:t}));
    }
  };

  /* ---------- rich text ----------
     Markup in content strings:
       [[termId|shown text]]  -> term with popover (definition from terms dict)
       **bold**               -> <strong>
       `code`                 -> <code>
     Runs of Latin/digits are wrapped in <bdi> so numbers like 1,000GW or 3.1% stay intact in RTL. */
  Desk.rich = function(text, terms){
    var s = Desk.esc(text);
    s = s.replace(/`([^`]+)`/g, function(_,c){ return "\u0001code\u0002"+c+"\u0001/code\u0002"; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\[\[([a-z0-9\-]+)\|([^\]]+)\]\]/gi, function(_,id,shown){
      if(!terms || !terms[id]){ if(window.console) console.warn("Desk: missing term", id); return shown; }
      return '<span class="term" role="button" tabindex="0" aria-expanded="false" data-term="'+id+'">'+shown+'</span>';
    });
    // isolate LTR runs outside of tags
    s = s.split(/(<[^>]+>|\u0001[^\u0002]*\u0002|&[#a-z0-9]+;)/i).map(function(part){
      if(!part || part.charAt(0)==="<" || part.charAt(0)==="\u0001" || part.charAt(0)==="&") return part;
      return part.replace(/([0-9A-Za-z_{][0-9A-Za-z_.,%×+\-–\/:|{}]*[0-9A-Za-z_%}])|([0-9])/g, function(m){ return "<bdi>"+m+"</bdi>"; });
    }).join("");
    s = s.replace(/\u0001code\u0002/g,'<code dir="auto">').replace(/\u0001\/code\u0002/g,"</code>");
    return s;
  };

  /* elements whose text has no Hebrew letters get dir=ltr (numbers, units, code-ish labels) */
  Desk.autoDir = function(root){
    Desk.$$("[data-autodir]", root).forEach(function(el){
      if(!HEB.test(el.textContent)) el.setAttribute("dir","ltr");
    });
  };

  /* ---------- term popovers ---------- */
  var pop = null, popFor = null;
  function closePop(){
    if(pop){ pop.remove(); pop = null; }
    if(popFor){ popFor.setAttribute("aria-expanded","false"); popFor.focus({preventScroll:true}); popFor = null; }
  }
  function openPop(el){
    var terms = Desk.terms || {};
    var t = terms[el.dataset.term]; if(!t) return;
    if(popFor === el){ closePop(); return; }
    closePop();
    pop = document.createElement("div");
    pop.className = "term-pop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label", t.term);
    pop.innerHTML = '<h4><span>'+Desk.esc(t.term)+(t.en?' <span class="muted mono" dir="ltr">· '+Desk.esc(t.en)+'</span>':'')+'</span><button type="button" aria-label="סגירה">×</button></h4>'+
      '<div>'+Desk.rich(t.def)+'</div>'+(t.example?'<div class="ex"><b>דוגמה: </b>'+Desk.rich(t.example)+'</div>':'');
    document.body.appendChild(pop);
    popFor = el; el.setAttribute("aria-expanded","true");
    var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(12, r.right - pw), vw - pw - 12);
    var top = r.bottom + 8;
    if(r.bottom + ph + 16 > window.innerHeight && r.top - ph - 8 > 0) top = r.top - ph - 8;
    pop.style.left = (left + window.scrollX) + "px";
    pop.style.top = (top + window.scrollY) + "px";
    pop.querySelector("button").addEventListener("click", closePop);
  }
  Desk.initTerms = function(terms){
    Desk.terms = terms || {};
    document.addEventListener("click", function(e){
      var el = e.target.closest && e.target.closest(".term");
      if(el){ e.preventDefault(); openPop(el); return; }
      if(pop && !pop.contains(e.target)) closePop();
    });
    document.addEventListener("keydown", function(e){
      if(e.key==="Escape") closePop();
      var el = e.target.closest && e.target.closest(".term");
      if(el && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); openPop(el); }
    });
    window.addEventListener("resize", function(){ if(pop){ var f = popFor; closePop(); } });
  };

  /* ---------- numbers ---------- */
  Desk.fmt = function(n, digits){
    if(n==null || isNaN(n)) return "—";
    var a = Math.abs(n), d = digits==null ? (a>=100?0:a>=10?1:2) : digits;
    return Number(n).toLocaleString("en-US",{maximumFractionDigits:d, minimumFractionDigits:0});
  };
  /* compact with SI-ish suffix: 1.2K, 3.4M, 5.6B */
  Desk.compact = function(n){
    if(n==null || isNaN(n)) return "—";
    var a = Math.abs(n), u = [[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
    for(var i=0;i<u.length;i++){ if(a>=u[i][0]){ var v=n/u[i][0]; return (v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/,"$1")+u[i][1]; } }
    return Desk.fmt(n);
  };
  /* bytes */
  Desk.bytes = function(b){
    if(b==null || isNaN(b)) return "—";
    var u=["B","KB","MB","GB","TB","PB","EB"], i=0;
    while(Math.abs(b)>=1000 && i<u.length-1){ b/=1000; i++; }
    return (b>=100?b.toFixed(0):b>=10?b.toFixed(1):b.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/,"$1")+" "+u[i];
  };

  /* ---------- analytics: GoatCounter, only on the published site ---------- */
  Desk.goat = function(code){
    if(!/\.github\.io$/.test(location.hostname)) return;
    var s = document.createElement("script");
    s.async = true; s.src = "//gc.zgo.at/count.js"; s.setAttribute("data-goatcounter","https://"+code+".goatcounter.com/count");
    document.head.appendChild(s);
  };

  /* ---------- data loading: prefer window globals (file://), fall back to fetch over http ---------- */
  Desk.load = function(globalName, url){
    if(window[globalName]) return Promise.resolve(window[globalName]);
    if(location.protocol === "file:") return Promise.reject(new Error("missing "+globalName+" (data.js) for file://"));
    return fetch(url).then(function(r){ if(!r.ok) throw new Error(r.status+" "+url); return r.json(); });
  };

  document.addEventListener("DOMContentLoaded", function(){ Desk.theme.init(); });
})();
