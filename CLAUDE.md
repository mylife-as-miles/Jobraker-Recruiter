# CLAUDE.md - AI Coding Agent Context

This file provides context for AI coding agents working on the **Jobraker Recruiter** monorepo — a local-first Electron desktop copilot for recruiters and lean hiring teams.

## Quick Reference Commands

```bash
# Electron App (apps/x)
cd apps/x && pnpm install          # Install dependencies
cd apps/x && npm run deps          # Build workspace packages (shared → core → preload)
cd apps/x && npm run dev           # Development mode (builds deps, runs app)
cd apps/x && npm run lint          # Lint check
cd apps/x/apps/main && npm run package   # Production build (.app)
cd apps/x/apps/main && npm run make      # Create DMG distributable
```

**Dev server:** Vite runs on `http://localhost:5173`. Main process waits for that port, then builds and starts Electron. On Windows use PowerShell (`;` not `&&` if chaining manually).

**Hot reload:** Renderer (React) hot-reloads. Main process and preload do **not** — restart `npm run dev` after editing `apps/main/src/` or `apps/preload/src/`.

**Verify compilation:**
```bash
cd apps/x && npm run deps && npm run lint
cd apps/x/apps/renderer && npx tsc --noEmit
```

## Monorepo Structure

```
jobraker-recruiter/
├── apps/
│   ├── x/                    # Electron desktop app (primary focus of this doc)
│   ├── jobraker-recruiter/   # Next.js web dashboard
│   ├── jobraker-recruiter-x/ # Next.js frontend
│   ├── cli/                  # CLI tool
│   ├── python-sdk/           # Python SDK
│   └── docs/                 # Documentation site
├── AGENTS.md                 # Cross-agent instructions (skills, Supabase, CodeGraph)
├── CLAUDE.md                 # This file
└── README.md                 # User-facing readme
```

## Electron App Architecture (`apps/x`)

The Electron app is a **nested pnpm workspace** with its own package management.

```
apps/x/
├── package.json              # Workspace root, dev scripts
├── pnpm-workspace.yaml
├── apps/
│   ├── main/                 # Electron main process
│   │   ├── src/main.ts       # Window creation, title bar, IPC, deep links
│   │   ├── forge.config.cjs
│   │   └── bundle.mjs        # esbuild bundler
│   ├── renderer/             # React UI (Vite)
│   │   ├── src/App.tsx       # Shell: navigation, tabs, layout (~6k lines)
│   │   ├── src/components/   # Feature UI
│   │   ├── src/lib/          # Shared renderer utilities
│   │   └── DESIGN_LANGUAGE.md
│   └── preload/
│       └── src/preload.ts    # contextBridge IPC + electronPlatform
└── packages/
    ├── shared/               # @x/shared — types, IPC schemas, validators
    └── core/                 # @x/core — AI, OAuth, MCP, knowledge, elastic
```

### Build Order (Dependencies)

```
shared (no deps)
   ↓
core (depends on shared)
   ↓
preload (depends on shared)
   ↓
renderer (depends on shared)
main (depends on shared, core)
```

**The `npm run deps` command builds:** shared → core → preload

### Key Entry Points

| Component | Entry | Output |
|-----------|-------|--------|
| main | `apps/main/src/main.ts` | `.package/dist/main.cjs` |
| renderer | `apps/renderer/src/main.tsx` | `apps/renderer/dist/` |
| preload | `apps/preload/src/preload.ts` | `apps/preload/dist/preload.js` |

### Local Data Directory

Default workspace: `~/.jobraker-recruiter` (override with `JOBRAKER_RECRUITER_WORKDIR`).

| Path | Purpose |
|------|---------|
| `config/models.json` | LLM provider + model |
| `config/elastic.json` | Elastic MCP connector (see `apps/x/ELASTIC.md`) |
| `knowledge/` | Notes, meetings, workspaces |
| `calendar_sync/` | Synced Google Calendar JSON for Meetings UI |
| `gmail_sync/` | Synced email |
| `bg-tasks/` | Background agent task definitions |
| `runs/` | Chat run history |

## Renderer Shell (No React Router)

All navigation lives in **`apps/x/apps/renderer/src/App.tsx`**. There is no React Router — views are selected by boolean flags + `selectedPath`, coordinated through a **`ViewState`** union and **`navigateToView()`** with back/forward history stacks.

### ViewState types

`chat`, `file`, `graph`, `task`, `suggested-topics`, `meetings`, `live-notes`, `email`, `workspace`, `knowledge-view`, `chat-history`, `home`, `bg-tasks`, `recruiter`

Use `navigateToView({ type: '…' })` for sidebar and programmatic navigation so history stays consistent. Direct `setState` bypasses history unless you also push to the history stack.

### Virtual file tabs

Built-in screens are represented as synthetic tab paths (not real files):

| Constant in `App.tsx` | Tab label |
|-----------------------|-----------|
| `HOME_TAB_PATH` | Home |
| `MEETINGS_TAB_PATH` | Meetings |
| `LIVE_NOTES_TAB_PATH` | Live notes |
| `BG_TASKS_TAB_PATH` | Background tasks |
| `EMAIL_TAB_PATH` | Email |
| `GRAPH_TAB_PATH` | Graph View |
| … | … |

Recruiter screens use paths defined in **`apps/x/apps/renderer/src/lib/view-tab-paths.ts`**:

- `__jobraker-recruiter_roles__` → Roles
- `__jobraker-recruiter_candidates__` → Candidates
- `__jobraker-recruiter_pipeline__` → Pipeline
- `__jobraker-recruiter_analytics__` → Analytics

`openRecruiterScreen(screen)` → `navigateToView({ type: 'recruiter', screen })` + `ensureRecruiterFileTab()`.

Real markdown/base files use normal `knowledge/…` paths as tab paths.

### Layout regions

```
┌─────────────────────────────────────────────────────────────┐
│ SidebarContentPanel │ SidebarInset                          │
│ (nav, favorites,    │ ┌ ContentHeader (titlebar + tabs) ──┐ │
│  knowledge tree)    │ │ back/forward │ TabBar │ actions  │ │
│                     │ └───────────────────────────────────┘ │
│                     │ Main content (Home, Recruiter, file,  │
│                     │ Meetings, …)                            │
│                     │                                         │
│                     │ [optional ChatSidebar docked right]     │
└─────────────────────────────────────────────────────────────┘
```

- **Default landing:** Home tab open, chat docked in right pane.
- **Full-screen chat:** `Ctrl+L` / `Cmd+L` when no file/view is active.
- **`isRightPaneContext`:** true when a main view is open (including recruiter screens) — keeps chat sidebar available.

### Unified content header (`ContentHeader`)

Defined in `App.tsx`. Shown on **every** main view (not full-screen chat-only mode).

| Element | Behavior |
|---------|----------|
| Back / forward | `navigateBack()` / `navigateForward()` over `ViewState` history |
| `TabBar` | File/virtual tabs; switch via `switchFileTab()` |
| `+` button | New chat tab |
| Context actions | Shown per active view in header (not duplicated in page body) |

Current header actions:

- **Meetings** → Take meeting notes / stop recording
- **Live notes** → New live note (opens Copilot setup prompt)
- **Background tasks** → New task (bumps `newTaskRequestVersion` on `BgTasksView`)

Drag regions: CSS classes `titlebar-drag-region` and `titlebar-no-drag` in `App.css`. Interactive controls must use `titlebar-no-drag`.

### Custom title bar (platform-specific)

Configured in **`apps/x/apps/main/src/main.ts`**:

| Platform | Approach |
|----------|----------|
| **macOS** | `titleBarStyle: "hiddenInset"`, traffic lights at `(12, 12)` |
| **Windows** | `titleBarStyle: "hidden"`, `titleBarOverlay: true`, `autoHideMenuBar: true` |
| **Linux** | Default frame |

Windows overlay after create:

```ts
win.setTitleBarOverlay({ color: "#000000", symbolColor: "#71717a", height: 40 })
```

Renderer inset for native window controls: **`apps/x/apps/renderer/src/lib/titlebar-platform.ts`**

- `window.electronPlatform` exposed from preload (`process.platform`)
- `titlebarRightInsetPx()` → `138` on Windows (room for min/max/close), `12` elsewhere

**Do not use `frame: false`** unless implementing fully custom window controls (min/max/close IPC). Current design uses native overlay buttons on Windows.

## Recruiter UI Module

Product dashboards for lean recruiting teams. Currently **mock data** with localStorage persistence for pipeline edits.

| File | Role |
|------|------|
| `components/recruiter/index.tsx` | `RecruiterScreens` router + page transitions |
| `components/recruiter/roles-page.tsx` | Open roles, KPIs |
| `components/recruiter/candidates-page.tsx` | Candidate list + detail |
| `components/recruiter/pipeline-page.tsx` | Kanban pipeline |
| `components/recruiter/analytics-page.tsx` | Hiring analytics |
| `components/recruiter/data.ts` | Mock seed data |
| `components/recruiter/storage.ts` | `localStorage` under `jobraker-recruiter-ui:*` |
| `components/recruiter/shared.tsx` | Shared layout, KPI cards, motion easing |

Screens render inside the main content chain (under `ContentHeader`), not as a separate overlay. Sidebar `activeNav` highlights the active recruiter section.

## Meetings & Calendar

| File | Role |
|------|------|
| `components/meetings-view.tsx` | List + Calendar tabs, meeting notes list |
| `components/meetings/meetings-calendar.tsx` | Month/week grid |
| `components/meetings/meetings-day-detail.tsx` | Day overlay (join, take notes) |
| `lib/calendar/meeting-events.ts` | Load events from `calendar_sync/`, date helpers, capture trigger |

Events come from synced Google Calendar JSON in the workdir. Meeting notes live under `knowledge/Meetings/`.

## Elastic Retrieval

Optional semantic search connector for workspaces, knowledge, bases, graph, and candidate matching.

| File | Role |
|------|------|
| `apps/x/ELASTIC.md` | Setup (Kibana Agent Builder MCP, Docker fallback, env vars) |
| `packages/core/src/elastic/connector.ts` | Auto-register MCP server `elastic` |
| `packages/core/src/elastic/retrieval.ts` | Retrieval implementation |
| `packages/core/src/application/lib/builtin-tools.ts` | `elastic-retrieval` builtin tool |

Config: `~/.jobraker-recruiter/config/elastic.json`. Never commit API keys.

## Design System

Read **`apps/x/apps/renderer/DESIGN_LANGUAGE.md`** before UI work.

Summary: calm density, command-first affordances, visible work state, notes-as-canvas, neutral precision palette. Titlebar/tabs use slim scan-first styling (`.jobraker-recruiter-*` classes in `App.css`). Use `PageTransition`, `PremiumListSkeleton`, `PremiumEmptyState` from `components/premium-states.tsx` for list views.

## Feature Deep-Dives

Read the relevant doc before changing a feature area:

| Feature | Doc |
|---------|-----|
| Live Notes — `live:` frontmatter block, self-updating notes, panel UI, Copilot skill | `apps/x/LIVE_NOTE.md` |
| Analytics — PostHog events, person properties, taxonomy | `apps/x/ANALYTICS.md` |
| Elastic connector — MCP setup, indices, env vars | `apps/x/ELASTIC.md` |
| Visual design — tokens, surfaces, launch positioning | `apps/x/apps/renderer/DESIGN_LANGUAGE.md` |

## Key Files Reference

| Purpose | File |
|---------|------|
| Electron main entry + title bar | `apps/x/apps/main/src/main.ts` |
| App shell, navigation, tabs, header | `apps/x/apps/renderer/src/App.tsx` |
| Sidebar nav + favorites + profile | `apps/x/apps/renderer/src/components/sidebar-content.tsx` |
| Tab bar UI | `apps/x/apps/renderer/src/components/tab-bar.tsx` |
| Chat dock (split pane) | `apps/x/apps/renderer/src/components/chat-sidebar.tsx` |
| Recruiter virtual tab paths | `apps/x/apps/renderer/src/lib/view-tab-paths.ts` |
| Title bar platform insets | `apps/x/apps/renderer/src/lib/titlebar-platform.ts` |
| Preload / IPC bridge | `apps/x/apps/preload/src/preload.ts` |
| AI agent runtime | `apps/x/packages/core/src/agents/runtime.ts` |
| Assistant instructions + skills | `apps/x/packages/core/src/application/assistant/` |
| Builtin tools (incl. elastic-retrieval) | `apps/x/packages/core/src/application/lib/builtin-tools.ts` |
| MCP server registry | `apps/x/packages/core/src/mcp/` |
| Shared IPC + domain types | `apps/x/packages/shared/src/` |

## Common Tasks

### LLM configuration (single provider)
- Config: `~/.jobraker-recruiter/config/models.json`
- Schema: `{ provider: { flavor, apiKey?, baseURL?, headers? }, model: string }`
- Models catalog cache: `~/.jobraker-recruiter/config/models.dev.json`

### Add a new main view / screen

1. Add a `ViewState` variant and handle it in `viewStatesEqual`, `currentViewState`, `applyViewState`, and `switchFileTab`.
2. Add a virtual tab path constant in `App.tsx` (or `view-tab-paths.ts` if recruiter-like).
3. Add `ensure*FileTab()` helper and wire sidebar `onOpen*` to `navigateToView`.
4. Render the view in the `SidebarInset` content chain (sibling to Home, Meetings, etc.).
5. If the view needs a primary action, add it to **`ContentHeader`** — avoid duplicate page-level title bars.
6. Include the view in `isFullScreenChat` and `isRightPaneContext` guards.

### Add a new shared type
1. Edit `apps/x/packages/shared/src/`
2. Run `cd apps/x && npm run deps`

### Modify main process
1. Edit `apps/x/apps/main/src/`
2. Restart dev server

### Modify renderer (React UI)
1. Edit `apps/x/apps/renderer/src/`
2. Changes hot-reload in dev (except when new files under `lib/` fail until saved — run `npm run deps` if `@x/shared` imports break)

### Add a dependency to main
1. `cd apps/x/apps/main && pnpm add <package>`
2. Import in source — esbuild bundles it

## Build System

- **Package manager:** pnpm (required for `workspace:*` protocol)
- **Main bundler:** esbuild (single CommonJS bundle)
- **Renderer bundler:** Vite 7
- **Packaging:** Electron Forge
- **TypeScript:** ES2022 target

### Why esbuild bundling?

pnpm uses symlinks for workspace packages. Electron Forge's dependency walker can't follow them. esbuild bundles main into one file, eliminating packaged `node_modules` symlink issues.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 39.x |
| UI | React 19, Vite 7, Motion (recruiter transitions) |
| Styling | TailwindCSS, Radix UI, custom `.jobraker-recruiter-*` CSS |
| State | React hooks in `App.tsx` (no global store) |
| AI | Vercel AI SDK, OpenAI/Anthropic/Google/OpenRouter, AI Gateway, Ollama, models.dev |
| IPC | Electron contextBridge (`window.ipc`) |
| Search (optional) | Elastic MCP + `elastic-retrieval` tool |
| Build | TypeScript 5.9, esbuild, Electron Forge |

## Environment Variables

**Packaging (code signing):**
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

**Runtime:**
- `JOBRAKER_RECRUITER_WORKDIR` — override `~/.jobraker-recruiter`
- `ELASTIC_*` / `ELASTICSEARCH_*` — Elastic connector (see `apps/x/ELASTIC.md`)

Not required for local development beyond optional Elastic config.

## Agent Notes

- **Never change model names, embedding IDs, or core stack** without explicit user permission (see `AGENTS.md`).
- **Only commit when asked.** Do not commit secrets (`.env`, API keys, `elastic.json` with real keys).
- Check `.agents/skills/` and global skills per `AGENTS.md` before domain-specific work.
- `App.tsx` is large — prefer small, focused diffs; match existing navigation/tab patterns when adding views.
