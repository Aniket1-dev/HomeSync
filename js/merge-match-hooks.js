/* Adds consent-based merge actions to ranked match cards.
   Top Vibe is rendered only by top-vibe-match.js so there is one source of truth. */
(() => {
  let me=null, profiles=[];
  async function init(){
    if(!window.supabaseClient)return;
    const {data:{user}}=await supabaseClient.auth.getUser(); if(!user)return;
    const {data:p}=await supabaseClient.from('profiles').select('id,full_name,city').eq('id',user.id).maybeSingle(); me=p;
    const {data:all}=await supabaseClient.from('profiles').select('id,full_name,city').neq('id',user.id); profiles=all||[];
    const list=document.getElementById('match-list'); if(!list)return;
    const observer=new MutationObserver(attach); observer.observe(list,{childList:true,subtree:true});
    setTimeout(attach,250); setTimeout(attach,900);
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
