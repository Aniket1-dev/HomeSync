document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('profile-root');
  const params = new URLSearchParams(location.search);
  const viewedId = params.get('id') || params.get('profile_id') || params.get('user_id');

  if (!viewedId) {
    root.innerHTML='<div class="card"><h3>Profile not found</h3><p class="muted">This profile link is missing a user ID.</p></div>';
    return;
  }

  // Show a useful state instead of leaving the page stuck forever if auth/network is slow.
  const failTimer = setTimeout(() => {
    if (root.querySelector('.profile-loading')) {
      root.innerHTML='<div class="card"><h3>Couldn’t load this profile</h3><p class="muted">Please refresh once. If it still fails, the profile may be private or unavailable.</p><a class="btn btn-primary" href="dashboard.html">Back to matches</a></div>';
    }
  }, 10000);

  root.innerHTML='<div class="card profile-loading"><p>Loading profile…</p></div>';

  try {
    if (!window.supabaseClient) throw new Error('Supabase client is not initialized.');

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!user) { location.href='login.html'; return; }
    if (user.id === viewedId) { location.href='profile.html'; return; }

    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id,full_name,age,gender,city,preferred_area,budget_min,budget_max,bio,photo_url,is_premium,premium_since,smoking_drinking,cooking_habits')
      .eq('id', viewedId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) throw new Error('This profile is not visible or no longer exists.');

    // IMPORTANT: Do not await analytics/notification writes before rendering.
    // A missing RLS policy/table must never leave the profile page stuck on Loading.
    Promise.resolve().then(async () => {
      try {
        await supabaseClient.from('profile_views').insert({ viewer_id:user.id, viewed_id:viewedId });
      } catch(e) { console.warn('profile_views tracking skipped:', e); }
    });

    Promise.resolve().then(async () => {
      try {
        // Do not send the old `data` column; some installations do not have it.
        await supabaseClient.from('notifications').insert({
          user_id:viewedId,
          type:'profile_view',
          title:'Someone viewed your profile',
          body:'A HomeSync member viewed your roommate profile.',
          link:'profile.html#notifications'
        });
      } catch(e) { console.warn('profile notification skipped:', e); }
    });

    const initials=(profile.full_name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    const avatar=profile.photo_url ? `background-image:url('${String(profile.photo_url).replace(/'/g,"%27")}')` : '';

    root.innerHTML=`
      <div class="card">
        <div class="profile-hero">
          <div class="public-avatar" style="${avatar}">${profile.photo_url?'':initials}</div>
          <div>
            <span class="eyebrow">Roommate profile</span>
            <h1 style="margin:4px 0 0">${esc(profile.full_name||'Unnamed')}</h1>
            <p class="muted" style="margin:6px 0">${esc([profile.age?profile.age+' years':'',profile.city||'',profile.preferred_area||''].filter(Boolean).join(' · '))}</p>
            <div class="profile-badges">
              ${profile.is_premium||profile.premium_since?'<span class="pill">⭐ Premium</span>':''}
              <span class="pill">🤝 Match profile</span>
            </div>
          </div>
          <div class="profile-action"><button class="btn btn-primary" id="merge-btn">🤝 Raise merge request</button></div>
        </div>
        <div class="privacy">🔒 <strong>Privacy protected.</strong> Exact address, phone number and private questionnaire answers are not shown on a public profile.</div>
      </div>
      <div class="profile-grid">
        <div class="card info-card"><h4>💰 Budget</h4><div>₹${profile.budget_min||'—'} – ₹${profile.budget_max||'—'} / month</div></div>
        <div class="card info-card"><h4>📍 Preferred area</h4><div>${esc(profile.preferred_area||profile.city||'Not specified')}</div></div>
        <div class="card info-card"><h4>🚭 Home habits</h4><div>${esc(profile.smoking_drinking||'Not specified')}</div></div>
        <div class="card info-card"><h4>🍳 Cooking</h4><div>${esc(profile.cooking_habits||'Not specified')}</div></div>
        <div class="card info-card" style="grid-column:1/-1"><h4>About</h4><p style="white-space:pre-wrap">${esc(profile.bio||'No bio added yet.')}</p></div>
      </div>`;

    document.getElementById('merge-btn').addEventListener('click', async () => {
      const btn=document.getElementById('merge-btn');
      btn.disabled=true; btn.textContent='Sending…';
      try {
        const { error } = await supabaseClient.rpc('create_roommate_merge_request',{p_target_user_id:viewedId});
        if(error) throw error;
        btn.textContent='✓ Request sent';
      } catch(error) {
        btn.disabled=false;
        btn.textContent='🤝 Raise merge request';
        alert(error.message || 'Could not send merge request.');
      }
    });
  } catch(error) {
    root.innerHTML=`<div class="card"><h3>Profile unavailable</h3><p class="muted">${esc(error?.message || 'Unable to load this profile.')}</p><a class="btn btn-primary" href="dashboard.html">← Back to matches</a></div>`;
  } finally {
    clearTimeout(failTimer);
  }
});

function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML;}
