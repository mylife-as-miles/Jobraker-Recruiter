# Hosted Codex App Server integration

Jobraker Recruiter remains a Vite web application. Supabase is the control plane for identity, authorization, durable run state, and Realtime delivery. A private persistent worker runs Codex App Server because a browser and a short-lived Edge Function cannot own local processes or a durable `CODEX_HOME`.

## Architecture

```text
Vite browser
  -> Supabase Auth JWT
  -> codex-control Edge Function
  -> private hosted Codex worker
  -> codex app-server over stdio
  -> per-user CODEX_HOME and workspace

Codex worker
  -> codex_connections / codex_runs / codex_run_events
  -> Supabase Realtime
  -> Vite browser
```

Users do not install Codex or run a local gateway. The Vite app invokes the authenticated `codex-control` Edge Function and subscribes to its own RLS-protected run rows.

## Components

### Vite settings UI

`src/components/settings/codex-app-server-settings.tsx`:

- invokes `codex-control` with the current Supabase session;
- displays the ChatGPT device-code challenge;
- polls connection state through Supabase;
- creates and cancels Codex runs;
- subscribes to `codex_runs` and `codex_run_events` through Realtime.

### Supabase Edge Function

`backend/supabase/functions/codex-control`:

- requires a valid Supabase JWT;
- resolves the user's recruiter workspace;
- owns all privileged writes through a server secret key;
- forwards only validated user/workspace/run identifiers to the private worker;
- never returns ChatGPT tokens to the browser.

Configure these Supabase function secrets:

| Secret | Purpose |
| --- | --- |
| `CODEX_WORKER_URL` | Private HTTPS origin of the worker, without a trailing slash |
| `CODEX_WORKER_SECRET` | High-entropy shared secret used only between the Edge Function and worker |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used for protected Codex state writes |

Example:

```bash
supabase secrets set --project-ref kazdiejpfujhudqucaaw CODEX_WORKER_URL=https://your-worker-host CODEX_WORKER_SECRET=your-shared-secret
supabase functions deploy codex-control --project-ref kazdiejpfujhudqucaaw
```

### Persistent Codex worker

`services/codex-worker`:

- authenticates every request with `x-jobraker-worker-secret`;
- creates a separate `CODEX_HOME` and workspace for each Supabase user;
- starts `codex app-server` over stdio;
- handles ChatGPT device-code login and account status;
- starts, interrupts, and records Codex turns;
- strips Supabase and worker secrets from the Codex child-process environment.

Required worker environment variables:

| Variable | Purpose |
| --- | --- |
| `JOBRAKER_CODEX_WORKER_SECRET` | Must exactly match Supabase `CODEX_WORKER_SECRET` |
| `SUPABASE_URL` | Jobraker Recruiter project URL |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `JOBRAKER_CODEX_DATA_DIR` | Persistent volume for per-user Codex state; defaults to `./.jobraker-codex` |
| `CODEX_BIN` | Optional Codex executable override; defaults to `codex` |
| `PORT` | Worker HTTP port; defaults to `8787` |

Build from the repository root:

```bash
# The image installs a pinned Codex package and exposes port 8787.
docker build -f services/codex-worker/Dockerfile -t jobraker-codex-worker .
```

Deploy the worker behind private networking or an authenticated HTTPS ingress and attach a persistent volume at `/data/codex`. Start with one replica unless distributed runtime locking and shared workspace semantics have been added.

## Database and Realtime

Migration `20260721210000_create_codex_web_runtime.sql` creates:

- `codex_connections` — account display metadata and connection state;
- `codex_runs` — durable prompts, model choices, status, output, and thread identifiers;
- `codex_run_events` — ordered App Server events used for progress and reconnect-safe replay.

All three tables have RLS enabled. Authenticated users receive read-only access to their own rows. Only the server role writes worker state. The migration also adds the tables to the `supabase_realtime` publication.

## Security boundaries

- Supabase Auth remains the authoritative Jobraker identity.
- ChatGPT authentication is a secondary Codex provider connection.
- ChatGPT tokens stay inside the user's worker-side `CODEX_HOME`; they are never stored in Postgres or Vite.
- The worker is not exposed directly to the browser.
- Each user receives an isolated runtime directory.
- Command and file-change approval requests are declined by the worker in this initial web implementation.
- Codex child processes do not inherit Supabase server keys, the worker shared secret, or `DATABASE_URL`.
