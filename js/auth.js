// Auth flows: Google OAuth + Email/Password
// Requires supabaseClient.js

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

// ---------- APP URL HELPER ----------

function appUrl(page = "") {
  const host = window.location.hostname;

  // GitHub Pages
  if (host === "aniket1-dev.github.io") {
    return `https://aniket1-dev.github.io/HomeSync/${page}`;
  }

  // Netlify / Vercel / Localhost
  return `${window.location.origin}/${page}`;
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    redirectAfterLogin();
    return;
  }

  els.tabSignin?.addEventListener("click", () => showStep("signin"));
  els.tabSignup?.addEventListener("click", () => showStep("signup"));
  els.backToSigninBtn?.addEventListener("click", () => showStep("signin"));

  els.signinStep?.addEventListener("submit", handleSignIn);
  els.signupStep?.addEventListener("submit", handleSignUp);
  els.forgotPasswordBtn?.addEventListener("click", handleForgotPassword);
  els.googleBtn?.addEventListener("click", handleGoogleSignIn);
});

// ---------- UI ----------

function showStep(step) {

  hideMsg(els.msg);

  els.signinStep.classList.toggle("hidden", step !== "signin");
  els.signupStep.classList.toggle("hidden", step !== "signup");
  els.confirmStep.classList.toggle("hidden", step !== "confirm");

  els.tabSignin.classList.toggle("active", step === "signin");
  els.tabSignup.classList.toggle("active", step === "signup");

}

// ---------- GOOGLE ----------

async function handleGoogleSignIn() {

  hideMsg(els.msg);

  const { error } = await supabaseClient.auth.signInWithOAuth({

    provider: "google",

    options: {

      redirectTo: appUrl("login.html")

    }

  });

  if (error) showMsg(els.msg, error.message);

}

// ---------- SIGN IN ----------

async function handleSignIn(e) {

  e.preventDefault();

  const email = els.signinEmail.value.trim();
  const password = els.signinPassword.value;

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({

      email,
      password

    });

  if (error) {

    showMsg(els.msg, error.message);
    return;

  }

  if (data.session) {

    redirectAfterLogin();

  }

}

// ---------- SIGN UP ----------

async function handleSignUp(e) {

  e.preventDefault();

  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value;

  const { data, error } =
    await supabaseClient.auth.signUp({

      email,
      password,

      options: {

        data: {

          full_name: name

        },

        emailRedirectTo: appUrl("index.html")

      }

    });

  if (error) {

    showMsg(els.msg, error.message);
    return;

  }

  if (data.session) {

    redirectAfterLogin();
    return;

  }

  els.confirmEmailLabel.textContent = email;

  showStep("confirm");

}

// ---------- PASSWORD RESET ----------

async function handleForgotPassword(e) {

  e.preventDefault();

  const email = els.signinEmail.value.trim();

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(email, {

      redirectTo: appUrl("index.html")

    });

  if (error) {

    showMsg(els.msg, error.message);

  } else {

    showMsg(els.msg, "Password reset email sent.", "ok");

  }

}

// ---------- REDIRECT ----------

async function redirectAfterLogin() {

  const {

    data: { user },

  } = await supabaseClient.auth.getUser();

  const { data: profile } =
    await supabaseClient
      .from("profiles")
      .select("id,is_admin")
      .eq("id", user.id)
      .maybeSingle();

  if (profile?.is_admin) {

    window.location.href = appUrl("admin.html");
    return;

  }

  if (profile) {

    window.location.href = appUrl("dashboard.html");

  } else {

    window.location.href = appUrl("onboarding.html");

  }

}
