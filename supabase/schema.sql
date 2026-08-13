-- ============================================================================
-- SMITTEN (DATEFUL) — Supabase / Postgres schema
-- Implements the data model from section 20 of the product spec.
-- Run this in the Supabase SQL editor, or via `supabase db push`.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
create type invitation_status as enum
  ('draft','sent','opened','responded','accepted','declined','expired','revoked');

create type response_choice as enum ('yes','maybe','no');

create type admin_role as enum
  ('super_admin','content_admin','support_admin','finance_admin','moderator');

create type report_status as enum ('open','resolved','escalated');

create type order_status as enum ('pending','fulfilled','delivered','issue','cancelled');

create type payment_status as enum ('paid','refunded','disputed','failed');

-- ---------------------------------------------------------------------------
-- USERS  (mirrors auth.users; one row per authenticated account)
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  mobile        text,
  email_verified   boolean not null default false,
  mobile_verified  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PROFILES  (public-facing identity shown on notes)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id       uuid primary key references public.users(id) on delete cascade,
  full_name     text not null,
  display_name  text,
  photo_url     text,
  instagram     text,
  bio           text,
  location      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SECTION DEFINITIONS  (reusable section "types" — Hero, Photo, Date, ...)
-- ---------------------------------------------------------------------------
create table public.section_definitions (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,        -- e.g. 'hero', 'photo', 'date'
  label         text not null,               -- e.g. 'Hero'
  config_schema jsonb not null default '{}', -- describes editable fields
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TEMPLATES  (official + user-created starting points)
-- ---------------------------------------------------------------------------
create table public.templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  description   text,
  is_official   boolean not null default false,
  is_published  boolean not null default false,
  created_by    uuid references public.users(id),
  theme         jsonb not null default '{}', -- colors, fonts, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.template_sections (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.templates(id) on delete cascade,
  section_def_id  uuid not null references public.section_definitions(id),
  "order"         integer not null default 0,
  visible         boolean not null default true,
  content         jsonb not null default '{}',
  style           jsonb not null default '{}',
  animation       jsonb not null default '{}'
);

-- ---------------------------------------------------------------------------
-- INVITATIONS  (a creator's note/invite, its lifecycle, its secure link)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.users(id) on delete cascade,
  template_id     uuid references public.templates(id),
  title           text,
  recipient_name  text,
  recipient_email text,
  recipient_mobile text,
  status          invitation_status not null default 'draft',
  -- cryptographically random public token — NEVER expose the numeric id publicly
  public_token    text unique not null default encode(gen_random_bytes(24), 'base64url'),
  scheduled_date  date,
  scheduled_time  time,
  timezone        text default 'Asia/Kolkata',
  venue_name      text,
  venue_address   text,
  venue_map_url   text,
  dress_code      text,
  published_at    timestamptz,
  opened_at       timestamptz,
  responded_at    timestamptz,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_invitations_creator on public.invitations(creator_id);
create index idx_invitations_token   on public.invitations(public_token);
create index idx_invitations_status  on public.invitations(status);

create table public.invitation_sections (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations(id) on delete cascade,
  section_def_id  uuid not null references public.section_definitions(id),
  "order"         integer not null default 0,
  visible         boolean not null default true,
  content         jsonb not null default '{}',
  style           jsonb not null default '{}',
  animation       jsonb not null default '{}'
);

create index idx_invitation_sections_invitation on public.invitation_sections(invitation_id);

-- ---------------------------------------------------------------------------
-- RESPONSES  (the recipient's submitted response + individual answers)
-- ---------------------------------------------------------------------------
create table public.responses (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null unique references public.invitations(id) on delete cascade,
  choice          response_choice not null,
  responded_at    timestamptz not null default now(),
  ip_hash         text,          -- hashed, never raw IP
  user_agent      text
);

create table public.response_answers (
  id              uuid primary key default gen_random_uuid(),
  response_id     uuid not null references public.responses(id) on delete cascade,
  section_id      uuid references public.invitation_sections(id),
  question        text not null,
  answer          jsonb not null
);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete cascade,
  type          text not null,   -- 'opened' | 'responded' | 'accepted' | 'reminder' | ...
  payload       jsonb not null default '{}',
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- MEDIA  (uploaded assets — photos for hero/gallery sections, avatars, etc.)
-- ---------------------------------------------------------------------------
create table public.media (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.users(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete cascade,
  storage_path  text not null,   -- Supabase Storage object path
  mime_type     text,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ADMIN USERS + AUDIT LOG  (created before REPORTS, which references admin_users)
-- ---------------------------------------------------------------------------
create table public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.users(id) on delete cascade,
  role          admin_role not null,
  granted_by    uuid references public.admin_users(id),
  created_at    timestamptz not null default now()
);

create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references public.admin_users(id),
  action        text not null,       -- e.g. 'suspend_user', 'revoke_invitation'
  target_type   text not null,       -- e.g. 'user', 'invitation', 'template'
  target_id     text not null,
  result        text not null default 'success',
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- REPORTS  (trust & safety / moderation queue)
-- ---------------------------------------------------------------------------
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.users(id),
  invitation_id   uuid references public.invitations(id) on delete cascade,
  reported_user_id uuid references public.users(id),
  reason          text not null,
  details         text,
  status          report_status not null default 'open',
  resolved_by     uuid references public.admin_users(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- COMMERCE — ORDERS + PAYMENTS  (bouquet / card add-ons)
-- ---------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid references public.invitations(id) on delete cascade,
  buyer_id        uuid not null references public.users(id),
  item_type       text not null,     -- 'bouquet' | 'card'
  item_name       text not null,
  status          order_status not null default 'pending',
  amount_cents    integer not null,
  currency        text not null default 'INR',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id) on delete set null,
  user_id         uuid not null references public.users(id),
  provider        text not null default 'stripe',
  provider_ref    text,
  amount_cents    integer not null,
  currency        text not null default 'INR',
  status          payment_status not null default 'paid',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users               enable row level security;
alter table public.profiles            enable row level security;
alter table public.invitations         enable row level security;
alter table public.invitation_sections enable row level security;
alter table public.responses           enable row level security;
alter table public.response_answers    enable row level security;
alter table public.notifications       enable row level security;
alter table public.media               enable row level security;
alter table public.reports             enable row level security;
alter table public.orders              enable row level security;
alter table public.payments            enable row level security;
alter table public.templates           enable row level security;
alter table public.template_sections   enable row level security;
alter table public.admin_users         enable row level security;
alter table public.audit_logs          enable row level security;

-- helper: is the current user an admin (any role)?
create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- Users can read/update their own row; admins can read all.
create policy "users read own" on public.users
  for select using (auth.uid() = id or public.is_admin());
create policy "users update own" on public.users
  for update using (auth.uid() = id);

create policy "profiles read own or admin" on public.profiles
  for select using (auth.uid() = user_id or public.is_admin());
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = user_id);

-- Invitations: creator has full access; admins have full access.
-- Public (anon) recipients access a single invitation ONLY via public_token,
-- which is enforced at the application layer (service-role lookup by token),
-- never via a broad anon SELECT policy.
create policy "invitations owner rw" on public.invitations
  for all using (auth.uid() = creator_id or public.is_admin())
  with check (auth.uid() = creator_id or public.is_admin());

create policy "invitation_sections via parent" on public.invitation_sections
  for all using (
    public.is_admin() or exists (
      select 1 from public.invitations i
      where i.id = invitation_id and i.creator_id = auth.uid()
    )
  );

create policy "responses via parent invitation" on public.responses
  for select using (
    public.is_admin() or exists (
      select 1 from public.invitations i
      where i.id = invitation_id and i.creator_id = auth.uid()
    )
  );

create policy "notifications owner" on public.notifications
  for select using (auth.uid() = user_id or public.is_admin());

create policy "media owner" on public.media
  for all using (auth.uid() = owner_id or public.is_admin());

create policy "reports admin only" on public.reports
  for select using (public.is_admin());
create policy "reports reporter insert" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "orders owner or admin" on public.orders
  for select using (auth.uid() = buyer_id or public.is_admin());
create policy "payments owner or admin" on public.payments
  for select using (auth.uid() = user_id or public.is_admin());

create policy "templates published read" on public.templates
  for select using (is_published or created_by = auth.uid() or public.is_admin());
create policy "templates admin write" on public.templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "template_sections read" on public.template_sections
  for select using (
    exists (select 1 from public.templates t where t.id = template_id and (t.is_published or public.is_admin()))
  );
create policy "template_sections admin write" on public.template_sections
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin_users admin only" on public.admin_users
  for select using (public.is_admin());
create policy "audit_logs admin only" on public.audit_logs
  for select using (public.is_admin());

-- ============================================================================
-- TRIGGERS — keep updated_at fresh
-- ============================================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated       before update on public.users        for each row execute function public.set_updated_at();
create trigger trg_profiles_updated    before update on public.profiles     for each row execute function public.set_updated_at();
create trigger trg_invitations_updated before update on public.invitations  for each row execute function public.set_updated_at();
create trigger trg_templates_updated   before update on public.templates    for each row execute function public.set_updated_at();
create trigger trg_orders_updated      before update on public.orders       for each row execute function public.set_updated_at();

-- ============================================================================
-- AUTH PROVISIONING — auto-create public.users / public.profiles on signup
-- Fires for EVERY new auth.users row, regardless of how the account was
-- created — email/password, Google OAuth, magic link, etc. Google (and most
-- OAuth providers) populate raw_user_meta_data with full_name / name /
-- avatar_url, which we use to pre-fill the profile so users skip typing their
-- name twice. Runs as SECURITY DEFINER so it bypasses RLS (this is the one
-- place that's expected to write rows on behalf of a brand-new user who has
-- no session-derived auth.uid() yet at insert time).
-- ============================================================================
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  derived_name  text  := coalesce(
                            nullif(meta->>'full_name', ''),
                            nullif(meta->>'name', ''),
                            split_part(new.email, '@', 1)
                          );
  avatar        text  := meta->>'avatar_url';
begin
  insert into public.users (id, email, email_verified)
  values (new.id, new.email, new.email_confirmed_at is not null)
  on conflict (id) do update set email = excluded.email;

  insert into public.profiles (user_id, full_name, photo_url)
  values (new.id, derived_name, avatar)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep public.users.email_verified in sync once a user confirms their email
-- (relevant for email/password signups; OAuth users are verified immediately).
create or replace function public.handle_auth_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users set email_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_handle_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_auth_user_confirmed();
