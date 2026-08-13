# HomeSync AI — Working Prototype

A fully working roommate-compatibility prototype: Google sign-in, real email OTP,
a structured questionnaire, and a rule-based matching engine — all running on
free tiers, with no build step (plain HTML/CSS/JS).

Team: Aniket · Anchal Garg · Anant Saxena · Ayush Chauhan

---

## What's actually working right now vs. what needs your keys

| Feature | Status |
|---|---|
| UI (landing, onboarding, dashboard) | Done — open `index.html` after config |
| Email OTP sign-in/up | Works once you paste your Supabase keys (Part 1) |
| Google sign-in | Works once you set up Google OAuth in Supabase (Part 2) |
| Structured profile + rule-based matching | Fully working, runs in the browser, no cost |
| LLM bio-compatibility scoring | Optional — needs a free Anthropic API key + Edge Function deploy (Part 4) |

You can ship the whole thing with just Parts 1–3. Part 4 is a bonus upgrade.

---

## Part 1 — Create your free Supabase project (5 min)

1. Go to https://supabase.com → **Start your project** → sign in with GitHub (free).
2. **New project** → name it `homesync-ai` → set a database password (save it) → pick the region closest to India (e.g. Mumbai/Singapore) → create.
3. Once it's ready: **Project Settings → API**. Copy:
   - **Project URL**
   - **anon public** key (NOT the `service_role` one)
4. Open `js/supabaseClient.js` in this project and paste both values in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOि...";
   ```

## Part 2 — Set up the database (2 min)

1. In Supabase: **SQL Editor → New query**.
2. Paste the entire contents of `sql/schema.sql` from this project and click **Run**.
3. This creates the `profiles` table with row-level security so people can only edit their own profile but can read others' (needed for matching). It also creates the `avatars` storage bucket (for profile photo uploads on the account page) with policies so each user can only write inside their own folder.

## Part 3 — Turn on Google sign-in and email OTP (10 min)

### Email OTP (6-digit code)
Signing in now requires this: after a correct email + password, `login.html`
sends a one-time code via `supabaseClient.auth.signInWithOtp()` and won't
create a session until that code is verified. Supabase sends a magic-link
email by default. To make it send a **6-digit code** (what this app's UI
expects) instead of just a link:

1. **Authentication → Email Templates → Magic Link**.
2. In the template body, make sure `{{ .Token }}` appears somewhere (Supabase's
   default template already includes it) — that's the 6-digit code. You can
   simplify the template to just show the code big and clear, e.g.:
   ```
   Your HomeSync AI verification code is: {{ .Token }}
   ```
3. **Authentication → Providers → Email**: make sure "Enable email provider" is on.
   Free tier sends via Supabase's shared SMTP (fine for a prototype/demo; rate-limited —
   for real usage later you'd connect your own SMTP, e.g. free Resend/Brevo tier).
4. Skip this step and every sign-in will fail at the OTP screen — the code
   simply won't arrive, since the account still only gets a link.

### Google sign-in
1. Go to https://console.cloud.google.com/ (free) → create a project (e.g. `homesync-ai`).
2. **APIs & Services → OAuth consent screen** → External → fill app name (`HomeSync AI`), your email → save (Testing mode is fine for a prototype).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**.
4. In Supabase: **Authentication → Providers → Google** → copy the **Callback URL** shown there.
5. Back in Google Cloud: paste that callback URL into **Authorized redirect URIs**. Also add your site's URL (e.g. `http://localhost:5500`, and later your Netlify URL) to **Authorized JavaScript origins**.
6. Copy the **Client ID** and **Client Secret** Google gives you → paste them into Supabase's Google provider settings → **Save** → toggle it **Enabled**.
7. In Supabase: **Authentication → URL Configuration** → set **Site URL** to wherever you'll host it (see Part 5), and add it under **Redirect URLs** too.

## Part 4 — Optional: turn on real LLM bio scoring (free tier)

This step is optional — the app fully works without it using the rule-based score alone.

1. Get a free Anthropic API key at https://console.anthropic.com (new accounts get free starter credit).
2. Install the Supabase CLI: `npm install -g supabase`
3. From this project folder: `supabase login` then `supabase link --project-ref YOUR_PROJECT_REF` (find the ref in your Supabase project URL).
4. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
5. `supabase functions deploy llm-score`
6. In `js/dashboard.js`, after computing `ruleScore` for a match, you can call:
   ```js
   const { data } = await supabase.functions.invoke('llm-score', {
     body: { bioA: me.bio, bioB: profile.bio }
   });
   const hybrid = computeHybridScore(ruleScore, data.score);
   ```
   and cache the result into the `llm_scores` table so you're not re-calling the API on every page load.

## Part 5 — Deploy for free

Easiest: **Netlify Drop** — no account even required for a quick demo:
1. Go to https://app.netlify.com/drop
2. Drag the whole `homesync-ai` folder in.
3. You get a live `https://something.netlify.app` URL instantly.
4. Go back to Supabase **Authentication → URL Configuration** and add that URL as the Site URL + a Redirect URL, and add it to Google Cloud's Authorized origins/redirect URIs too (Part 3).

Alternative free hosts: **Vercel**, **GitHub Pages**, **Cloudflare Pages** — all work the same way since this is a static site with no build step.

## Testing locally before deploying

Just open `index.html` in a browser — but OAuth redirects need a real URL, so for
local testing use a simple local server instead of `file://`:
```bash
cd homesync-ai
python3 -m http.server 5500
```
Then visit `http://localhost:5500`. Remember to add `http://localhost:5500` to
Supabase's Redirect URLs and Google's Authorized origins while testing.

---

## Project structure

```
homesync-ai/
├── index.html              # Landing page (marketing only — no auth forms here)
├── login.html               # Separate premium sign-in / sign-up page (Google + email)
├── onboarding.html          # 4-step premium profile wizard (Section 3.2 of the report)
├── dashboard.html            # Premium dashboard: banner, stats, ranked matches
├── profile.html               # Account settings
├── admin-login.html          # Separate admin-only sign-in page
├── admin.html                 # Admin Portal (users, contact messages, stats)
├── css/style.css             # Design system
├── js/
│   ├── supabaseClient.js     # <- paste your keys here
│   ├── auth.js                 # Google OAuth + email sign-in/up flow (used by login.html)
│   ├── admin-auth.js           # Admin sign-in + is_admin check (used by admin-login.html)
│   ├── admin.js                # Admin Portal logic (used by admin.html)
│   ├── ui.js                   # Sync Dial component + helpers
│   ├── onboarding.js           # Wizard step logic + saves profile to Supabase
│   ├── matching.js             # Rule-based scoring engine (Section 3.3)
│   └── dashboard.js            # Loads profiles, ranks, renders
├── sql/schema.sql            # Run this in Supabase SQL Editor
└── supabase/functions/llm-score/index.ts   # Optional Claude API bio scoring
```

### Redirect flow
- Signed-out visitors always land on `login.html` to authenticate (never a mixed page).
- After sign-in: no profile yet → `onboarding.html`; has a profile → `dashboard.html`; `is_admin = true` → `admin.html`.
- `admin.html` re-checks `is_admin` on load and signs out + shows a 403 screen for anyone else who reaches it directly.

## Part 2.5 — Set yourself up as an admin

1. Sign up normally once through `login.html` (as yourself).
2. In Supabase → **SQL Editor**, run:
   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
3. Go to `admin-login.html` and sign in with that same email/password — you'll land in the Admin Portal.
4. From **Admin Portal → Settings**, you can promote other teammates by email without touching SQL again.

## Where this maps to the report

- **Section 3.2** (structured fields) → `onboarding.html` form fields
- **Section 3.3** (rule-based scoring) → `js/matching.js`
- **Section 3.4** (LLM semantic scoring) → `supabase/functions/llm-score`
- **Section 3.5** (hybrid score) → `computeHybridScore()` in `js/matching.js`
- **Section 4** (shortlist-then-LLM architecture) → `rankMatches()` returns the
  top-N rule-scored shortlist that Part 4's LLM call would run on

## Next upgrades (for scaling beyond the prototype)

- Move matching computation to a Postgres function or Edge Function so it scales past a few hundred profiles (client-side ranking is fine for a demo/thesis dataset).
- Add photo upload via Supabase Storage (free tier: 1GB).
- Add pagination + city/location radius filtering instead of exact city match.
- Cache `llm_scores` so each pair is only scored once.
- Add a proper custom SMTP provider (e.g. free Resend tier) once you outgrow Supabase's shared email rate limit.
