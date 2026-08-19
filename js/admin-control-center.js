/* HomeSync Admin Control Center
 * Adds an operational layer to the existing admin portal without replacing it.
 * Sensitive platform metrics come from the admin-only Supabase RPC.
 */
(() => {
  const esc = (v) => { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; };
  const fmt = (v) => Number(v || 0).toLocaleString();

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 250);
  });

  async function init() {
    const app = document.getElementById('admin-app');
    if (!app) return;
    const nav = document.querySelector('.admin-sidebar');
    if (!nav || document.querySelector('[data-panel-link="control"]')) return;

    const link = document.createElement('a');
    link.href = '#control'; link.className = 'admin-nav-link';
    link.dataset.panelLink = 'control'; link.innerHTML = '🛡️ Trust & Operations';
    const settings = nav.querySelector('[data-panel-link="settings"]');
    nav.insertBefore(link, settings || nav.lastElementChild);

    const panel = document.createElement('div');
    panel.className = 'admin-panel'; panel.dataset.panel = 'control';
    panel.innerHTML = `
      <div class="ops-hero">
        <div><span class="eyebrow">Trust & Safety command center</span><h2>Keep HomeSync healthy.</h2><p class="muted">Monitor the signals that matter: safety, verification, rooms, visits, conversations and user trust.</p></div>
        <button class="btn btn-primary" id="ops-refresh">↻ Refresh data</button>
      </div>
      <div class="ops-alert-grid" id="ops-alerts"></div>
      <div class="ops-kpi-grid" id="ops-kpis"></div>
      <div class="ops-two-col">
        <section class="card ops-section"><div class="ops-section-head"><div><h3>Safety queue</h3><p class="muted">Items that need human attention.</p></div><span class="ops-live">● LIVE</span></div><div id="ops-safety-list"></div></section>
        <section class="card ops-section"><div class="ops-section-head"><div><h3>Trust pipeline</h3><p class="muted">Verification and room activity.</p></div></div><div id="ops-trust-list"></div></section>
      </div>
      <section class="card ops-section"><div class="ops-section-head"><div><h3>Admin operating rules</h3><p class="muted">Recommended controls for a trust-first roommate marketplace.</p></div></div>
        <div class="ops-rules"><div>🔐 <strong>Never expose exact addresses publicly.</strong><span>Use exact coordinates only inside consent-based visits.</span></div><div>💳 <strong>Never treat payment as proof of a legitimate room.</strong><span>Escalate suspicious advance-payment requests.</span></div><div>🪪 <strong>Separate identity verification from room verification.</strong><span>A verified person does not make an unverified listing safe.</span></div><div>🚨 <strong>Resolve safety reports before growth metrics.</strong><span>Trust incidents are operationally higher priority than acquisition.</span></div><div>🧠 <strong>Never sell compatibility as certainty.</strong><span>Show match signals and dealbreakers transparently.</span></div></div>
      </section>`;
    document.querySelector('.admin-main').appendChild(panel);

    link.addEventListener('click', e => { e.preventDefault(); activate(); });
    document.getElementById('ops-refresh').addEventListener('click', load);
    load();
  }

  function activate() {
    document.querySelectorAll('.admin-nav-link[data-panel-link]').forEach(x => x.classList.remove('active'));
    document.querySelector('[data-panel-link="control"]')?.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(x => x.classList.toggle('active', x.dataset.panel === 'control'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function load() {
    const kpis = document.getElementById('ops-kpis');
    if (!kpis) return;
    kpis.innerHTML = '<div class="card ops-kpi"><span>Loading</span><strong>…</strong></div>'.repeat(6);
    const { data, error } = await supabaseClient.rpc('admin_platform_snapshot');
    if (error) {
      kpis.innerHTML = `<div class="card ops-error"><strong>Control center unavailable</strong><span>${esc(error.message)}</span><small>Make sure your signed-in account has admin access.</small></div>`;
      return;
    }
    render(data || {});
  }

  function render(d) {
    const kpis = [
      ['👥','Users',d.users], ['✨','Premium',d.premium_users], ['👀','Profile views / 30d',d.profile_views_30d],
      ['💬','Active chats',d.active_conversations], ['🏠','Active rooms',d.active_rooms], ['🤝','Agreements',d.active_agreements]
    ];
    document.getElementById('ops-kpis').innerHTML = kpis.map(([i,l,v]) => `<div class="card ops-kpi"><span class="ops-icon">${i}</span><strong>${fmt(v)}</strong><span>${l}</span></div>`).join('');
    const safety = [['🚨','Open safety reports',d.open_reports,'admin-reports.html'],['🪪','Pending verification',d.verification_pending,'admin-verifications.html'],['🧭','Active safe visits',d.active_safe_visits,'safe-visit.html']];
    document.getElementById('ops-safety-list').innerHTML = safety.map(([i,l,v,u]) => `<a class="ops-row" href="${u}"><span>${i}</span><b>${fmt(v)}</b><span>${l}</span><em>Open →</em></a>`).join('');
    const trust = [['🏙️','Cities covered',d.cities],['👤','Suspended users',d.suspended_users],['🗺️','Safe visits total',d.safe_visits],['📋','Agreements total',d.agreements]];
    document.getElementById('ops-trust-list').innerHTML = trust.map(([i,l,v]) => `<div class="ops-row"><span>${i}</span><b>${fmt(v)}</b><span>${l}</span></div>`).join('');
    const alerts=[];
    if(Number(d.open_reports)>0) alerts.push(['critical','🚨','Safety queue requires review',`${fmt(d.open_reports)} report${Number(d.open_reports)===1?'':'s'} open.`]);
    if(Number(d.verification_pending)>0) alerts.push(['warning','🪪','Verification backlog',`${fmt(d.verification_pending)} verification request${Number(d.verification_pending)===1?'':'s'} pending.`]);
    if(!alerts.length) alerts.push(['good','✓','No urgent trust backlog','Safety and verification queues are clear right now.']);
    document.getElementById('ops-alerts').innerHTML=alerts.map(([c,i,t,s])=>`<div class="ops-alert ${c}"><span>${i}</span><div><strong>${t}</strong><small>${s}</small></div></div>`).join('');
  }
})();