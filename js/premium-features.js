/* HomeSync Premium discovery toolkit.
   Research-backed features: saved searches/alerts, profile views, boosts,
   advanced filters and contextual icebreakers. */
(() => {
  let me = null;
  let profile = null;

  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const isPremium = (p) => Boolean(p?.is_premium) || Boolean(p?.premium_since);

  async function init() {
    if (!window.supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    me = user;
    const { data } = await supabaseClient.from('profiles')
      .select('id,full_name,is_premium,premium_since,city,preferred_area')
      .eq('id', user.id).maybeSingle();
    profile = data;
    if (!isPremium(profile)) return;
    injectToolkit();
    await loadSavedSearches();
    await loadProfileViews();
    bindAdvancedFilters();
    injectIcebreakers();
  }

  function injectToolkit() {
    if (document.getElementById('hs-premium-toolkit')) return;
    const host = document.querySelector('.dash-layout');
    if (!host) return;
    const card = document.createElement('section');
    card.id = 'hs-premium-toolkit';
    card.className = 'card hs-premium-toolkit';
    card.innerHTML = `
      <div class="hs-toolkit-head">
        <div><span class="eyebrow">✨ Premium toolkit</span><h3>Search smarter, respond faster.</h3><p class="muted">Premium tools that reduce missed matches and help you understand demand.</p></div>
        <span class="hs-premium-live">ACTIVE</span>
      </div>
      <div class="hs-tool-grid">
        <div class="hs-tool-card"><div class="hs-tool-icon">🔎</div><h4>Saved searches</h4><p class="muted">Save your current filters and receive alerts for new matching profiles.</p><div id="hs-saved-searches"></div><button class="btn btn-primary hs-tool-btn" id="hs-save-search">Save current search</button></div>
        <div class="hs-tool-card"><div class="hs-tool-icon">👀</div><h4>Who viewed you</h4><p class="muted">See recent profile interest without exposing private location data.</p><div id="hs-profile-views" class="hs-view-count">Loading…</div><button class="btn btn-ghost hs-tool-btn" id="hs-refresh-views">Refresh</button></div>
        <div class="hs-tool-card"><div class="hs-tool-icon">🚀</div><h4>Profile boost</h4><p class="muted">Move your profile higher in eligible match rankings for 24 hours.</p><div id="hs-boost-status" class="hs-boost-status">Checking…</div><button class="btn btn-primary hs-tool-btn" id="hs-boost">Boost for 24 hours</button></div>
        <div class="hs-tool-card"><div class="hs-tool-icon">⚙️</div><h4>Advanced filters</h4><p class="muted">Tune the current match view beyond the basic city filter.</p><button class="btn btn-ghost hs-tool-btn" id="hs-advanced-toggle">Open advanced filters</button></div>
      </div>
      <div id="hs-advanced-panel" class="hs-advanced-panel hidden">
        <div class="hs-advanced-grid">
          <label>Max monthly budget<input id="hs-max-budget" type="number" min="0" placeholder="₹25,000"></label>
          <label>Minimum compatibility<input id="hs-min-score" type="number" min="0" max="100" placeholder="70"></label>
          <label>Move-in window<select id="hs-move-window"><option value="any">Any time</option><option value="30">Within 30 days</option><option value="60">Within 60 days</option><option value="90">Within 90 days</option></select></label>
          <label class="hs-check"><input id="hs-only-verified" type="checkbox"> Only verified profiles</label>
        </div>
        <button class="btn btn-primary" id="hs-apply-filters">Apply filters</button>
        <button class="btn btn-ghost" id="hs-clear-filters">Clear</button>
      </div>`;
    host.parentElement.insertBefore(card, host);
    document.getElementById('hs-save-search')?.addEventListener('click', saveCurrentSearch);
    document.getElementById('hs-refresh-views')?.addEventListener('click', loadProfileViews);
    document.getElementById('hs-boost')?.addEventListener('click', boostProfile);
    document.getElementById('hs-advanced-toggle')?.addEventListener('click', () => document.getElementById('hs-advanced-panel')?.classList.toggle('hidden'));
    document.getElementById('hs-apply-filters')?.addEventListener('click', applyFilters);
    document.getElementById('hs-clear-filters')?.addEventListener('click', clearFilters);
    checkBoostStatus();
  }

  function currentFilters() {
    return {
      scope: document.getElementById('city-scope-chip')?.dataset.scope || 'city',
      sort: document.querySelector('[data-sort].active')?.dataset.sort || 'score',
      maxBudget: Number(document.getElementById('hs-max-budget')?.value || 0),
      minScore: Number(document.getElementById('hs-min-score')?.value || 0),
      moveWindow: document.getElementById('hs-move-window')?.value || 'any',
      verified: Boolean(document.getElementById('hs-only-verified')?.checked)
    };
  }

  async function saveCurrentSearch() {
    const name = prompt('Name this search', `${profile?.city || 'Roommate'} search`);
    if (!name) return;
    const { error } = await supabaseClient.from('saved_searches').insert({ user_id: me.id, name, filters: currentFilters(), alerts_enabled: true });
    if (error) return toast('Could not save search.');
    toast('Search saved. You can turn alerts off anytime.');
    await loadSavedSearches();
  }

  async function loadSavedSearches() {
    const host = document.getElementById('hs-saved-searches'); if (!host) return;
    const { data } = await supabaseClient.from('saved_searches').select('id,name,alerts_enabled,updated_at').eq('user_id', me.id).order('updated_at', { ascending:false }).limit(4);
    host.innerHTML = (data || []).length ? data.map(s => `<div class="hs-saved-row"><span>${esc(s.name)}</span><button type="button" data-alert="${s.id}">${s.alerts_enabled ? '🔔 On' : '🔕 Off'}</button></div>`).join('') : '<div class="muted hs-empty">No saved searches yet.</div>';
    host.querySelectorAll('[data-alert]').forEach(btn => btn.addEventListener('click', async () => {
      const row = (data || []).find(x => x.id === btn.dataset.alert); if (!row) return;
      await supabaseClient.from('saved_searches').update({alerts_enabled: !row.alerts_enabled, updated_at:new Date().toISOString()}).eq('id', row.id).eq('user_id', me.id);
      loadSavedSearches();
    }));
  }

  async function loadProfileViews() {
    const host = document.getElementById('hs-profile-views'); if (!host) return;
    const { data, error } = await supabaseClient.from('profile_views').select('viewer_id,viewed_at').eq('viewed_id', me.id).order('viewed_at',{ascending:false}).limit(12);
    if (error) { host.textContent = 'View data unavailable'; return; }
    const ids = [...new Set((data || []).map(x => x.viewer_id).filter(Boolean))];
    if (!ids.length) { host.innerHTML = '<strong>0</strong><span class="muted"> recent profile views</span>'; return; }
    const { data: people } = await supabaseClient.from('profiles').select('id,full_name,city').in('id', ids);
    const byId = Object.fromEntries((people || []).map(p => [p.id,p]));
    host.innerHTML = `<strong>${ids.length}</strong><span class="muted"> recent profile viewers</span><div class="hs-viewers">${ids.slice(0,4).map(id => `<span>${esc(byId[id]?.full_name || 'HomeSync member')}</span>`).join('')}</div>`;
  }

  async function boostProfile() {
    const { data: active } = await supabaseClient.from('profile_boosts').select('id,expires_at').eq('user_id',me.id).eq('status','active').gt('expires_at',new Date().toISOString()).limit(1).maybeSingle();
    if (active) return toast('Your profile is already boosted.');
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();
    const { error } = await supabaseClient.from('profile_boosts').insert({user_id:me.id,expires_at:expires,status:'active'});
    if (error) return toast('Could not start boost.');
    await supabaseClient.from('premium_usage').upsert({user_id:me.id,boosts_used:1,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    toast('Profile boosted for 24 hours.');
    checkBoostStatus();
  }

  async function checkBoostStatus() {
    const host = document.getElementById('hs-boost-status'); if (!host) return;
    const { data } = await supabaseClient.from('profile_boosts').select('expires_at').eq('user_id',me.id).eq('status','active').gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(1).maybeSingle();
    host.textContent = data ? `Active until ${new Date(data.expires_at).toLocaleString()}` : 'Not boosted';
  }

  function bindAdvancedFilters() {
    const list = document.getElementById('match-list');
    if (!list) return;
    list.dataset.premiumFilters = 'ready';
  }

  function applyFilters() {
    const max = Number(document.getElementById('hs-max-budget')?.value || 0);
    const min = Number(document.getElementById('hs-min-score')?.value || 0);
    const verified = Boolean(document.getElementById('hs-only-verified')?.checked);
    document.querySelectorAll('.match-card').forEach(card => {
      const text = card.textContent || '';
      const scoreMatch = text.match(/(\d{2,3})%/);
      const score = scoreMatch ? Number(scoreMatch[1]) : 100;
      const budgetMatch = text.match(/₹\s?([\d,]+)/);
      const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g,'')) : 0;
      const isVerified = /verified|✓/i.test(text);
      const show = (!min || score >= min) && (!max || !budget || budget <= max) && (!verified || isVerified);
      card.style.display = show ? '' : 'none';
    });
    toast('Advanced filters applied to the current results.');
  }

  function clearFilters() {
    ['hs-max-budget','hs-min-score'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const verified=document.getElementById('hs-only-verified'); if(verified) verified.checked=false;
    document.querySelectorAll('.match-card').forEach(card => card.style.display='');
  }

  function injectIcebreakers() {
    if (!Array.isArray(window.rankedMatches)) return;
    document.querySelectorAll('.match-card').forEach(card => {
      if (card.querySelector('.hs-icebreaker')) return;
      const name = card.querySelector('.match-name')?.textContent?.trim(); if (!name) return;
      const match = window.rankedMatches.find(m => String(m.profile?.full_name || '').trim() === name); if (!match) return;
      const signals = [];
      const p = match.profile || {};
      if (p.city) signals.push(`their move to ${p.city}`);
      if (match.score) signals.push(`your ${Math.round(match.score)}% compatibility`);
      const prompt = `Hey ${name.split(' ')[0]}, I saw that we have ${signals.join(' and ')}. What are you looking for in a roommate?`;
      const host = card.querySelector('.contact-row') || card.lastElementChild;
      if (!host) return;
      const box = document.createElement('div'); box.className='hs-icebreaker'; box.innerHTML=`<span>💬 Premium icebreaker</span><button type="button" title="Copy message">Copy</button><p>${esc(prompt)}</p>`;
      box.querySelector('button').addEventListener('click', async()=>{try{await navigator.clipboard.writeText(prompt);toast('Icebreaker copied.');}catch{toast(prompt);}});
      host.parentElement?.appendChild(box);
    });
  }

  function toast(message) {
    let t=document.getElementById('hs-premium-toast');
    if(!t){t=document.createElement('div');t.id='hs-premium-toast';t.className='hs-premium-toast';document.body.appendChild(t);}
    t.textContent=message; t.classList.add('show'); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();