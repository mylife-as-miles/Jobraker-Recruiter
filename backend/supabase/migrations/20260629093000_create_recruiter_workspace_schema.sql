-- Jobraker Recruiter workspace schema.
--
-- The Electron app persists recruiter state to config/recruiter-db.json with:
-- candidates, roles, pipelineBoard, candidateStages, candidateNotes,
-- roleFavorites, and homeMetricsSnapshots. This migration normalizes those
-- local-file concepts for the web app while leaving room for pages that are
-- already present in the desktop shell: sourcing, outreach, meetings, agents,
-- analytics, integrations, and settings.

create extension if not exists pgcrypto;

create table if not exists public.recruiter_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Jobraker Recruiter Workspace',
  company_name text,
  role_title text,
  timezone text,
  settings jsonb not null default '{}'::jsonb,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.recruiter_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  external_id text,
  title text not null,
  department text,
  location text,
  employment_type text,
  level text,
  salary_range text,
  status text not null default 'Draft'
    check (status in ('Open', 'Interviewing', 'Closing', 'Draft', 'Archived')),
  posted_at timestamptz,
  posted_ago text,
  applicants integer not null default 0 check (applicants >= 0),
  new_applicants integer not null default 0 check (new_applicants >= 0),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  favorite boolean not null default false,
  description text,
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  skills text[] not null default '{}',
  stage_counts jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

create table if not exists public.recruiter_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete set null,
  external_id text,
  name text not null,
  title text,
  headline text,
  location text,
  email text,
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  linkedin_url text,
  photo_url text,
  summary text,
  experience_years numeric(4, 1) not null default 0 check (experience_years >= 0),
  match_score integer not null default 0 check (match_score between 0 and 100),
  startup_fit_score integer not null default 0 check (startup_fit_score between 0 and 100),
  startup_fit_insight text,
  stage text not null default 'New'
    check (stage in ('New', 'Screening', 'In Review', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Archived')),
  source text not null default 'Quick Import'
    check (source in ('LinkedIn', 'Referral', 'Website', 'Job Board', 'AngelList', 'Dribbble', 'Twitter', 'Career Page', 'PDL Enrichment', 'Enrich.so', 'Quick Import', 'Manual')),
  last_activity text,
  last_activity_at timestamptz,
  fit text check (fit in ('High fit', 'Recommended')),
  skills text[] not null default '{}',
  highlights text[] not null default '{}',
  ai_insight text,
  note text,
  company_stages text[] not null default '{}',
  growth_trajectory text check (growth_trajectory in ('Fast', 'Moderate', 'Steady')),
  vesting_status text check (vesting_status in ('Fully Vested', 'Partially Vested', 'Unvested')),
  intent_signal text check (intent_signal in ('Actively Sourcing', 'Recently Promoted', 'High Engagement', 'Passive')),
  enrichment_source text check (enrichment_source in ('pdl', 'enrich.so', 'manual')),
  enriched_at timestamptz,
  social_profiles jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

create table if not exists public.recruiter_candidate_experience (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiter_candidates(id) on delete cascade,
  company text not null,
  title text not null,
  start_date text,
  end_date text,
  is_current boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_candidate_education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiter_candidates(id) on delete cascade,
  school text not null,
  degree text,
  field text,
  start_year integer,
  end_year integer,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete cascade,
  candidate_id uuid not null references public.recruiter_candidates(id) on delete cascade,
  stage text not null
    check (stage in ('Sourced', 'Contacted', 'Screening', 'Interview', 'Offer', 'Hired', 'Archived')),
  sort_order integer not null default 0,
  entered_stage_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, role_id, candidate_id)
);

create table if not exists public.recruiter_saved_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete set null,
  name text not null,
  description text,
  query text,
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete set null,
  candidate_id uuid references public.recruiter_candidates(id) on delete set null,
  name text not null,
  mode text not null default 'single' check (mode in ('single', 'sequence')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'sent', 'completed', 'archived')),
  subject text,
  body text,
  sequence_steps jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.recruiter_outreach_campaigns(id) on delete cascade,
  candidate_id uuid references public.recruiter_candidates(id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'sms', 'note')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'opened', 'replied', 'bounced', 'failed')),
  subject text,
  body text not null default '',
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_chats (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  title text not null default 'New recruiter chat',
  agent_slug text,
  status text not null default 'open' check (status in ('open', 'pinned', 'archived')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.recruiter_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete set null,
  candidate_id uuid references public.recruiter_candidates(id) on delete set null,
  external_event_id text,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  meeting_url text,
  platform text,
  attendees jsonb not null default '[]'::jsonb,
  transcript_path text,
  transcript text,
  notes_path text,
  summary text,
  status text not null default 'scheduled' check (status in ('scheduled', 'recording', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_event_id)
);

create table if not exists public.recruiter_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  kind text not null default 'background' check (kind in ('background', 'sourcing', 'outreach', 'screening', 'meeting_notes', 'analytics')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'running', 'paused', 'error', 'completed')),
  enabled boolean not null default true,
  schedule jsonb,
  trigger_config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer not null default 0 check (run_count >= 0),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.recruiter_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.recruiter_agents(id) on delete cascade,
  run_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  provider text not null,
  label text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'needs_reconnect', 'error')),
  account_email text,
  scopes text[] not null default '{}',
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, account_email)
);

create table if not exists public.recruiter_home_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  label text,
  metrics jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recruiter_analytics_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  role_id uuid references public.recruiter_roles(id) on delete set null,
  candidate_id uuid references public.recruiter_candidates(id) on delete set null,
  event_type text not null,
  event_name text,
  value numeric,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recruiter_local_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  source_path text not null default 'config/recruiter-db.json',
  payload jsonb not null default '{}'::jsonb,
  checksum text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists recruiter_workspaces_user_id_idx on public.recruiter_workspaces (user_id);
create index if not exists recruiter_roles_workspace_status_idx on public.recruiter_roles (workspace_id, status);
create index if not exists recruiter_roles_skills_idx on public.recruiter_roles using gin (skills);
create index if not exists recruiter_candidates_workspace_stage_idx on public.recruiter_candidates (workspace_id, stage);
create index if not exists recruiter_candidates_role_id_idx on public.recruiter_candidates (role_id);
create index if not exists recruiter_candidates_email_idx on public.recruiter_candidates (email);
create index if not exists recruiter_candidates_skills_idx on public.recruiter_candidates using gin (skills);
create index if not exists recruiter_candidate_experience_candidate_id_idx on public.recruiter_candidate_experience (candidate_id);
create index if not exists recruiter_candidate_education_candidate_id_idx on public.recruiter_candidate_education (candidate_id);
create index if not exists recruiter_pipeline_entries_workspace_stage_idx on public.recruiter_pipeline_entries (workspace_id, stage, sort_order);
create index if not exists recruiter_outreach_campaigns_workspace_status_idx on public.recruiter_outreach_campaigns (workspace_id, status);
create index if not exists recruiter_outreach_messages_campaign_id_idx on public.recruiter_outreach_messages (campaign_id);
create index if not exists recruiter_chats_workspace_last_message_idx on public.recruiter_chats (workspace_id, last_message_at desc nulls last);
create index if not exists recruiter_chat_messages_chat_created_idx on public.recruiter_chat_messages (chat_id, created_at);
create index if not exists recruiter_meetings_workspace_starts_at_idx on public.recruiter_meetings (workspace_id, starts_at);
create index if not exists recruiter_agents_workspace_status_idx on public.recruiter_agents (workspace_id, status);
create index if not exists recruiter_agent_runs_agent_id_idx on public.recruiter_agent_runs (agent_id);
create index if not exists recruiter_integrations_workspace_provider_idx on public.recruiter_integrations (workspace_id, provider);
create index if not exists recruiter_analytics_events_workspace_type_idx on public.recruiter_analytics_events (workspace_id, event_type, occurred_at desc);
create index if not exists recruiter_home_metric_snapshots_workspace_captured_idx on public.recruiter_home_metric_snapshots (workspace_id, captured_at desc);

create or replace function public.recruiter_workspace_owner_id(workspace_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select user_id
  from public.recruiter_workspaces
  where id = workspace_id
$$;

revoke all on function public.recruiter_workspace_owner_id(uuid) from public;
grant execute on function public.recruiter_workspace_owner_id(uuid) to authenticated;

drop trigger if exists set_recruiter_workspaces_updated_at on public.recruiter_workspaces;
drop trigger if exists set_recruiter_roles_updated_at on public.recruiter_roles;
drop trigger if exists set_recruiter_candidates_updated_at on public.recruiter_candidates;
drop trigger if exists set_recruiter_candidate_experience_updated_at on public.recruiter_candidate_experience;
drop trigger if exists set_recruiter_candidate_education_updated_at on public.recruiter_candidate_education;
drop trigger if exists set_recruiter_pipeline_entries_updated_at on public.recruiter_pipeline_entries;
drop trigger if exists set_recruiter_saved_searches_updated_at on public.recruiter_saved_searches;
drop trigger if exists set_recruiter_outreach_campaigns_updated_at on public.recruiter_outreach_campaigns;
drop trigger if exists set_recruiter_outreach_messages_updated_at on public.recruiter_outreach_messages;
drop trigger if exists set_recruiter_chats_updated_at on public.recruiter_chats;
drop trigger if exists set_recruiter_chat_messages_updated_at on public.recruiter_chat_messages;
drop trigger if exists set_recruiter_meetings_updated_at on public.recruiter_meetings;
drop trigger if exists set_recruiter_agents_updated_at on public.recruiter_agents;
drop trigger if exists set_recruiter_agent_runs_updated_at on public.recruiter_agent_runs;
drop trigger if exists set_recruiter_integrations_updated_at on public.recruiter_integrations;

create trigger set_recruiter_workspaces_updated_at before update on public.recruiter_workspaces for each row execute function public.set_updated_at();
create trigger set_recruiter_roles_updated_at before update on public.recruiter_roles for each row execute function public.set_updated_at();
create trigger set_recruiter_candidates_updated_at before update on public.recruiter_candidates for each row execute function public.set_updated_at();
create trigger set_recruiter_candidate_experience_updated_at before update on public.recruiter_candidate_experience for each row execute function public.set_updated_at();
create trigger set_recruiter_candidate_education_updated_at before update on public.recruiter_candidate_education for each row execute function public.set_updated_at();
create trigger set_recruiter_pipeline_entries_updated_at before update on public.recruiter_pipeline_entries for each row execute function public.set_updated_at();
create trigger set_recruiter_saved_searches_updated_at before update on public.recruiter_saved_searches for each row execute function public.set_updated_at();
create trigger set_recruiter_outreach_campaigns_updated_at before update on public.recruiter_outreach_campaigns for each row execute function public.set_updated_at();
create trigger set_recruiter_outreach_messages_updated_at before update on public.recruiter_outreach_messages for each row execute function public.set_updated_at();
create trigger set_recruiter_chats_updated_at before update on public.recruiter_chats for each row execute function public.set_updated_at();
create trigger set_recruiter_chat_messages_updated_at before update on public.recruiter_chat_messages for each row execute function public.set_updated_at();
create trigger set_recruiter_meetings_updated_at before update on public.recruiter_meetings for each row execute function public.set_updated_at();
create trigger set_recruiter_agents_updated_at before update on public.recruiter_agents for each row execute function public.set_updated_at();
create trigger set_recruiter_agent_runs_updated_at before update on public.recruiter_agent_runs for each row execute function public.set_updated_at();
create trigger set_recruiter_integrations_updated_at before update on public.recruiter_integrations for each row execute function public.set_updated_at();

alter table public.recruiter_workspaces enable row level security;
alter table public.recruiter_roles enable row level security;
alter table public.recruiter_candidates enable row level security;
alter table public.recruiter_candidate_experience enable row level security;
alter table public.recruiter_candidate_education enable row level security;
alter table public.recruiter_pipeline_entries enable row level security;
alter table public.recruiter_saved_searches enable row level security;
alter table public.recruiter_outreach_campaigns enable row level security;
alter table public.recruiter_outreach_messages enable row level security;
alter table public.recruiter_chats enable row level security;
alter table public.recruiter_chat_messages enable row level security;
alter table public.recruiter_meetings enable row level security;
alter table public.recruiter_agents enable row level security;
alter table public.recruiter_agent_runs enable row level security;
alter table public.recruiter_integrations enable row level security;
alter table public.recruiter_home_metric_snapshots enable row level security;
alter table public.recruiter_analytics_events enable row level security;
alter table public.recruiter_local_snapshots enable row level security;

drop policy if exists recruiter_workspaces_all_own on public.recruiter_workspaces;
create policy recruiter_workspaces_all_own on public.recruiter_workspaces
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists recruiter_roles_all_own on public.recruiter_roles;
create policy recruiter_roles_all_own on public.recruiter_roles
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_candidates_all_own on public.recruiter_candidates;
create policy recruiter_candidates_all_own on public.recruiter_candidates
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_pipeline_entries_all_own on public.recruiter_pipeline_entries;
create policy recruiter_pipeline_entries_all_own on public.recruiter_pipeline_entries
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_saved_searches_all_own on public.recruiter_saved_searches;
create policy recruiter_saved_searches_all_own on public.recruiter_saved_searches
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_outreach_campaigns_all_own on public.recruiter_outreach_campaigns;
create policy recruiter_outreach_campaigns_all_own on public.recruiter_outreach_campaigns
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_chats_all_own on public.recruiter_chats;
create policy recruiter_chats_all_own on public.recruiter_chats
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_meetings_all_own on public.recruiter_meetings;
create policy recruiter_meetings_all_own on public.recruiter_meetings
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_agents_all_own on public.recruiter_agents;
create policy recruiter_agents_all_own on public.recruiter_agents
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_integrations_all_own on public.recruiter_integrations;
create policy recruiter_integrations_all_own on public.recruiter_integrations
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_home_metric_snapshots_all_own on public.recruiter_home_metric_snapshots;
create policy recruiter_home_metric_snapshots_all_own on public.recruiter_home_metric_snapshots
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_analytics_events_all_own on public.recruiter_analytics_events;
create policy recruiter_analytics_events_all_own on public.recruiter_analytics_events
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_local_snapshots_all_own on public.recruiter_local_snapshots;
create policy recruiter_local_snapshots_all_own on public.recruiter_local_snapshots
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

drop policy if exists recruiter_candidate_experience_all_own on public.recruiter_candidate_experience;
create policy recruiter_candidate_experience_all_own on public.recruiter_candidate_experience
  for all to authenticated
  using (
    exists (
      select 1
      from public.recruiter_candidates c
      where c.id = candidate_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recruiter_candidates c
      where c.id = candidate_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  );

drop policy if exists recruiter_candidate_education_all_own on public.recruiter_candidate_education;
create policy recruiter_candidate_education_all_own on public.recruiter_candidate_education
  for all to authenticated
  using (
    exists (
      select 1
      from public.recruiter_candidates c
      where c.id = candidate_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recruiter_candidates c
      where c.id = candidate_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  );

drop policy if exists recruiter_outreach_messages_all_own on public.recruiter_outreach_messages;
create policy recruiter_outreach_messages_all_own on public.recruiter_outreach_messages
  for all to authenticated
  using (
    exists (
      select 1
      from public.recruiter_outreach_campaigns c
      where c.id = campaign_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recruiter_outreach_campaigns c
      where c.id = campaign_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  );

drop policy if exists recruiter_chat_messages_all_own on public.recruiter_chat_messages;
create policy recruiter_chat_messages_all_own on public.recruiter_chat_messages
  for all to authenticated
  using (
    exists (
      select 1
      from public.recruiter_chats c
      where c.id = chat_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recruiter_chats c
      where c.id = chat_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(c.workspace_id)
    )
  );

drop policy if exists recruiter_agent_runs_all_own on public.recruiter_agent_runs;
create policy recruiter_agent_runs_all_own on public.recruiter_agent_runs
  for all to authenticated
  using (
    exists (
      select 1
      from public.recruiter_agents a
      where a.id = agent_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(a.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recruiter_agents a
      where a.id = agent_id
        and (select auth.uid()) = public.recruiter_workspace_owner_id(a.workspace_id)
    )
  );

grant select, insert, update, delete on
  public.recruiter_workspaces,
  public.recruiter_roles,
  public.recruiter_candidates,
  public.recruiter_candidate_experience,
  public.recruiter_candidate_education,
  public.recruiter_pipeline_entries,
  public.recruiter_saved_searches,
  public.recruiter_outreach_campaigns,
  public.recruiter_outreach_messages,
  public.recruiter_chats,
  public.recruiter_chat_messages,
  public.recruiter_meetings,
  public.recruiter_agents,
  public.recruiter_agent_runs,
  public.recruiter_integrations,
  public.recruiter_home_metric_snapshots,
  public.recruiter_analytics_events,
  public.recruiter_local_snapshots
to authenticated;

comment on table public.recruiter_workspaces is 'Top-level recruiter workspace owned by a Supabase profile.';
comment on table public.recruiter_roles is 'Open positions from the Roles page.';
comment on table public.recruiter_candidates is 'Candidate records from candidates, sourcing, pipeline, and outreach pages.';
comment on table public.recruiter_pipeline_entries is 'Normalized pipeline board membership replacing local pipelineBoard JSON.';
comment on table public.recruiter_outreach_campaigns is 'Single-message and sequence outreach drafts/campaigns.';
comment on table public.recruiter_chats is 'Recruiter chat conversations from the AI chat page.';
comment on table public.recruiter_chat_messages is 'Message history, attachments, and tool calls for recruiter chat conversations.';
comment on table public.recruiter_meetings is 'Calendar/interview meetings and generated notes/transcripts.';
comment on table public.recruiter_agents is 'Persistent AI recruiter agents and scheduled background tasks.';
comment on table public.recruiter_integrations is 'Connected recruiter tools such as Gmail, Calendar, Fireflies, PDL, Enrich.so, and ATS providers.';
comment on table public.recruiter_home_metric_snapshots is 'Home/dashboard metric snapshots from the Electron local file model.';
comment on table public.recruiter_local_snapshots is 'Raw config/recruiter-db.json snapshots for compatibility with desktop local-file sync.';
