/* Market-informed discovery controls that work with the existing dashboard renderer. */
(function(){
  let active='all';
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-market-filter]').forEach(btn=>btn.addEventListener('click',async()=>{
      document.querySelectorAll('[data-market-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); active=btn.dataset.marketFilter; await applyFilter();
    }));
    refreshCompatibilityStatus();
  });

  async function applyFilter(){
    const cards=[...document.querySelectorAll('#match-list .match-card')];
    if(!cards.length) return;
    if(active==='all'){cards.forEach(c=>c.style.display='');return;}
    const {data:{user}}=await supabaseClient.auth.getUser();
    if(!user)return;
    const {data:profiles}=await supabaseClient.from('profiles').select('id,full_name,verification_status,move_in_date,last_active_at,last_seen').neq('id',user.id);
    const now=Date.now();
    const allowed=new Set((profiles||[]).filter(p=>{
      if(active==='verified') return p.verification_status && p.verification_status!=='unverified';
      if(active==='moving') return p.move_in_date && new Date(p.move_in_date).getTime()<=now+45*86400000;
      if(active==='active'){const d=p.last_active_at||p.last_seen;return d && now-new Date(d).getTime()<=7*86400000;}
      return true;
    }).map(p=>(p.full_name||'').trim()));
    cards.forEach(card=>{const name=card.querySelector('.match-name')?.textContent?.trim()||'';card.style.display=allowed.has(name)?'':'none';});
  }

  async function refreshCompatibilityStatus(){
    const {data:{user}}=await supabaseClient.auth.getUser();
    if(!user)return;
    const {data}=await supabaseClient.from('roommate_questionnaire').select('answers,completed_at').eq('user_id',user.id).maybeSingle();
    const answered=Object.keys(data?.answers||{}).length;
    const el=document.getElementById('stat-completeness-hint');
    if(el && answered<15){el.innerHTML=`<a href="compatibility.html">${answered}/15 compatibility questions · improve your matches →</a>`;}
    if(el && answered>=15) el.textContent='15/15 compatibility signals active ✓';
  }
})();
