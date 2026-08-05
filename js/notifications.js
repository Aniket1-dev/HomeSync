// Shared notification bell — call initNotifications(userId) after you know
// who's logged in. Renders into any element with id="notif-bell-slot".
// Depends on: supabaseClient.js, ui.js (escapeHtml pattern reused inline).

let _notifUserId = null;
let _notifPollTimer = null;

async function initNotifications(userId) {
  _notifUserId = userId;
  const slot = document.getElementById("notif-bell-slot");
  if (!slot) return;

  slot.innerHTML = `
    <div class="notif-bell-wrap">
      <button id="notif-bell-btn" class="notif-bell-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span id="notif-badge" class="notif-badge hidden">0</span>
      </button>
      <div id="notif-dropdown" class="notif-dropdown hidden">
        <div class="notif-dropdown-header">
          <span>Notifications</span>
          <button id="notif-mark-all" class="notif-mark-all">Mark all read</button>
        </div>
        <div id="notif-list" class="notif-list"><p class="muted center" style="padding:20px;">Loading…</p></div>
      </div>
    </div>
  `;

  document.getElementById("notif-bell-btn").addEventListener("click", toggleNotifDropdown);
  document.getElementById("notif-mark-all").addEventListener("click", markAllNotificationsRead);
  document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".notif-bell-wrap");
    if (wrap && !wrap.contains(e.target)) closeNotifDropdown();
  });

  await refreshNotifBadge();
  clearInterval(_notifPollTimer);
  _notifPollTimer = setInterval(refreshNotifBadge, 60000);
}

async function toggleNotifDropdown() {
  const dropdown = document.getElementById("notif-dropdown");
  const btn = document.getElementById("notif-bell-btn");
  const opening = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden", !opening);
  btn.setAttribute("aria-expanded", String(opening));
  if (opening) await loadNotifList();
}

function closeNotifDropdown() {
  document.getElementById("notif-dropdown")?.classList.add("hidden");
  document.getElementById("notif-bell-btn")?.setAttribute("aria-expanded", "false");
}

async function refreshNotifBadge() {
  if (!_notifUserId) return;
  const { count } = await supabaseClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", _notifUserId)
    .eq("is_read", false);

  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  if (count && count > 0) {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

async function loadNotifList() {
  const list = document.getElementById("notif-list");
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", _notifUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    list.innerHTML = `<p class="muted center" style="padding:20px;">Couldn't load notifications.</p>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<p class="muted center" style="padding:20px;">You're all caught up.</p>`;
    return;
  }

  list.innerHTML = "";
  data.forEach((n) => {
    const item = document.createElement(n.link ? "a" : "div");
    if (n.link) item.href = n.link;
    item.className = `notif-item${n.is_read ? "" : " unread"}`;
    item.innerHTML = `
      <div class="notif-item-title">${notifEscape(n.title)}</div>
      ${n.body ? `<div class="notif-item-body">${notifEscape(n.body)}</div>` : ""}
      <div class="notif-item-time">${timeAgo(n.created_at)}</div>
    `;
    item.addEventListener("click", () => markNotificationRead(n.id, item));
    list.appendChild(item);
  });
}

async function markNotificationRead(id, itemEl) {
  itemEl.classList.remove("unread");
  await supabaseClient.from("notifications").update({ is_read: true }).eq("id", id);
  refreshNotifBadge();
}

async function markAllNotificationsRead() {
  await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", _notifUserId)
    .eq("is_read", false);
  document.querySelectorAll(".notif-item.unread").forEach((el) => el.classList.remove("unread"));
  refreshNotifBadge();
}

// Writes a notification to the current user's own feed only — RLS allows
// self-inserts for everyone, so this is safe to call from dashboard.js etc.
async function notifySelf({ type = "system", title, body = null, link = null }) {
  if (!_notifUserId) return;
  await supabaseClient.from("notifications").insert({
    user_id: _notifUserId,
    type,
    title,
    body,
    link,
  });
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function notifEscape(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
