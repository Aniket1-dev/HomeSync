// Admin Portal: guards the page behind profiles.is_admin, then loads
// platform stats, the user table, and contact messages.

let allUsers = [];
let allMessages = [];
let currentStatusFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "admin-login.html";
    return;
  }

  const { data: myProfile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile?.is_admin) {
    denyAccess();
    return;
  }

  document.getElementById("admin-app").classList.remove("hidden");
  document.getElementById("admin-name").textContent = myProfile.full_name?.split(" ")[0] || "Admin";

  wireNav();
  wireLogout();
  wireSearch();
  wireStatusFilters();
  wirePromote();

  await Promise.all([loadUsers(), loadMessages()]);
});

function denyAccess() {
  document.getElementById("access-denied").classList.remove("hidden");
  document.getElementById("admin-app").classList.add("hidden");
  // Make sure a non-admin session doesn't linger on this page.
  supabaseClient.auth.signOut();
}

function wireLogout() {
  document.getElementById("admin-logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "admin-login.html";
  });
}

function wireNav() {
  document.querySelectorAll(".admin-nav-link[data-panel-link]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.panelLink;
      document.querySelectorAll(".admin-nav-link[data-panel-link]").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      document.querySelectorAll(".admin-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === target));
    });
  });
}

function wireSearch() {
  document.getElementById("admin-user-search").addEventListener("input", (e) => {
    renderUsersTable(filterUsers(e.target.value));
  });
}

function wireStatusFilters() {
  document.querySelectorAll(".filter-chip[data-status-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip[data-status-filter]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentStatusFilter = chip.dataset.statusFilter;
      renderUsersTable(filterUsers(document.getElementById("admin-user-search").value));
    });
  });
}

function wirePromote() {
  document.getElementById("promote-btn").addEventListener("click", async () => {
    const msg = document.getElementById("admin-promote-msg");
    const email = document.getElementById("promote-email").value.trim();
    hideMsg(msg);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showMsg(msg, "Enter a valid email address.");
      return;
    }

    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ is_admin: true })
      .eq("email", email)
      .select();

    if (error) {
      showMsg(msg, error.message);
      return;
    }
    if (!data || data.length === 0) {
      showMsg(msg, "No user found with that email — they need to sign up first.");
      return;
    }

    showMsg(msg, `${email} now has admin access.`, "ok");
    document.getElementById("promote-email").value = "";
    await loadUsers();
  });
}

async function loadUsers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("admin-users-body").innerHTML = `<tr><td colspan="6" class="muted center">Couldn't load users: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  allUsers = data || [];
  renderStats();
  renderUsersTable(allUsers);
  renderRecentUsers(allUsers.slice(0, 5));
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // Table may not have a select policy yet, or none exist — fail quietly with a hint.
    document.getElementById("admin-messages-body").innerHTML = `<tr><td colspan="5" class="muted center">Couldn't load messages: ${escapeHtml(error.message)}</td></tr>`;
    document.getElementById("admin-recent-messages-body").innerHTML = `<tr><td colspan="4" class="muted center">Couldn't load messages.</td></tr>`;
    document.getElementById("admin-stat-messages").textContent = "—";
    return;
  }

  allMessages = data || [];
  document.getElementById("admin-stat-messages").textContent = allMessages.length;
  renderMessagesTable(allMessages);
  renderRecentMessages(allMessages.slice(0, 5));
}

function renderStats() {
  document.getElementById("admin-stat-users").textContent = allUsers.length;

  const cities = new Set(allUsers.map((u) => (u.city || "").trim().toLowerCase()).filter(Boolean));
  document.getElementById("admin-stat-cities").textContent = cities.size;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = allUsers.filter((u) => u.created_at && new Date(u.created_at).getTime() >= weekAgo).length;
  document.getElementById("admin-stat-new").textContent = newThisWeek;
}

function filterUsers(query) {
  let filtered = allUsers;

  if (currentStatusFilter === "active") filtered = filtered.filter((u) => (u.status || "active") === "active");
  else if (currentStatusFilter === "suspended") filtered = filtered.filter((u) => u.status === "suspended");
  else if (currentStatusFilter === "admin") filtered = filtered.filter((u) => u.is_admin);

  const q = (query || "").trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((u) =>
      [u.full_name, u.email, u.city].some((v) => (v || "").toLowerCase().includes(q))
    );
  }

  return filtered;
}

function renderUsersTable(users) {
  const body = document.getElementById("admin-users-body");
  if (users.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="muted center">No users match this filter.</td></tr>`;
    return;
  }

  body.innerHTML = users.map((u) => userRowHtml(u, true)).join("");

  body.querySelectorAll("[data-action='toggle-status']").forEach((btn) => {
    btn.addEventListener("click", () => toggleUserStatus(btn.dataset.id));
  });
  body.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id, btn.dataset.name));
  });
}

function renderRecentUsers(users) {
  const body = document.getElementById("admin-recent-users-body");
  body.innerHTML = users.length
    ? users.map((u) => userRowHtml(u, false)).join("")
    : `<tr><td colspan="5" class="muted center">No users yet.</td></tr>`;
}

function userRowHtml(u, withActions) {
  const status = u.status || "active";
  const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : "—";
  const budget = u.budget_min || u.budget_max ? `₹${u.budget_min ?? "?"}–₹${u.budget_max ?? "?"}` : "—";
  const badgeClass = u.is_admin ? "admin" : status === "suspended" ? "suspended" : "active";
  const badgeLabel = u.is_admin ? "Admin" : status;

  return `
    <tr>
      <td>
        <div class="admin-row-user">
          <div class="admin-avatar" style="background:${avatarColor(u.id)};">${initials(u.full_name)}</div>
          <div>
            <div style="font-weight:600;">${escapeHtml(u.full_name || "Unnamed")}</div>
            <div class="muted" style="font-size:0.8rem;">${escapeHtml(u.email || "")}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(u.city || "—")}</td>
      <td class="mono">${budget}</td>
      <td>${joined}</td>
      <td><span class="admin-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span></td>
      ${withActions ? `
      <td>
        <div class="admin-row-actions">
          <button class="admin-icon-btn" data-action="toggle-status" data-id="${u.id}" title="${status === "suspended" ? "Reinstate" : "Suspend"}">${status === "suspended" ? "▶" : "⏸"}</button>
          <button class="admin-icon-btn danger" data-action="delete" data-id="${u.id}" data-name="${escapeAttr(u.full_name || u.email || "this user")}" title="Delete">🗑</button>
        </div>
      </td>` : ""}
    </tr>`;
}

async function toggleUserStatus(id) {
  const target = allUsers.find((u) => u.id === id);
  if (!target) return;
  const newStatus = (target.status || "active") === "active" ? "suspended" : "active";

  const { error } = await supabaseClient.from("profiles").update({ status: newStatus }).eq("id", id);
  if (error) {
    alert("Couldn't update status: " + error.message);
    return;
  }
  target.status = newStatus;
  renderStats();
  renderUsersTable(filterUsers(document.getElementById("admin-user-search").value));
  renderRecentUsers(allUsers.slice(0, 5));
}

async function deleteUser(id, name) {
  if (!confirm(`Delete ${name}'s profile? This can't be undone. (Their login account isn't deleted — only their HomeSync profile data.)`)) return;

  const { error } = await supabaseClient.from("profiles").delete().eq("id", id);
  if (error) {
    alert("Couldn't delete user: " + error.message);
    return;
  }
  allUsers = allUsers.filter((u) => u.id !== id);
  renderStats();
  renderUsersTable(filterUsers(document.getElementById("admin-user-search").value));
  renderRecentUsers(allUsers.slice(0, 5));
}

function renderMessagesTable(messages) {
  const body = document.getElementById("admin-messages-body");
  if (messages.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="muted center">No contact messages yet.</td></tr>`;
    return;
  }
  body.innerHTML = messages.map((m) => messageRowHtml(m, true)).join("");
  body.querySelectorAll("[data-action='delete-msg']").forEach((btn) => {
    btn.addEventListener("click", () => deleteMessage(btn.dataset.id));
  });
}

function renderRecentMessages(messages) {
  const body = document.getElementById("admin-recent-messages-body");
  body.innerHTML = messages.length
    ? messages.map((m) => messageRowHtml(m, false)).join("")
    : `<tr><td colspan="4" class="muted center">No messages yet.</td></tr>`;
}

function messageRowHtml(m, withActions) {
  const received = m.created_at ? new Date(m.created_at).toLocaleDateString() : "—";
  return `
    <tr>
      <td>
        <div style="font-weight:600;">${escapeHtml(m.name || "Unknown")}</div>
        <div class="muted" style="font-size:0.8rem;">${escapeHtml(m.email || "")}</div>
      </td>
      <td>${escapeHtml(m.topic || "General")}</td>
      <td style="max-width:320px;">${escapeHtml((m.message || "").slice(0, 100))}${(m.message || "").length > 100 ? "…" : ""}</td>
      <td>${received}</td>
      ${withActions ? `<td><div class="admin-row-actions"><button class="admin-icon-btn danger" data-action="delete-msg" data-id="${m.id}" title="Delete">🗑</button></div></td>` : ""}
    </tr>`;
}

async function deleteMessage(id) {
  if (!confirm("Delete this message permanently?")) return;
  const { error } = await supabaseClient.from("contact_messages").delete().eq("id", id);
  if (error) {
    alert("Couldn't delete message: " + error.message);
    return;
  }
  allMessages = allMessages.filter((m) => m.id !== id);
  document.getElementById("admin-stat-messages").textContent = allMessages.length;
  renderMessagesTable(allMessages);
  renderRecentMessages(allMessages.slice(0, 5));
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
