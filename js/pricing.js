// Pricing / upgrade page. No real payment gateway is wired up (see the
// note in sql/schema.sql) — "upgrading" just flips profiles.is_premium
// on the signed-in user's own row, which the RLS policy allows.

let pricingUser = null;
let pricingProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }
  pricingUser = user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (await enforceActiveStatus(profile)) return;

  pricingProfile = profile || {};
  if (pricingProfile.is_admin) {
    document.getElementById("nav-back-link").href = "admin.html";
  }

  renderPlanState();

  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

  document.getElementById("btn-upgrade").addEventListener("click", handleUpgrade);
});

function renderPlanState() {
  const freeBtn = document.getElementById("btn-stay-free");
  const upgradeBtn = document.getElementById("btn-upgrade");

  if (pricingProfile.is_premium) {
    freeBtn.textContent = "Downgrade to Free";
    freeBtn.disabled = false;
    freeBtn.addEventListener("click", handleDowngrade, { once: true });

    upgradeBtn.textContent = "You're on Premium ✓";
    upgradeBtn.disabled = true;
  }
}

async function handleUpgrade() {
  const msg = document.getElementById("pricing-msg");
  const btn = document.getElementById("btn-upgrade");
  hideMsg(msg);
  setLoading(btn, true, "Upgrade to Premium");

  const { error } = await supabaseClient
    .from("profiles")
    .update({ is_premium: true, premium_since: new Date().toISOString() })
    .eq("id", pricingUser.id);

  setLoading(btn, false, "Upgrade to Premium");

  if (error) {
    showMsg(msg, "Couldn't upgrade: " + error.message);
    return;
  }

  pricingProfile.is_premium = true;
  showMsg(msg, "You're Premium now ✨ Unlimited matches, cross-city search, priority placement, and icebreakers are unlocked.", "ok");
  btn.textContent = "You're on Premium ✓";
  btn.disabled = true;

  const freeBtn = document.getElementById("btn-stay-free");
  freeBtn.textContent = "Downgrade to Free";
  freeBtn.disabled = false;
  freeBtn.addEventListener("click", handleDowngrade, { once: true });

  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1400);
}

async function handleDowngrade() {
  const confirmed = window.confirm("Downgrade to Free? You'll lose unlimited matches, cross-city search, priority placement, and icebreakers.");
  if (!confirmed) return;

  const msg = document.getElementById("pricing-msg");
  hideMsg(msg);

  const { error } = await supabaseClient
    .from("profiles")
    .update({ is_premium: false })
    .eq("id", pricingUser.id);

  if (error) {
    showMsg(msg, "Couldn't downgrade: " + error.message);
    return;
  }

  pricingProfile.is_premium = false;
  showMsg(msg, "You're back on Free.", "ok");

  const freeBtn = document.getElementById("btn-stay-free");
  freeBtn.textContent = "Current plan";
  freeBtn.disabled = true;

  const upgradeBtn = document.getElementById("btn-upgrade");
  upgradeBtn.textContent = "Upgrade to Premium";
  upgradeBtn.disabled = false;
  upgradeBtn.addEventListener("click", handleUpgrade, { once: true });
}
