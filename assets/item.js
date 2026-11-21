/* Blueprint item page renderer. Reads window.DESK_ITEM (items/<ID>/data.js, generated from item.json).
   Sections: title block, trailer, minute, 01 prompt, 02 requirements, 03 estimates (sliders), 04 API & data,
   05 architecture (scroll-built SVG), 06 deep dives, 07 ×10, 08 trade-offs, 09 interviewer, takeaways, docs. */
(function(){
  "use strict";
  var D = window.Desk, $ = D.$, $$ = D.$$, esc = D.esc;
  var IT, R; // item, rich() bound to item terms
  D.goat("blueprint");

  function sec(id, num, title, inner, sheet){
    return '<section class="sec" id="'+id+'" aria-labelledby="'+id+'-h"><div class="sec-head">'+
      (num?'<span class="sec-num" dir="ltr">'+num+'</span>':'')+'<h2 id="'+id+'-h">'+esc(title)+'</h2>'+
      (sheet?'<span class="sheet-tag">'+esc(sheet)+'</span>':'')+'</div>'+inner+'</section>';
  }
  function bridge(key){ var b = IT.bridges && IT.bridges[key]; return b ? '<p class="bridge">'+R(b)+'</p>' : ""; }
  var BADGE = {report:"מהדיווח", assume:"הנחה שלנו", calc:"חישוב"};
  function badge(kind){ return '<span class="badge '+kind+'">'+BADGE[kind]+'</span>'; }

  /* ---------------- head ---------------- */
  function head(){
    var tb = IT.titleblock || [];
    var toc = [["prompt","השאלה"],["reqs","דרישות"],["calc","חישוב גס"],["api","API ונתונים"],["arch","ארכיטקטורה"],["dives","צלילה"],["x10","פי 10"],["trades","פשרות"],["qa","שאלות המשך"],["takes","מה לקחתי"]];
    return '<div class="titleblock" role="group" aria-label="פרטי הפריט">'+tb.map(function(c){
        return '<div><div class="k">'+esc(c.k)+'</div><div class="v" data-autodir>'+esc(c.v)+'</div></div>';
      }).join("")+'</div>'+
      '<header class="item-hero"><div class="kicker" dir="ltr" style="text-align:right">'+esc(IT.sheet)+' · '+esc(IT.issue)+'</div>'+
      '<h1>'+esc(IT.title)+'</h1><p class="sub">'+R(IT.subtitle)+'</p>'+
      '<p class="trailer">'+R(IT.trailer.text)+'<span class="q">'+R(IT.trailer.question)+'</span></p>'+
      '<nav class="toc" aria-label="תוכן העמוד">'+toc.map(function(t){return '<a href="#'+t[0]+'">'+t[1]+'</a>';}).join("")+'</nav></header>';
  }

  function minute(){
    var m = IT.minute;
    return '<section class="sec" id="minute" aria-labelledby="minute-h"><div class="sec-head"><span class="sec-num">⏱</span><h2 id="minute-h">הסיפור בדקה</h2></div>'+
      '<div class="minute"><div><ul>'+m.points.map(function(p){return '<li>'+R(p)+'</li>';}).join("")+'</ul>'+
      (m.quote?'<blockquote class="pull"><span dir="ltr" lang="en">“'+esc(m.quote.text)+'”</span><cite>'+R(m.quote.cite)+'</cite></blockquote>':'')+
      '</div><div class="facts">'+m.facts.map(function(f){
        return '<div class="fact"><b dir="ltr">'+esc(f.value)+'</b><span>'+R(f.label)+'</span></div>';
      }).join("")+'</div></div></section>';
  }

  function prompt(){
    var p = IT.prompt;
    return bridge("prompt")+sec("prompt","01","השאלה",
      '<div class="prompt"><span class="who">INTERVIEWER</span>'+R(p.text)+'</div>'+
      (p.notes?'<p class="prompt-notes">'+R(p.notes)+'</p>':''),"SHEET 01");
  }

  function reqs(){
    var r = IT.reqs;
    function list(a){ return '<ul>'+a.map(function(x,i){return '<li>'+R(x)+'</li>';}).join("")+'</ul>'; }
    return bridge("reqs")+sec("reqs","02","הבהרת דרישות",
      '<div class="reqs">'+
      '<div class="card"><h3><span class="num">F</span>פונקציונליות</h3>'+list(r.functional)+'</div>'+
      '<div class="card"><h3><span class="num">NF</span>לא־פונקציונליות</h3>'+list(r.nonfunctional)+'</div>'+
      '<div class="card out"><h3><span class="num">∅</span>מחוץ לתחום</h3>'+list(r.out)+'</div></div>',"SHEET 02");
  }

  /* ---------------- 03 calculator ---------------- */
  var calcVals = {};
  function sliderPos(inp, v){ return inp.scale==="log" ? Math.round(1000*Math.log(v/inp.min)/Math.log(inp.max/inp.min)) : v; }
  function sliderVal(inp, pos){
    if(inp.scale!=="log") return +pos;
    var v = inp.min*Math.pow(inp.max/inp.min, pos/1000);
    var mag = Math.pow(10, Math.floor(Math.log10(v))-1); // 2 significant digits
    return Math.round(v/mag)*mag;
  }
  function fmtOut(v, f){
    if(f==="bytes") return D.bytes(v);
    if(f==="bps"){ var u=["bps","Kbps","Mbps","Gbps","Tbps"],i=0; while(v>=1000&&i<u.length-1){v/=1000;i++;} return D.fmt(v, v>=100?0:1)+" "+u[i]; }
    if(f==="compact") return D.compact(v);
    return D.fmt(v);
  }
  function calc(){
    var c = IT.calc;
    var ins = c.inputs.map(function(inp){
      calcVals[inp.id] = inp.value;
      var isLog = inp.scale==="log";
      return '<div class="slider"><div class="row"><label for="in-'+inp.id+'">'+R(inp.label)+'</label>'+
        '<output id="out-'+inp.id+'" for="in-'+inp.id+'" dir="ltr"></output></div>'+
        '<input type="range" id="in-'+inp.id+'" data-id="'+inp.id+'" min="'+(isLog?0:inp.min)+'" max="'+(isLog?1000:inp.max)+'" step="'+(isLog?1:inp.step)+'" value="'+sliderPos(inp,inp.value)+'" aria-describedby="src-'+inp.id+'">'+
        '<div class="src" id="src-'+inp.id+'">'+badge(inp.src.kind)+R(inp.src.text)+'</div></div>';
    }).join("");
    var outs = c.outputs.map(function(o){
      return '<div class="outcard" id="oc-'+o.id+'"><div class="top"><span class="lbl">'+R(o.label)+'</span><span class="val" id="ov-'+o.id+'"></span></div>'+
        '<div class="how">'+badge("calc")+R(o.how)+'</div></div>';
    }).join("");
    return bridge("calc")+sec("calc","03","חישוב גס",
      '<p class="text">'+R(c.intro)+'</p><div class="calc"><div class="calc-in card">'+ins+
      '<button class="btn ghost calc-reset" type="button" id="calc-reset">חזרה לברירת המחדל</button></div>'+
      '<div><div class="calc-out" aria-live="polite">'+outs+'</div><p class="calc-note">'+R(c.note)+'</p></div></div>',"SHEET 03");
  }
  function evalOut(expr){
    var keys = Object.keys(calcVals);
    /* expressions come from our own item.json, not from user input */
    return Function.apply(null, keys.concat(["return ("+expr+");"])).apply(null, keys.map(function(k){return calcVals[k];}));
  }
  function updateCalc(changed){
    var c = IT.calc;
    c.inputs.forEach(function(inp){
      var o = $("#out-"+inp.id);
      o.textContent = (inp.fmt==="compact"?D.compact(calcVals[inp.id]):D.fmt(calcVals[inp.id]))+(inp.unit?" "+inp.unit:"");
    });
    c.outputs.forEach(function(o){
      var v = evalOut(o.expr), el = $("#ov-"+o.id);
      var txt = fmtOut(v, o.fmt), unit = o.unit ? '<small>'+esc(o.unit)+'</small>' : "";
      var html = esc(txt)+unit;
      if(el.innerHTML !== html){
        el.innerHTML = html;
        if(changed){ var card = $("#oc-"+o.id); card.classList.add("flash"); setTimeout(function(){card.classList.remove("flash");}, 350); }
      }
    });
  }
  function bindCalc(){
    var c = IT.calc;
    $$(".calc input[type=range]").forEach(function(el){
      el.addEventListener("input", function(){
        var inp = c.inputs.filter(function(x){return x.id===el.dataset.id;})[0];
        calcVals[inp.id] = sliderVal(inp, el.value);
        updateCalc(true);
      });
    });
    $("#calc-reset").addEventListener("click", function(){
      c.inputs.forEach(function(inp){ calcVals[inp.id]=inp.value; $("#in-"+inp.id).value = sliderPos(inp, inp.value); });
      updateCalc(true);
    });
    updateCalc(false);
  }

  /* ---------------- 04 API & data ---------------- */
  function api(){
    var a = IT.api;
    var eps = a.endpoints.map(function(e){
      return '<div class="ep"><div class="sig"><span class="m m-'+e.m+'">'+e.m+'</span><span class="p">'+esc(e.p)+'</span>'+(e.scope?'<span class="scope">'+esc(e.scope)+'</span>':'')+'</div>'+
        '<p class="d">'+R(e.d)+'</p>'+(e.ex?'<pre><code>'+esc(e.ex)+'</code></pre>':'')+'</div>';
    }).join("");
    var models = a.models.map(function(m){
      return '<div class="model"><h4>'+esc(m.name)+'<span>'+esc(m.kind)+'</span></h4><table>'+m.fields.map(function(f){
        return '<tr><td class="'+(f[2]?'pk':'')+'">'+esc(f[0])+'</td><td data-autodir>'+R(f[1])+'</td></tr>';
      }).join("")+'</table>'+(m.note?'<div class="note">'+R(m.note)+'</div>':'')+'</div>';
    }).join("");
    return bridge("api")+sec("api","04","API ומודל נתונים",
      '<p class="text">'+R(a.intro)+'</p><div class="api">'+eps+'</div><h3 style="margin-top:22px">מודל הנתונים</h3><div class="models">'+models+'</div>',"SHEET 04");
  }

  /* ---------------- 05 architecture ---------------- */
  var A = {step:-1, vb:null, anim:null, mobile:false};
  var KIND_LABEL = {source:"מקור",edge:"קצה",ingest:"קליטה",store:"אחסון",compute:"עיבוד",client:"לקוח"};
  function svgArch(){
    var a = IT.arch, vb = a.viewBox;
    var s = '<svg class="arch-svg" viewBox="0 0 '+vb[0]+' '+vb[1]+'" role="img" aria-labelledby="arch-title" direction="rtl">'+
      '<title id="arch-title">'+esc(a.title)+'</title>'+
      '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--muted)"/></marker>'+
      '<marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--accent)"/></marker></defs>';
    a.edges.forEach(function(e){
      var d = e.pts.map(function(p,i){return (i?"L":"M")+p[0]+" "+p[1];}).join(" ");
      s += '<g class="edge off'+(e.dash?' dash':'')+'" data-step="'+e.step+'" data-id="'+e.from+'-'+e.to+'"><path d="'+d+'" marker-end="url(#arr)"/>'+
        (e.label?'<text x="'+e.lp[0]+'" y="'+e.lp[1]+'" text-anchor="middle">'+esc(e.label)+'</text>':'')+'</g>';
    });
    a.nodes.forEach(function(n){
      var w = n.w||150, h = n.h||56, cx = n.x+w/2;
      s += '<g class="node off" data-step="'+n.step+'" data-id="'+n.id+'"><rect x="'+n.x+'" y="'+n.y+'" width="'+w+'" height="'+h+'" rx="8" style="stroke:var(--c-'+n.kind+')"/>'+
        '<rect x="'+(n.x+w-5)+'" y="'+n.y+'" width="5" height="'+h+'" rx="2" style="fill:var(--c-'+n.kind+');stroke:none"/>'+
        '<text x="'+cx+'" y="'+(n.y+h/2-2)+'" text-anchor="middle">'+esc(n.label)+'</text>'+
        '<text class="s" x="'+cx+'" y="'+(n.y+h/2+16)+'" text-anchor="middle">'+esc(n.sub||"")+'</text></g>';
    });
    return s+'</svg>';
  }
  function arch(){
    var a = IT.arch;
    var kinds = [];
    a.nodes.forEach(function(n){ if(kinds.indexOf(n.kind)<0) kinds.push(n.kind); });
    var steps = a.steps.map(function(st,i){
      return '<div class="arch-step" data-i="'+i+'"><span class="n" dir="ltr">STEP '+String(i+1).padStart(2,"0")+'</span><h3>'+R(st.title)+'</h3><p>'+R(st.text)+'</p>'+
        (st.why?'<p class="why"><b>למה כאן: </b>'+R(st.why)+'</p>':'')+'</div>';
    }).join("");
    return bridge("arch")+sec("arch","05","ארכיטקטורה, רכיב אחרי רכיב",
      '<p class="text">'+R(a.intro)+'</p><div class="arch"><div class="arch-steps">'+steps+'</div>'+
      '<div class="arch-stage"><div class="arch-svg-wrap">'+svgArch()+'</div>'+
      '<div class="arch-ctrl"><span class="lbl" id="arch-lbl" aria-live="polite"></span>'+
      '<button class="chip" type="button" id="arch-prev" aria-label="שלב קודם">→ קודם</button>'+
      '<button class="chip" type="button" id="arch-next" aria-label="שלב הבא">הבא ←</button>'+
      '<button class="chip" type="button" id="arch-all">הכול</button></div>'+
      '<div class="legend">'+kinds.map(function(k){return '<span><i style="border-color:var(--c-'+k+')"></i>'+KIND_LABEL[k]+'</span>';}).join("")+'</div>'+
      '</div></div>',"SHEET 05");
  }
  function stepNodes(i){
    var a = IT.arch, st = a.steps[i], ids = (st.nodes||[]).slice();
    a.edges.forEach(function(e){ if(e.step===i){ if(ids.indexOf(e.from)<0) ids.push(e.from); if(ids.indexOf(e.to)<0) ids.push(e.to); } });
    return ids;
  }
  function targetVB(i, all){
    var a = IT.arch, full = [0,0,a.viewBox[0],a.viewBox[1]];
    if(all || !A.mobile) return full;
    var ids = stepNodes(i); if(!ids.length) return full;
    var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    a.nodes.forEach(function(n){ if(ids.indexOf(n.id)>=0){ x0=Math.min(x0,n.x); y0=Math.min(y0,n.y); x1=Math.max(x1,n.x+(n.w||150)); y1=Math.max(y1,n.y+(n.h||56)); } });
    var pad = 22; x0-=pad; y0-=pad; x1+=pad; y1+=pad;
    var ratio = a.viewBox[0]/a.viewBox[1], w = x1-x0, h = y1-y0;
    var minW = 380; if(w<minW){ x0 -= (minW-w)/2; w = minW; }
    if(w/h > ratio){ var nh = w/ratio; y0 -= (nh-h)/2; h = nh; } else { var nw = h*ratio; x0 -= (nw-w)/2; w = nw; }
    if(w > a.viewBox[0]) return full;
    x0 = Math.max(0, Math.min(x0, a.viewBox[0]-w)); y0 = Math.max(0, Math.min(y0, a.viewBox[1]-h));
    return [x0,y0,w,h];
  }
  function animVB(to){
    var svg = $(".arch-svg"); if(!svg) return;
    var from = A.vb || to.slice(); A.vb = from;
    if(A.anim) cancelAnimationFrame(A.anim);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = performance.now(), dur = reduce ? 0 : 450;
    function tick(t){
      var k = dur ? Math.min(1,(t-t0)/dur) : 1, e = k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
      var cur = from.map(function(v,j){ return v+(to[j]-v)*e; });
      svg.setAttribute("viewBox", cur.join(" ")); A.vb = cur;
      if(k<1) A.anim = requestAnimationFrame(tick);
    }
    A.anim = requestAnimationFrame(tick);
  }
  function setStep(i, all){
    var a = IT.arch, n = a.steps.length;
    i = Math.max(0, Math.min(n-1, i));
    A.step = i; A.all = !!all;
    var shown = all ? n-1 : i, cur = stepNodes(i);
    $$(".arch-svg .node").forEach(function(g){
      var s = +g.dataset.step;
      g.classList.toggle("off", s>shown);
      g.classList.toggle("hl", !all && cur.indexOf(g.dataset.id)>=0 && (a.steps[i].nodes||[]).indexOf(g.dataset.id)>=0);
      g.classList.toggle("dim", !all && s<=shown && cur.indexOf(g.dataset.id)<0 && A.mobile===false && i<n-1);
    });
    $$(".arch-svg .edge").forEach(function(g){
      var s = +g.dataset.step;
      g.classList.toggle("off", s>shown);
      var hl = !all && s===i;
      g.classList.toggle("hl", hl);
      g.querySelector("path").setAttribute("marker-end", hl ? "url(#arr-hl)" : "url(#arr)");
    });
    $$(".arch-step").forEach(function(el){ el.classList.toggle("on", +el.dataset.i===i); });
    $("#arch-lbl").textContent = all ? "כל המערכת" : "שלב "+(i+1)+" מתוך "+n;
    $("#arch-all").setAttribute("aria-pressed", all ? "true" : "false");
    animVB(targetVB(i, all || i===n-1));
  }
  function bindArch(){
    var mq = window.matchMedia("(max-width: 900px)");
    function onMQ(){ A.mobile = mq.matches; if(A.step>=0) setStep(A.step, A.all); }
    A.mobile = mq.matches;
    if(mq.addEventListener) mq.addEventListener("change", onMQ); else mq.addListener(onMQ);
    var steps = $$(".arch-step");
    if("IntersectionObserver" in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ if(en.isIntersecting) setStep(+en.target.dataset.i, false); });
      }, {rootMargin: A.mobile ? "-55% 0px -35% 0px" : "-45% 0px -45% 0px"});
      steps.forEach(function(s){ io.observe(s); });
    }
    $("#arch-prev").addEventListener("click", function(){ setStep((A.all?IT.arch.steps.length-1:A.step)-1, false); });
    $("#arch-next").addEventListener("click", function(){ setStep(A.step+1, false); });
    $("#arch-all").addEventListener("click", function(){ setStep(A.all ? A.step : IT.arch.steps.length-1, !A.all); });
    setStep(0, false);
  }

  /* ---------------- 06 deep dives (+ day strip) ---------------- */
  function daystrip(ds){
    var btns = ds.modes.map(function(m,i){ return '<button class="chip" type="button" data-mode="'+i+'" aria-pressed="'+(i===0)+'">'+esc(m.label)+'</button>'; }).join("");
    return '<div class="daystrip" id="daystrip"><div class="filters" style="margin:0 0 8px" role="group" aria-label="אסטרטגיית טעינה">'+btns+'</div>'+
      '<div class="legend ds-legend"><span><i style="border-color:var(--good);background:var(--good)"></i>'+esc(ds.lgAbsorbed)+'</span><span><i style="border-color:var(--bad);background:var(--bad);opacity:.4"></i>'+esc(ds.lgWasted)+'</span><span><i style="border-color:var(--warn);background:var(--warn)"></i>'+esc(ds.lgGrid)+'</span><span><i style="border-color:var(--c-source)"></i>'+esc(ds.solarLabel)+'</span></div>'+
      '<svg id="ds-svg" viewBox="0 0 720 230" direction="ltr" style="direction:ltr" role="img" aria-labelledby="ds-t ds-cap"><title id="ds-t">'+esc(ds.title)+'</title><g id="ds-g"></g></svg>'+
      '<p class="cap" id="ds-cap" aria-live="polite"></p></div>';
  }
  function drawDay(mode){
    var ds = IT.daystrip, m = ds.modes[mode], g = $("#ds-g"); if(!g) return;
    var svg = $("#ds-svg"), W = Math.max(320, Math.round(svg.parentNode.clientWidth || 720)), PW = W-60, H = W < 560 ? 250 : 230;
    svg.setAttribute("viewBox", "0 0 "+W+" "+H); A.dsMode = mode;
    var X = function(h){ return 40 + h*(PW/24); }, maxY = ds.maxGW, B = H-40, Y = function(v){ return B - v*((B-16)/maxY); };
    var s = "";
    // axis
    var stepH = W < 560 ? 6 : 3;
    for(var h=0; h<=24; h+=stepH){ s += '<line x1="'+X(h)+'" y1="'+B+'" x2="'+X(h)+'" y2="'+(B+4)+'" style="stroke:var(--muted)"/><text x="'+X(h)+'" y="'+(B+18)+'" text-anchor="middle" style="fill:var(--muted);font:11px var(--f-mono)">'+String(h).padStart(2,"0")+':00</text>'; }
    s += '<line x1="40" y1="'+B+'" x2="'+(W-20)+'" y2="'+B+'" style="stroke:var(--line)"/>';
    var solar = ds.solar, cap = ds.gridCap, load = m.load;
    // surplus area: solar above export capacity
    var area = "", line = "", capl = "";
    for(var i=0;i<24;i++){ var x=X(i+.5); line += (i?"L":"M")+x+" "+Y(solar[i]); }
    // shaded surplus (solar - cap) minus absorbed
    var absorbed = 0, wasted = 0;
    for(var j=0;j<24;j++){
      var sur = Math.max(0, solar[j]-cap), take = Math.min(sur, load[j]);
      absorbed += take; wasted += sur-take;
      var x0 = X(j), w = PW/24 - 2;
      if(sur>0){
        s += '<rect x="'+(x0+1)+'" y="'+Y(cap+sur)+'" width="'+w+'" height="'+(Y(cap)-Y(cap+sur))+'" style="fill:var(--bad);opacity:.22"/>';
        if(take>0) s += '<rect x="'+(x0+1)+'" y="'+Y(cap+take)+'" width="'+w+'" height="'+(Y(cap)-Y(cap+take))+'" style="fill:var(--good);opacity:.75"/>';
      }
      if(load[j]>0 && sur<load[j]){ // charging outside surplus = from grid mix
        var extra = load[j]-Math.min(sur,load[j]);
        s += '<rect x="'+(x0+1)+'" y="'+(Y(0)-(Y(0)-Y(extra)))+'" width="'+w+'" height="'+(Y(0)-Y(extra))+'" style="fill:var(--warn);opacity:.7"/>';
      }
    }
    s += '<path d="'+line+'" style="fill:none;stroke:var(--c-source);stroke-width:2.2"/>';
    s += '<line x1="40" y1="'+Y(cap)+'" x2="'+(W-20)+'" y2="'+Y(cap)+'" style="stroke:var(--ink);stroke-dasharray:5 4;stroke-width:1.2"/>';
    s += '<text x="44" y="'+(Y(cap)-6)+'" text-anchor="start" style="fill:var(--ink);font:500 12px var(--f-body)">'+esc(ds.capLabel)+'</text>';
    g.innerHTML = s;
    var total = absorbed+wasted, pct = total ? Math.round(100*absorbed/total) : 0;
    $("#ds-cap").innerHTML = R(m.caption.replace("{pct}", pct).replace("{abs}", D.fmt(absorbed,1)).replace("{waste}", D.fmt(wasted,1)));
  }
  function bindDay(){
    var box = $("#daystrip"); if(!box) return;
    box.addEventListener("click", function(e){
      var b = e.target.closest("button[data-mode]"); if(!b) return;
      $$("button[data-mode]",box).forEach(function(x){ x.setAttribute("aria-pressed", x===b?"true":"false"); });
      drawDay(+b.dataset.mode);
    });
    drawDay(0);
    var lastW = window.innerWidth;
    window.addEventListener("resize", function(){ if(window.innerWidth!==lastW){ lastW = window.innerWidth; drawDay(A.dsMode||0); } });
  }
  function dives(){
    var out = IT.dives.map(function(d){
      function list(a){ return '<ul>'+a.map(function(x){return '<li>'+R(x)+'</li>';}).join("")+'</ul>'; }
      return '<article class="dive" id="dive-'+d.id+'"><span class="tag" dir="ltr">'+esc(d.tag)+'</span><h3>'+R(d.title)+'</h3>'+
        '<p>'+R(d.problem)+'</p>'+(d.viz==="daystrip"?daystrip(IT.daystrip):'')+
        '<div class="cols"><div><h4>איך זה עובד</h4>'+list(d.design)+'</div><div><h4>החלטות ומקרי קצה</h4>'+list(d.decisions)+'</div></div>'+
        (d.code?'<h4>'+esc(d.code.title)+'</h4><pre><code>'+esc(d.code.text)+'</code></pre>':'')+'</article>';
    }).join("");
    return bridge("dives")+sec("dives","06","צלילה לשני רכיבים קריטיים",'<div class="dives">'+out+'</div>',"SHEET 06");
  }

  /* ---------------- 07 ×10 ---------------- */
  function x10(){
    var x = IT.x10;
    var bars = x.components.map(function(c,i){
      return '<div class="bar" data-i="'+i+'"><div class="top"><span>'+R(c.name)+'</span><span class="pct" id="x-p-'+i+'"></span></div>'+
        '<div class="track"><div class="fill" id="x-f-'+i+'"></div></div><div class="at" id="x-a-'+i+'"></div></div>';
    }).join("");
    return bridge("x10")+sec("x10","07","מה קורה בפי 10",
      '<p class="text">'+R(x.intro)+'</p><div class="x10"><div><div class="x10-ctrl">'+
      '<label for="x10-in" class="muted">'+esc(x.label)+'</label><div class="big" id="x10-big"></div>'+
      '<input type="range" id="x10-in" min="1" max="10" step="0.1" value="1" aria-describedby="x10-eq">'+
      '<div class="eq" id="x10-eq">'+R(x.eq)+'</div></div>'+
      '<div class="x10-verdict" id="x10-v" aria-live="polite"></div></div><div class="bars">'+bars+'</div></div>'+
      '<p class="calc-note">'+R(x.note)+'</p>',"SHEET 07");
  }
  function updX10(k){
    var x = IT.x10, first = null, firstAt = 1e9, nearest = null, nearAt = 1e9;
    $("#x10-big").textContent = "×"+(+k).toFixed(1);
    x.components.forEach(function(c,i){
      var u = c.base*Math.pow(k, c.exp), breakAt = Math.pow(100/c.base, 1/c.exp);
      var bar = $('.bar[data-i="'+i+'"]');
      $("#x-f-"+i).style.width = Math.min(100,u)+"%";
      $("#x-p-"+i).textContent = Math.round(u)+"%";
      bar.classList.toggle("warn", u>=70 && u<100);
      bar.classList.toggle("broken", u>=100);
      $("#x-a-"+i).textContent = breakAt<=10 ? "נשבר בערך ב-×"+breakAt.toFixed(1) : "מחזיק גם ב-×10";
      if(u>=100 && breakAt<firstAt){ first = i; firstAt = breakAt; }
      if(u<100 && breakAt<nearAt){ nearest = i; nearAt = breakAt; }
    });
    $$(".bar").forEach(function(b){ b.classList.toggle("first", +b.dataset.i===first); });
    var v = $("#x10-v");
    if(first!==null){
      var c = x.components[first];
      v.className = "x10-verdict bad";
      v.innerHTML = '<h4>נשבר ראשון: '+R(c.name)+'</h4><div>'+R(c.breaks)+'</div><div class="fix"><b>הפתרון: </b>'+R(c.fix)+'</div>';
    } else {
      v.className = "x10-verdict";
      v.innerHTML = '<h4>הכול מחזיק</h4><div>'+R(x.okText)+(nearest!==null?' הגבול הקרוב: <b>'+R(x.components[nearest].name)+'</b>, בערך ב-<bdi>×'+nearAt.toFixed(1)+'</bdi>.':'')+'</div>';
    }
  }
  function bindX10(){
    var el = $("#x10-in");
    el.addEventListener("input", function(){ updX10(+el.value); });
    updX10(1);
  }

  /* ---------------- 08 trade-offs, 09 Q&A, takeaways, docs ---------------- */
  function trades(){
    var out = IT.trades.map(function(t){
      return '<div class="trade"><div class="ends"><span>'+R(t.a)+'</span><span>'+R(t.b)+'</span></div>'+
        '<div class="axis" role="img" aria-label="'+esc("הבחירה שלנו: "+t.choice)+'"><span class="pin" style="inset-inline-start:'+t.pos+'%"></span></div>'+
        '<p><span class="choice">'+R(t.choice)+'. </span>'+R(t.why)+'</p></div>';
    }).join("");
    return bridge("trades")+sec("trades","08","פשרות",'<div class="trades">'+out+'</div>',"SHEET 08");
  }
  function qa(){
    var out = IT.qa.map(function(q,i){
      return '<details><summary><span class="mono" dir="ltr" style="color:var(--accent)">Q'+(i+1)+'</span><span>'+R(q.q)+'</span></summary>'+
        '<div class="body"><p>'+R(q.a)+'</p>'+(q.tip?'<p class="tip"><b>מה המראיין בודק: </b>'+R(q.tip)+'</p>':'')+'</div></details>';
    }).join("");
    return bridge("qa")+sec("qa","09","מה המראיין ישאל עכשיו",'<p class="text muted">נסו לענות לפני שאתם פותחים.</p><div class="qa">'+out+'</div>',"SHEET 09");
  }
  function takes(){
    var KIND = {tech:"טכנולוגי",human:"אנושי",pro:"מקצועי"};
    return bridge("takes")+sec("takes","","מה לקחתי מזה",'<div class="takes">'+IT.takes.map(function(t){
      return '<div class="take"><span class="kind">'+KIND[t.kind]+'</span><p>'+R(t.text)+'</p></div>';
    }).join("")+'</div>');
  }
  function docs(){
    var s = IT.source;
    return '<section class="sec" id="docs" aria-labelledby="docs-h"><div class="sec-head"><span class="sec-num">⤓</span><h2 id="docs-h">Design Doc להורדה</h2></div>'+
      '<div class="docs">'+IT.docs.map(function(d){ return '<a class="btn ghost" href="'+esc(d.href)+'" download>'+esc(d.label)+'</a>'; }).join("")+'</div>'+
      '<p class="source">מבוסס על דיווח ב-The Economist, <bdi>'+esc(s.dateLabel)+'</bdi> ('+esc(s.section)+', "<span dir="ltr" lang="en">'+esc(s.headline)+'</span>"). '+R(s.note||"")+'</p></section>';
  }

  /* ---------------- boot ---------------- */
  D.load("DESK_ITEM","item.json").then(function(item){
    IT = item;
    R = function(t){ return D.rich(t, IT.terms); };
    D.initTerms(IT.terms);
    $("#main").innerHTML = head()+minute()+prompt()+reqs()+calc()+api()+arch()+dives()+x10()+trades()+qa()+takes()+docs();
    D.autoDir($("#main"));
    bindCalc(); bindArch(); bindDay(); bindX10();
    if(location.hash){ var t = document.getElementById(location.hash.slice(1)); if(t) t.scrollIntoView(); }
  }).catch(function(err){
    $("#main").innerHTML = '<p class="card" style="margin-top:40px">לא הצלחתי לטעון את הפריט. אם פתחתם מהדיסק, ודאו שקיים data.js בתיקיית הפריט.</p>';
    console.error(err);
  });
})();
