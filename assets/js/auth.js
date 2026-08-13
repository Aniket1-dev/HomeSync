// ============================================================================
// Smitten — Auth helpers
// Loaded after supabase-client.js. Wraps supabase-js auth calls and adds the
// page guards used across the app (requireAuth / requireAdmin / redirectIfAuthed).
// ============================================================================
const AUTH = (() => {
  function client() {
    if (!window.sb) throw new Error("Supabase client not initialized — check supabase-config.js");
    return window.sb;
  }

  // Where the Google OAuth flow lands after redirecting back from Google.
  // Relative, so it works whether this is served from repo root or a GitHub
  // Pages project subpath (username.github.io/repo/...).
  function callbackUrl() {
    return new URL("auth-callback.html", window.location.href).toString();
  }

  async function getSession() {
    const { data, error } = await client().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getUser() {
    const { data, error } = await client().auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function signUpWithEmail(email, password, fullName) {
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: callbackUrl(), // confirmed users land on auth-callback.html, same as Google
      },
    });
    if (error) throw error;
    return data; // data.session is null if email confirmation is required
  }

  async function signInWithEmail(email, password) {
    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { error } = await client().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(),
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) throw error;
    // Browser navigates away to Google — nothing else to do here.
  }

  async function sendPasswordReset(email) {
    const { error } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: new URL("reset-password.html", window.location.href).toString(),
    });
    if (error) throw error;
  }

  // ---- Email OTP (6-digit code) verification -----------------------------
  // These pair with the "Confirm signup" / "Reset password" email templates
  // in the Supabase dashboard, which must include {{ .Token }} for a code to
  // actually be emailed (see README → "Email OTP verification"). Without
  // that template edit, Supabase only sends a link and these will have
  // nothing to verify against.

  // Verifies the 6-digit code sent on signup. On success supabase-js stores
  // the new session automatically, same as clicking the email link would.
  async function verifySignupOtp(email, token) {
    const { data, error } = await client().auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) throw error;
    return data; // { user, session }
  }

  // Verifies the 6-digit code sent for a password-reset request. On success
  // a recovery session is set, so updatePassword() can be called right after.
  async function verifyRecoveryOtp(email, token) {
    const { data, error } = await client().auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });
    if (error) throw error;
    return data; // { user, session }
  }

  // Re-sends the signup confirmation email (link + code) for someone who
  // never got it or let the code expire.
  async function resendSignupEmail(email) {
    const { error } = await client().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const { error } = await client().auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function signOut() {
    await client().auth.signOut();
    window.location.href = "index.html";
  }

  // Safety net: the DB trigger (handle_new_auth_user in schema.sql) is what
  // actually provisions public.users/public.profiles on signup. This upsert
  // just guards against that trigger not being installed yet, or metadata
  // that arrived after the trigger ran (e.g. a slower OAuth round trip).
  async function ensureUserRow(user) {
    if (!user) return;
    const { error } = await client()
      .from("users")
      .upsert(
        { id: user.id, email: user.email, email_verified: !!user.email_confirmed_at },
        { onConflict: "id" }
      );
    if (error) console.warn("ensureUserRow:", error.message);
  }

  async function hasProfile(userId) {
    const { data, error } = await client()
      .from("profiles")
      .select("user_id, display_name, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("hasProfile:", error.message);
      return false;
    }
    return !!data;
  }

  async function isAdmin(userId) {
    const { data, error } = await client()
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false; // RLS hides the row entirely for non-admins
    return !!data;
  }

  // Pages that gate on auth/admin include an inline
  // `<style id="auth-gate">html{visibility:hidden}</style>` in <head> so
  // nothing paints until the check below resolves — this reveals the page
  // (or never does, if we redirect away first).
  function reveal() {
    document.documentElement.style.visibility = "visible";
    var gate = document.getElementById("auth-gate");
    if (gate) gate.remove();
  }

  // Call at the top of any page that requires a logged-in user.
  // Redirects to login.html (preserving the intended destination) if there's
  // no session.
  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname.split("/").pop());
      window.location.href = `login.html?next=${next}`;
      return null;
    }
    if (await isBlocked(session.user.id)) {
      await client().auth.signOut();
      window.location.href = "login.html?blocked=1";
      return null;
    }
    reveal();
    return session;
  }

  // Suspended/blocked accounts (set by an admin) are locked out even with a
  // valid session — checked against public.users.status on every gated page.
  async function isBlocked(userId) {
    const { data, error } = await client().from("users").select("status").eq("id", userId).maybeSingle();
    if (error || !data) return false;
    return data.status === "suspended" || data.status === "blocked";
  }

  // Call at the top of any /admin/* page. Redirects non-admins to the
  // dashboard even if they type the admin URL directly — this is a UX nicety
  // only; the real boundary is the RLS `is_admin()` check on every table, so
  // a bypassed redirect still can't read/write admin-only data.
  async function requireAdmin() {
    const session = await getSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname.split("/").pop());
      window.location.href = `login.html?next=${next}`;
      return null;
    }
    const admin = await isAdmin(session.user.id);
    if (!admin) {
      window.location.href = "dashboard.html";
      return null;
    }
    reveal();
    return session;
  }

  // Call at the top of login.html / signup.html — bounce already-logged-in
  // users straight to their dashboard.
  async function redirectIfAuthed(target = "dashboard.html") {
    const session = await getSession();
    if (session) window.location.href = target;
  }

  return {
    getSession,
    getUser,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    verifySignupOtp,
    verifyRecoveryOtp,
    resendSignupEmail,
    updatePassword,
    signOut,
    ensureUserRow,
    hasProfile,
    isAdmin,
    isBlocked,
    requireAuth,
    requireAdmin,
    redirectIfAuthed,
    reveal,
  };
})();
