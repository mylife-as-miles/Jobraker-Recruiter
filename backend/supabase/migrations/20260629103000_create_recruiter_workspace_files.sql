-- Database-backed replacement for the Electron workspace:* local file IPC API.

create table if not exists public.recruiter_workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.recruiter_workspaces(id) on delete cascade,
  path text not null,
  kind text not null default 'file' check (kind in ('file', 'dir')),
  data text,
  encoding text not null default 'utf8' check (encoding in ('utf8', 'base64', 'binary')),
  mime_type text,
  byte_size integer not null default 0 check (byte_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, path)
);

create index if not exists recruiter_workspace_files_workspace_path_idx
  on public.recruiter_workspace_files (workspace_id, path);

drop trigger if exists set_recruiter_workspace_files_updated_at on public.recruiter_workspace_files;
create trigger set_recruiter_workspace_files_updated_at
  before update on public.recruiter_workspace_files
  for each row execute function public.set_updated_at();

alter table public.recruiter_workspace_files enable row level security;

drop policy if exists recruiter_workspace_files_all_own on public.recruiter_workspace_files;
create policy recruiter_workspace_files_all_own on public.recruiter_workspace_files
  for all to authenticated
  using ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id))
  with check ((select auth.uid()) = public.recruiter_workspace_owner_id(workspace_id));

grant select, insert, update, delete on public.recruiter_workspace_files to authenticated;

comment on table public.recruiter_workspace_files is 'Authenticated web replacement for desktop workspace local files and folders.';
