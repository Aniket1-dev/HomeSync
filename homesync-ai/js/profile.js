// Account / profile settings page

let currentUser = null;
let currentProfile = null;
let profilePhotoUrl = null;

const LEGAL_TEXT = {
  privacy:
    "Privacy Policy (prototype placeholder) — HomeSync AI is a B.Tech Project-II student prototype, not a live commercial product. " +
    "Your profile fields, bio, mobile number and email are stored in Supabase and shown only to other signed-in users for matching purposes. " +
    "Don't enter sensitive personal information you're not comfortable sharing with other users of this prototype.",
  terms:
    "Terms & Conditions (prototype placeholder) — By using this prototype you understand it's an academic project, not a production service. " +
    "No liability is accepted for matches made through the app. Use your own judgement when meeting anyone you connect with here.",
  disclaimer:
    "Disclaimer — HomeSync AI does not verify the identity of users. Always exercise normal safety precautions (meet in public first, " +
    "verify identity independently) before entering any living arrangement with someone you matched with here.",
};

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.status === "suspended") {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html?suspended=1";
    return;
  }

  currentProfile = profile || {};
  populateForm();
  wireEvents();

  if (currentProfile.role === "admin") {
    document.getElementById("admin-link")?.classList.remove("hidden");
  }
  await initNotifications(user.id);
});

function populateForm() {
  profilePhotoUrl = currentProfile.photo_url || null;

  document.getElementById("profile-avatar").textContent = initials(currentProfile.full_name);
  document.getElementById("profile-avatar").style.background = avatarColor(currentUser.id);
  if (currentProfile.photo_url) {
    document.getElementById("profile-avatar").style.backgroundImage = `url(${currentProfile.photo_url})`;
    document.getElementById("profile-avatar").textContent = "";
  }

  initAvatarPicker({
    fileInputId: "profile-avatar-input",
    previewElId: "profile-avatar",
    userId: currentUser.id,
    existingUrl: currentProfile.photo_url || null,
    onUploaded: async (url) => {
      profilePhotoUrl = url;
      document.getElementById("profile-avatar-hint").textContent = "Saved.";
      document.getElementById("profile-avatar-hint").style.color = "var(--sage)";
      await supabaseClient.from("profiles").update({ photo_url: url }).eq("id", currentUser.id);
    },
    onError: (msg) => {
      document.getElementById("profile-avatar-hint").textContent = msg;
      document.getElementById("profile-avatar-hint").style.color = "var(--danger)";
    },
  });

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
    window.location.href = "index.html";
  });

  document.getElementById("logout-btn-top").addEventListener("click", doLogout);
  document.getElementById("logout-btn-bottom").addEventListener("click", doLogout);

  document.getElementById("delete-account-btn").addEventListener("click", handleDeleteAccount);

  document.getElementById("privacy-link").addEventListener("click", (e) => {
    e.preventDefault();
    showMsg(msg, LEGAL_TEXT.privacy, "ok");
  });
  document.getElementById("terms-link").addEventListener("click", (e) => {
    e.preventDefault();
    showMsg(msg, LEGAL_TEXT.terms, "ok");
  });
  document.getElementById("disclaimer-link").addEventListener("click", (e) => {
    e.preventDefault();
    showMsg(msg, LEGAL_TEXT.disclaimer, "ok");
  });

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
  document.body.classList.toggle("dark", on);
}

async function doLogout(e) {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
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
  window.location.href = "index.html";
}
