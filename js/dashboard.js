// Dashboard: loads profiles, ranks matches client-side, renders results

let me = null;

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

  if (myProfile.status === "suspended") {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html?suspended=1";
    return;
  }

  me = myProfile;

  document.getElementById("welcome-name").textContent = myProfile.full_name?.split(" ")[0] || "there";
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });
  document.getElementById("edit-profile-link").href = "onboarding.html";

  if (myProfile.role === "admin") {
    document.getElementById("admin-link").classList.remove("hidden");
  }

  await initNotifications(user.id);
  await loadMatches();
});

async function loadMatches() {
  const list = document.getElementById("match-list");
  list.innerHTML = `<p class="muted center">Loading matches…</p>`;

  const { data: candidates, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .neq("id", me.id)
    .eq("city", me.city);

  if (error) {
    list.innerHTML = `<p class="muted center">Couldn't load matches: ${error.message}</p>`;
    return;
  }

  if (!candidates || candidates.length === 0) {
    list.innerHTML = `<p class="muted center">No other profiles in ${me.city} yet. Invite your team/friends to sign up so the matching engine has data to work with.</p>`;
    return;
  }

  const ranked = rankMatches(me, candidates, 20);

  if (ranked.length === 0) {
    list.innerHTML = `<p class="muted center">No compatible budget/location overlaps found yet.</p>`;
    return;
  }

  list.innerHTML = "";
  ranked.forEach((m) => renderMatchCard(list, m));

  maybeNotifyTopMatch(ranked);
}

// Sends at most one "new match" notification per 20h, and only if the
// person hasn't turned match alerts off in their settings.
async function maybeNotifyTopMatch(ranked) {
  const prefs = me.notif_prefs || { match_alerts: true };
  if (prefs.match_alerts === false) return;
  if (!ranked.length || ranked[0].ruleScore < 70) return;

  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .eq("type", "match_digest")
    .gte("created_at", since);

  if (count && count > 0) return;

  const top = ranked[0];
  await notifySelf({
    type: "match_digest",
    title: "New high-compatibility match",
    body: `${Math.round(top.ruleScore)}% match with ${top.profile.full_name || "someone"} in ${me.city}.`,
    link: "dashboard.html",
  });
}

function renderMatchCard(list, match) {
  const { profile, ruleScore, breakdown } = match;
  const card = document.createElement("div");
  card.className = "card match-card";

  const dial = document.createElement("div");
  dial.className = "mini-dial";

  const info = document.createElement("div");
  info.innerHTML = `
    <div class="match-name">${escapeHtml(profile.full_name || "Unnamed")}</div>
    <p class="muted mt-0" style="margin-bottom:8px;">${escapeHtml(profile.preferred_area || profile.city || "")} · ₹${profile.budget_min || "?"}–₹${profile.budget_max || "?"}</p>
    <p style="margin-bottom:0;">${escapeHtml((profile.bio || "").slice(0, 160))}${profile.bio && profile.bio.length > 160 ? "…" : ""}</p>
    <div class="score-breakdown">
      <span>sleep ${pct(breakdown.sleep_schedule)}</span>
      <span>clean ${pct(breakdown.cleanliness)}</span>
      <span>social ${pct(breakdown.guest_frequency)}</span>
      <span>vibe ${pct(breakdown.personality)}</span>
    </div>
    ${renderContactRow(profile)}
  `;

  const side = document.createElement("div");
  side.className = "avatar-lg";
  side.style.width = "64px";
  side.style.height = "64px";
  if (profile.photo_url) {
    side.style.backgroundImage = `url(${escapeAttr(profile.photo_url)})`;
  } else {
    side.style.background = avatarColor(profile.id);
    side.textContent = initials(profile.full_name);
  }

  card.appendChild(dial);
  card.appendChild(info);
  card.appendChild(side);
  list.appendChild(card);

  renderSyncDial(dial, ruleScore, { size: 78, label: "" });
  wireContactButtons(info, profile);
}

function wireContactButtons(container, profile) {
  container.querySelectorAll(".btn-contact").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channel = btn.classList.contains("whatsapp") ? "WhatsApp" : "email";
      // Fire-and-forget — don't block the mailto:/wa.me navigation on this.
      supabaseClient.rpc("notify_contact", { target_id: profile.id, channel }).catch(() => {});
    });
  });
}

function renderContactRow(profile) {
  const buttons = [];

  if (profile.email) {
    const subject = encodeURIComponent("Hi from HomeSync AI");
    const body = encodeURIComponent(
      `Hey ${profile.full_name || ""}, we matched on HomeSync AI — would love to chat about rooming together.`
    );
    buttons.push(
      `<a class="btn-contact" href="mailto:${escapeAttr(profile.email)}?subject=${subject}&body=${body}" target="_blank" rel="noopener">✉️ Email</a>`
    );
  }

  if (profile.mobile_number) {
    const digits = profile.mobile_number.replace(/\D/g, "");
    // Assume Indian numbers if no country code was entered (10 digits).
    const waNumber = digits.length === 10 ? "91" + digits : digits;
    const text = encodeURIComponent(
      `Hi ${profile.full_name || ""}, we matched on HomeSync AI — would love to chat about rooming together!`
    );
    buttons.push(
      `<a class="btn-contact whatsapp" href="https://wa.me/${waNumber}?text=${text}" target="_blank" rel="noopener">💬 WhatsApp</a>`
    );
  }

  if (buttons.length === 0) return "";
  return `<div class="contact-row">${buttons.join("")}</div>`;
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

function pct(sim) {
  return Math.round((sim ?? 0) * 100) + "%";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
