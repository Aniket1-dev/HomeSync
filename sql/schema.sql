-- ============================================================
-- HomeSync AI — Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  mobile_number text,
  date_of_birth date,
  photo_url text,
  age int,
  gender text,
  city text,
  preferred_area text,
  budget_min int,
  budget_max int,
  sleep_schedule int check (sleep_schedule between 1 and 5),
  cleanliness int check (cleanliness between 1 and 5),
  guest_frequency int check (guest_frequency between 1 and 5),
  personality int check (personality between 1 and 5),
  smoking_drinking text check (smoking_drinking in ('never','social','regular')),
  cooking_habits text check (cooking_habits in ('self_cook','order_in','shared')),
  conflict_style text check (conflict_style in ('avoids','discusses','confronts')),
  bio text,
  notif_prefs jsonb default '{"match_alerts": true, "email_updates": true}'::jsonb,
  dark_mode boolean default false,
  is_admin boolean default false,
  status text default 'active' check (status in ('active','suspended')),
  is_premium boolean default false,
  premium_since timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MIGRATION for existing projects: if your profiles table already
-- exists from before, run just this block in the SQL Editor instead
-- of the create table above (it's safe to re-run, uses IF NOT EXISTS).
-- ============================================================
-- alter table public.profiles add column if not exists email text;
-- alter table public.profiles add column if not exists mobile_number text;
-- alter table public.profiles add column if not exists date_of_birth date;
-- alter table public.profiles add column if not exists photo_url text;
-- alter table public.profiles add column if not exists notif_prefs jsonb default '{"match_alerts": true, "email_updates": true}'::jsonb;
-- alter table public.profiles add column if not exists dark_mode boolean default false;
-- alter table public.profiles add column if not exists is_admin boolean default false;
-- alter table public.profiles add column if not exists status text default 'active' check (status in ('active','suspended'));
-- alter table public.profiles add column if not exists is_premium boolean default false;
-- alter table public.profiles add column if not exists premium_since timestamptz;

alter table public.profiles enable row level security;

-- Any signed-in user can read all profiles (needed for matching to work).
-- For a public launch you'd later restrict fields returned via a view.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only insert/update their own row.
create policy "users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- ============================================================
-- Admin portal access
-- ------------------------------------------------------------
-- Admins are just profiles with is_admin = true. Promote yourself
-- after signing up once, from the SQL Editor:
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

create policy "admins can delete any profile"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Premium plan
-- ------------------------------------------------------------
-- `is_premium` unlocks unlimited matches, cross-city search, priority
-- placement in other users' match lists, and icebreaker suggestions
-- (see pricing.html / js/pricing.js). This prototype has no real payment
-- gateway wired up, so "upgrading" just self-serve flips this flag from
-- the client (allowed because of the "users can update own profile"
-- policy above) — fine for a demo/thesis project, but before any real
-- money changes hands this flag should only ever be set from a trusted
-- server (e.g. a webhook from Razorpay/Stripe using the service_role key),
-- not from client-side code.
-- ============================================================

-- Optional: table to cache LLM bio-compatibility results so you don't
-- re-call the API for the same pair every dashboard load.
create table if not exists public.llm_scores (
  user_a uuid references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete cascade,
  score int check (score between 0 and 100),
  justification text,
  created_at timestamptz default now(),
  primary key (user_a, user_b)
);

alter table public.llm_scores enable row level security;

create policy "llm scores readable by authenticated users"
  on public.llm_scores for select
  to authenticated
  using (true);

-- Writes to llm_scores happen only from the Edge Function using the
-- service_role key, which bypasses RLS — no insert/update policy needed
-- for regular users.

-- ============================================================
-- Contact form submissions (contact.html)
-- ============================================================
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- MIGRATION for existing projects: safe to re-run.
-- alter table public.contact_messages add column if not exists is_read boolean default false;

alter table public.contact_messages enable row level security;

-- Anyone (including signed-out visitors) can submit the contact form.
create policy "anyone can submit contact messages"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

-- Admins can read + triage contact messages from the Admin Portal.
create policy "admins can read contact messages"
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

create policy "admins can update contact messages"
  on public.contact_messages for update
  to authenticated
  using (public.is_admin());

create policy "admins can delete contact messages"
  on public.contact_messages for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Broadcast Center — admin-authored announcements shown to users
-- as a dismissible banner (dashboard.html reads the latest active one).
-- Targeting beyond "everyone" (city/college/verified/etc.) from the
-- original wish-list needs the profile fields that support it — this
-- ships "everyone" broadcasts now, in a shape that's easy to extend
-- with a `target_city` / `target_audience` column later.
-- ============================================================
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.broadcasts enable row level security;

-- Any signed-in user can read active broadcasts (to show the banner).
create policy "broadcasts readable by authenticated users"
  on public.broadcasts for select
  to authenticated
  using (is_active = true);

-- Only admins can create/manage broadcasts.
create policy "admins can insert broadcasts"
  on public.broadcasts for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can update broadcasts"
  on public.broadcasts for update
  to authenticated
  using (public.is_admin());

create policy "admins can delete broadcasts"
  on public.broadcasts for delete
  to authenticated
  using (public.is_admin());

-- Admins need to read inactive broadcasts too (to manage history) — this
-- policy is broader than the one above and Postgres OR-combines them.
create policy "admins can read all broadcasts"
  on public.broadcasts for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Profile photo uploads (profile.html)
-- ------------------------------------------------------------
-- Creates a public "avatars" bucket. Files are stored at
-- <user_id>/avatar.<ext> — the policies below only let a user
-- write inside their own <user_id>/ folder, while anyone can view
-- any avatar (needed since match cards show other people's photos).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
