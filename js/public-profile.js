document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('profile-root');
  const params = new URLSearchParams(location.search);
  const viewedId = params.get('id');
  if (!viewedId) { root.innerHTML='<div class="card"><p>Profile not found.</p></div>'; return; }

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { location.href='login.html'; return; }
  if (user.id === viewedId) { location.href='profile.html'; return; }

  const { data: profile, error } = await supabaseClient.from('profiles').select('id,full_name,age,gender,city,preferred_area,budget_min,budget_max,bio,photo_url,is_premium,premium_since,smoking_drinking,cooking_habits').eq('id', viewedId).maybeSingle();
  if (error || !profile) { root.innerHTML='<div class="card"><h3>Profile unavailable</h3><p class="muted">This profile may have been removed or is not visible.</p></div>'; return; }

  // Record a view without exposing exact location or private contact fields.
  await supabaseClient.from('profile_views').insert({ viewer_id:user.id, viewed_id:viewedId }).catch(()=>{});
  try { await supabaseClient.from('notifications').insert({ user_id:viewedId, type:'profile_view', title:'Someone viewed your profile', body:`${user.email ? 'A HomeSync member' : 'Someone'} viewed your roommate profile.`, link:'profile.html#notifications', data:{viewer_id:user.id} }); } catch(e) {}

  const initials=(profile.full_name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const avatar=profile.photo_url ? `background-image:url('${String(profile.photo_url).replace(/'/g,"%27")}')` : '';
  root.innerHTML=`<div class="card"><div class="profile-hero"><div class="public-avatar" style="${avatar}">${profile.photo_url?'':initials}</div><div><span class="eyebrow">Roommate profile</span><h1 style="margin:4px 0 0">${esc(profile.full_name||'Unnamed')}</h1><p class="muted" style="margin:6px 0">${esc([profile.age?profile.age+' years':'',profile.city||'',profile.preferred_area||''].filter(Boolean).join(' · '))}</p><div class="profile-badges">${profile.is_premium||profile.premium_since?'<span class="pill">⭐ Premium</span>':''}<span class="pill">🤝 Match profile</span></div></div><div class="profile-action"><button class="btn btn-primary" id="merge-btn">🤝 Raise merge request</button></div></div><div class="privacy">🔒 <strong>Privacy protected.</strong> Exact address, phone number and private questionnaire answers are not shown on a public profile.</div></div><div class="profile-grid"><div class="card info-card"><h4>💰 Budget</h4><div>₹${profile.budget_min||'—'} – ₹${profile.budget_max||'—'} / month</div></div><div class="card info-card"><h4>📍 Preferred area</h4><div>${esc(profile.preferred_area||profile.city||'Not specified')}</div></div><div class="card info-card"><h4>🚭 Home habits</h4><div>${esc(profile.smoking_drinking||'Not specified')}</div></div><div class="card info-card"><h4>🍳 Cooking</h4><div>${esc(profile.cooking_habits||'Not specified')}</div></div><div class="card info-card" style="grid-column:1/-1"><h4>About</h4><p style="white-space:pre-wrap">${esc(profile.bio||'No bio added yet.')}</p></div></div>`;

  document.getElementById('merge-btn').addEventListener('click', async () => {
    const btn=document.getElementById('merge-btn'); btn.disabled=true; btn.textContent='Sending…';
    const { error } = await supabaseClient.rpc('create_roommate_merge_request',{p_target_user_id:viewedId});
    if(error){ btn.disabled=false; btn.textContent='🤝 Raise merge request'; alert(error.message); return; }
    btn.textContent='✓ Request sent';
  });
});
function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML;}
