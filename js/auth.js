// Auth flows: Google OAuth + Email/Password Sign in & Sign up
// Auth flows: Google OAuth + Email/Password Sign in & Sign up
// Requires: supabaseClient.js loaded first

// Builds a redirect URL that keeps whatever subpath the site is served
// from — critical on GitHub Pages project sites, where the real URL is
// https://username.github.io/repo-name/... not just https://username.github.io/.
// window.location.origin alone drops that repo-name segment, which is
// what causes the GitHub Pages 404 after Google sign-in.
function siteUrl(page) {
  const dir = window.location.pathname.replace(/[^/]*$/, ""); // current folder, keeps trailing slash
  return window.location.origin + dir + page;
}

const els = {
  tabSignin: document.getElementById("tab-signin"),
  tabSignup: document.getElementById("tab-signup"),

  signinStep: document.getElementById("signin-step"),
  otpStep: document.getElementById("otp-step"),
  signupStep: document.getElementById("signup-step"),
  confirmStep: document.getElementById("confirm-step"),

  signinEmail: document.getElementById("signin-email"),
  signinPassword: document.getElementById("signin-password"),
  signinBtn: document.getElementById("signin-btn"),
  forgotPasswordBtn: document.getElementById("forgot-password-btn"),

  otpEmailLabel: document.getElementById("otp-email-label"),
  otpCode: document.getElementById("otp-code"),
  otpVerifyBtn: document.getElementById("otp-verify-btn"),
  otpResendBtn: document.getElementById("otp-resend-btn"),
  otpBackBtn: document.getElementById("otp-back-btn"),

  signupName: document.getElementById("signup-name"),
  signupEmail: document.getElementById("signup-email"),
  signupPassword: document.getElementById("signup-password"),
  signupBtn: document.getElementById("signup-btn"),

  confirmEmailLabel: document.getElementById("confirm-email-label"),
  backToSigninBtn: document.getElementById("back-to-signin-btn"),

  googleBtn: document.getElementById("google-btn"),
  msg: document.getElementById("auth-msg"),
};

// Email + password the person just verified — held only in memory while
// they enter the OTP, never persisted.
let pendingOtpEmail = null;
let pendingOtpPassword = null;

document.addEventListener("DOMContentLoaded", () => {
  if (new URLSearchParams(window.location.search).get("suspended") === "1") {
    showMsg(els.msg, "This account has been suspended. Contact support if you think this is a mistake.");
  }

  // If already logged in, skip straight to app
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) redirectAfterLogin();
  });

  els.tabSignin?.addEventListener("click", () => showStep("signin"));
  els.tabSignup?.addEventListener("click", () => showStep("signup"));
  els.backToSigninBtn?.addEventListener("click", () => showStep("signin"));

  els.signinStep?.addEventListener("submit", handleSignIn);
  els.otpStep?.addEventListener("submit", handleVerifyOtp);
  els.otpResendBtn?.addEventListener("click", handleResendOtp);
  els.otpBackBtn?.addEventListener("click", () => {
    pendingOtpEmail = null;
    pendingOtpPassword = null;
    showStep("signin");
  });
  els.signupStep?.addEventListener("submit", handleSignUp);
  els.forgotPasswordBtn?.addEventListener("click", handleForgotPassword);
  els.googleBtn?.addEventListener("click", handleGoogleSignIn);
});

function showStep(step) {
  hideMsg(els.msg);
  els.signinStep.classList.toggle("hidden", step !== "signin");
  els.otpStep.classList.toggle("hidden", step !== "otp");
  els.signupStep.classList.toggle("hidden", step !== "signup");
  els.confirmStep.classList.toggle("hidden", step !== "confirm");
  els.tabSignin.classList.toggle("active", step === "signin" || step === "otp");
  els.tabSignup.classList.toggle("active", step === "signup");
}

async function handleGoogleSignIn() {
  hideMsg(els.msg);
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: siteUrl("login.html") },
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

  // Step 1: verify the password. This does create a session momentarily —
  // we immediately sign back out below so nothing is usable until the
  // OTP is verified too; signInWithPassword is just being used here as
  // the credential check.
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setLoading(els.signinBtn, false, "Sign in");
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

  await supabaseClient.auth.signOut();

  // Step 2: email a one-time code and require it before the real session
  // is created. shouldCreateUser: false because the account must already
  // exist — password already confirmed that above.
  const { error: otpError } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  setLoading(els.signinBtn, false, "Sign in");

  if (otpError) {
    showMsg(els.msg, "Couldn't send verification code: " + otpError.message);
    return;
  }

  pendingOtpEmail = email;
  pendingOtpPassword = password;
  els.otpEmailLabel.textContent = email;
  els.otpCode.value = "";
  showStep("otp");
  els.otpCode.focus();
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const code = els.otpCode.value.trim();

  if (!pendingOtpEmail) {
    showMsg(els.msg, "Your session expired — please sign in again.");
    showStep("signin");
    return;
  }
  if (!/^\d{8}$/.test(code)) {
    showMsg(els.msg, "Enter the 8-digit code from your email.");
    return;
  }

  hideMsg(els.msg);
  setLoading(els.otpVerifyBtn, true, "Verify & sign in");

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: pendingOtpEmail,
    token: code,
    type: "email",
  });

  setLoading(els.otpVerifyBtn, false, "Verify & sign in");

  if (error) {
    showMsg(
      els.msg,
      /expired|invalid/i.test(error.message)
        ? "That code is incorrect or has expired — try resending it."
        : error.message
    );
    return;
  }

  pendingOtpEmail = null;
  pendingOtpPassword = null;
  if (data.session) redirectAfterLogin();
}

async function handleResendOtp(e) {
  e.preventDefault();
  if (!pendingOtpEmail) return;
  hideMsg(els.msg);

  const { error } = await supabaseClient.auth.signInWithOtp({
    email: pendingOtpEmail,
    options: { shouldCreateUser: false },
  });

  if (error) {
    showMsg(els.msg, "Couldn't resend code: " + error.message);
    return;
  }
  showMsg(els.msg, "A new code is on its way.", "ok");
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
      emailRedirectTo: siteUrl("index.html"),
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
    redirectTo: siteUrl("reset-password.html"),
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
    .select("id, is_admin, status")
    .eq("id", user.id)
    .maybeSingle();

  if (await enforceActiveStatus(profile)) return;

  if (profile?.is_admin) {
    window.location.href = "admin.html";
    return;
  }

  window.location.href = profile ? "dashboard.html" : "onboarding.html";
}
