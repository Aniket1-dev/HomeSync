let premiumMe=null;
const $=id=>document.getElementById(id);

document.addEventListener('DOMContentLoaded', async()=>{
  const {data:{user}}=await supabaseClient.auth.getUser();
  if(!user){location.href='login.html';return;}
  const {data,error}=await supabaseClient.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error||!data){location.href='dashboard.html';return;}
  premiumMe=data;
  premiumMe.is_premium=data.is_premium===true||Boolean(data.premium_since);
  if(!premiumMe.is_premium){$('premium-status').textContent='Free plan';$('premium-status').style.color='var(--ink-soft)';$('gate').classList.remove('hidden');return;}
  $('premium-status').textContent='✨ Premium active';$('tools').classList.remove('hidden');document.querySelectorAll('.hub-section').forEach(x=>x.classList.remove('hidden'));
  await Promise.all([loadShortlist(),loadAlerts(),loadConcierge()]);
  $('logout-btn')?.addEventListener('click',async e=>{e.preventDefault();await supabaseClient.auth.signOut();location.href='login.html';});
  $('save-compare')?.addEventListener('click',saveComparison);$('save-plan')?.addEventListener('click',saveRelocation);$('save-alert')?.addEventListener('click',saveAlert);$('send-concierge')?.addEventListener('click',sendConcierge);
  const hash=location.hash;if(hash&&$(hash.slice(1)))setTimeout(()=>$(hash.slice(1)).scrollIntoView({behavior:'smooth'}),80);
});

async function saveComparison(){
  const ids=($('compare-ids').value||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,4);
  if(ids.length<2){return showCompare('Add at least 2 profile IDs.');}
  const {data,error}=await supabaseClient.from('profiles').select('id,full_name,city,preferred_area,budget_min,budget_max,move_in_date,is_verified,verification_status,sleep_schedule,cleanliness,guest_frequency,personality,smoking_drinking,cooking_habits,conflict_style').in('id',ids);
  if(error){return showCompare(error.message);}
  if((data||[]).length<2){return showCompare('I could not find enough valid profiles. Copy the ID from each public profile URL.');}
  const rows=data.map(p=>`<tr><th>${escapeHtml(p.full_name||'User')}</th><td>${escapeHtml(p.city||'—')}</td><td>₹${p.budget_min??'—'}–₹${p.budget_max??'—'}</td><td>${p.is_verified?'✓ Verified':'Not verified'}</td><td>${p.sleep_schedule??'—'}</td><td>${p.cleanliness??'—'}</td><td>${p.guest_frequency??'—'}</td><td>${p.personality??'—'}</td></tr>`).join('');
  $('compare-result').classList.remove('empty');$('compare-result').innerHTML=`<table class="compare-table"><thead><tr><th>Person</th><th>City</th><th>Budget</th><th>Trust</th><th>Sleep</th><th>Clean</th><th>Guests</th><th>Social</th></tr></thead><tbody>${rows}</tbody></table>`;
  const {error:saveError}=await supabaseClient.from('premium_comparisons').insert({user_id:premiumMe.id,title:$('compare-title').value||'My comparison',member_ids:data.map(p=>p.id)});
  if(saveError)console.warn(saveError.message);
}
function showCompare(text){$('compare-result').classList.add('empty');$('compare-result').textContent=text;}

async function saveRelocation(){
  const checklist=[...document.querySelectorAll('#plan-checklist input:checked')].map(x=>x.dataset.item);
  const payload={user_id:premiumMe.id,destination_city:$('plan-city').value.trim(),destination_area:$('plan-area').value.trim()||null,target_move_date:$('plan-date').value||null,budget_min:num('plan-min'),budget_max:num('plan-max'),commute_destination:$('plan-commute').value.trim()||null,commute_mode:$('plan-mode').value.trim()||null,notes:$('plan-notes').value.trim()||null,checklist};
  if(!payload.destination_city){alert('Enter a destination city first.');return;}
  const {error}=await supabaseClient.from('relocation_plans').insert(payload);
  if(error){alert(error.message);return;}alert('Relocation plan saved.');
}

async function saveAlert(){
  const filters={city:$('alert-city').value.trim()||premiumMe.city||null,min_compatibility:Number($('alert-score').value||80),verified_only:$('alert-verified').value==='true',premium_early_access:true};
  const {error}=await supabaseClient.from('saved_searches').insert({user_id:premiumMe.id,name:$('alert-name').value.trim()||'Premium match alert',filters,alerts_enabled:$('alert-enabled').checked});
  if(error){alert(error.message);return;}await loadAlerts();alert('Alert saved.');
}
async function loadAlerts(){const box=$('alert-list');if(!box)return;const {data,error}=await supabaseClient.from('saved_searches').select('*').eq('user_id',premiumMe.id).order('created_at',{ascending:false}).limit(10);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(x=>`<div class="saved-item"><strong>🔔 ${escapeHtml(x.name)}</strong><small>${x.alerts_enabled?'Alerts on':'Alerts paused'} · ${escapeHtml(x.filters?.city||'Any city')} · ${x.filters?.min_compatibility||80}%+ compatibility</small></div>`).join('')||'<div class="saved-item">No saved alerts yet.</div>';}

async function loadShortlist(){const box=$('shortlist-list');if(!box)return;const {data,error}=await supabaseClient.from('premium_shortlists').select('id,target_user_id,note,created_at').eq('user_id',premiumMe.id).order('created_at',{ascending:false}).limit(20);if(error){box.textContent=error.message;return;}if(!data?.length){box.textContent='No shortlisted people yet. Add one from a profile.';return;}const ids=data.map(x=>x.target_user_id).filter(Boolean);const {data:profiles}=await supabaseClient.from('profiles').select('id,full_name,city,preferred_area,budget_min,budget_max').in('id',ids);const byId=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));box.innerHTML=data.map(x=>{const p=byId[x.target_user_id]||{};return `<div class="saved-item"><strong>🔖 ${escapeHtml(p.full_name||'Saved profile')}</strong><small>${escapeHtml(p.city||'')} · ₹${p.budget_min??'—'}–₹${p.budget_max??'—'}${x.note?' · '+escapeHtml(x.note):''}</small></div>`}).join('');}

async function loadConcierge(){const box=$('concierge-list');if(!box)return;const {data,error}=await supabaseClient.from('premium_concierge_requests').select('id,category,subject,status,created_at').eq('user_id',premiumMe.id).order('created_at',{ascending:false}).limit(10);if(error){box.textContent=error.message;return;}box.innerHTML=(data||[]).map(x=>`<div class="saved-item"><strong>${escapeHtml(x.subject)}</strong><small>${escapeHtml(x.category)} · ${escapeHtml(x.status)} · ${new Date(x.created_at).toLocaleDateString()}</small></div>`).join('')||'<div class="saved-item">No concierge requests yet.</div>';}
async function sendConcierge(){const subject=$('concierge-subject').value.trim(),message=$('concierge-message').value.trim();if(!subject||!message){alert('Add a subject and message.');return;}const {error}=await supabaseClient.from('premium_concierge_requests').insert({user_id:premiumMe.id,category:$('concierge-category').value,subject,message});if(error){alert(error.message);return;}$('concierge-subject').value='';$('concierge-message').value='';await loadConcierge();alert('Request created.');}
function num(id){const v=Number($(id).value);return Number.isFinite(v)&&v>0?v:null;}function escapeHtml(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML;}
