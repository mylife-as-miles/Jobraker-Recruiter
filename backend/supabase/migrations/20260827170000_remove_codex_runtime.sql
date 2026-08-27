-- Remove the retired Codex App Server runtime.
-- Historical migrations are intentionally retained so existing Supabase migration
-- histories remain valid, but the active schema no longer keeps Codex state.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.codex_run_events;
    exception when undefined_table or object_not_in_prerequisite_state then null;
    end;
    begin
      alter publication supabase_realtime drop table public.codex_runs;
    exception when undefined_table or object_not_in_prerequisite_state then null;
    end;
    begin
      alter publication supabase_realtime drop table public.codex_connections;
    exception when undefined_table or object_not_in_prerequisite_state then null;
    end;
  end if;
end
$$;

drop table if exists public.codex_run_events cascade;
drop table if exists public.codex_runs cascade;
drop table if exists public.codex_connections cascade;
