// Completes the "forgot password" flow. Supabase's reset email links back
// to this page with a recovery token in the URL, which the client library
// auto-detects (detectSessionInUrl defaults to true) and turns into a
// temporary "recovery" session — that's what lets updateUser({password})
// below work without the user re-entering their old password.

const rEls = {
  form: document.getElementById("reset-form"),
  invalid: document.getElementById("reset-invalid"),
  done: document.getElementById("reset-done"),
  password: document.getElementById("reset-password"),
  confirm: document.getElementById("reset-password-confirm"),
  btn: document.getElementById("reset-btn"),
  msg: document.getElementById("reset-msg"),
};

let hasRecoverySession = false;

document.addEventListener("DOMContentLoaded", () => {
  // Fires once supabase-js has parsed the recovery token out of the URL.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      hasRecoverySession = true;
    }
  });

  // Fallback check in case the event already fired before we attached
  // the listener (can happen depending on load timing).
  setTimeout(async () => {
    if (hasRecoverySession) return;
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      hasRecoverySession = true;
    } else {
      showInvalidState();
    }
  }, 1500);

  rEls.form.addEventListener("submit", handleReset);
});

function showInvalidState() {
  rEls.form.classList.add("hidden");
  rEls.invalid.classList.remove("hidden");
}

async function handleReset(e) {
  e.preventDefault();
  hideMsg(rEls.msg);

  if (!hasRecoverySession) {
    showMsg(rEls.msg, "This reset link isn't valid anymore. Please request a new one.");
    return;
  }

  const password = rEls.password.value;
  const confirm = rEls.confirm.value;

  if (password.length < 8) {
    showMsg(rEls.msg, "Password must be at least 8 characters.");
    return;
  }
  if (password !== confirm) {
    showMsg(rEls.msg, "Passwords don't match.");
    return;
  }

  setLoading(rEls.btn, true, "Update password");
  const { error } = await supabaseClient.auth.updateUser({ password });
  setLoading(rEls.btn, false, "Update password");

  if (error) {
    showMsg(rEls.msg, error.message);
    return;
  }

  // Sign out of the temporary recovery session so the person lands back
  // on a clean sign-in form and confirms their new password works.
  await supabaseClient.auth.signOut();
  rEls.form.classList.add("hidden");
  rEls.done.classList.remove("hidden");
}
