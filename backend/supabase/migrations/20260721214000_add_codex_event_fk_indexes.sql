create index if not exists codex_run_events_workspace_id_idx
  on public.codex_run_events (workspace_id);

create index if not exists codex_run_events_user_id_idx
  on public.codex_run_events (user_id);
