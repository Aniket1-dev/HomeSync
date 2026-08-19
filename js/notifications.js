/* HomeSync in-app notifications */
(() => {
  async function initNotifications() {
    if (!window.supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    const navLinks = document.getElementById('nav-links');
    if (!navLinks || document.getElementById('hs-notification-button')) return;

    const wrap = document.createElement('div');
    wrap.className = 'hs-notification-wrap';
    wrap.innerHTML = `<button id="hs-notification-button" class="hs-notification-button" type="button" aria-label="Notifications" aria-expanded="false">🔔<span id="hs-notification-count" class="hs-notification-count hidden">0</span></button><div id="hs-notification-panel" class="hs-notification-panel hidden"><div class="hs-notification-head"><strong>Notifications</strong><button id="hs-notification-read" type="button">Mark all read</button></div><div id="hs-notification-list" class="hs-notification-list"><div class="muted">Loading…</div></div></div>`;
    navLinks.insertBefore(wrap, navLinks.firstChild);

    const button = document.getElementById('hs-notification-button');
    const panel = document.getElementById('hs-notification-panel');
    button.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      button.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) panel.classList.add('hidden'); });
    document.getElementById('hs-notification-read').addEventListener('click', async () => {
      await supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      loadNotifications(user.id);
    });
    await loadNotifications(user.id);
    setInterval(() => loadNotifications(user.id), 30000);
  }

  async function loadNotifications(userId) {
    const { data, error } = await supabaseClient.from('notifications').select('id,type,title,body,data,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    const list = document.getElementById('hs-notification-list');
    const count = document.getElementById('hs-notification-count');
    if (!list || !count) return;
    if (error) { list.innerHTML = '<div class="muted">Notifications unavailable.</div>'; return; }
    const unread = (data || []).filter(n => !n.is_read).length;
    count.textContent = unread;
    count.classList.toggle('hidden', unread === 0);
    if (!data?.length) { list.innerHTML = '<div class="hs-notification-empty">You’re all caught up. 🎉</div>'; return; }
    list.innerHTML = data.map(n => `<button type="button" class="hs-notification-item ${n.is_read ? '' : 'unread'}" data-notification-id="${esc(n.id)}"><span class="hs-notification-icon">${icon(n.type)}</span><span><strong>${esc(n.title)}</strong><span>${esc(n.body || '')}</span><small>${relativeTime(n.created_at)}</small></span></button>`).join('');
    list.querySelectorAll('[data-notification-id]').forEach(el => el.addEventListener('click', async () => {
      const id = el.dataset.notificationId;
      await supabaseClient.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
      el.classList.remove('unread');
      loadNotifications(userId);
    }));
  }
  function icon(type) { return type === 'merge_request' ? '🤝' : type === 'merge_accepted' ? '🎉' : type === 'merge_declined' ? '↩️' : '🔔'; }
  function relativeTime(value) { const diff = Math.max(0, Date.now() - new Date(value).getTime()); const m = Math.floor(diff / 60000); if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }
  function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotifications); else initNotifications();
})();