// Onboarding wizard: 4-step form that writes the structured profile
// (Section 3.2 of the report) to Supabase.

let currentUser = null;
let currentStep = 1;
const TOTAL_STEPS = 4;

// Fields required to advance out of each step
const STEP_REQUIRED_FIELDS = {
  1: ["full_name"],
  2: ["city", "budget_min", "budget_max"],
  3: [],
  4: ["bio"],
};

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

  // Prefill the form if a profile already exists (edit mode)
  const { data: existing } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing && (await enforceActiveStatus(existing))) return;

  if (existing) {
    const form = document.getElementById("onboarding-form");
    Object.entries(existing).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field && value !== null && value !== undefined) field.value = value;
    });
  }

  // Wire up range slider live values
  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const out = document.getElementById(range.id + "-val");
    const update = () => (out.textContent = range.value);
    range.addEventListener("input", update);
    update();
  });

  // Wizard navigation
  document.querySelectorAll(".wizard-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      goToStep(parseInt(btn.dataset.next, 10));
    });
  });
  document.querySelectorAll(".wizard-back").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.back, 10)));
  });

  document.getElementById("onboarding-form").addEventListener("submit", handleSubmit);
});

function validateStep(step) {
  const msg = document.getElementById("onboarding-msg");
  hideMsg(msg);
  const form = document.getElementById("onboarding-form");
  const required = STEP_REQUIRED_FIELDS[step] || [];

  for (const name of required) {
    const field = form.elements[name];
    if (field && !String(field.value || "").trim()) {
      showMsg(msg, "Please fill in all required fields before continuing.");
      field.focus();
      return false;
    }
  }

  if (step === 2) {
    const min = parseInt(form.elements["budget_min"].value, 10);
    const max = parseInt(form.elements["budget_max"].value, 10);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      showMsg(msg, "Minimum budget can't be higher than the maximum.");
      return false;
    }
  }

  return true;
}

function goToStep(step) {
  currentStep = Math.max(1, Math.min(TOTAL_STEPS, step));

  document.querySelectorAll(".wizard-panel").forEach((panel) => {
    panel.classList.toggle("active", parseInt(panel.dataset.panel, 10) === currentStep);
  });

  document.querySelectorAll(".wizard-step").forEach((stepEl) => {
    const n = parseInt(stepEl.dataset.step, 10);
    stepEl.classList.toggle("active", n === currentStep);
    stepEl.classList.toggle("done", n < currentStep);
  });

  document.querySelectorAll(".wizard-step-line").forEach((line, idx) => {
    line.classList.toggle("done", idx + 1 < currentStep);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateStep(4)) return;

  const form = e.target;
  const btn = document.getElementById("save-profile-btn");
  const msg = document.getElementById("onboarding-msg");
  hideMsg(msg);

  const data = Object.fromEntries(new FormData(form).entries());

  const payload = {
    id: currentUser.id,
    full_name: data.full_name,
    email: currentUser.email,
    mobile_number: data.mobile_number || null,
    date_of_birth: data.date_of_birth || null,
    age: data.age ? parseInt(data.age, 10) : null,
    gender: data.gender || null,
    city: data.city,
    preferred_area: data.preferred_area,
    budget_min: parseInt(data.budget_min, 10),
    budget_max: parseInt(data.budget_max, 10),
    sleep_schedule: parseInt(data.sleep_schedule, 10),
    cleanliness: parseInt(data.cleanliness, 10),
    guest_frequency: parseInt(data.guest_frequency, 10),
    personality: parseInt(data.personality, 10),
    smoking_drinking: data.smoking_drinking,
    cooking_habits: data.cooking_habits,
    conflict_style: data.conflict_style,
    bio: data.bio,
    updated_at: new Date().toISOString(),
  };

  setLoading(btn, true, "Save & see matches ✓");

  const { error } = await supabaseClient.from("profiles").upsert(payload);

  setLoading(btn, false, "Save & see matches ✓");

  if (error) {
    showMsg(msg, error.message);
    return;
  }

  window.location.href = "dashboard.html";
}
