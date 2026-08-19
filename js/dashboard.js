// Dashboard: loads profiles, ranks matches client-side, renders results,
// and powers the premium stat cards / sidebar.

let me = null;
let rankedMatches = [];
let currentSort = "score";
let cityScope = "city"; // "city" | "all" — "all" only ever active for premium users

const FREE_MATCH_LIMIT = 6; // free users see this many unlocked match cards; rest are blurred

const PROFILE_FIELDS_FOR_COMPLETENESS = [
  "full_name", "age", "gender", "mobile_number", "city", "preferred_area",
  "budget_min", "budget_max", "sleep_schedule", "cleanliness",
  "guest_frequency", "personality", "smoking_drinking", "cooking_habits",
  "conflict_style", "bio",
];

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();

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

  // Keep Premium state consistent with the plan activation timestamp. This
  // prevents an older profile row from being treated as Free after upgrade.
  myProfile.is_premium = myProfile.is_premium === true || Boolean(myProfile.premium_since);
  me = myProfile;

  document.getElementById("welcome-name").textContent = myProfile.full_name?.split(" ")[0] || "there";
  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
  document.getElementById("edit-profile-link")?.setAttribute("href", "onboarding.html");

  renderCompleteness();
  renderPremiumBanner();
  wireCityScopeChip();

  document.querySelectorAll(".filter-chip[data-sort]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip[data-sort]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentSort = chip.dataset.sort;
      renderSortedMatches();
    });
  });

  await Promise.all([loadMatches(), loadBroadcastBanner()]);
});

function renderPremiumBanner() {
  const banner = document.getElementById("premium-banner");
  const badge = document.getElementById("premium-banner-badge");
  const title = document.getElementById("premium-banner-title");
  const sub = document.getElementById("premium-banner-sub");
  const btn = document.getElementById("premium-banner-btn");

  if (me.is_premium) {
    banner.classList.add("is-premium");
    badge.classList.add("is-premium");
    badge.textContent = "✨ Premium active";
    title.textContent = "You're on HomeSync AI Premium";
    sub.textContent = "Unlimited matches, cross-city search, priority placement, and icebreakers are all unlocked.";
    btn.textContent = "Manage plan";
    btn.href = "pricing.html";
  } else {
    banner.classList.remove("is-premium");
    badge.classList.remove("is-premium");
    badge.textContent = "✨ Upgrade";
    title.textContent = "HomeSync AI Premium";
    sub.textContent = "Unlock priority matching, unlimited cross-city search and icebreaker suggestions.";
    btn.textContent = "Upgrade to Premium";
    btn.href = "pricing.html";
  }
}

function wireCityScopeChip() {
  const chip = document.getElementById("city-scope-chip");
  if (!chip) return;

  if (!me.is_premium) {
    chip.classList.add("upgrade-lock-chip");
    chip.textContent = "🔒 All cities — Premium";
    chip.addEventListener("click", () => {
      window.location.href = "pricing.html";
    });
    return;
  }

  chip.addEventListener("click", () => {
    cityScope = cityScope === "city" ? "all" : "city";
    chip.textContent = cityScope === "city" ? "📍 My city" : "🌍 All cities";
    loadMatches();
  });
}

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
  try { dismissedId = localStorage.getItem(DISMISSED_BROADCAST_KEY); } catch (e) {}
  if (dismissedId === data.id) return;

  const banner = document.getElementById("broadcast-banner");
  document.getElementById("broadcast-banner-title").textContent = data.title;
  document.getElementById("broadcast-banner-body").textContent = data.body;
  banner.classList.remove("hidden");

  document.getElementById("broadcast-banner-dismiss").addEventListener("click", () => {
    banner.classList.add("hidden");
    try { localStorage.setItem(DISMISSED_BROADCAST_KEY, data.id); } catch (e) {}
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

  let query = supabaseClient.from("profiles").select("*").neq("id", me.id);
  const crossCity = me.is_premium && cityScope === "all";
  if (!crossCity) query = query.eq("city", me.city);

  const { data: candidates, error } = await query;

  if (error) {
    list.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">⚠️</div><p class="muted mt-0">Couldn't load matches: ${error.message}</p></div>`;
    setStatFallback();
    return;
  }

  if (!candidates || candidates.length === 0) {
    const scopeMsg = crossCity ? "No other profiles yet." : `No other profiles in ${escapeHtml(me.city)} yet.`;
    list.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">🏠</div><p class="muted mt-0">${scopeMsg} Invite your team/friends to sign up so the matching engine has data to work with.</p></div>`;
    setStatFallback();
    return;
  }

  candidates.forEach((candidate) => {
    candidate.is_premium = candidate.is_premium === true || Boolean(candidate.premium_since);
  });

  rankedMatches = rankMatches(me, candidates, crossCity ? 200 : 20).map((m) => ({
    ...m,
    displayScore: m.ruleScore + (m.profile.is_premium ? 8 : 0),
  }));

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
  if (currentSort === "budget") sorted.sort((a, b) => (a.profile.budget_min ?? Infinity) - (b.profile.budget_min ?? Infinity));
  else sorted.sort((a, b) => b.displayScore - a.displayScore);

  list.innerHTML = "";
  const limit = me.is_premium ? sorted.length : FREE_MATCH_LIMIT;
  sorted.slice(0, limit).forEach((m) => renderMatchCard(list, m));
  const lockedCount = sorted.length - limit;
  if (lockedCount > 0) renderLockedMatchTeaser(list, lockedCount);
}

function renderLockedMatchTeaser(list, lockedCount) {
  const wrap = document.createElement("div");
  wrap.className = "locked-match-card";
  wrap.innerHTML = `<div class="locked-match-card-blur"><div class="skeleton skeleton-circle"></div><div><div class="skeleton skeleton-line" style="width:40%;"></div><div class="skeleton skeleton-line" style="width:70%;"></div><div class="skeleton skeleton-line" style="width:55%;"></div></div></div><div class="locked-match-card-cta"><span class="lock-icon">🔒</span><div><strong>${lockedCount} more match${lockedCount === 1 ? "" : "es"}</strong> waiting behind Premium</div><a href="pricing.html" class="btn btn-primary" style="margin-top:4px;">Unlock unlimited matches</a></div>`;
  list.appendChild(wrap);
}

function skeletonHtml(n) {
  let html = "";
  for (let i = 0; i < n; i++) html += `<div class="skeleton-card"><div class="skeleton skeleton-circle"></div><div><div class="skeleton skeleton-line" style="width:40%;"></div><div class="skeleton skeleton-line" style="width:70%;"></div><div class="skeleton skeleton-line" style="width:55%;"></div></div></div>`;
  return html;
}

function renderMatchCard(list, match) {
  const { profile, ruleScore, breakdown } = match;
  const card = document.createElement("div");
  card.className = "card match-card";
  if (profile.is_premium) card.classList.add("is-premium-user");

  const dial = document.createElement("div");
  dial.className = "mini-dial";
  const info = document.createElement("div");
  const avatarStyle = profile.photo_url ? `background-image:url(${escapeAttr(profile.photo_url)});` : `background:${avatarColor(profile.id)};`;
  info.innerHTML = `<div class="match-header-row"><div class="match-avatar" style="${avatarStyle}">${profile.photo_url ? "" : initials(profile.full_name)}</div><div class="match-name" style="margin-bottom:0;">${escapeHtml(profile.full_name || "Unnamed")}</div>${profile.is_premium ? `<span class="match-priority-tag">⭐ Priority</span>` : ""}</div><p class="muted mt-0" style="margin-bottom:8px;">${escapeHtml(profile.preferred_area || profile.city || "")} · ₹${profile.budget_min || "?"}–₹${profile.budget_max || "?"}</p><p style="margin-bottom:0;">${escapeHtml((profile.bio || "").slice(0, 160))}${profile.bio && profile.bio.length > 160 ? "…" : ""}</p><div class="score-breakdown"><span>sleep ${pct(breakdown.sleep_schedule)}</span><span>clean ${pct(breakdown.cleanliness)}</span><span>social ${pct(breakdown.guest_frequency)}</span><span>vibe ${pct(breakdown.personality)}</span></div>${renderContactRow(profile)}${renderIcebreakerButton(profile)}<div class="icebreaker-box hidden" id="icebreaker-${escapeAttr(profile.id)}"></div>`;

  card.appendChild(dial); card.appendChild(info); card.appendChild(document.createElement("div")); list.appendChild(card);
  renderSyncDial(dial, ruleScore, { size: 78, label: "" });
  info.querySelector("[data-action='icebreaker']")?.addEventListener("click", () => handleIcebreakerClick(profile));
}

function renderIcebreakerButton(profile) {
  if (!me.is_premium) return `<button type="button" class="btn-icebreaker locked" data-action="icebreaker" style="margin-top:12px;">🔒 Icebreaker suggestion — Premium</button>`;
  return `<button type="button" class="btn-icebreaker" data-action="icebreaker" style="margin-top:12px;">✨ Suggest an icebreaker</button>`;
}

function handleIcebreakerClick(profile) {
  if (!me.is_premium) { window.location.href = "pricing.html"; return; }
  const box = document.getElementById(`icebreaker-${profile.id}`);
  if (!box) return;
  if (!box.classList.contains("hidden")) { box.classList.add("hidden"); return; }
  const text = generateIcebreaker(me, profile);
  box.innerHTML = `<p>${escapeHtml(text)}</p><div class="icebreaker-actions"><button type="button" class="btn-icebreaker" data-action="copy">📋 Copy</button><button type="button" class="btn-icebreaker" data-action="regen">🔁 Another one</button></div>`;
  box.classList.remove("hidden");
  box.querySelector("[data-action='copy']").addEventListener("click", (e) => { navigator.clipboard?.writeText(text); e.currentTarget.textContent = "Copied ✓"; setTimeout(() => (e.currentTarget.textContent = "📋 Copy"), 1500); });
  box.querySelector("[data-action='regen']").addEventListener("click", () => { box.querySelector("p").textContent = generateIcebreaker(me, profile); });
}

function generateIcebreaker(me, profile) {
  const name = (profile.full_name || "there").split(" ")[0];
  const sameArea = profile.preferred_area && profile.preferred_area === me.preferred_area;
  const sameCleanliness = profile.cleanliness != null && me.cleanliness != null && Math.abs(profile.cleanliness - me.cleanliness) <= 1;
  const sameCooking = profile.cooking_habits && profile.cooking_habits === me.cooking_habits;
  const templates = [`Hey ${name}! We matched pretty high on HomeSync — I'm looking around ${escapeHtml(me.preferred_area || me.city || "the same area")} too, budget's roughly ₹${me.budget_min || "?"}–₹${me.budget_max || "?"}. Open to a quick chat?`,`Hi ${name}, our lifestyle answers lined up well on HomeSync AI. Want to compare notes on the flat-hunt and see if it's worth meeting up?`];
  if (sameArea) templates.push(`Hey ${name}! Looks like we're both eyeing ${escapeHtml(profile.preferred_area)} — small world. Want to team up on the search?`);
  if (sameCleanliness) templates.push(`Hi ${name}, seems like we're on the same page about tidiness levels, which is honestly the thing that makes or breaks a flatshare. Want to chat?`);
  if (sameCooking) templates.push(`Hey ${name}! We matched well, and looks like our cooking habits line up too — always a good sign for a shared kitchen. Down to talk?`);
  return templates[Math.floor(Math.random() * templates.length)];
}

function renderContactRow(profile) {
  const buttons = [];
  if (profile.email) {
    const subject = encodeURIComponent("Hi from HomeSync AI");
    const body = encodeURIComponent(`Hey ${profile.full_name || ""}, we matched on HomeSync AI — would love to chat about rooming together.`);
    buttons.push(`<a class="btn-contact" href="mailto:${escapeAttr(profile.email)}?subject=${subject}&body=${body}" target="_blank" rel="noopener">✉️ Email</a>`);
  }
  if (profile.mobile_number) {
    const digits = profile.mobile_number.replace(/\D/g, "");
    const waNumber = digits.length === 10 ? "91" + digits : digits;
    const text = encodeURIComponent(`Hi ${profile.full_name || ""}, we matched on HomeSync AI — would love to chat about rooming together!`);
    buttons.push(`<a class="btn-contact whatsapp" href="https://wa.me/${waNumber}?text=${text}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
  }
  if (buttons.length === 0) return "";
  return `<div class="contact-row">${buttons.join("")}</div>`;
}

function escapeAttr(str) { return String(str || "").replace(/"/g, "&quot;"); }
function pct(sim) { return Math.round((sim ?? 0) * 100) + "%"; }
function escapeHtml(str) { const div = document.createElement("div"); div.textContent = str || ""; return div.innerHTML; }
