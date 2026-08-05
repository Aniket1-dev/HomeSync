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
3. This creates the `profiles` table with row-level security so people can only edit their own profile but can read others' (needed for matching).

## Part 3 — Turn on Google sign-in and email OTP (10 min)

### Email OTP (6-digit code)
Supabase sends a magic-link email by default. To make it send a **6-digit code**
(what this app's UI expects):

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

## Part 4.5 — Admin panel + notifications (new)

Two features were added on top of the original prototype:

- **In-app notifications**: a bell icon (top nav on every logged-in page) with unread badge, dropdown feed, mark-as-read/mark-all-read. Automatic notifications: a welcome message when someone finishes onboarding, and a "new high-compatibility match" alert on the dashboard (max once per ~20h, respects the "New match alerts" toggle in Settings → Notifications).
- **Admin panel** (`admin.html`): stats (total users, joined this week, suspended, admins), a searchable user table with promote/demote and suspend/reactivate actions, and a broadcast tool that sends an announcement notification to every user. Only visible to accounts with `role = 'admin'`.

**Setup:**

1. Re-run `sql/schema.sql` in the Supabase SQL Editor — it now includes a "MIGRATION 2" block at the bottom (adds `role`/`status` columns, the `notifications` table, and the RLS policies/triggers that enforce all of this server-side). Safe to run even though you ran the file before — everything is `if not exists` / `or replace`.
2. Make your 4 team accounts admins — **sign up normally first** (so each has a `profiles` row), then in the SQL Editor run, once per person:
   ```sql
   update public.profiles set role = 'admin' where email = 'teammate@example.com';
   ```
3. There's no UI to self-promote to admin — this is intentional. A `prevent_privilege_escalation` trigger silently ignores any attempt by a non-admin to change `role` or `status` on their own row, even via a raw API call, so it can only be done from the SQL Editor (or by an existing admin, from the admin panel).

That's it — reload `dashboard.html`/`profile.html` as one of the 4 admin accounts and you'll see an "Admin" link in the nav.

**Your 4 admins, ready to copy-paste** once each person has signed up (any password they choose — see the note below on why a shared password isn't a good idea):
```sql
update public.profiles set role = 'admin' where email = 'anant.25001037@kiet.edu';
update public.profiles set role = 'admin' where email = 'anchal.25001041@kiet.edu';
update public.profiles set role = 'admin' where email = 'ayush.25001074@kiet.edu';
update public.profiles set role = 'admin' where email = 'aniket.25001043@kiet.edu';
```
> A quick note on using one shared password (`Aniket@7906`) for all 4 accounts: it works, but if it ever leaks, all 4 admin accounts are exposed at once and there's no way to tell whose account did what in the logs. It costs nothing to have each person set their own password during signup — worth doing even for a student project.

## Part 4.6 — Mandatory profile photo + "someone reached out" notifications (new)

- **Profile photos are now required.** Onboarding won't let you continue without uploading one, and the account settings page uses the same upload widget. Photos are stored in Supabase Storage (bucket `avatars`, public read, write-your-own-folder-only) instead of the old paste-a-URL field, and now show up on match cards too.
- **Contact notifications.** Clicking the Email or WhatsApp button on a match card now also fires a notification to that person ("X reached out to connect via email/WhatsApp") via a locked-down `notify_contact()` database function — it can only ever write that one fixed message, so it can't be used to spam arbitrary content to other users.

**Setup:**

1. Re-run `sql/schema.sql` again — it now has a "MIGRATION 3" block at the bottom that creates the `avatars` storage bucket, its access policies, and the `notify_contact` function. Safe to re-run.
2. That's it — no manual bucket creation needed, the SQL does it (`insert into storage.buckets ...`). Deploy the updated site files as usual.
3. Heads up: this only applies going forward. Anyone with an existing profile from before this change can still see their old (no-photo) profile — they'll just be prompted to add one next time they open onboarding/settings. If you want to force it retroactively, you could hide profiles with `photo_url is null` from the matching query in `dashboard.js`, but that's a judgment call depending on how many existing users you have.

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
├── index.html              # Landing + sign-in (Google + Email OTP)
├── onboarding.html          # Structured questionnaire (Section 3.2 of the report)
├── dashboard.html           # Ranked matches
├── admin.html               # Admin panel (role='admin' only)
├── css/style.css            # Design system
├── js/
│   ├── supabaseClient.js    # <- paste your keys here
│   ├── auth.js               # Google OAuth + OTP verify flow
│   ├── ui.js                 # Sync Dial component + helpers
│   ├── notifications.js      # Shared bell/dropdown + notifySelf() helper
│   ├── onboarding.js         # Saves profile to Supabase
│   ├── matching.js           # Rule-based scoring engine (Section 3.3)
│   ├── dashboard.js          # Loads profiles, ranks, renders
│   ├── profile.js            # Account/settings page logic
│   └── admin.js              # Admin panel: users, stats, broadcast
├── sql/schema.sql           # Run this in Supabase SQL Editor (incl. MIGRATION 2)
└── supabase/functions/llm-score/index.ts   # Optional Claude API bio scoring
```

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
