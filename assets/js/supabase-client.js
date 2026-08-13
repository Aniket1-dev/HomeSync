// ============================================================================
// Smitten — Supabase client
// Loaded after supabase-config.js and assets/js/vendor/supabase.js (a local
// copy of the supabase-js UMD bundle — not a CDN — so this never breaks due
// to ad blockers, corporate firewalls, or a flaky external request).
// Exposes a single shared client on window.sb for every page to reuse.
// ============================================================================
(function () {
  function showBanner(message) {
    var el = document.createElement("div");
    el.textContent = message;
    el.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#ffe3e3;" +
      "color:#7a1f1f;font:600 13px/1.4 system-ui,sans-serif;padding:10px 16px;" +
      "text-align:center;border-bottom:2px solid #c92a2a;";
    document.addEventListener("DOMContentLoaded", function () {
      document.body.prepend(el);
    });
    if (document.body) document.body.prepend(el);
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    var msg =
      "Smitten: the Supabase library didn't load. Check that " +
      "assets/js/vendor/supabase.js exists in this deployment and that " +
      "it's included in <head> before supabase-client.js.";
    console.error(msg);
    showBanner("⚠️ Supabase library failed to load — see browser console for details.");
    return;
  }
  if (
    !window.SUPABASE_URL ||
    window.SUPABASE_URL.includes("YOUR-PROJECT-REF") ||
    !window.SUPABASE_ANON_KEY ||
    window.SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY")
  ) {
    var cfgMsg =
      "Smitten: assets/js/supabase-config.js still has placeholder values. " +
      "Fill in SUPABASE_URL and SUPABASE_ANON_KEY with your real project's " +
      "values (Supabase dashboard → Settings → API).";
    console.warn(cfgMsg);
    showBanner("⚠️ Supabase isn't configured yet — edit assets/js/supabase-config.js with your project's URL and anon key.");
    return; // don't create a client with placeholder values — it'll just fail confusingly later
  }

  window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();

