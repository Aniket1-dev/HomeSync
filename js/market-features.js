/* Market-informed discovery filters. Works on the already-loaded rankedMatches array. */
(function(){
  let active='all';
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-market-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-market-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); active=btn.dataset.marketFilter; applyMarketFilter();
    }));
  });
  function applyMarketFilter(){
    if(!window.rankedMatches || !document.getElementById('match-list')) return;
    let source=[...window.rankedMatches];
    const now=Date.now();
    if(active==='verified') source=source.filter(m=>m.profile.verification_status && m.profile.verification_status!=='unverified');
    if(active==='moving') source=source.filter(m=>m.profile.move_in_date && new Date(m.profile.move_in_date).getTime()<=now+45*86400000);
    if(active==='active') source=source.filter(m=>{const d=m.profile.last_active_at||m.profile.last_seen;return d && now-new Date(d).getTime()<=7*86400000;});
    const list=document.getElementById('match-list'); list.innerHTML='';
    if(!source.length){list.innerHTML='<div class="card empty-state"><div class="empty-state-icon">🔎</div><p class="muted">No matches fit this filter yet. Try another signal.</p></div>';return;}
    source.sort((a,b)=>(b.displayScore??b.ruleScore)-(a.displayScore??a.ruleScore));
    const premium=window.me?.is_premium; const limit=premium?source.length:6;
    source.slice(0,limit).forEach(m=>window.renderMatchCard?.(list,m));
    if(source.length>limit) window.renderLockedMatchTeaser?.(list,source.length-limit);
  }
})();
