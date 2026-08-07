// Admin Portal auth: signs in with email/password, then verifies
// profiles.is_admin = true before granting access to admin.html.
// If the signed-in account is NOT an admin, it is signed out again —
// the admin portal never trusts a regular session.

document.addEventListener("DOMContentLoaded", () => {
  const msg = document.getElementById("admin-msg");

  // If already signed in as an admin, skip straight to the portal.
  supabaseClient.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;
    const isAdmin = await checkIsAdmin(data.session.user.id);
    if (isAdmin) window.location.href = "admin.html";
  });

  document.getElementById("admin-login-form").addEventListener("submit", handleAdminLogin);
});

async function checkIsAdmin(userId) {
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!profile?.is_admin;
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const msg = document.getElementById("admin-msg");
  const btn = document.getElementById("admin-login-btn");
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  hideMsg(msg);

  if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
    showMsg(msg, "Enter a valid admin email and password.");
    return;
  }

  setLoading(btn, true, "Sign in to Admin Portal");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setLoading(btn, false, "Sign in to Admin Portal");
    showMsg(msg, /invalid login credentials/i.test(error.message) ? "Incorrect email or password." : error.message);
    return;
  }

  const isAdmin = await checkIsAdmin(data.user.id);

  setLoading(btn, false, "Sign in to Admin Portal");

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    showMsg(msg, "This account doesn't have admin access.");
    return;
  }

  window.location.href = "admin.html";
}
