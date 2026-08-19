// Account / profile settings page
let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = "login.html"; return; }
  currentUser = user;
  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (await enforceActiveStatus(profile)) return;
  currentProfile = profile || {};
  populateForm();
  wireEvents();
});

function populateForm() {
  document.getElementById("profile-avatar").textContent = initials(currentProfile.full_name);
  document.getElementById("profile-avatar").style.background = avatarColor(currentUser.id);
  if (currentProfile.photo_url) { document.getElementById("profile-avatar").style.backgroundImage = `url(${currentProfile.photo_url})`; document.getElementById("profile-avatar").textContent = ""; }
  document.getElementById("photo_url").value = currentProfile.photo_url || "";
  document.getElementById("profile-full-name").value = currentProfile.full_name || "";
  document.getElementById("profile-email").value = currentUser.email || "";
  document.getElementById("profile-mobile").value = currentProfile.mobile_number || "";
  document.getElementById("profile-dob").value = currentProfile.date_of_birth || "";
  document.getElementById("profile-location-address").value = currentProfile.location_address || "";
  document.getElementById("profile-location-city").value = currentProfile.location_city || "";
  document.getElementById("profile-location-area").value = currentProfile.location_area || "";
  document.getElementById("profile-location-lat").value = currentProfile.location_latitude ?? "";
  document.getElementById("profile-location-lng").value = currentProfile.location_longitude ?? "";
  document.getElementById("profile-location-place-id").value = currentProfile.location_place_id || "";
  if (currentProfile.location_latitude != null && currentProfile.location_longitude != null) {
    document.getElementById("location-status").textContent = `Location saved. GPS accuracy: ${currentProfile.location_accuracy_meters ? Math.round(currentProfile.location_accuracy_meters) + " m" : "not provided"}. Exact coordinates remain private.`;
  }
  const prefs = currentProfile.notif_prefs || { match_alerts: true, email_updates: true };
  document.getElementById("notif-match-alerts").checked = prefs.match_alerts !== false;
  document.getElementById("notif-email-updates").checked = prefs.email_updates !== false;
  document.getElementById("dark-mode-toggle").checked = !!currentProfile.dark_mode;
  applyDarkMode(!!currentProfile.dark_mode);
  renderPlanSection();
}

function renderPlanSection() {
  const badge = document.getElementById("plan-badge"), hint = document.getElementById("plan-hint"), cta = document.getElementById("plan-cta-btn");
  if (currentProfile.is_premium) {
    badge.textContent = "✨ Premium"; badge.classList.remove("free");
    const since = currentProfile.premium_since ? new Date(currentProfile.premium_since).toLocaleDateString() : null;
    hint.textContent = since ? `Premium since ${since}. Unlimited matches, cross-city search, priority placement, and icebreakers are unlocked.` : "Unlimited matches, cross-city search, priority placement, and icebreakers are unlocked.";
    cta.textContent = "Manage plan"; cta.href = "pricing.html";
  } else { badge.textContent = "Free"; badge.classList.add("free"); hint.textContent = "Upgrade for unlimited matches, cross-city search, priority placement, and icebreaker suggestions."; cta.textContent = "Upgrade to Premium"; cta.href = "pricing.html"; }
}

function wireEvents() {
  const msg = document.getElementById("account-msg");
  document.getElementById("save-profile-basics-btn").addEventListener("click", async () => {
    const btn = document.getElementById("save-profile-basics-btn"); hideMsg(msg); setLoading(btn, true, "Save changes");
    const lat = parseFloat(document.getElementById("profile-location-lat").value);
    const lng = parseFloat(document.getElementById("profile-location-lng").value);
    const locationPayload = {
      location_address: document.getElementById("profile-location-address").value.trim() || null,
      location_city: document.getElementById("profile-location-city").value.trim() || null,
      location_area: document.getElementById("profile-location-area").value.trim() || null,
      location_latitude: Number.isFinite(lat) ? lat : null,
      location_longitude: Number.isFinite(lng) ? lng : null,
      location_place_id: document.getElementById("profile-location-place-id").value.trim() || null,
      location_updated_at: (Number.isFinite(lat) && Number.isFinite(lng)) ? new Date().toISOString() : currentProfile.location_updated_at || null,
    };
    const { error } = await supabaseClient.from("profiles").update({
      full_name: document.getElementById("profile-full-name").value.trim(),
      mobile_number: document.getElementById("profile-mobile").value.trim() || null,
      date_of_birth: document.getElementById("profile-dob").value || null,
      photo_url: document.getElementById("photo_url").value.trim() || null,
      ...locationPayload,
      updated_at: new Date().toISOString(),
    }).eq("id", currentUser.id);
    setLoading(btn, false, "Save changes");
    if (error) { showMsg(msg, error.message); return; }
    currentProfile = { ...currentProfile, ...locationPayload };
    showMsg(msg, "Profile and location updated.", "ok");
  });

  document.getElementById("use-location-btn").addEventListener("click", useCurrentLocation);
  document.getElementById("photo-file").addEventListener("change", handlePhotoUpload);
  document.getElementById("notif-match-alerts").addEventListener("change", saveNotifPrefs);
  document.getElementById("notif-email-updates").addEventListener("change", saveNotifPrefs);
  document.getElementById("dark-mode-toggle").addEventListener("change", async (e) => { applyDarkMode(e.target.checked); await supabaseClient.from("profiles").update({ dark_mode: e.target.checked }).eq("id", currentUser.id); });
  document.getElementById("change-password-btn").addEventListener("click", async () => {
    const pw = document.getElementById("new-password").value;
    if (!pw) { showMsg(msg, "Enter a new password first."); return; }
    if (pw.length < 8) { showMsg(msg, "Password must be at least 8 characters."); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) { showMsg(msg, error.message); return; }
    document.getElementById("new-password").value = ""; showMsg(msg, "Password updated.", "ok");
  });
  document.getElementById("logout-all-btn").addEventListener("click", async () => { await supabaseClient.auth.signOut({ scope: "global" }); window.location.href = "login.html"; });
  document.getElementById("logout-btn-top").addEventListener("click", doLogout);
  document.getElementById("logout-btn-bottom").addEventListener("click", doLogout);
  document.getElementById("delete-account-btn").addEventListener("click", handleDeleteAccount);
  const navLinks = Array.from(document.querySelectorAll(".account-nav a"));
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
  window.addEventListener("scroll", () => { let activeIdx = 0; sections.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top < 140) activeIdx = i; }); navLinks.forEach((a, i) => a.classList.toggle("active", i === activeIdx)); });
}

function useCurrentLocation() {
  const btn = document.getElementById("use-location-btn");
  const status = document.getElementById("location-status");
  const msg = document.getElementById("account-msg");
  if (!navigator.geolocation) { showMsg(msg, "This browser does not support location access."); return; }
  setLoading(btn, true, "📍 Use my current location");
  status.textContent = "Requesting your location permission…";
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    document.getElementById("profile-location-lat").value = latitude;
    document.getElementById("profile-location-lng").value = longitude;
    document.getElementById("profile-location-place-id").value = "";
    status.textContent = `GPS location captured (${Math.round(accuracy)} m accuracy). Click Save changes to store it.`;
    setLoading(btn, false, "📍 Use my current location");
    // Reverse geocode with OpenStreetMap Nominatim to make the location readable.
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const a = data.address || {};
        document.getElementById("profile-location-address").value = data.display_name || "";
        document.getElementById("profile-location-city").value = a.city || a.town || a.municipality || a.village || a.state_district || "";
        document.getElementById("profile-location-area").value = a.suburb || a.neighbourhood || a.city_district || a.quarter || "";
      }
    } catch (_) { /* Coordinates are still usable if reverse geocoding fails. */ }
  }, (error) => {
    setLoading(btn, false, "📍 Use my current location");
    status.textContent = "Location permission was not granted.";
    showMsg(msg, error.code === 1 ? "Please allow location access in your browser and try again." : "Couldn't get your location. You can enter the area manually.");
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

async function handlePhotoUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const msg = document.getElementById("account-msg"), hint = document.getElementById("photo-upload-hint"); hideMsg(msg);
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) { showMsg(msg, "Please choose a JPG, PNG, or WEBP image."); e.target.value = ""; return; }
  if (file.size > 5 * 1024 * 1024) { showMsg(msg, "That image is too large — please pick one under 5MB."); e.target.value = ""; return; }
  const avatarEl = document.getElementById("profile-avatar"), originalHint = hint.textContent; hint.textContent = "Uploading…";
  const ext = file.name.split(".").pop().toLowerCase(), path = `${currentUser.id}/avatar.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
  if (uploadError) { hint.textContent = originalHint; showMsg(msg, /bucket not found/i.test(uploadError.message) ? "Photo uploads aren't set up yet — ask an admin to create the 'avatars' storage bucket (see sql/schema.sql)." : "Couldn't upload photo: " + uploadError.message); e.target.value = ""; return; }
  const { data: { publicUrl } } = supabaseClient.storage.from("avatars").getPublicUrl(path);
  const bustedUrl = `${publicUrl}?t=${Date.now()}`;
  const { error: updateError } = await supabaseClient.from("profiles").update({ photo_url: bustedUrl, updated_at: new Date().toISOString() }).eq("id", currentUser.id);
  hint.textContent = originalHint;
  if (updateError) { showMsg(msg, "Photo uploaded but couldn't save to your profile: " + updateError.message); return; }
  currentProfile.photo_url = bustedUrl; document.getElementById("photo_url").value = bustedUrl; avatarEl.style.backgroundImage = `url(${bustedUrl})`; avatarEl.textContent = ""; showMsg(msg, "Profile photo updated.", "ok");
}

async function saveNotifPrefs() { const prefs = { match_alerts: document.getElementById("notif-match-alerts").checked, email_updates: document.getElementById("notif-email-updates").checked }; await supabaseClient.from("profiles").update({ notif_prefs: prefs }).eq("id", currentUser.id); }
function applyDarkMode(on) { document.body.classList.toggle("light", on); }
async function doLogout(e) { e.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = "login.html"; }
async function handleDeleteAccount() {
  const confirmed = window.confirm("This deletes your profile and match data permanently. This can't be undone. Continue?"); if (!confirmed) return;
  const msg = document.getElementById("account-msg"), btn = document.getElementById("delete-account-btn"); setLoading(btn, true, "Delete account");
  const { error } = await supabaseClient.from("profiles").delete().eq("id", currentUser.id); setLoading(btn, false, "Delete account");
  if (error) { showMsg(msg, error.message); return; }
  await supabaseClient.auth.signOut(); window.location.href = "login.html";
}
