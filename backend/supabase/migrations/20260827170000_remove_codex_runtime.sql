-- Remove the retired Codex App Server runtime.
-- Historical migrations are intentionally retained so existing Supabase migration
-- histories remain valid, but the active schema no longer keeps Codex state.
-- PostgreSQL automatically removes dropped relations from publications.

drop table if exists public.codex_run_events cascade;
drop table if exists public.codex_runs cascade;
drop table if exists public.codex_connections cascade;
