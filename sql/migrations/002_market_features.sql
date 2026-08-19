-- HomeSync market-informed roommate discovery schema
alter table public.profiles
  add column if not exists move_in_date date,
  add column if not exists commute_preference text,
  add column if not exists room_type text,
  add column if not exists deposit_budget integer,
  add column if not exists utilities_budget integer,
  add column if not exists verification_status text default 'unverified',
  add column if not exists last_active_at timestamptz;

create table if not exists public.roommate_questionnaire (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  dealbreakers jsonb not null default '[]'::jsonb,
  compatibility_version integer not null default 1,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.roommate_questionnaire enable row level security;
drop policy if exists "Users can view own roommate questionnaire" on public.roommate_questionnaire;
drop policy if exists "Users can insert own roommate questionnaire" on public.roommate_questionnaire;
drop policy if exists "Users can update own roommate questionnaire" on public.roommate_questionnaire;
create policy "Users can view own roommate questionnaire" on public.roommate_questionnaire for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own roommate questionnaire" on public.roommate_questionnaire for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own roommate questionnaire" on public.roommate_questionnaire for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists profiles_move_in_date_idx on public.profiles(move_in_date);
create index if not exists profiles_last_active_at_idx on public.profiles(last_active_at desc);
create index if not exists profiles_verification_status_idx on public.profiles(verification_status);
create index if not exists profiles_room_type_idx on public.profiles(room_type);
