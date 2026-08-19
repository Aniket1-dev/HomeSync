/* HomeSync Admin Control Center */
(() => {
  const esc = v => { const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; };
  const fmt = v => Number(v||0).toLocaleString();

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 250));

  function init() {
    const app=document.getElementById('admin-app');
    const nav=document.querySelector('.admin-sidebar');
    if(!app || !nav || document.querySelector('[data-panel-link="control"]')) return;

    const link=document.createElement('a');
    link.href='#control'; link.className='admin-nav-link'; link.dataset.panelLink='control';
    link.textContent='🛡️ Trust & Operations';
    const settings=nav.querySelector('[data-panel-link="settings"]');
    nav.insertBefore(link, settings || nav.lastElementChild);

    const panel=document.createElement('div');
    panel.className='admin-panel'; panel.dataset.panel='control';
    panel.innerHTML=`
      <div class="ops-hero"><div><span class="eyebrow">Trust & Safety command center</span><h2>Keep HomeSync healthy.</h2><p class="muted">Monitor the signals that matter: safety, verification, rooms, visits, conversations and user trust.</p></div><button class="btn btn-primary" id="ops-refresh">↻ Refresh data</button></div>
      <div class="ops-alert-grid" id="ops-alerts"></div>
      <div class="ops-kpi-grid" id="ops-kpis"></div>
      <div class="ops-two-col">
        <section class="card ops-section"><div class="ops-section-head"><div><h3>Safety queue</h3><p class="muted">Items that need human attention.</p></div><span class="ops-live">● LIVE</span></div><div id="ops-safety-list"></div></section>
        <section class="card ops-section"><div class="ops-section-head"><div><h3>Trust pipeline</h3><p class="muted">Verification and room activity.</p></div></div><div id="ops-trust-list"></div></section>
      </div>
      <section class="card ops-section"><div class="ops-section-head"><div><h3>Admin operating rules</h3><p class="muted">Recommended controls for a trust-first roommate marketplace.</p></div></div><div class="ops-rules"><div>🔐 <strong>Never expose exact addresses publicly.</strong><span>Use exact coordinates only inside consent-based visits.</span></div><div>💳 <strong>Never treat payment as proof of a legitimate room.</strong><span>Escalate suspicious advance-payment requests.</span></div><div>🪪 <strong>Separate identity verification from room verification.</strong><span>A verified person does not make an unverified listing safe.</span></div><div>🚨 <strong>Resolve safety reports before growth metrics.</strong><span>Trust incidents are operationally higher priority than acquisition.</span></div><div>🧠 <strong>Never sell compatibility as certainty.</strong><span>Show match signals and dealbreakers transparently.</span></div></div></section>`;
    document.querySelector('.admin-main').appendChild(panel);

    link.onclick=e=>{e.preventDefault();activate();};
    document.getElementById('ops-refresh').onclick=load;
    load();
    setInterval(load,15000);
  }

  function activate(){
    document.querySelectorAll('.admin-nav-link[data-panel-link]').forEach(x=>x.classList.remove('active'));
    document.querySelector('[data-panel-link="control"]')?.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel==='control'));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function load(){
    const kpis=document.getElementById('ops-kpis');
    if(!kpis || typeof supabaseClient==='undefined') return;
    kpis.innerHTML='<div class="card ops-kpi"><span>Loading</span><strong>…</strong></div>'.repeat(6);

    const [snapshotResult,queueResult]=await Promise.all([
      supabaseClient.rpc('admin_platform_snapshot'),
      supabaseClient.rpc('admin_attention_queue')
    ]);

    if(snapshotResult.error){
      showError(snapshotResult.error.message);
      return;
    }
    if(queueResult.error){
      showError(queueResult.error.message);
      return;
    }

    render(snapshotResult.data||{}, queueResult.data||{});
  }

  function showError(message){
    document.getElementById('ops-alerts').innerHTML=`<div class="ops-alert critical"><span>⚠️</span><div><strong>Queue error</strong><small>${esc(message)}</small></div></div>`;
    document.getElementById('ops-safety-list').innerHTML='<div class="ops-error">Unable to load live safety queue.</div>';
  }

  function render(d,q){
    const kpis=[['👥','Users',d.users],['✨','Premium',d.premium_users],['👀','Profile views / 30d',d.profile_views_30d],['💬','Active chats',d.active_conversations],['🏠','Active rooms',d.active_rooms],['🤝','Agreements',d.active_agreements]];
    document.getElementById('ops-kpis').innerHTML=kpis.map(([i,l,v])=>`<div class="card ops-kpi"><span class="ops-icon">${i}</span><strong>${fmt(v)}</strong><span>${l}</span></div>`).join('');

    const safety=[['🚨','Open safety reports',q.open_reports,'admin-reports.html'],['🪪','Pending verification',q.pending_verification,'admin-kyc.html'],['🧭','Active safe visits',q.active_safe_visits,'safe-visit.html']];
    document.getElementById('ops-safety-list').innerHTML=safety.map(([i,l,v,u])=>`<a class="ops-row" href="${u}"><span>${i}</span><b>${fmt(v)}</b><span>${l}</span><em>Open →</em></a>`).join('');

    const trust=[['🏙️','Cities covered',d.cities],['👤','Suspended users',d.suspended_users],['🗺️','Safe visits total',d.safe_visits],['📋','Agreements total',d.agreements]];
    document.getElementById('ops-trust-list').innerHTML=trust.map(([i,l,v])=>`<div class="ops-row"><span>${i}</span><b>${fmt(v)}</b><span>${l}</span></div>`).join('');

    const alerts=[];
    if(Number(q.open_reports)>0) alerts.push(['critical','🚨','Safety queue requires review',`${fmt(q.open_reports)} report${Number(q.open_reports)===1?'':'s'} open.`]);
    if(Number(q.pending_verification)>0) alerts.push(['warning','🪪','Verification backlog',`${fmt(q.pending_verification)} verification request${Number(q.pending_verification)===1?'':'s'} pending.`]);
    if(!alerts.length) alerts.push(['good','✓','No urgent trust backlog','Safety and verification queues are clear right now.']);
    document.getElementById('ops-alerts').innerHTML=alerts.map(([c,i,t,s])=>`<div class="ops-alert ${c}"><span>${i}</span><div><strong>${t}</strong><small>${s}</small></div></div>`).join('');
  }
})();
