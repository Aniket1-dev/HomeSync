/* Adds consent-based merge actions to same-city match cards and keeps the
   strongest lifestyle/vibe match at the top. Premium never changes compatibility. */
(() => {
  let me=null, profiles=[];
  async function init(){
    if(!window.supabaseClient)return;
    const {data:{user}}=await supabaseClient.auth.getUser(); if(!user)return;
    const {data:p}=await supabaseClient.from('profiles').select('id,full_name,city').eq('id',user.id).maybeSingle(); me=p;
    const {data:all}=await supabaseClient.from('profiles').select('id,full_name,city').neq('id',user.id); profiles=all||[];
    const list=document.getElementById('match-list'); if(!list)return;
    const observer=new MutationObserver(()=>{keepBestVibeOnTop();attach();}); observer.observe(list,{childList:true,subtree:true});
    setTimeout(keepBestVibeOnTop,350);
    setTimeout(keepBestVibeOnTop,1200);
    attach();
  }

  function keepBestVibeOnTop(){
    if(!Array.isArray(window.rankedMatches) || !window.rankedMatches.length)return;
    // The 15-question Lifestyle score is the compatibility source of truth.
    // Never add a Premium/boost bonus to this value.
    window.rankedMatches.forEach(m=>{ if(m && typeof m.ruleScore==='number') m.displayScore=m.ruleScore; });
    window.rankedMatches.sort((a,b)=>(Number(b?.ruleScore)||0)-(Number(a?.ruleScore)||0));
    const list=document.getElementById('match-list');
    if(!list)return;
    const cards=[...list.querySelectorAll('.match-card')];
    if(!cards.length)return;
    const top=window.rankedMatches[0];
    if(!top?.profile)return;
    const topName=String(top.profile.full_name||'').trim();
    const topCard=cards.find(c=>String(c.querySelector('.match-name')?.textContent||'').trim()===topName);
    if(topCard && topCard!==cards[0]) list.insertBefore(topCard,cards[0]);
    cards.forEach(c=>c.classList.remove('top-vibe-match'));
    if(topCard){
      topCard.classList.add('top-vibe-match');
      if(!topCard.querySelector('.best-vibe-badge')){
        const info=topCard.querySelector('.match-name')?.parentElement?.parentElement;
        if(info){const b=document.createElement('div');b.className='best-vibe-badge';b.textContent='🏆 Best vibe match';info.prepend(b);}
      }
    }
  }

  function attach(){
    if(!me)return;
    document.querySelectorAll('.match-card').forEach(card=>{
      if(card.querySelector('[data-merge-request]'))return;
      const name=card.querySelector('.match-name')?.textContent?.trim(); if(!name)return;
      const p=profiles.find(x=>String(x.full_name||'').trim()===name); if(!p)return;
      if(!me.city||!p.city||String(me.city).toLowerCase()!==String(p.city).toLowerCase())return;
      const host=card.querySelector('.contact-row')||card.querySelector('.score-breakdown'); if(!host)return;
      const btn=document.createElement('button');btn.type='button';btn.className='btn btn-primary btn-merge';btn.dataset.mergeRequest=p.id;btn.dataset.name=p.full_name||'roommate';btn.textContent='🤝 Raise merge request';host.parentElement?.appendChild(btn);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();