# Sitemap

Maps the product spec's intended routes to the actual files in this folder.
All links below are relative — click through starting from `index.html`.

## Public

| Route (intended) | File | Notes |
|---|---|---|
| `/` | `index.html` | Landing |
| `/login` | `login.html` | Sign in → redirects to `dashboard.html` |
| `/signup` | `signup.html` | Create account → `verify-email.html` (if confirmation required) or `onboarding.html` |
| *(auth)* | `verify-email.html` | Enter the 6-digit signup code (or click the emailed link instead) → `onboarding.html` |
| `/forgot-password` | `forgot-password.html` | Request a password reset email (link + code) |
| `/reset-password` | `reset-password.html` | Enter the emailed code, or arrive via the emailed link, then set a new password → `dashboard.html` |
| *(auth)* | `auth-callback.html` | Google OAuth / email-confirmation landing → `onboarding.html` or `dashboard.html` |
| `/onboarding` | `onboarding.html` | Profile completion → `dashboard.html` |

## Core app (authenticated)

| Route (intended) | File | Notes |
|---|---|---|
| `/dashboard` | `dashboard.html` | Personal workspace, next date, quick create |
| `/invitations` | `invitations.html` | Full list of the user's notes, filterable (visual only) |
| `/invitations/new` | `templates.html` | Choosing a template *is* starting a new invitation |
| `/invitations/:id/edit` | `studio.html` | The Builder — used for both new and existing notes |
| `/templates` | `templates.html` | The Collection |
| `/templates/:id` | `template-detail.html` | Single template preview → "Use this template" opens Studio |
| `/profile` | `profile.html` | Identity, basic + optional details, danger zone |
| `/settings` | `settings.html` | Notifications, privacy, security |

## Send → receive → confirm flow

| Step | File | Notes |
|---|---|---|
| Creator previews before publishing | `invite-preview.html` | "Not saved or sent" banner |
| Recipient opens the private link | `invite.html` | **This is `/invite/:token`.** Step-through: opening → reveal → question → thank-you |
| Recipient accepts | `confirmation.html` | "It's a date" — calendar/maps buttons, confetti |

## Admin (`/admin/*`)

| Route (intended) | File | Notes |
|---|---|---|
| `/admin` | `admin.html` | Overview + quick links + capabilities summary |
| `/admin/users` | `admin-users.html` | Full user table, roles, suspend/verify/delete |
| `/admin/invitations` | `admin-invitations.html` | All notes across all users, revoke/regenerate links |
| `/admin/templates` | `admin-templates.html` | Publish/unpublish, edit, delete official templates |
| `/admin/sections` | `admin-sections.html` | Manage the 15 reusable section definitions |
| `/admin/reports` | `admin-reports.html` | Moderation queue |
| *(audit)* | `admin-audit.html` | Admin action history — not in the original route table but referenced by spec §19 |
| `/admin/orders` | `admin-orders.html` | Bouquet/card order operations |
| `/admin/payments` | `admin-payments.html` | Payment records, refunds |
| `/admin/analytics` | `admin-analytics.html` | Funnel: sent → opened → responded → accepted |
| `/admin/settings` | `admin-settings.html` | Platform config, feature flags, role list |

---

## Navigation graph (who links to whom)

```
index.html ──► signup.html ──► onboarding.html ──► dashboard.html
index.html ──► login.html ──► dashboard.html
login.html ──► signup.html

dashboard.html ──► invitations.html, templates.html, studio.html, profile.html
dashboard.html ──► invite-preview.html (per note), studio.html (drafts)

invitations.html ──► invite-preview.html / studio.html (per row)

templates.html ──► template-detail.html ──► studio.html
templates.html ──► studio.html (direct "use template")

studio.html ──► dashboard.html (exit), invite-preview.html (preview)

invite-preview.html ──► studio.html (back)

invite.html ──► confirmation.html (on "Yes")

profile.html ──► settings.html, admin.html

admin.html ──► admin-users.html, admin-invitations.html, admin-templates.html,
               admin-sections.html, admin-reports.html, admin-audit.html,
               admin-orders.html, admin-payments.html, admin-analytics.html,
               admin-settings.html
(every admin-*.html has the same sidebar linking back to all the others,
 plus "← Back to app" → dashboard.html)
```

## Not yet built as separate pages

- `/admin/reports` detail view (single report drill-down) — currently one
  list page (`admin-reports.html`)
- Individual "edit template" screen for admins — `admin-templates.html`
  links out to Studio-style editing conceptually, not a separate file yet
- Password reset flow (`/forgot-password`) — not in the original route table
