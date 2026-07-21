import { timingSafeEqual } from "node:crypto"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { mkdir } from "node:fs/promises"
import { createInterface } from "node:readline"
import path from "node:path"
import { platform } from "node:os"
import { createClient } from "@supabase/supabase-js"

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || "0.0.0.0"
const CODEX_BIN = process.env.CODEX_BIN || "codex"
const DATA_DIR = path.resolve(process.env.JOBRAKER_CODEX_DATA_DIR || "./.jobraker-codex")
const WORKER_SECRET = process.env.JOBRAKER_CODEX_WORKER_SECRET || ""
const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
const IS_WINDOWS = platform() === "win32"

if (!WORKER_SECRET) throw new Error("Missing JOBRAKER_CODEX_WORKER_SECRET")
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or Supabase server secret key")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const controlSessions = new Map()
const activeRuns = new Map()

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""))
  const b = Buffer.from(String(right || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

function quoteWindowsPart(value) {
  const text = String(value)
  if (/^[A-Za-z0-9._:/\\-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

function codexCommand(args) {
  if (!IS_WINDOWS) return { command: CODEX_BIN, args }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [CODEX_BIN, ...args].map(quoteWindowsPart).join(" ")],
  }
}

function runtimePaths(userId, workspaceId) {
  const userRoot = path.join(DATA_DIR, userId)
  return {
    codexHome: path.join(userRoot, ".codex"),
    workspace: path.join(userRoot, "workspaces", workspaceId),
  }
}

function childEnvironment(codexHome) {
  const env = { ...process.env, CODEX_HOME: codexHome }
  for (const key of [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JOBRAKER_CODEX_WORKER_SECRET",
    "DATABASE_URL",
  ]) {
    delete env[key]
  }
  return env
}

async function createAppServerSession({ userId, workspaceId, onMessage }) {
  const paths = runtimePaths(userId, workspaceId)
  await mkdir(paths.codexHome, { recursive: true })
  await mkdir(paths.workspace, { recursive: true })

  const command = codexCommand(["app-server"])
  const processHandle = spawn(command.command, command.args, {
    cwd: paths.workspace,
    env: childEnvironment(paths.codexHome),
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })

  const session = {
    process: processHandle,
    reader: createInterface({ input: processHandle.stdout }),
    pending: new Map(),
    requestId: 0,
    closed: false,
    workspace: paths.workspace,
    userId,
    workspaceId,
  }

  session.reader.on("line", (line) => {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }

    if (message.id !== undefined && !message.method) {
      const pending = session.pending.get(message.id)
      if (!pending) return
      clearTimeout(pending.timeout)
      session.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
      else pending.resolve(message.result)
      return
    }

    Promise.resolve(onMessage?.(message, session)).catch((error) => {
      console.error(`[codex:${userId}] notification handler failed`, error)
    })
  })

  processHandle.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim()
    if (text) console.error(`[codex:${userId}] ${text}`)
  })

  processHandle.on("error", (error) => closeSession(session, error))
  processHandle.on("exit", (code) => {
    closeSession(session, new Error(`Codex App Server exited with code ${code}`))
  })

  await request(session, "initialize", {
    clientInfo: {
      name: "jobraker_recruiter_web",
      title: "Jobraker Recruiter",
      version: "0.1.0",
    },
    capabilities: { experimentalApi: true },
  })
  notify(session, "initialized", {})

  return session
}

function notify(session, method, params) {
  if (session.process.stdin?.writable) {
    session.process.stdin.write(`${JSON.stringify({ method, params })}\n`)
  }
}

function request(session, method, params = {}, timeoutMs = 30_000) {
  const id = ++session.requestId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.pending.delete(id)
      reject(new Error(`Codex App Server request ${method} timed out`))
    }, timeoutMs)

    session.pending.set(id, { resolve, reject, timeout })
    session.process.stdin.write(`${JSON.stringify({ id, method, params })}\n`)
  })
}

function respond(session, id, result) {
  if (session.process.stdin?.writable) {
    session.process.stdin.write(`${JSON.stringify({ id, result })}\n`)
  }
}

function closeSession(session, reason = new Error("Codex session closed")) {
  if (!session || session.closed) return
  session.closed = true
  session.reader?.close()
  for (const pending of session.pending.values()) {
    clearTimeout(pending.timeout)
    pending.reject(reason)
  }
  session.pending.clear()
  if (!session.process.killed) session.process.kill("SIGTERM")
}

async function upsertConnection(userId, workspaceId, patch) {
  const { error } = await supabase.from("codex_connections").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      ...patch,
    },
    { onConflict: "workspace_id" },
  )
  if (error) throw error
}

async function ensureControlSession(userId, workspaceId) {
  const existing = controlSessions.get(userId)
  if (existing && !existing.closed) return existing

  const session = await createAppServerSession({
    userId,
    workspaceId,
    onMessage: async (message) => {
      const params = message.params || {}

      if (message.method === "account/updated") {
        await upsertConnection(userId, workspaceId, {
          status: params.authMode ? "connected" : "disconnected",
          auth_mode: params.authMode || null,
          plan_type: params.planType || null,
          connected_at: params.authMode ? new Date().toISOString() : null,
          last_error: null,
        }).catch(console.error)
      }

      if (message.method === "account/login/completed") {
        if (!params.success) {
          await upsertConnection(userId, workspaceId, {
            status: "error",
            login_id: params.loginId || null,
            last_error: params.error || "ChatGPT sign-in failed",
          }).catch(console.error)
          return
        }

        try {
          const result = await request(session, "account/read", { refreshToken: true })
          const account = result?.account || null
          await upsertConnection(userId, workspaceId, {
            status: account ? "connected" : "disconnected",
            account_email: account?.email || null,
            auth_mode: account?.type || "chatgpt",
            plan_type: result?.planType || account?.planType || null,
            login_id: null,
            connected_at: account ? new Date().toISOString() : null,
            last_error: null,
          })
        } catch (error) {
          console.error(error)
        }
      }
    },
  })

  controlSessions.set(userId, session)
  return session
}

async function readAccount(userId, workspaceId) {
  const session = await ensureControlSession(userId, workspaceId)
  const result = await request(session, "account/read", { refreshToken: false })
  const account = result?.account || null

  await upsertConnection(userId, workspaceId, {
    status: account ? "connected" : "disconnected",
    account_email: account?.email || null,
    auth_mode: account?.type || null,
    plan_type: result?.planType || account?.planType || null,
    connected_at: account ? new Date().toISOString() : null,
    runtime_id: userId,
    last_error: null,
  })

  return {
    connected: Boolean(account),
    accountEmail: account?.email || null,
    authMode: account?.type || null,
    planType: result?.planType || account?.planType || null,
    runtimeId: userId,
  }
}

async function startLogin(userId, workspaceId) {
  const session = await ensureControlSession(userId, workspaceId)
  const result = await request(session, "account/login/start", {
    type: "chatgptDeviceCode",
  })

  if (!result?.loginId || !result?.verificationUrl || !result?.userCode) {
    throw new Error("Codex App Server did not return a device-code challenge")
  }

  await upsertConnection(userId, workspaceId, {
    status: "connecting",
    login_id: result.loginId,
    runtime_id: userId,
    last_error: null,
  })

  return {
    loginId: result.loginId,
    verificationUrl: result.verificationUrl,
    userCode: result.userCode,
  }
}

async function logout(userId, workspaceId) {
  const session = await ensureControlSession(userId, workspaceId)
  await request(session, "account/logout", {})
  await upsertConnection(userId, workspaceId, {
    status: "disconnected",
    account_email: null,
    plan_type: null,
    auth_mode: null,
    login_id: null,
    connected_at: null,
    last_error: null,
  })
}

async function updateRun(runId, patch) {
  const { error } = await supabase.from("codex_runs").update(patch).eq("id", runId)
  if (error) throw error
}

async function appendEvent(state, eventType, payload = {}) {
  state.sequence += 1
  const { error } = await supabase.from("codex_run_events").insert({
    run_id: state.runId,
    workspace_id: state.workspaceId,
    user_id: state.userId,
    sequence: state.sequence,
    event_type: eventType,
    payload,
  })
  if (error) throw error
}

function queueText(state, text) {
  if (!text) return
  state.agentText += text
  state.textBuffer += text
  if (state.flushTimer) return
  state.flushTimer = setTimeout(() => {
    const chunk = state.textBuffer
    state.textBuffer = ""
    state.flushTimer = null
    appendEvent(state, "agent_message_delta", { text: chunk }).catch(console.error)
  }, 250)
}

async function flushText(state) {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer)
    state.flushTimer = null
  }
  if (!state.textBuffer) return
  const chunk = state.textBuffer
  state.textBuffer = ""
  await appendEvent(state, "agent_message_delta", { text: chunk })
}

async function failRunState(state, reason) {
  if (state.finished) return
  state.finished = true
  await flushText(state).catch(console.error)
  const message = reason instanceof Error ? reason.message : String(reason)
  await updateRun(state.runId, {
    status: "failed",
    output: state.agentText,
    error: message,
    completed_at: new Date().toISOString(),
  }).catch(console.error)
  await appendEvent(state, "run_failed", { error: message }).catch(console.error)
  activeRuns.delete(state.runId)
}

async function executeRun(input) {
  const state = {
    ...input,
    sequence: 0,
    agentText: "",
    textBuffer: "",
    flushTimer: null,
    threadId: input.threadId || null,
    turnId: null,
    session: null,
    finished: false,
  }

  activeRuns.set(state.runId, state)
  await updateRun(state.runId, {
    status: "running",
    started_at: new Date().toISOString(),
    error: null,
  })
  await appendEvent(state, "run_started", { model: state.model })

  try {
    const session = await createAppServerSession({
      userId: state.userId,
      workspaceId: state.workspaceId,
      onMessage: async (message, currentSession) => {
        const params = message.params || {}

        if (
          message.id !== undefined &&
          (message.method === "item/commandExecution/requestApproval" ||
            message.method === "item/fileChange/requestApproval")
        ) {
          respond(currentSession, message.id, { decision: "decline" })
          return
        }

        if (message.method === "turn/started") {
          state.turnId = params.turn?.id || state.turnId
          await updateRun(state.runId, { turn_id: state.turnId })
          await appendEvent(state, "turn_started", { turnId: state.turnId })
          return
        }

        if (message.method === "item/agentMessage/delta") {
          queueText(state, params.delta || "")
          return
        }

        if (message.method === "item/started") {
          await appendEvent(state, "item_started", { item: params.item || null })
          return
        }

        if (message.method === "item/completed") {
          await appendEvent(state, "item_completed", { item: params.item || null })
          return
        }

        if (message.method === "turn/completed") {
          if (state.finished) return
          state.finished = true
          await flushText(state)
          const status = params.turn?.status === "interrupted" ? "cancelled" : "completed"
          await updateRun(state.runId, {
            status,
            output: state.agentText,
            thread_id: state.threadId,
            turn_id: state.turnId,
            completed_at: new Date().toISOString(),
          })
          await appendEvent(state, status === "cancelled" ? "run_cancelled" : "run_completed", {
            threadId: state.threadId,
            turnId: state.turnId,
          })
          activeRuns.delete(state.runId)
          closeSession(session)
          return
        }

        if (message.method === "turn/failed") {
          await failRunState(
            state,
            params.turn?.error?.message || "Codex turn failed",
          )
          closeSession(session)
        }
      },
    })

    state.session = session
    const accountResult = await request(session, "account/read", { refreshToken: false })
    if (!accountResult?.account) {
      throw new Error("Connect a ChatGPT account before running Codex")
    }

    const threadResult = await request(
      session,
      state.threadId ? "thread/resume" : "thread/start",
      state.threadId
        ? { threadId: state.threadId }
        : {
            model: state.model,
            cwd: session.workspace,
            approvalPolicy: "never",
            sandbox: "workspaceWrite",
            serviceName: "jobraker_recruiter_web",
          },
    )

    state.threadId = threadResult?.thread?.id
    if (!state.threadId) throw new Error("Codex App Server did not return a thread id")
    await updateRun(state.runId, { thread_id: state.threadId })

    const turnResult = await request(session, "turn/start", {
      threadId: state.threadId,
      input: [{ type: "text", text: state.prompt }],
      cwd: session.workspace,
      model: state.model,
      approvalPolicy: "never",
      sandboxPolicy: {
        type: "workspaceWrite",
        writableRoots: [session.workspace],
        networkAccess: false,
      },
    })
    state.turnId = turnResult?.turn?.id || null
    await updateRun(state.runId, { turn_id: state.turnId })
  } catch (error) {
    await failRunState(state, error)
    closeSession(state.session)
  }
}

async function cancelRun(runId) {
  const state = activeRuns.get(runId)
  if (!state) {
    await updateRun(runId, {
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    return
  }

  if (state.session && state.threadId && state.turnId) {
    await request(state.session, "turn/interrupt", {
      threadId: state.threadId,
      turnId: state.turnId,
    })
    return
  }

  state.finished = true
  activeRuns.delete(runId)
  closeSession(state.session)
  await updateRun(runId, {
    status: "cancelled",
    completed_at: new Date().toISOString(),
  })
  await appendEvent(state, "run_cancelled", {})
}

function validateIdentity(body) {
  if (!isUuid(body.userId) || !isUuid(body.workspaceId)) {
    throw new Error("Invalid Supabase user or workspace id")
  }
  return { userId: body.userId, workspaceId: body.workspaceId }
}

async function handleAction(body) {
  const { userId, workspaceId } = validateIdentity(body)

  switch (body.action) {
    case "status":
      return readAccount(userId, workspaceId)
    case "connect":
      return startLogin(userId, workspaceId)
    case "logout":
      await logout(userId, workspaceId)
      return { ok: true }
    case "start_run": {
      if (!isUuid(body.runId)) throw new Error("Invalid run id")
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) throw new Error("Missing Codex task")
      const model =
        typeof body.model === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(body.model)
          ? body.model
          : "gpt-5.6"
      queueMicrotask(() =>
        executeRun({
          userId,
          workspaceId,
          runId: body.runId,
          threadId: typeof body.threadId === "string" ? body.threadId : null,
          model,
          prompt,
        }),
      )
      return { accepted: true, runId: body.runId }
    }
    case "cancel_run":
      if (!isUuid(body.runId)) throw new Error("Invalid run id")
      await cancelRun(body.runId)
      return { ok: true }
    default:
      throw new Error("Unsupported action")
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error("Request body is too large")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "jobraker-codex-worker",
      activeRuns: activeRuns.size,
      controlSessions: controlSessions.size,
    })
  }

  if (request.method !== "POST" || request.url !== "/v1/codex") {
    return sendJson(response, 404, { error: "Not found" })
  }

  if (!safeEqual(request.headers["x-jobraker-worker-secret"], WORKER_SECRET)) {
    return sendJson(response, 401, { error: "Unauthorized" })
  }

  try {
    const body = await readJson(request)
    const result = await handleAction(body)
    return sendJson(response, 200, result)
  } catch (error) {
    console.error(error)
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Jobraker Codex worker listening on http://${HOST}:${PORT}`)
})

function shutdown() {
  for (const session of controlSessions.values()) closeSession(session)
  for (const state of activeRuns.values()) closeSession(state.session)
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
