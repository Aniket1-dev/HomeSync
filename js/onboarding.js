// Onboarding wizard: 4-step form that writes the structured profile
// and the 15-question lifestyle compatibility profile to Supabase.

let currentUser = null;
let currentStep = 1;
const TOTAL_STEPS = 4;

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

  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const out = document.getElementById(range.id + "-val");
    if (!out) return;
    const update = () => (out.textContent = range.value);
    range.addEventListener("input", update);
    update();
  });

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

function mapCompatibilityToLegacyProfile(compatibility) {
  const a = compatibility?.answers || {};
  const value = (key) => a[key] == null ? null : Number(a[key]) + 1;

  const sleep = value("sleep_time");
  const clean = value("clean_room");
  const guests = value("guest_frequency");
  const personality = value("social_energy");
  const conflictIndex = a.noise_conflict == null ? null : Number(a.noise_conflict);
  const smokingIndex = a.smoking_home == null ? null : Number(a.smoking_home);

  return {
    sleep_schedule: sleep,
    cleanliness: clean,
    guest_frequency: guests,
    personality,
    conflict_style: conflictIndex == null ? null : (conflictIndex === 0 ? "avoids" : conflictIndex === 1 ? "discusses" : "confronts"),
    smoking_drinking: smokingIndex == null ? null : (smokingIndex === 0 ? "never" : smokingIndex === 3 ? "regular" : "social"),
  };
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateStep(4)) return;

  const form = e.target;
  const btn = document.getElementById("save-profile-btn");
  const msg = document.getElementById("onboarding-msg");
  hideMsg(msg);

  const data = Object.fromEntries(new FormData(form).entries());
  const compatibility = window.homesyncCompatibilityAnswers || null;
  const legacy = mapCompatibilityToLegacyProfile(compatibility);

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
    sleep_schedule: legacy.sleep_schedule ?? null,
    cleanliness: legacy.cleanliness ?? null,
    guest_frequency: legacy.guest_frequency ?? null,
    personality: legacy.personality ?? null,
    smoking_drinking: legacy.smoking_drinking,
    cooking_habits: data.cooking_habits || null,
    conflict_style: legacy.conflict_style,
    compatibility_answers: compatibility?.answers || {},
    compatibility_dealbreakers: compatibility?.dealbreakers || [],
    bio: data.bio,
    updated_at: new Date().toISOString(),
  };

  setLoading(btn, true, "Save & see matches ✓");

  const { error } = await supabaseClient.from("profiles").upsert(payload);

  if (error) {
    setLoading(btn, false, "Save & see matches ✓");
    showMsg(msg, error.message);
    return;
  }

  if (compatibility) {
    const { error: questionnaireError } = await supabaseClient
      .from("roommate_questionnaire")
      .upsert({
        user_id: currentUser.id,
        answers: compatibility.answers || {},
        dealbreakers: compatibility.dealbreakers || [],
        compatibility_version: compatibility.version || 1,
        completed_at: compatibility.completed_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (questionnaireError) {
      setLoading(btn, false, "Save & see matches ✓");
      showMsg(msg, "Profile saved, but compatibility answers could not be saved: " + questionnaireError.message);
      return;
    }
  }

  setLoading(btn, false, "Save & see matches ✓");
  window.location.href = "dashboard.html";
}
