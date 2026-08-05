// Onboarding form: writes the structured profile (Section 3.2 of the report) to Supabase

let currentUser = null;
let uploadedPhotoUrl = null;

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;

  // Prefill the form if a profile already exists (edit mode)
  const { data: existing } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const form = document.getElementById("onboarding-form");
    Object.entries(existing).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field && value !== null && value !== undefined) field.value = value;
    });
    if (existing.photo_url) {
      uploadedPhotoUrl = existing.photo_url;
    }
  }

  const preview = document.getElementById("onboarding-avatar-preview");
  if (!uploadedPhotoUrl) preview.textContent = initials(existing?.full_name || currentUser.email);

  initAvatarPicker({
    fileInputId: "onboarding-avatar-input",
    previewElId: "onboarding-avatar-preview",
    userId: currentUser.id,
    existingUrl: uploadedPhotoUrl,
    onUploaded: (url) => {
      uploadedPhotoUrl = url;
      document.getElementById("avatar-upload-hint").textContent = "";
      hideMsg(document.getElementById("onboarding-msg"));
    },
    onError: (msg) => {
      document.getElementById("avatar-upload-hint").textContent = msg;
      document.getElementById("avatar-upload-hint").style.color = "var(--danger)";
    },
  });

  // Wire up range slider live values
  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const out = document.getElementById(range.id + "-val");
    const update = () => (out.textContent = range.value);
    range.addEventListener("input", update);
    update();
  });

  document.getElementById("onboarding-form").addEventListener("submit", handleSubmit);
});

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("save-profile-btn");
  const msg = document.getElementById("onboarding-msg");
  hideMsg(msg);

  if (!uploadedPhotoUrl) {
    showMsg(msg, "Please add a profile photo before continuing — it's required so matches can see who they'd be talking to.");
    document.getElementById("onboarding-avatar-input").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());

  const payload = {
    id: currentUser.id,
    full_name: data.full_name,
    email: currentUser.email,
    photo_url: uploadedPhotoUrl,
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

  setLoading(btn, true, "Save & see matches");

  const { error } = await supabaseClient.from("profiles").upsert(payload);

  setLoading(btn, false, "Save & see matches");

  if (error) {
    showMsg(msg, error.message);
    return;
  }

  window.location.href = "dashboard.html";
}
