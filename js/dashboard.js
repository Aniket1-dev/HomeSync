// Dashboard: loads profiles, ranks matches client-side, renders results,
// and powers the premium stat cards / sidebar.

let me = null;
let rankedMatches = [];
let currentSort = "score";

const PROFILE_FIELDS_FOR_COMPLETENESS = [
  "full_name", "age", "gender", "mobile_number", "city", "preferred_area",
  "budget_min", "budget_max", "sleep_schedule", "cleanliness",
  "guest_frequency", "personality", "smoking_drinking", "cooking_habits",
  "conflict_style", "bio",
];

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
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
  if (await enforceActiveStatus(myProfile)) return;
  if (myProfile.is_admin) {
    window.location.href = "admin.html";
    return;
  }
  me = myProfile;

  document.getElementById("welcome-name").textContent = myProfile.full_name?.split(" ")[0] || "there";
  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
  document.getElementById("edit-profile-link").href = "onboarding.html";

  renderCompleteness();

  document.getElementById("premium-notify-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.textContent = "You're on the list ✓";
    btn.disabled = true;
  });

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentSort = chip.dataset.sort;
      renderSortedMatches();
    });
  });

  await Promise.all([loadMatches(), loadBroadcastBanner()]);
});

const DISMISSED_BROADCAST_KEY = "homesync-dismissed-broadcast";

async function loadBroadcastBanner() {
  const { data, error } = await supabaseClient
    .from("broadcasts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return;

  let dismissedId = null;
  try {
    dismissedId = localStorage.getItem(DISMISSED_BROADCAST_KEY);
  } catch (e) {
    /* localStorage unavailable */
  }
  if (dismissedId === data.id) return;

  const banner = document.getElementById("broadcast-banner");
  document.getElementById("broadcast-banner-title").textContent = data.title;
  document.getElementById("broadcast-banner-body").textContent = data.body;
  banner.classList.remove("hidden");

  document.getElementById("broadcast-banner-dismiss").addEventListener("click", () => {
    banner.classList.add("hidden");
    try {
      localStorage.setItem(DISMISSED_BROADCAST_KEY, data.id);
    } catch (e) {
      /* localStorage unavailable — banner just reappears next visit */
    }
  });
}

function renderCompleteness() {
  const filled = PROFILE_FIELDS_FOR_COMPLETENESS.filter((f) => {
    const v = me[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  const pct = Math.round((filled / PROFILE_FIELDS_FOR_COMPLETENESS.length) * 100);

  document.getElementById("stat-completeness").textContent = pct + "%";
  document.getElementById("stat-city").textContent = me.city || "—";
  const hint = document.getElementById("stat-completeness-hint");
  hint.textContent = pct === 100 ? "Fully filled out" : "Finish it for stronger matches";
  hint.classList.toggle("up", pct === 100);
}

async function loadMatches() {
  const list = document.getElementById("match-list");
  list.innerHTML = skeletonHtml(3);

  const { data: candidates, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .neq("id", me.id)
    .eq("city", me.city);

  if (error) {
    list.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">⚠️</div><p class="muted mt-0">Couldn't load matches: ${error.message}</p></div>`;
    setStatFallback();
    return;
  }

  if (!candidates || candidates.length === 0) {
    list.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">🏠</div><p class="muted mt-0">No other profiles in ${escapeHtml(me.city)} yet. Invite your team/friends to sign up so the matching engine has data to work with.</p></div>`;
    setStatFallback();
    return;
  }

  rankedMatches = rankMatches(me, candidates, 20);

  if (rankedMatches.length === 0) {
    list.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">🤷</div><p class="muted mt-0">No compatible budget/location overlaps found yet.</p></div>`;
    setStatFallback();
    return;
  }

  document.getElementById("stat-match-count").textContent = rankedMatches.length;
  document.getElementById("stat-top-score").textContent = Math.round(rankedMatches[0].ruleScore) + "%";

  renderSortedMatches();
}

function setStatFallback() {
  document.getElementById("stat-match-count").textContent = "0";
  document.getElementById("stat-top-score").textContent = "—";
}

function renderSortedMatches() {
  const list = document.getElementById("match-list");
  const sorted = [...rankedMatches];

  if (currentSort === "budget") {
    sorted.sort((a, b) => (a.profile.budget_min ?? Infinity) - (b.profile.budget_min ?? Infinity));
  } else {
    sorted.sort((a, b) => b.ruleScore - a.ruleScore);
  }

  list.innerHTML = "";
  sorted.forEach((m) => renderMatchCard(list, m));
}

function skeletonHtml(n) {
  let html = "";
  for (let i = 0; i < n; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-circle"></div>
        <div>
          <div class="skeleton skeleton-line" style="width:40%;"></div>
          <div class="skeleton skeleton-line" style="width:70%;"></div>
          <div class="skeleton skeleton-line" style="width:55%;"></div>
        </div>
      </div>`;
  }
  return html;
}

function renderMatchCard(list, match) {
  const { profile, ruleScore, breakdown } = match;
  const card = document.createElement("div");
  card.className = "card match-card";

  const dial = document.createElement("div");
  dial.className = "mini-dial";

  const info = document.createElement("div");
  const avatarStyle = profile.photo_url
    ? `background-image:url(${escapeAttr(profile.photo_url)});`
    : `background:${avatarColor(profile.id)};`;
  info.innerHTML = `
    <div class="match-header-row">
      <div class="match-avatar" style="${avatarStyle}">${profile.photo_url ? "" : initials(profile.full_name)}</div>
      <div class="match-name" style="margin-bottom:0;">${escapeHtml(profile.full_name || "Unnamed")}</div>
    </div>
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

  card.appendChild(dial);
  card.appendChild(info);
  card.appendChild(document.createElement("div")); // spacer for grid col 3
  list.appendChild(card);

  renderSyncDial(dial, ruleScore, { size: 78, label: "" });
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
