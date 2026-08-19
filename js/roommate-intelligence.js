/* HomeSync roommate intelligence: directions, room verification, area costs and local amenities. */
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`;

  async function geocode(query) {
    if (!query) return null;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {headers:{'Accept-Language':'en'}});
      const d = await r.json();
      if (!d?.[0]) return null;
      return {lat:Number(d[0].lat), lon:Number(d[0].lon), display:d[0].display_name};
    } catch { return null; }
  }

  function directionsUrl(lat, lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}&travelmode=driving`;
  }

  function injectStyles() {
    if (document.getElementById('hs-intel-styles')) return;
    const s = document.createElement('style'); s.id='hs-intel-styles';
    s.textContent = `
      .hs-intel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:22px 0}
      .hs-intel-card{border:1px solid var(--line);border-radius:18px;padding:18px;background:var(--canvas-raised);color:var(--ink);box-shadow:var(--shadow-card)}
      .hs-intel-card h4{margin:0 0 6px;font-size:1.05rem;color:var(--ink)}
      .hs-intel-card p,.hs-intel-muted{color:var(--ink-soft);font-size:.9rem}
      .hs-verify-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-size:.78rem;font-weight:700;background:rgba(249,115,22,.16);color:#fdba74}
      .hs-verify-status.verified{background:rgba(16,185,129,.16);color:#6ee7b7}
      .hs-verify-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
      .hs-verify-item{font-size:.84rem;color:var(--ink-soft)}.hs-verify-item.ok{color:var(--plum)}.hs-verify-item.no{color:var(--ink-soft)}
      .hs-area-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.hs-area-stat{padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--canvas)}.hs-area-stat b{display:block;font-size:1rem;color:var(--ink)}
      .hs-cost-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:8px 0;color:var(--ink)}.hs-cost-row input{width:90px;padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--input-bg);color:var(--input-text)}
      .hs-directions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.hs-directions a{font-size:.86rem}.hs-safety{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--sage-soft);color:var(--ink-soft);font-size:.83rem}
      .hs-match-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.hs-match-tools button{cursor:pointer}
      .hs-intel-card .btn-ghost{color:var(--ink);border-color:var(--line);background:transparent}
      .hs-intel-card .btn-ghost:hover{background:var(--canvas)}
      @media(max-width:760px){.hs-intel-grid{grid-template-columns:1fr}.hs-verify-list,.hs-area-stats{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  async function getListing(profileId) {
    const {data} = await supabaseClient.from('room_listings').select('*').eq('owner_id',profileId).eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    return data || null;
  }

  async function getVerification(listingId) {
    if (!listingId) return null;
    const {data} = await supabaseClient.from('room_verifications').select('*').eq('listing_id',listingId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    return data || null;
  }

  async function renderRoomIntelligence(match) {
    const {profile} = match;
    const grid = document.getElementById('hs-room-intelligence');
    if (!grid) return;
    grid.innerHTML = '<div class="hs-intel-card"><strong>Loading room intelligence…</strong><p class="hs-intel-muted">Checking listing, verification and area signals.</p></div>';
    const listing = await getListing(profile.id);
    const verification = await getVerification(listing?.id);
    const place = await geocode([profile.preferred_area,profile.city].filter(Boolean).join(', '));
    const query = [profile.preferred_area,profile.city].filter(Boolean).join(', ');
    let insight = null;
    if (profile.preferred_area || profile.city) {
      const {data} = await supabaseClient.from('area_insights').select('*').eq('city',profile.city || '').eq('area',profile.preferred_area || '').maybeSingle();
      insight = data || null;
    }
    grid.innerHTML = '';
    grid.appendChild(roomCard(profile,listing,verification,place));
    grid.appendChild(areaCard(profile,listing,insight,query));
  }

  function roomCard(profile,listing,v,place) {
    const c=document.createElement('div'); c.className='hs-intel-card';
    const verified=v?.status==='verified';
    const checks=[['Room condition',!!v?.room_condition],['Electricity meter',!!v?.electricity_meter_checked],['Water supply',!!v?.water_checked],['Washroom',!!v?.washroom_checked],['Locks/security',!!v?.locks_checked],['Network',!!v?.network_checked],['Owner identity',!!v?.owner_identity_checked]];
    const dir=place?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${directionsUrl(place.lat,place.lon)}">🧭 Get directions in Google Maps</a>`:'';
    c.innerHTML=`<h4>🏠 Room & safety verification</h4><div class="hs-verify-status ${verified?'verified':''}">${verified?'✓ Verified room':'⚠ Not verified'}</div><p class="hs-intel-muted">${verified?'Verification completed by HomeSync. Check the verification date and evidence before visiting.':'Do not treat an unverified listing as confirmed. Ask for a visit and original documents before paying.'}</p>${listing?`<div class="hs-area-stats"><div class="hs-area-stat"><span class="hs-intel-muted">Rent</span><b>${money(listing.monthly_rent)}</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Deposit</span><b>${money(listing.security_deposit)}</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Maintenance</span><b>${money(listing.maintenance)}</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Electricity</span><b>${listing.electricity_included?'Included':money(listing.electricity_rate)+'/unit'}</b></div></div>`:''}<div class="hs-verify-list">${checks.map(x=>`<div class="hs-verify-item ${x[1]?'ok':'no'}">${x[1]?'✓':'○'} ${esc(x[0])}</div>`).join('')}</div>${v?.notes?`<div class="hs-safety">Verification note: ${esc(v.notes)}</div>`:''}<div class="hs-directions">${dir}<button class="btn btn-ghost hs-report-btn" type="button">Report this listing</button></div>`;
    c.querySelector('.hs-report-btn').addEventListener('click',()=>reportListing(profile,listing));
    return c;
  }

  function areaCard(profile,listing,insight,query) {
    const c=document.createElement('div'); c.className='hs-intel-card';
    const avgPower=insight?.avg_monthly_electricity ?? 1800;
    const rate=listing?.electricity_rate ?? insight?.electricity_rate_max ?? 8;
    const water=listing?.water_included ? 0 : (insight?.water_monthly ?? 500);
    const internet=listing?.internet_included ? 0 : (insight?.internet_monthly ?? 700);
    c.innerHTML=`<h4>📊 Area intelligence</h4><p class="hs-intel-muted">${esc(query||'Your preferred area')} · Costs shown as estimates unless sourced below.</p><div class="hs-area-stats"><div class="hs-area-stat"><span class="hs-intel-muted">Typical rent</span><b>${insight?money(insight.avg_rent_min)+'–'+money(insight.avg_rent_max):'Not available yet'}</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Electricity rate</span><b>${money(rate)}/unit</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Water / month</span><b>${money(water)}</b></div><div class="hs-area-stat"><span class="hs-intel-muted">Internet / month</span><b>${money(internet)}</b></div></div><div style="margin-top:14px"><strong>Monthly electricity estimator</strong><div class="hs-cost-row"><span class="hs-intel-muted">Units used</span><input id="hs-units" type="number" min="0" value="${Math.round(avgPower/rate)}"></div><div class="hs-cost-row"><span>Estimated electricity</span><strong id="hs-electricity-total">${money(Math.round(avgPower/rate)*rate)}</strong></div><div class="hs-cost-row"><span>Total recurring estimate</span><strong id="hs-total-cost">—</strong></div></div><div id="hs-amenities" class="hs-safety">Checking nearby metro, railway and airport…</div>${insight?.source?`<p class="hs-intel-muted" style="margin-top:10px">Source: ${esc(insight.source)}${insight.as_of?' · '+esc(insight.as_of):''}</p>`:'<p class="hs-intel-muted" style="margin-top:10px">No curated tariff record exists for this area. Electricity and recurring costs are estimates, not a guaranteed bill.</p>'}`;
    const units=c.querySelector('#hs-units'); const update=()=>{const electricity=Math.round(Number(units.value||0)*rate);c.querySelector('#hs-electricity-total').textContent=money(electricity);c.querySelector('#hs-total-cost').textContent=money((listing?.monthly_rent||0)+(listing?.maintenance||0)+electricity+water+internet);}; units.addEventListener('input',update); update();
    loadAmenities(query,c.querySelector('#hs-amenities'));
    return c;
  }

  async function loadAmenities(query,el) {
    if (!query) {el.textContent='Add a city/area to see nearby transport signals.';return;}
    const found=[];
    for (const [label,search] of [['Metro','metro station'],['Railway','railway station'],['Airport','airport']]) {
      const r=await geocode(search+', '+query); if(r) found.push({label,name:r.display,lat:r.lat,lon:r.lon});
    }
    if (!found.length){el.textContent='No nearby transport result found from OpenStreetMap.';return;}
    el.innerHTML='<strong>Nearby transport</strong><br>'+found.map(x=>`<div style="margin-top:6px">${x.label}: ${esc(x.name.split(',').slice(0,2).join(','))} · <a target="_blank" rel="noopener" href="${directionsUrl(x.lat,x.lon)}">Directions</a></div>`).join('');
  }

  async function reportListing(profile,listing) {
    const reason=prompt('Why are you reporting this listing? (fake listing, wrong price, unsafe room, scam, other)'); if(!reason) return;
    const details=prompt('Add details (optional):')||'';
    const {data:{user}}=await supabaseClient.auth.getUser(); if(!user) return;
    const {error}=await supabaseClient.from('room_reports').insert({reporter_id:user.id,listing_id:listing?.id||null,reported_user_id:profile.id,reason,details});
    alert(error?'Could not submit report. Please try again.':'Report submitted. Please do not send money until the listing is reviewed.');
  }

  function addMatchTools(card) {
    if (card.querySelector('.hs-match-tools')) return;
    const key=card.querySelector('[id^="icebreaker-"]')?.id?.replace('icebreaker-','');
    if (!key || typeof rankedMatches === 'undefined') return;
    const match=rankedMatches.find(m=>m.profile?.id===key); if(!match) return;
    const info=card.querySelector(':scope > div:nth-child(2)'); if(!info) return;
    const tools=document.createElement('div'); tools.className='hs-match-tools';
    tools.innerHTML='<button type="button" class="btn-contact hs-details-btn">🏠 Room & area details</button>';
    tools.querySelector('.hs-details-btn').addEventListener('click',()=>{
      renderRoomIntelligence(match);
      document.getElementById('hs-room-intelligence')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    info.appendChild(tools);
  }

  function observeMatches() {
    const list=document.getElementById('match-list'); if(!list) return;
    const scan=()=>list.querySelectorAll('.match-card').forEach(addMatchTools);
    scan();
    new MutationObserver(scan).observe(list,{childList:true,subtree:true});
  }

  function init() {
    injectStyles();
    const list=document.getElementById('match-list'); if(!list) return;
    const grid=document.createElement('div'); grid.id='hs-room-intelligence'; grid.className='hs-intel-grid';
    list.parentElement.insertBefore(grid,list);
    observeMatches();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();