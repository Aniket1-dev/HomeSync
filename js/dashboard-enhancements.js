/* HomeSync dashboard enhancements: authoritative premium state, account pill, map. */
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = (name) => (String(name || 'U').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'U');

  async function init() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    const { data: profile, error } = await supabaseClient.from('profiles').select('id,full_name,photo_url,is_premium,premium_since,city,preferred_area').eq('id', user.id).maybeSingle();
    if (error || !profile) return;

    // Treat a recorded premium activation as Premium too. This keeps the UI correct
    // if an older row has premium_since set but is_premium was not synchronized.
    profile.is_premium = profile.is_premium === true || Boolean(profile.premium_since);

    // Reconcile the banner from a fresh database read. Never show an upgrade CTA to Premium users.
    const banner = document.getElementById('premium-banner');
    if (banner && profile.is_premium) {
      banner.classList.add('is-premium','hs-premium-hide');
      banner.setAttribute('aria-hidden','true');
    } else if (banner) {
      banner.classList.remove('hs-premium-hide');
    }

    renderAccountPill(profile);
    renderMapShell();
    loadMap(profile, user.id);
  }

  function renderAccountPill(profile) {
    if (document.getElementById('hs-account-pill')) return;
    const a = document.createElement('a');
    a.id = 'hs-account-pill';
    a.className = 'hs-account-pill';
    a.href = 'profile.html';
    const avatar = profile.photo_url ? `<img src="${esc(profile.photo_url)}" alt="">` : esc(initials(profile.full_name));
    const plan = profile.is_premium ? '⭐ Premium' : 'Free plan';
    a.innerHTML = `<span class="hs-account-avatar">${avatar}</span><span class="hs-account-meta"><span class="hs-account-name">${esc(profile.full_name || 'Your account')}</span><span class="hs-account-plan ${profile.is_premium ? 'premium' : ''}">${plan}</span></span>`;
    document.body.appendChild(a);
  }

  function renderMapShell() {
    if (document.getElementById('hs-match-map-card') || !document.getElementById('match-list')) return;
    const card = document.createElement('div');
    card.id = 'hs-match-map-card';
    card.className = 'card hs-map-card';
    card.innerHTML = `<div class="hs-map-head"><div><div class="hs-map-title">📍 Roommate map</div><div class="hs-map-sub">See where compatible profiles are located.</div></div><span class="eyebrow" style="margin:0">Location view</span></div><div id="hs-match-map" class="hs-map"></div><div class="hs-map-legend">Approximate locations only — HomeSync never exposes a user's exact address.</div>`;
    const heading = document.querySelector('.section-heading-row');
    heading?.parentElement?.insertBefore(card, heading);
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function geocode(query) {
    if (!query) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data?.[0]) return null;
      return [Number(data[0].lat), Number(data[0].lon)];
    } catch { return null; }
  }

  async function loadMap(me, userId) {
    const el = document.getElementById('hs-match-map');
    if (!el) return;
    try { await loadLeaflet(); } catch { el.innerHTML = '<div style="padding:24px;color:var(--ink-soft)">Map could not be loaded right now.</div>'; return; }

    const { data: profiles } = await supabaseClient.from('profiles').select('id,full_name,city,preferred_area,is_premium,premium_since').neq('id', userId).limit(30);
    const points = [];
    const mePoint = await geocode([me.preferred_area, me.city].filter(Boolean).join(', '));
    if (mePoint) points.push({ coords: mePoint, name: 'You', own: true });

    const seen = new Set();
    for (const p of (profiles || [])) {
      const query = [p.preferred_area, p.city].filter(Boolean).join(', ');
      if (!query || seen.has(query.toLowerCase())) continue;
      seen.add(query.toLowerCase());
      const coords = await geocode(query);
      if (coords) points.push({ coords, name: p.full_name || 'Roommate match', premium: p.is_premium === true || Boolean(p.premium_since) });
      if (points.length >= 12) break;
    }

    const map = L.map(el, { scrollWheelZoom: false }).setView(mePoint || [20.5937,78.9629], mePoint ? 12 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const bounds = [];
    points.forEach(point => {
      const marker = L.marker(point.coords).addTo(map);
      marker.bindPopup(`<strong>${esc(point.name)}</strong>${point.own ? '<br>You are here' : point.premium ? '<br>⭐ Premium profile' : ''}`);
      bounds.push(point.coords);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30,30], maxZoom: 13 });
    setTimeout(() => map.invalidateSize(), 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();