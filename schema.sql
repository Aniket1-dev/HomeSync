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
-- MIGRATION 2 — Admin roles + notifications
-- Run this whole block once in Supabase SQL Editor -> New query -> Run.
-- Safe to re-run (everything is IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- Every user gets 'user' by default. You promote your team manually
-- (see "Making your team admins" below) — there is no UI to self-promote.
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists status text default 'active';

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('user','admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_status_check check (status in ('active','suspended'));
exception when duplicate_object then null; end $$;

-- SECURITY DEFINER so it can read the profiles table even from inside a
-- profiles RLS policy (avoids infinite recursion) — this function is the
-- single source of truth for "is the current user an admin?".
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Admins can update any profile (needed for the admin panel to promote/
-- suspend users). This is ADDED alongside the existing "users can update
-- own profile" policy — Postgres OR's multiple policies together.
drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Guard rail: even though a regular user's own row is updatable, they must
-- never be able to grant themselves admin or unsuspend themselves by
-- editing the request in devtools. This trigger silently reverts role/
-- status changes unless the person making the change is already an admin.
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_privilege_escalation on public.profiles;
create trigger trg_prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_privilege_escalation();

-- ---- Notifications ----
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text default 'system',
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- Anyone can insert a notification for themselves (e.g. dashboard.js
-- writing its own "new match" digest); only admins can insert one for
-- someone else (the admin panel's broadcast tool).
drop policy if exists "insert own or admin broadcast" on public.notifications;
create policy "insert own or admin broadcast"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Auto-send a welcome notification the moment someone finishes onboarding
-- (their profiles row is created).
create or replace function public.notify_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (
    new.id,
    'system',
    'Welcome to HomeSync AI',
    'Your lifestyle profile is live. Check your dashboard to see ranked matches.',
    'dashboard.html'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_welcome on public.profiles;
create trigger trg_notify_welcome
  after insert on public.profiles
  for each row execute function public.notify_welcome();

-- ============================================================
-- Making your team admins (run once per admin, after they've signed up
-- and completed onboarding at least once so their profiles row exists):
--
--   update public.profiles set role = 'admin' where email = 'teammate@example.com';
--
-- Do this for all 4 of you. Nobody else can grant this to themselves —
-- see prevent_privilege_escalation() above.
-- ============================================================

-- ============================================================
-- MIGRATION 3 — Mandatory profile photo (Storage) + contact notifications
-- Run this whole block once in Supabase SQL Editor -> New query -> Run.
-- ============================================================

-- ---- Avatar storage bucket ----
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars (they're shown on match cards).
drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Users can only upload/update/delete files inside their own folder —
-- files are stored as avatars/{user_id}/{timestamp}.{ext}, enforced by
-- checking the first path segment matches auth.uid().
drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- "Someone reached out" notification ----
-- A controlled RPC instead of a free-form insert policy: it only ever
-- writes a fixed-shape "X reached out via <channel>" notification, so a
-- user can't use it to spam arbitrary content to arbitrary people. Runs
-- as the function owner, so it bypasses the notifications insert policy
-- (which normally only allows inserting your own notifications).
create or replace function public.notify_contact(target_id uuid, channel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  if target_id = auth.uid() then
    return; -- no-op if someone somehow calls this on themselves
  end if;

  select coalesce(full_name, 'Someone') into sender_name
  from public.profiles where id = auth.uid();

  insert into public.notifications (user_id, type, title, body, link)
  values (
    target_id,
    'contact',
    sender_name || ' reached out to connect',
    'They messaged you via ' || channel || ' from HomeSync AI — check your inbox.',
    'dashboard.html'
  );
end;
$$;

grant execute on function public.notify_contact(uuid, text) to authenticated;
