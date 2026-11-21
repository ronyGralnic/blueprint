/* Blueprint home: gallery with free-text search and domain/region filters. Data: window.DESK_INDEX (items/data.js). */
(function(){
  "use strict";
  var D = window.Desk, state = {q:"", f:null};
  D.goat("blueprint");

  function card(it){
    var tags = [it.domain, it.country].concat(it.tags||[]).filter(Boolean).slice(0,4);
    return '<a class="item-card" href="items/'+D.esc(it.id)+'/index.html">'+
      '<img src="'+D.esc(it.og)+'" alt="" loading="lazy" width="1200" height="630">'+
      '<div class="b"><span class="kicker" dir="ltr" style="text-align:right">'+D.esc(it.issue)+' · '+D.esc(it.sheet||"SD")+'</span>'+
      '<h3>'+D.esc(it.title)+'</h3><p>'+D.esc(it.summary)+'</p>'+
      (it.keyMetric?'<p><b dir="ltr" class="mono" style="color:var(--accent)">'+D.esc(it.keyMetric.value)+'</b> · '+D.esc(it.keyMetric.label)+'</p>':'')+
      '<div class="meta">'+tags.map(function(t){return '<span class="chip">'+D.esc(t)+'</span>';}).join("")+'</div></div></a>';
  }
  function match(it){
    if(state.f && it.domain!==state.f && it.region!==state.f) return false;
    if(!state.q) return true;
    var hay = [it.title,it.subtitle,it.summary,it.domain,it.region,it.country].concat(it.tags||[]).join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every(function(w){ return hay.indexOf(w)>=0; });
  }
  function render(idx){
    var items = (idx.items||[]).slice().sort(function(a,b){ return a.id<b.id?1:-1; });
    var list = items.filter(match);
    D.$("#gallery").innerHTML = list.length ? list.map(card).join("") : '<div class="empty card">אין פריטים שמתאימים לסינון.</div>';
  }
  function chips(idx){
    var vals = [];
    (idx.items||[]).forEach(function(it){ [it.domain,it.region].forEach(function(v){ if(v && vals.indexOf(v)<0) vals.push(v); }); });
    var box = D.$("#chips");
    box.innerHTML = '<button class="chip" type="button" aria-pressed="true" data-f="">הכול</button>'+
      vals.map(function(v){ return '<button class="chip" type="button" aria-pressed="false" data-f="'+D.esc(v)+'">'+D.esc(v)+'</button>'; }).join("");
    box.addEventListener("click", function(e){
      var b = e.target.closest("button"); if(!b) return;
      state.f = b.dataset.f || null;
      D.$$("button",box).forEach(function(x){ x.setAttribute("aria-pressed", x===b?"true":"false"); });
      render(idx);
    });
  }
  D.load("DESK_INDEX","items/index.json").then(function(idx){
    chips(idx); render(idx);
    D.$("#q").addEventListener("input", function(e){ state.q = e.target.value.trim(); render(idx); });
  }).catch(function(err){
    D.$("#gallery").innerHTML = '<div class="empty card">לא הצלחתי לטעון את רשימת הפריטים.</div>';
    console.error(err);
  });
})();
