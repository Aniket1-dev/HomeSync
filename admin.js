// Admin panel: guarded by role check against the profiles table.
// NOTE: the *real* enforcement is server-side (RLS policies + the
// prevent_privilege_escalation trigger in sql/schema.sql) — this page-level
// check just controls what the UI shows. Even if someone bypassed this and
// called the update/insert endpoints directly, RLS would reject anything
// a non-admin isn't allowed to do.

let me = null;
let allUsers = [];

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: myProfile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile) {
    window.location.href = "onboarding.html";
    return;
  }

  if (myProfile.role !== "admin") {
    document.getElementById("admin-guard").classList.remove("hidden");
    return;
  }

  me = myProfile;
  document.getElementById("admin-content").classList.remove("hidden");

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("broadcast-btn").addEventListener("click", sendBroadcast);
  document.getElementById("user-search").addEventListener("input", (e) => renderUserTable(e.target.value));

  await initNotifications(user.id);
  await loadStats();
  await loadUsers();
});

async function loadStats() {
  const [{ count: total }, { count: week }, { count: suspended }, { count: admins }] = await Promise.all([
    supabaseClient.from("profiles").select("id", { count: "exact", head: true }),
    supabaseClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabaseClient.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabaseClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
  ]);

  document.getElementById("stat-total").textContent = total ?? "0";
  document.getElementById("stat-week").textContent = week ?? "0";
  document.getElementById("stat-suspended").textContent = suspended ?? "0";
  document.getElementById("stat-admins").textContent = admins ?? "0";
}

async function loadUsers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, city, role, status, photo_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("user-table-body").innerHTML =
      `<tr><td colspan="6" class="muted center" style="padding:24px;">Couldn't load users: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  allUsers = data || [];
  renderUserTable("");
}

function renderUserTable(filter) {
  const body = document.getElementById("user-table-body");
  const q = filter.trim().toLowerCase();

  const filtered = !q
    ? allUsers
    : allUsers.filter((u) =>
        [u.full_name, u.email, u.city].some((f) => (f || "").toLowerCase().includes(q))
      );

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="muted center" style="padding:24px;">No users match.</td></tr>`;
    return;
  }

  body.innerHTML = "";
  filtered.forEach((u) => {
    const tr = document.createElement("tr");
    const isSelf = u.id === me.id;
    const avatarStyle = u.photo_url ? `style="background-image:url(${escapeAttr(u.photo_url)});"` : "";

    tr.innerHTML = `
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" ${avatarStyle} style="background-color:${avatarColor(u.id)};">
            ${u.photo_url ? "" : initials(u.full_name)}
          </div>
          <div>
            <div style="font-weight:600;">${escapeHtml(u.full_name || "Unnamed")}${isSelf ? " (you)" : ""}</div>
            <div class="muted" style="font-size:0.8rem;">${escapeHtml(u.email || "")}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(u.city || "—")}</td>
      <td><span class="badge ${u.role === "admin" ? "badge-admin" : "badge-user"}">${u.role}</span></td>
      <td><span class="badge ${u.status === "suspended" ? "badge-suspended" : "badge-active"}">${u.status}</span></td>
      <td class="muted mono" style="font-size:0.78rem;">${new Date(u.created_at).toLocaleDateString()}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm role-btn" data-id="${u.id}" data-role="${u.role}" ${isSelf ? "disabled" : ""}>
          ${u.role === "admin" ? "Remove admin" : "Make admin"}
        </button>
        <button class="btn btn-ghost btn-sm status-btn" data-id="${u.id}" data-status="${u.status}" ${isSelf ? "disabled" : ""}>
          ${u.status === "suspended" ? "Reactivate" : "Suspend"}
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll(".role-btn").forEach((btn) =>
    btn.addEventListener("click", () => toggleRole(btn.dataset.id, btn.dataset.role))
  );
  body.querySelectorAll(".status-btn").forEach((btn) =>
    btn.addEventListener("click", () => toggleStatus(btn.dataset.id, btn.dataset.status))
  );
}

async function toggleRole(id, currentRole) {
  const nextRole = currentRole === "admin" ? "user" : "admin";
  const confirmed = window.confirm(
    nextRole === "admin" ? "Grant this user admin access?" : "Remove admin access from this user?"
  );
  if (!confirmed) return;

  const { error } = await supabaseClient.from("profiles").update({ role: nextRole }).eq("id", id);
  if (error) {
    showMsg(document.getElementById("admin-msg"), error.message);
    return;
  }
  await loadUsers();
  await loadStats();
}

async function toggleStatus(id, currentStatus) {
  const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
  const confirmed = window.confirm(
    nextStatus === "suspended" ? "Suspend this user? They'll be signed out immediately." : "Reactivate this user?"
  );
  if (!confirmed) return;

  const { error } = await supabaseClient.from("profiles").update({ status: nextStatus }).eq("id", id);
  if (error) {
    showMsg(document.getElementById("admin-msg"), error.message);
    return;
  }
  await loadUsers();
  await loadStats();
}

async function sendBroadcast() {
  const msg = document.getElementById("admin-msg");
  const title = document.getElementById("broadcast-title").value.trim();
  const body = document.getElementById("broadcast-body").value.trim() || null;
  const btn = document.getElementById("broadcast-btn");

  if (!title) {
    showMsg(msg, "Give the announcement a title first.");
    return;
  }

  hideMsg(msg);
  setLoading(btn, true, "Send to all users");

  const { data: users, error: fetchErr } = await supabaseClient.from("profiles").select("id");
  if (fetchErr) {
    setLoading(btn, false, "Send to all users");
    showMsg(msg, fetchErr.message);
    return;
  }

  const rows = users.map((u) => ({
    user_id: u.id,
    type: "announcement",
    title,
    body,
  }));

  const { error } = await supabaseClient.from("notifications").insert(rows);
  setLoading(btn, false, "Send to all users");

  if (error) {
    showMsg(msg, error.message);
    return;
  }

  document.getElementById("broadcast-title").value = "";
  document.getElementById("broadcast-body").value = "";
  showMsg(msg, `Sent to ${rows.length} users.`, "ok");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
