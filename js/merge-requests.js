/* HomeSync roommate merge requests */
(() => {
  const pending = new Map();
  async function init() {
    if (!window.supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    injectSection();
    document.addEventListener('click', async (e) => {
      const requestBtn = e.target.closest('[data-merge-request]');
      if (requestBtn) { await createRequest(requestBtn.dataset.mergeRequest, requestBtn.dataset.name || 'this roommate', requestBtn); return; }
      const respond = e.target.closest('[data-merge-response]');
      if (respond) { await respondRequest(respond.dataset.id, respond.dataset.mergeResponse, respond); }
    });
    await loadMyRequests(user.id);
  }

  function injectSection() {
    if (document.getElementById('hs-merge-section')) return;
    const host = document.getElementById('matches')?.parentElement || document.getElementById('match-list')?.parentElement;
    if (!host) return;
    const section = document.createElement('section');
    section.id = 'hs-merge-section';
    section.className = 'card hs-merge-section';
    section.innerHTML = `<div class="hs-merge-head"><div><span class="eyebrow">ROOMMATE PLAN</span><h3>🤝 Build a roommate plan</h3><p class="muted">Found someone in your city you genuinely want to live with? Send a merge request. They can accept or decline, and both of you get notified.</p></div><span class="hs-merge-status">Private · consent-based</span></div><div id="hs-merge-list"><div class="muted">No active requests yet.</div></div>`;
    host.insertBefore(section, host.firstChild);
  }

  async function loadMyRequests(userId) {
    const { data, error } = await supabaseClient.from('roommate_merge_requests').select('id,requester_id,recipient_id,status,message,requester_city,recipient_city,created_at,responded_at').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20);
    const list = document.getElementById('hs-merge-list');
    if (!list || error) return;
    if (!data?.length) { list.innerHTML = '<div class="muted">No active requests yet. Send one from a strong match below.</div>'; return; }
    const ids = [...new Set(data.flatMap(r => [r.requester_id, r.recipient_id]).filter(id => id !== userId))];
    let names = {};
    if (ids.length) { const { data: profiles } = await supabaseClient.from('profiles').select('id,full_name,city,preferred_area').in('id', ids); (profiles || []).forEach(p => names[p.id] = p); }
    list.innerHTML = data.map(r => {
      const otherId = r.requester_id === userId ? r.recipient_id : r.requester_id;
      const other = names[otherId] || {};
      const incoming = r.recipient_id === userId;
      const state = r.status === 'pending' ? (incoming ? `<div class="hs-merge-actions"><button class="btn btn-primary" data-merge-response="accepted" data-id="${r.id}">Accept</button><button class="btn btn-ghost" data-merge-response="declined" data-id="${r.id}">Decline</button></div>` : '<span class="hs-merge-pending">Waiting for their response</span>') : `<span class="hs-merge-${r.status}">${r.status}</span>`;
      return `<article class="hs-merge-item"><div class="hs-merge-avatar">${initials(other.full_name)}</div><div class="hs-merge-copy"><strong>${esc(other.full_name || 'Roommate')}</strong><span>${esc(other.preferred_area || other.city || 'Location not set')} · ${incoming ? 'wants to explore living together' : 'your request'}</span>${r.message ? `<small>${esc(r.message)}</small>` : ''}</div><div>${state}</div></article>`;
    }).join('');
  }

  async function createRequest(targetId, name, button) {
    if (pending.has(targetId)) return;
    pending.set(targetId, true); const original = button.innerHTML; button.disabled = true; button.textContent = 'Sending…';
    const message = `Hi ${name.split(' ')[0]}, we matched on HomeSync. Want to explore finding a place together?`;
    const { error } = await supabaseClient.rpc('create_roommate_merge_request', { target_user_id: targetId, request_message: message });
    if (error) {
      if (error.code === '23505') { button.textContent = 'Request already sent'; }
      else { button.disabled = false; button.innerHTML = original; alert(error.message || 'Could not send request.'); }
    } else { button.textContent = 'Request sent ✓'; button.classList.add('is-sent'); }
    pending.delete(targetId);
    const { data: { user } } = await supabaseClient.auth.getUser(); if (user) loadMyRequests(user.id);
  }

  async function respondRequest(id, status, button) {
    button.disabled = true; button.textContent = 'Updating…';
    const { error } = await supabaseClient.rpc('respond_to_roommate_merge_request', { request_id: id, new_status: status });
    if (error) { button.disabled = false; button.textContent = status === 'accepted' ? 'Accept' : 'Decline'; alert(error.message || 'Could not update request.'); return; }
    const { data: { user } } = await supabaseClient.auth.getUser(); if (user) loadMyRequests(user.id);
  }
  function initials(name) { return (String(name || 'R').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'R'); }
  function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();