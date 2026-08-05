// ============================================================
// HomeSync AI — Supabase configuration
// ------------------------------------------------------------
// 1. Go to https://supabase.com -> New project (free tier).
// 2. Project Settings -> API -> copy "Project URL" and "anon public" key.
// 3. Paste them below. Do NOT paste the "service_role" key here —
//    that one is secret and only belongs in the Edge Function.
// ============================================================

const SUPABASE_URL = "https://xbqmrmxneizmjuafunvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_APx8RaZ3zFB_ZZ0ksVV_oQ_IJ0mlvq9";

// Loaded from CDN in every HTML page via:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simple guard so pages fail loudly instead of silently if not configured yet
function assertConfigured() {
  if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) {
    console.warn(
      "HomeSync AI: Supabase is not configured yet. Open js/supabaseClient.js and paste your project URL + anon key."
    );
  }
}
assertConfigured();
