# Agent Instructions

To ensure consistent and high-quality assistance, all AI agents (including Cursor and any future agents) MUST follow these guidelines for **Jobraker-Recruiters**.

## Skill Discovery

Before performing any task, agents MUST check for available domain expertise in this order:

1. **Project skills**: `.agents/skills/` (project-scoped installs)
2. **Cursor global skills**: `C:\Users\MILES\.cursor\skills-cursor\`
3. **User agent skills**: `C:\Users\MILES\.agents\skills\`
4. **Antigravity primary**: `C:\Users\MILES\.gemini\antigravity-ide\skills\`
5. **Antigravity backup**: `C:\Users\MILES\.gemini\antigravity-backup\skills\`

**Action**: List or read the project directory first, then fall back through the paths above when a task needs specialized guidance.

## Invocation Pattern

When a specific domain or skill is relevant, agents SHOULD load and follow the corresponding skill.

- **Cursor**: Skills are discovered automatically from `.agents/skills/` and global paths; reference by name when helpful (e.g. `emil-design-eng`, `create-rule`).
- **Antigravity-style**: Use `@skill-name` (e.g. `@typescript-expert`, `@backend-architect`) when that environment supports it.

## Persistent Context

This file is the persistent anchor for all agent interactions in **Jobraker-Recruiters**. Refer to it when starting a new session or tackling a complex, multi-step task.

## Supabase Deployment

When working with Supabase (project root is `backend`, i.e. the directory that contains the `supabase` folder), use:

```bash
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
cd backend
npx supabase functions deploy <function-name> --project-ref <PROJECT_REF> --use-api
npx supabase db push --include-all --yes
```

Use `--use-api` when Docker is not running (bundles functions on Supabase's side).

Replace `<PROJECT_REF>` with this project's Supabase reference once `backend` is set up.

Never commit Supabase access tokens, database passwords, service-role keys, or project API secrets. Store them in local environment variables (e.g. `SUPABASE_ACCESS_TOKEN`) or Supabase secrets.

## CodeGraph

CodeGraph can be installed locally in this repo and exposed through MCP (see `.mcp.json` when present).

### Install

From the project root:

```bash
npx @colbymchenry/codegraph install --target=auto --location=local -y
```

After install, restart the agent session so the `codegraph` MCP server is available.

To install CodeGraph globally for supported agents on this machine:

```bash
npx @colbymchenry/codegraph install --target=auto --location=global -y
```

Restart those tools afterward (e.g. Codex CLI, Claude Code).

### Common commands

From the project root:

```bash
npx @colbymchenry/codegraph status
npx @colbymchenry/codegraph index
npx @colbymchenry/codegraph sync
npx @colbymchenry/codegraph query "<search term>"
npx @colbymchenry/codegraph context "<task or symbol>"
npx @colbymchenry/codegraph files "<search term>"
npx @colbymchenry/codegraph affected
```

### MCP server

Local MCP entry:

```bash
codegraph serve --mcp
```

A local install typically creates:

```text
.mcp.json
.claude/settings.json
.claude/CLAUDE.md
.codegraph/
```

This workspace may already expose CodeGraph via Cursor MCP (`user-codegraph`).

## Marketing Skills

The `coreyhaines31/marketingskills` pack can be installed for growth, copy, SEO, and launch work.

### Install

From the project root:

```bash
npx skills add coreyhaines31/marketingskills
```

This installs project-scoped skills into `.agents/skills/` and links them for supported agents.

### Useful commands

```bash
npx skills list
npx skills find marketing
npx skills update
npx skills remove
```

Global install:

```bash
npx skills add coreyhaines31/marketingskills -g
npx skills list -g
```

Example skills from that pack:

```text
analytics
pricing
product-marketing
seo-audit
copywriting
social
signup
paywalls
popups
launch
```

## Model and Stack Restrictions

- **CRITICAL**: Never change any model name (e.g. embedding or LLM identifiers), model configurations, or tech stack components (libraries, databases, architecture) without explicit user permission or telling the user first.
