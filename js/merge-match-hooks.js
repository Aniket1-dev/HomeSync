/* Adds consent-based merge actions to same-city match cards. */
(() => {
  function init(){
    const list=document.getElementById('match-list'); if(!list)return;
    const observer=new MutationObserver(()=>attach()); observer.observe(list,{childList:true,subtree:true}); attach();
  }
  function attach(){
    if(!window.rankedMatches||!Array.isArray(window.rankedMatches))return;
    document.querySelectorAll('.match-card').forEach(card=>{
      if(card.querySelector('[data-merge-request]'))return;
      const name=card.querySelector('.match-name')?.textContent?.trim(); if(!name)return;
      const match=window.rankedMatches.find(m=>String(m.profile?.full_name||'').trim()===name); if(!match)return;
      const p=match.profile; const sameCity=Boolean(window.me?.city&&p.city&&String(window.me.city).toLowerCase()===String(p.city).toLowerCase());
      if(!sameCity)return;
      const host=card.querySelector('.contact-row')||card.querySelector('.score-breakdown')||card.lastElementChild; if(!host)return;
      const btn=document.createElement('button');btn.type='button';btn.className='btn btn-primary btn-merge';btn.dataset.mergeRequest=p.id;btn.dataset.name=p.full_name||'roommate';btn.textContent='🤝 Raise merge request';host.parentElement?.appendChild(btn);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();