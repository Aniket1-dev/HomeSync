// Auth flows: Google OAuth + Email/Password Sign in & Sign up
// Requires: supabaseClient.js loaded first

const els = {
  tabSignin: document.getElementById("tab-signin"),
  tabSignup: document.getElementById("tab-signup"),

  signinStep: document.getElementById("signin-step"),
  signupStep: document.getElementById("signup-step"),
  confirmStep: document.getElementById("confirm-step"),

  signinEmail: document.getElementById("signin-email"),
  signinPassword: document.getElementById("signin-password"),
  signinBtn: document.getElementById("signin-btn"),
  forgotPasswordBtn: document.getElementById("forgot-password-btn"),

  signupName: document.getElementById("signup-name"),
  signupEmail: document.getElementById("signup-email"),
  signupPassword: document.getElementById("signup-password"),
  signupBtn: document.getElementById("signup-btn"),

  confirmEmailLabel: document.getElementById("confirm-email-label"),
  backToSigninBtn: document.getElementById("back-to-signin-btn"),

  googleBtn: document.getElementById("google-btn"),
  msg: document.getElementById("auth-msg"),
};

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, skip straight to app
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) redirectAfterLogin();
  });

  els.tabSignin?.addEventListener("click", () => showStep("signin"));
  els.tabSignup?.addEventListener("click", () => showStep("signup"));
  els.backToSigninBtn?.addEventListener("click", () => showStep("signin"));

  els.signinStep?.addEventListener("submit", handleSignIn);
  els.signupStep?.addEventListener("submit", handleSignUp);
  els.forgotPasswordBtn?.addEventListener("click", handleForgotPassword);
  els.googleBtn?.addEventListener("click", handleGoogleSignIn);
});

function showStep(step) {
  hideMsg(els.msg);
  els.signinStep.classList.toggle("hidden", step !== "signin");
  els.signupStep.classList.toggle("hidden", step !== "signup");
  els.confirmStep.classList.toggle("hidden", step !== "confirm");
  els.tabSignin.classList.toggle("active", step === "signin");
  els.tabSignup.classList.toggle("active", step === "signup");
}

async function handleGoogleSignIn() {
  hideMsg(els.msg);
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/login.html" },
  });
  if (error) showMsg(els.msg, error.message);
}

async function handleSignIn(e) {
  e.preventDefault();
  const email = els.signinEmail.value.trim();
  const password = els.signinPassword.value;

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showMsg(els.msg, "Enter a valid email address.");
    return;
  }
  if (!password) {
    showMsg(els.msg, "Enter your password.");
    return;
  }

  hideMsg(els.msg);
  setLoading(els.signinBtn, true, "Sign in");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  setLoading(els.signinBtn, false, "Sign in");

  if (error) {
    // Supabase returns this exact message when the account exists but
    // hasn't clicked the confirmation link yet.
    if (/email not confirmed/i.test(error.message)) {
      showMsg(
        els.msg,
        "Please confirm your email first — check the link we sent you when you signed up."
      );
    } else if (/invalid login credentials/i.test(error.message)) {
      showMsg(els.msg, "Incorrect email or password.");
    } else {
      showMsg(els.msg, error.message);
    }
    return;
  }

  if (data.session) redirectAfterLogin();
}

async function handleSignUp(e) {
  e.preventDefault();
  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value;

  if (!name) {
    showMsg(els.msg, "Enter your full name.");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showMsg(els.msg, "Enter a valid email address.");
    return;
  }
  if (password.length < 8) {
    showMsg(els.msg, "Password must be at least 8 characters.");
    return;
  }

  hideMsg(els.msg);
  setLoading(els.signupBtn, true, "Create account");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: window.location.origin + "/index.html",
    },
  });

  setLoading(els.signupBtn, false, "Create account");

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      showMsg(els.msg, "An account with this email already exists. Try signing in instead.");
    } else {
      showMsg(els.msg, error.message);
    }
    return;
  }

  // If email confirmations are disabled in Supabase, a session comes back
  // immediately and we can log the user straight in.
  if (data.session) {
    redirectAfterLogin();
    return;
  }

  // Otherwise Supabase sent a confirmation email — show that state.
  els.confirmEmailLabel.textContent = email;
  showStep("confirm");
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = els.signinEmail.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showMsg(els.msg, "Enter your email address above first, then click 'Forgot password?'.");
    return;
  }

  hideMsg(els.msg);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/index.html",
  });

  if (error) {
    showMsg(els.msg, error.message);
    return;
  }
  showMsg(els.msg, "Password reset link sent — check your inbox.", "ok");
}

async function redirectAfterLogin() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_admin) {
    window.location.href = "admin.html";
    return;
  }

  window.location.href = profile ? "dashboard.html" : "onboarding.html";
}
