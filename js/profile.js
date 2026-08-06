// Account / profile settings page

let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  currentProfile = profile || {};
  populateForm();
  wireEvents();
});

function populateForm() {
  document.getElementById("profile-avatar").textContent = initials(currentProfile.full_name);
  document.getElementById("profile-avatar").style.background = avatarColor(currentUser.id);
  if (currentProfile.photo_url) {
    document.getElementById("profile-avatar").style.backgroundImage = `url(${currentProfile.photo_url})`;
    document.getElementById("profile-avatar").textContent = "";
  }

  document.getElementById("photo_url").value = currentProfile.photo_url || "";
  document.getElementById("profile-full-name").value = currentProfile.full_name || "";
  document.getElementById("profile-email").value = currentUser.email || "";
  document.getElementById("profile-mobile").value = currentProfile.mobile_number || "";
  document.getElementById("profile-dob").value = currentProfile.date_of_birth || "";

  const prefs = currentProfile.notif_prefs || { match_alerts: true, email_updates: true };
  document.getElementById("notif-match-alerts").checked = prefs.match_alerts !== false;
  document.getElementById("notif-email-updates").checked = prefs.email_updates !== false;

  document.getElementById("dark-mode-toggle").checked = !!currentProfile.dark_mode;
  applyDarkMode(!!currentProfile.dark_mode);
}

function wireEvents() {
  const msg = document.getElementById("account-msg");

  document.getElementById("save-profile-basics-btn").addEventListener("click", async () => {
    const btn = document.getElementById("save-profile-basics-btn");
    hideMsg(msg);
    setLoading(btn, true, "Save changes");

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        full_name: document.getElementById("profile-full-name").value.trim(),
        mobile_number: document.getElementById("profile-mobile").value.trim() || null,
        date_of_birth: document.getElementById("profile-dob").value || null,
        photo_url: document.getElementById("photo_url").value.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentUser.id);

    setLoading(btn, false, "Save changes");

    if (error) {
      showMsg(msg, error.message);
      return;
    }
    showMsg(msg, "Profile updated.", "ok");
  });

  document.getElementById("notif-match-alerts").addEventListener("change", saveNotifPrefs);
  document.getElementById("notif-email-updates").addEventListener("change", saveNotifPrefs);

  document.getElementById("dark-mode-toggle").addEventListener("change", async (e) => {
    applyDarkMode(e.target.checked);
    await supabaseClient
      .from("profiles")
      .update({ dark_mode: e.target.checked })
      .eq("id", currentUser.id);
  });

  document.getElementById("change-password-btn").addEventListener("click", async () => {
    const pw = document.getElementById("new-password").value;
    if (!pw) {
      showMsg(msg, "Enter a new password first.");
      return;
    }
    if (pw.length < 8) {
      showMsg(msg, "Password must be at least 8 characters.");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) {
      showMsg(msg, error.message);
      return;
    }
    document.getElementById("new-password").value = "";
    showMsg(msg, "Password updated.", "ok");
  });

  document.getElementById("logout-all-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut({ scope: "global" });
    window.location.href = "login.html";
  });

  document.getElementById("logout-btn-top").addEventListener("click", doLogout);
  document.getElementById("logout-btn-bottom").addEventListener("click", doLogout);

  document.getElementById("delete-account-btn").addEventListener("click", handleDeleteAccount);

  // Highlight active section in left nav on scroll
  const navLinks = Array.from(document.querySelectorAll(".account-nav a"));
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
  window.addEventListener("scroll", () => {
    let activeIdx = 0;
    sections.forEach((sec, i) => {
      if (sec && sec.getBoundingClientRect().top < 140) activeIdx = i;
    });
    navLinks.forEach((a, i) => a.classList.toggle("active", i === activeIdx));
  });
}

async function saveNotifPrefs() {
  const prefs = {
    match_alerts: document.getElementById("notif-match-alerts").checked,
    email_updates: document.getElementById("notif-email-updates").checked,
  };
  await supabaseClient.from("profiles").update({ notif_prefs: prefs }).eq("id", currentUser.id);
}

function applyDarkMode(on) {
  // Site now defaults to the dark ZeroSmoke-matched theme; this toggle
  // switches TO the light/cream variant when "on".
  document.body.classList.toggle("light", on);
}

async function doLogout(e) {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function handleDeleteAccount() {
  const confirmed = window.confirm(
    "This deletes your profile and match data permanently. This can't be undone. Continue?"
  );
  if (!confirmed) return;

  const msg = document.getElementById("account-msg");
  const btn = document.getElementById("delete-account-btn");
  setLoading(btn, true, "Delete account");

  // Note: this deletes the user's profile row, which is all the browser's
  // anon key is permitted to do under Row Level Security. Fully deleting
  // the underlying auth.users record requires the service_role key, which
  // must never be exposed in client-side code — that step needs a small
  // server-side/Edge Function call using the service_role key server-side.
  const { error } = await supabaseClient.from("profiles").delete().eq("id", currentUser.id);

  setLoading(btn, false, "Delete account");

  if (error) {
    showMsg(msg, error.message);
    return;
  }

  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
