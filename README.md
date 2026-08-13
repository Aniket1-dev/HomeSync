# Smitten (DATEFUL)

A premium, bright, doodle-illustrated digital date-invitation platform.
Create a profile, start from a template or a blank canvas, customize a private
note, send it, and let the recipient answer in a cinematic mobile experience.

This repo is a **front-end prototype** (static HTML/CSS/JS, no build step) plus
a **ready-to-run Supabase schema** for the real backend. Nothing here calls a
live API yet — forms redirect between pages so the whole flow is click-through
demoable without a server.

---

## Quick start

No build tools needed.

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

Opening `index.html` directly via `file://` also works for browsing, but a
local server avoids any relative-path/CORS quirks once you wire up Supabase.

---

## Folder structure

```
smitten/
├── index.html                  Landing page
├── login.html                  Sign in
├── signup.html                 Create account
├── forgot-password.html        Request a password reset email (link + 6-digit code)
├── reset-password.html         Set a new password (via the emailed link, or the code)
├── verify-email.html           Enter the 6-digit signup code (or use the emailed link)
├── auth-callback.html          Lands here after Google OAuth / email confirmation
├── onboarding.html             Profile completion (post-signup)
├── dashboard.html               "My Notes" — personal workspace
├── invitations.html            Full list of a user's notes/invitations
├── templates.html              The Collection (template gallery)
├── template-detail.html        Single template preview
├── studio.html                 The Builder (sections / canvas / properties)
├── invite-preview.html         Creator's "preview as recipient" view
├── invite.html                 THE RECEIVER EXPERIENCE — /invite/:token
├── confirmation.html           "It's a date" — post-acceptance summary
├── profile.html                Account identity + basic/optional details
├── settings.html                Notifications, privacy, security
│
├── admin.html                  Admin overview / quick links
├── admin-users.html            /admin/users
├── admin-invitations.html      /admin/invitations
├── admin-templates.html        /admin/templates
├── admin-sections.html         /admin/sections
├── admin-reports.html          /admin/reports  (moderation)
├── admin-audit.html            Audit log (admin activity)
├── admin-orders.html           /admin/orders
├── admin-payments.html         /admin/payments
├── admin-analytics.html        /admin/analytics
├── admin-settings.html         /admin/settings
│
├── assets/
│   ├── css/
│   │   ├── app.css             Shared tokens/components for app-side pages
│   │   ├── admin.css           Shared tokens/components for admin pages
│   │   ├── auth-shared.css     Google button / form error+note styles
│   │   └── <page>.css          Page-specific styles (one per app page)
│   └── js/
│       ├── vendor/supabase.js  Local copy of the supabase-js library (no CDN dependency)
│       ├── supabase-config.js  Your Supabase URL + anon key (edit this)
│       ├── supabase-client.js  Creates the shared `window.sb` client
│       ├── auth.js             Signup/login/Google OAuth/logout + page guards
│       ├── studio.js           Section select/highlight logic (Builder)
│       ├── invite.js           Step-through logic (receiver experience)
│       └── confirmation.js     Confetti sprinkle on the confirmation screen
│
├── supabase/
│   ├── schema.sql              Full Postgres schema + RLS policies
│   └── seed.sql                Section types, official templates, sample data
│
├── SITEMAP.md                  Route map: URL → file → purpose
└── README.md                   This file
```

Every `<a href>` between pages is a real relative link — click through the
whole app starting at `index.html` and every route in `SITEMAP.md` resolves.

---

## Design system

| Token | Value |
|---|---|
| Background | `#FFF8EF` (paper), `#FFF1DE` (paper-2) |
| Ink (text) | `#3A2B39` |
| Ink soft | `#7A6B78` |
| Pink | `#FF6F9C` |
| Yellow | `#FFC94A` |
| Lavender | `#B9A6E8` |
| Mint | `#5FCBA6` |
| Display font | Fredoka |
| Handwriting accent | Caveat |
| UI/body font | Quicksand |

Signature visual language: hand-drawn heart doodles (inline SVG `<symbol>`),
sticker-style drop shadows (`box-shadow: Npx Npx 0 var(--ink)`), dashed
"paper" borders, and slightly rotated cards. `prefers-reduced-motion` is
respected everywhere animation is used.

---

## Backend (Supabase)

`supabase/schema.sql` implements the full data model from the product spec:
`users`, `profiles`, `invitations`, `invitation_sections`, `templates`,
`template_sections`, `section_definitions`, `responses`, `response_answers`,
`notifications`, `media`, `reports`, `admin_users`, `audit_logs`, `payments`,
`orders` — with enums for lifecycle states, foreign keys, indexes, and **Row
Level Security** policies (creators can only touch their own invitations,
admins bypass via an `is_admin()` helper, recipients never get a broad
`SELECT` — invitation lookup by `public_token` should go through a
service-role/Edge Function, not client-side RLS).

### To set this up for real

This app is now wired to real Supabase auth (email/password + Google) —
follow the two sections below (**Supabase setup** and **Google sign-in**),
then deploy.

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql` (this also creates the
   `handle_new_auth_user` trigger — see below).
3. Run `supabase/seed.sql` to load the 15 section types and the 6 official
   templates.
4. Copy your project's URL and anon key into `assets/js/supabase-config.js`
   (Supabase dashboard → **Settings → API**).
5. For the receiver route (`invite.html`), look up the invitation by
   `public_token` through a Supabase Edge Function using the **service role
   key** — never expose write access to `invitations` to anonymous visitors.
   (`invite.html` and `confirmation.html` are intentionally left without an
   auth guard — recipients open them without ever logging in.)

#### How auth is wired up

- `assets/js/vendor/supabase.js` — the supabase-js library itself, vendored
  locally instead of pulled from a CDN, so it never breaks due to ad
  blockers, corporate firewalls, or a flaky third-party request. No build
  step needed — it's plain JS, already committed.
- `assets/js/supabase-config.js` — your project URL + anon key (edit this).
- `assets/js/supabase-client.js` — creates the shared `window.sb` client.
- `assets/js/auth.js` — sign up, log in, Google OAuth, sign out, and the page
  guards (`AUTH.requireAuth()`, `AUTH.requireAdmin()`).
- `login.html` / `signup.html` — real forms wired to `supabase-js`, plus a
  "Continue with Google" button.
- `forgot-password.html` / `reset-password.html` — request a reset email,
  then set a new password once the link brings the user back with a session
  (or, if the link hasn't been clicked, `reset-password.html` falls back to
  a 6-digit code field — see "Email OTP verification" below).
- `verify-email.html` — where `signup.html` sends people when email
  confirmation is required; lets them paste the 6-digit code from the
  confirmation email instead of hunting for the link (see "Email OTP
  verification" below).
- `auth-callback.html` — where Google (and confirmed email signups) send the
  user back after consent; it waits for the session, then routes to
  `onboarding.html` (new user) or `dashboard.html` (returning user).
- `onboarding.html` — saves `mobile` to `public.users` and the rest to
  `public.profiles`.
- Every page under "Core app" and every `/admin/*` page starts with
  `AUTH.requireAuth()` or `AUTH.requireAdmin()`, which redirects to
  `login.html` (or `dashboard.html`, for non-admins hitting `/admin/*`) if
  there's no valid session.
- `profile.html`'s "Log out" now calls `AUTH.signOut()`.
- **Account provisioning happens in Postgres, not in the browser**: the
  `handle_new_auth_user` trigger in `schema.sql` fires on every new
  `auth.users` row (from email/password *or* Google) and creates the matching
  `public.users` / `public.profiles` rows automatically, pre-filling name and
  avatar from Google's profile data when available. The JS calls
  `AUTH.ensureUserRow()` as a harmless backup in case the trigger isn't
  installed yet.
- To make someone an admin (for `/admin/*` access), insert a row into
  `public.admin_users` for their `auth.users` id — there's no UI for this by
  design; do it from the SQL editor:
  ```sql
  insert into public.admin_users (user_id, role) values ('<their-auth-uuid>', 'super_admin');
  ```

### Email OTP verification

Signup email confirmation and password-reset now support entering a **6-digit
code** (in addition to clicking the link in the email) — `verify-email.html`
and `reset-password.html` both have a code-entry step, backed by
`AUTH.verifySignupOtp()` / `AUTH.verifyRecoveryOtp()` / `AUTH.resendSignupEmail()`
in `assets/js/auth.js`.

**This only works once you edit two email templates in Supabase** — by
default Supabase's templates contain just `{{ .ConfirmationURL }}` (a link),
not the numeric code. Without this step the emails will have a link but no
code, and the code-entry screens will have nothing valid to check against.

1. Supabase dashboard → **Authentication → Emails → Templates**.
2. **Confirm signup** template → add `{{ .Token }}` somewhere in the body,
   e.g.:
   ```html
   <p>Your verification code is: <strong>{{ .Token }}</strong></p>
   <p>Or click this link: <a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   ```
3. **Reset Password** template → same thing:
   ```html
   <p>Your verification code is: <strong>{{ .Token }}</strong></p>
   <p>Or click this link: <a href="{{ .ConfirmationURL }}">Reset your password</a></p>
   ```
4. Save both. (Optional) **Authentication → Emails → Rate Limits / Auth
   settings** — the code is valid for the same expiry window as the link
   (default 1 hour); shorten it there if you want a tighter window.
5. Make sure **Authentication → Sign In / Providers → Email** has "Confirm
   email" turned **on** (it's what makes `signUp()` return `session: null`
   and require verification in the first place — if it's off, users are
   signed in immediately and `verify-email.html` is never reached).

How the flow behaves once this is set up:

- **Signup**: `signup.html` → `AUTH.signUpWithEmail()` → if no session comes
  back, redirect to `verify-email.html?email=…`. The person can either paste
  the 6-digit code there (`AUTH.verifySignupOtp`, `type: "signup"`) or click
  the link in the same email, which lands on `auth-callback.html` instead —
  both produce a session and route to `onboarding.html`.
- **Password reset**: `forgot-password.html` → `AUTH.sendPasswordReset()` →
  redirect to `reset-password.html?email=…`. That page polls for a session
  (link click) for ~3 seconds; if none shows up it falls back to a code-entry
  form (`AUTH.verifyRecoveryOtp`, `type: "recovery"`) before showing the
  new-password fields. Clicking the link at any point still works too.
- Both code screens have a 30-second-cooldown **Resend** button
  (`AUTH.resendSignupEmail` for signup, `AUTH.sendPasswordReset` again for
  recovery).
- `public.users.email_verified` updates automatically either way — the
  `handle_auth_user_confirmed` trigger in `schema.sql` fires off
  `auth.users.email_confirmed_at`, which `verifyOtp()` sets exactly like
  clicking the link does.

### Google sign-in

Google OAuth needs to be configured in **two** places — Google Cloud Console
and your Supabase project — before the "Continue with Google" button works.

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
   1. Create (or pick) a project → **APIs & Services → OAuth consent screen**
      → fill in an app name, support email, and add your domain if prompted.
   2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
      → Application type: **Web application**.
   3. Under **Authorized redirect URIs**, add your Supabase callback URL:
      `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
      (found on the Supabase dashboard's Google provider settings page —
      copy it from there to be exact).
   4. Save, then copy the generated **Client ID** and **Client Secret**.
2. **Supabase dashboard** → **Authentication → Providers → Google**
   1. Toggle it on, paste in the **Client ID** and **Client Secret** from
      step 1.
   2. Save.
3. **Authentication → URL Configuration** in Supabase:
   - **Site URL**: your deployed site's root, e.g.
     `https://YOUR-USERNAME.github.io/YOUR-REPO/`
   - **Redirect URLs**: add all of these (both local and production copies):
     - `http://localhost:8080/auth-callback.html`
     - `http://localhost:8080/reset-password.html`
     - `https://YOUR-USERNAME.github.io/YOUR-REPO/auth-callback.html`
     - `https://YOUR-USERNAME.github.io/YOUR-REPO/reset-password.html`
4. That's it — `AUTH.signInWithGoogle()` in `assets/js/auth.js` sends people
   to Google, Google sends them back to Supabase, and Supabase redirects to
   `auth-callback.html` with a session.

If you ever move the site to a custom domain, add that domain's
`/auth-callback.html` URL to the **Redirect URLs** list too (and update
**Site URL**) or Google sign-in will fail with a redirect mismatch.

### Deploying on GitHub Pages

1. Push this folder to a GitHub repo (root of the repo, or a `/docs` folder —
   either works, it's static files with no build step).
2. Repo → **Settings → Pages** → **Source**: deploy from a branch → pick
   `main` (and `/root` or `/docs`, matching where you put the files) → Save.
   Your site will be live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.
3. Double-check `assets/js/supabase-config.js` has your real
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` **before** pushing — GitHub Pages
   serves whatever's committed. (The anon key is meant to be public; RLS in
   `schema.sql` is what actually protects the data.)
4. Add the GitHub Pages URL to Supabase's **Site URL** / **Redirect URLs**
   and to Google's **Authorized redirect URIs** as described above — this is
   the step people most often forget, and it's why Google sign-in works
   locally but not once deployed.
5. This repo includes a `.nojekyll` file so GitHub Pages serves the files
   as-is instead of running them through Jekyll (which would otherwise ignore
   some files). Leave it in place.
6. Open `https://YOUR-USERNAME.github.io/YOUR-REPO/index.html` and click
   through — signup, Google sign-in, forgot/reset password, onboarding,
   dashboard should all be live against your real Supabase project.

### Secure links

Invitations use `public_token` — a random, non-sequential token
(`gen_random_bytes(24)`, base64url-encoded) — never the numeric/UUID primary
key. This matches the spec's "never expose sequential database IDs" rule.

---

## What's mocked vs. real

- **Real**: full page structure, navigation, all internal links, the design
  system, the Supabase schema + RLS policies, **and auth** — signup, login,
  Google OAuth, logout, page guards (`AUTH.requireAuth()` /
  `AUTH.requireAdmin()`), and automatic `public.users`/`public.profiles`
  provisioning via a Postgres trigger.
- **Mocked**: everything *past* login/onboarding still redirects instead of
  reading/writing real data — invitation create/edit in the Studio, the
  dashboard's stats/numbers (static sample data), admin table filters (visual
  tabs, don't actually filter rows yet), and the Studio's drag-to-reorder
  (sections are clickable/selectable, not yet draggable). Wiring these up
  means replacing the static sample arrays in each page with `supabase-js`
  queries against the tables in `schema.sql`, following the same pattern
  used in `onboarding.html` and `auth.js`.

See `SITEMAP.md` for the full route-to-file map and what's still a stub.
