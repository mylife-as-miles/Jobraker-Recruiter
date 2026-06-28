-- Jobraker Recruiter user profile schema.
--
-- Supabase Auth keeps identities in auth.users. App-owned user data lives in
-- public.profiles so it can be safely queried from the web and desktop apps.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  first_name text,
  last_name text,
  company_name text,
  job_title text,
  phone text,
  avatar_url text,
  location text,
  about text,
  goals text[] not null default '{}',
  skills text[] not null default '{}',
  education jsonb,
  experience jsonb,
  socials jsonb,
  onboarding_complete boolean not null default false,
  availability_start text,
  preferred_weekly_hours integer,
  work_timezone text,
  weekly_availability jsonb,
  availability_date_exceptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Recruiter-facing user profile records linked one-to-one with auth.users.';
comment on column public.profiles.availability_start is 'When the recruiter can start using or staffing new hiring workflows.';
comment on column public.profiles.preferred_weekly_hours is 'Preferred weekly hiring/recruiting workload hours.';
comment on column public.profiles.work_timezone is 'IANA timezone for interpreting weekly availability.';
comment on column public.profiles.weekly_availability is 'JSON map of day index 0=Sun..6=Sat to array of {start,end} in HH:MM.';
comment on column public.profiles.availability_date_exceptions is 'Array of {id,date,unavailable,slots} for date-specific overrides.';

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_skills_idx on public.profiles using gin (skills);

alter table public.profiles enable row level security;

drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Insert own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- SECURITY DEFINER is needed here because the trigger runs from auth.users and
-- must create the matching app profile row in public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text := split_part(new.email, '@', 1);
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), fallback_name),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
