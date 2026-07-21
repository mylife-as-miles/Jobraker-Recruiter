# Codex App Server integration

Jobraker Recruiter uses Codex App Server as the runtime behind the Codex settings tab. The browser does not call Codex directly and does not receive ChatGPT credentials.

## Architecture

```text
Jobraker Recruiter web UI
  -> http://127.0.0.1:17373
  -> scripts/codex-app-server-gateway.mjs
  -> codex app-server over stdio
  -> ChatGPT-authenticated Codex account
```

The local gateway exposes only the small HTTP and WebSocket surface needed by the web UI:

- `POST /codex/connect` starts `account/login/start` with the ChatGPT device-code flow.
- `GET /codex/status` reads connection state through `account/read`.
- `POST /codex/logout` disconnects the current App Server account.
- `WS /ws/codex` starts or resumes a Codex thread and streams turn events.

## Start locally

Install the Codex package so that the `codex` executable is available, then run:

```bash
npm run codex:app-server
```

The previous command remains as a compatibility alias:

```bash
npm run codex:bridge
```

It starts the same App Server gateway and does not use the legacy `codex login` command.

Open Jobraker Recruiter, go to **Settings -> Codex**, select **Connect ChatGPT**, and complete the device-code challenge shown in the app.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `CODEX_BIN` | Codex executable path or command | `codex` |
| `JOBRAKER_CODEX_APP_SERVER_PORT` | Local gateway port | `17373` |
| `JOBRAKER_CODEX_BRIDGE_PORT` | Backward-compatible port variable | `17373` |
| `JOBRAKER_CODEX_ALLOWED_ORIGINS` | Comma-separated browser origins | Jobraker production and local origins |

## Security boundaries

- App Server communicates with the gateway through local stdio.
- The gateway listens on `127.0.0.1`, not on a public interface.
- ChatGPT tokens remain in the local Codex home managed by Codex.
- The browser receives only the device challenge, account display state, and streamed task events.
- Workspace tasks use the current repository directory and a workspace-write sandbox.
- Unexpected command or file approval requests are declined by the gateway.
