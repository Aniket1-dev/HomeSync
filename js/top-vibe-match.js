/* HomeSync — dedicated Top Vibe Match.
   This is intentionally separate from practical match eligibility so a strong
   lifestyle match is still visible when budget/location filters exclude them. */
(() => {
  const WEIGHTS={sleep_time:.10,wake_time:.07,study_work_schedule:.05,clean_room:.10,dishes:.06,shared_cleaning:.05,guest_frequency:.08,social_energy:.06,noise_conflict:.07,smoking_home:.10,cooking_frequency:.06,personal_space:.06,move_in_timing:.05,commute_priority:.05,verification_priority:.04};
  function vibeScore(a,b){
    const aa=a.compatibility_answers,bb=b.compatibility_answers;
    if(!aa||!bb||typeof aa!=='object'||typeof bb!=='object')return null;
    const keys=Object.keys(WEIGHTS).filter(k=>aa[k]!=null&&bb[k]!=null);
    if(keys.length<8)return null;
    const da=new Set(Array.isArray(a.compatibility_dealbreakers)?a.compatibility_dealbreakers:[]);
    const db=new Set(Array.isArray(b.compatibility_dealbreakers)?b.compatibility_dealbreakers:[]);
    for(const k of new Set([...da,...db]))if(aa[k]!=null&&bb[k]!=null&&Number(aa[k])!==Number(bb[k]))return null;
    let total=0,weight=0,matched=0;
    for(const k of keys){const sim=1-Math.abs(Number(aa[k])-Number(bb[k]))/3;total+=WEIGHTS[k]*Math.max(0,sim);weight+=WEIGHTS[k];if(Number(aa[k])===Number(bb[k]))matched++;}
    return {score:weight?Math.round(total/weight*100):0,matched,total:keys.length};
  }
  async function init(){
    if(!window.supabaseClient)return;
    const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return;
    const {data:me}=await supabaseClient.from('profiles').select('*').eq('id',user.id).maybeSingle();if(!me)return;
    const q=supabaseClient.from('profiles').select('*').neq('id',user.id);const {data:candidates}=me.city?await q.eq('city',me.city):await q;
    const scored=(candidates||[]).map(p=>({p,s:vibeScore(me,p)})).filter(x=>x.s).sort((a,b)=>b.s.score-a.s.score);
    const best=scored[0];
    const mount=document.getElementById('top-vibe-match');
    if(!mount)return;
    if(!best){mount.innerHTML='';return;}
    const p=best.p,s=best.s;
    const initials=(p.full_name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    const avatar=p.photo_url?`background-image:url('${String(p.photo_url).replace(/'/g,'%27')}')`:`background:${avatarColor(p.id)}`;
    mount.innerHTML=`<div class="top-vibe-card"><div class="top-vibe-copy"><div class="best-vibe-badge">🏆 Best vibe match</div><h3>${esc(p.full_name||'Unnamed')}</h3><p class="muted">${esc(p.preferred_area||p.city||'')} · ₹${p.budget_min||'?'}–₹${p.budget_max||'?'} / month</p><p>${esc((p.bio||'').slice(0,220))}</p><div class="top-vibe-stats"><strong>${s.score}% lifestyle vibe</strong><span>${s.matched}/${s.total} answers exactly aligned</span></div><div class="top-vibe-actions"><a class="btn btn-primary" href="public-profile.html?id=${encodeURIComponent(p.id)}">👤 View full profile</a><a class="btn btn-ghost" href="public-profile.html?id=${encodeURIComponent(p.id)}#merge">🤝 View & merge</a></div></div><div class="top-vibe-avatar" style="${avatar}">${p.photo_url?'':initials}</div></div>`;
  }
  function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
