-- Add app-level RBAC on top of per-user workspace ownership.
-- The current product is single-owner by default, but these roles let us
-- safely grow into team access without opening broad authenticated writes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('owner', 'admin', 'recruiter', 'viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended', 'deactivated');
  end if;
end
$$;

alter table public.profiles
  add column if not exists app_role public.app_role not null default 'owner',
  add column if not exists account_status public.account_status not null default 'active';

comment on column public.profiles.app_role is 'Application role used by RLS policies: owner, admin, recruiter, or viewer.';
comment on column public.profiles.account_status is 'Account access state. Suspended or deactivated users cannot access recruiter workspace data.';

create or replace function public.current_recruiter_role_can(access_level text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        (access_level = 'read' and p.app_role in ('owner', 'admin', 'recruiter', 'viewer'))
        or (access_level = 'write' and p.app_role in ('owner', 'admin', 'recruiter'))
        or (access_level = 'manage' and p.app_role in ('owner', 'admin'))
      )
  )
$$;

create or replace function public.can_access_recruiter_workspace(workspace_id uuid, access_level text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_recruiter_role_can(access_level)
    and exists (
      select 1
      from public.recruiter_workspaces w
      where w.id = workspace_id
        and w.user_id = (select auth.uid())
    )
$$;

revoke all on function public.current_recruiter_role_can(text) from public;
revoke all on function public.can_access_recruiter_workspace(uuid, text) from public;
grant execute on function public.current_recruiter_role_can(text) to authenticated;
grant execute on function public.can_access_recruiter_workspace(uuid, text) to authenticated;

-- Prevent client-side role or status escalation while keeping profile editing.
revoke insert, update on public.profiles from authenticated;
grant insert (
  id,
  email,
  full_name,
  first_name,
  last_name,
  company_name,
  job_title,
  phone,
  avatar_url,
  location,
  about,
  goals,
  skills,
  education,
  experience,
  socials,
  onboarding_complete,
  availability_start,
  preferred_weekly_hours,
  work_timezone,
  weekly_availability,
  availability_date_exceptions
) on public.profiles to authenticated;
grant update (
  email,
  full_name,
  first_name,
  last_name,
  company_name,
  job_title,
  phone,
  avatar_url,
  location,
  about,
  goals,
  skills,
  education,
  experience,
  socials,
  onboarding_complete,
  availability_start,
  preferred_weekly_hours,
  work_timezone,
  weekly_availability,
  availability_date_exceptions
) on public.profiles to authenticated;

drop policy if exists recruiter_workspaces_all_own on public.recruiter_workspaces;
drop policy if exists recruiter_workspaces_select_own_role on public.recruiter_workspaces;
drop policy if exists recruiter_workspaces_insert_own_role on public.recruiter_workspaces;
drop policy if exists recruiter_workspaces_update_own_role on public.recruiter_workspaces;
drop policy if exists recruiter_workspaces_delete_own_role on public.recruiter_workspaces;

create policy recruiter_workspaces_select_own_role on public.recruiter_workspaces
  for select to authenticated
  using ((select auth.uid()) = user_id and public.current_recruiter_role_can('read'));

create policy recruiter_workspaces_insert_own_role on public.recruiter_workspaces
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.current_recruiter_role_can('write'));

create policy recruiter_workspaces_update_own_role on public.recruiter_workspaces
  for update to authenticated
  using ((select auth.uid()) = user_id and public.current_recruiter_role_can('write'))
  with check ((select auth.uid()) = user_id and public.current_recruiter_role_can('write'));

create policy recruiter_workspaces_delete_own_role on public.recruiter_workspaces
  for delete to authenticated
  using ((select auth.uid()) = user_id and public.current_recruiter_role_can('manage'));

drop policy if exists recruiter_roles_all_own on public.recruiter_roles;
drop policy if exists recruiter_candidates_all_own on public.recruiter_candidates;
drop policy if exists recruiter_pipeline_entries_all_own on public.recruiter_pipeline_entries;
drop policy if exists recruiter_saved_searches_all_own on public.recruiter_saved_searches;
drop policy if exists recruiter_outreach_campaigns_all_own on public.recruiter_outreach_campaigns;
drop policy if exists recruiter_chats_all_own on public.recruiter_chats;
drop policy if exists recruiter_meetings_all_own on public.recruiter_meetings;
drop policy if exists recruiter_agents_all_own on public.recruiter_agents;
drop policy if exists recruiter_integrations_all_own on public.recruiter_integrations;
drop policy if exists recruiter_home_metric_snapshots_all_own on public.recruiter_home_metric_snapshots;
drop policy if exists recruiter_analytics_events_all_own on public.recruiter_analytics_events;
drop policy if exists recruiter_local_snapshots_all_own on public.recruiter_local_snapshots;
drop policy if exists recruiter_workspace_files_all_own on public.recruiter_workspace_files;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recruiter_roles',
    'recruiter_candidates',
    'recruiter_pipeline_entries',
    'recruiter_saved_searches',
    'recruiter_outreach_campaigns',
    'recruiter_chats',
    'recruiter_meetings',
    'recruiter_agents',
    'recruiter_integrations',
    'recruiter_home_metric_snapshots',
    'recruiter_analytics_events',
    'recruiter_local_snapshots',
    'recruiter_workspace_files'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_role', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_role', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_role', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_role', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_recruiter_workspace(workspace_id, %L))',
      table_name || '_select_role',
      table_name,
      'read'
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_access_recruiter_workspace(workspace_id, %L))',
      table_name || '_insert_role',
      table_name,
      'write'
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_access_recruiter_workspace(workspace_id, %L)) with check (public.can_access_recruiter_workspace(workspace_id, %L))',
      table_name || '_update_role',
      table_name,
      'write',
      'write'
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_access_recruiter_workspace(workspace_id, %L))',
      table_name || '_delete_role',
      table_name,
      'write'
    );
  end loop;
end
$$;

drop policy if exists recruiter_candidate_experience_all_own on public.recruiter_candidate_experience;
drop policy if exists recruiter_candidate_education_all_own on public.recruiter_candidate_education;
drop policy if exists recruiter_outreach_messages_all_own on public.recruiter_outreach_messages;
drop policy if exists recruiter_chat_messages_all_own on public.recruiter_chat_messages;
drop policy if exists recruiter_agent_runs_all_own on public.recruiter_agent_runs;

drop policy if exists recruiter_candidate_experience_select_role on public.recruiter_candidate_experience;
drop policy if exists recruiter_candidate_experience_insert_role on public.recruiter_candidate_experience;
drop policy if exists recruiter_candidate_experience_update_role on public.recruiter_candidate_experience;
drop policy if exists recruiter_candidate_experience_delete_role on public.recruiter_candidate_experience;
create policy recruiter_candidate_experience_select_role on public.recruiter_candidate_experience
  for select to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'read')));
create policy recruiter_candidate_experience_insert_role on public.recruiter_candidate_experience
  for insert to authenticated
  with check (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_candidate_experience_update_role on public.recruiter_candidate_experience
  for update to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')))
  with check (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_candidate_experience_delete_role on public.recruiter_candidate_experience
  for delete to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));

drop policy if exists recruiter_candidate_education_select_role on public.recruiter_candidate_education;
drop policy if exists recruiter_candidate_education_insert_role on public.recruiter_candidate_education;
drop policy if exists recruiter_candidate_education_update_role on public.recruiter_candidate_education;
drop policy if exists recruiter_candidate_education_delete_role on public.recruiter_candidate_education;
create policy recruiter_candidate_education_select_role on public.recruiter_candidate_education
  for select to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'read')));
create policy recruiter_candidate_education_insert_role on public.recruiter_candidate_education
  for insert to authenticated
  with check (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_candidate_education_update_role on public.recruiter_candidate_education
  for update to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')))
  with check (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_candidate_education_delete_role on public.recruiter_candidate_education
  for delete to authenticated
  using (exists (select 1 from public.recruiter_candidates c where c.id = candidate_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));

drop policy if exists recruiter_outreach_messages_select_role on public.recruiter_outreach_messages;
drop policy if exists recruiter_outreach_messages_insert_role on public.recruiter_outreach_messages;
drop policy if exists recruiter_outreach_messages_update_role on public.recruiter_outreach_messages;
drop policy if exists recruiter_outreach_messages_delete_role on public.recruiter_outreach_messages;
create policy recruiter_outreach_messages_select_role on public.recruiter_outreach_messages
  for select to authenticated
  using (exists (select 1 from public.recruiter_outreach_campaigns c where c.id = campaign_id and public.can_access_recruiter_workspace(c.workspace_id, 'read')));
create policy recruiter_outreach_messages_insert_role on public.recruiter_outreach_messages
  for insert to authenticated
  with check (exists (select 1 from public.recruiter_outreach_campaigns c where c.id = campaign_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_outreach_messages_update_role on public.recruiter_outreach_messages
  for update to authenticated
  using (exists (select 1 from public.recruiter_outreach_campaigns c where c.id = campaign_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')))
  with check (exists (select 1 from public.recruiter_outreach_campaigns c where c.id = campaign_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_outreach_messages_delete_role on public.recruiter_outreach_messages
  for delete to authenticated
  using (exists (select 1 from public.recruiter_outreach_campaigns c where c.id = campaign_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));

drop policy if exists recruiter_chat_messages_select_role on public.recruiter_chat_messages;
drop policy if exists recruiter_chat_messages_insert_role on public.recruiter_chat_messages;
drop policy if exists recruiter_chat_messages_update_role on public.recruiter_chat_messages;
drop policy if exists recruiter_chat_messages_delete_role on public.recruiter_chat_messages;
create policy recruiter_chat_messages_select_role on public.recruiter_chat_messages
  for select to authenticated
  using (exists (select 1 from public.recruiter_chats c where c.id = chat_id and public.can_access_recruiter_workspace(c.workspace_id, 'read')));
create policy recruiter_chat_messages_insert_role on public.recruiter_chat_messages
  for insert to authenticated
  with check (exists (select 1 from public.recruiter_chats c where c.id = chat_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_chat_messages_update_role on public.recruiter_chat_messages
  for update to authenticated
  using (exists (select 1 from public.recruiter_chats c where c.id = chat_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')))
  with check (exists (select 1 from public.recruiter_chats c where c.id = chat_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));
create policy recruiter_chat_messages_delete_role on public.recruiter_chat_messages
  for delete to authenticated
  using (exists (select 1 from public.recruiter_chats c where c.id = chat_id and public.can_access_recruiter_workspace(c.workspace_id, 'write')));

drop policy if exists recruiter_agent_runs_select_role on public.recruiter_agent_runs;
drop policy if exists recruiter_agent_runs_insert_role on public.recruiter_agent_runs;
drop policy if exists recruiter_agent_runs_update_role on public.recruiter_agent_runs;
drop policy if exists recruiter_agent_runs_delete_role on public.recruiter_agent_runs;
create policy recruiter_agent_runs_select_role on public.recruiter_agent_runs
  for select to authenticated
  using (exists (select 1 from public.recruiter_agents a where a.id = agent_id and public.can_access_recruiter_workspace(a.workspace_id, 'read')));
create policy recruiter_agent_runs_insert_role on public.recruiter_agent_runs
  for insert to authenticated
  with check (exists (select 1 from public.recruiter_agents a where a.id = agent_id and public.can_access_recruiter_workspace(a.workspace_id, 'write')));
create policy recruiter_agent_runs_update_role on public.recruiter_agent_runs
  for update to authenticated
  using (exists (select 1 from public.recruiter_agents a where a.id = agent_id and public.can_access_recruiter_workspace(a.workspace_id, 'write')))
  with check (exists (select 1 from public.recruiter_agents a where a.id = agent_id and public.can_access_recruiter_workspace(a.workspace_id, 'write')));
create policy recruiter_agent_runs_delete_role on public.recruiter_agent_runs
  for delete to authenticated
  using (exists (select 1 from public.recruiter_agents a where a.id = agent_id and public.can_access_recruiter_workspace(a.workspace_id, 'write')));
