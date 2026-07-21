import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { platform } from "node:os"

const HOST = "127.0.0.1"
const PORT = Number(process.env.JOBRAKER_CODEX_APP_SERVER_PORT || process.env.JOBRAKER_CODEX_BRIDGE_PORT || 17373)
const CODEX_BIN = process.env.CODEX_BIN || "codex"
const IS_WINDOWS = platform() === "win32"
const DEFAULT_ALLOWED_ORIGINS = [
  "https://jobraker-recruiter.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
const ALLOWED_ORIGINS = new Set(
  (process.env.JOBRAKER_CODEX_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
)

let controlSession = null
let controlSessionPromise = null
let latestAccountUpdate = { authMode: null, planType: null }
let activeLogin = null

function quoteWindowsCommandPart(value) {
  const text = String(value)
  if (/^[A-Za-z0-9._:/\\-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

function getCodexSpawnCommand(args) {
  if (!IS_WINDOWS) return { command: CODEX_BIN, args }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [CODEX_BIN, ...args].map(quoteWindowsCommandPart).join(" ")],
  }
}

function getCorsHeaders(origin) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Vary": "Origin",
  }
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin)
}

function sendJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...getCorsHeaders(req.headers.origin),
    "Content-Type": "application/json",
  })
  res.end(JSON.stringify(payload))
}

function buildWorkspaceTaskPrompt({ task }) {
  return [
    "You are running inside Jobraker Recruiter through Codex App Server.",
    `Target workspace: use the current gateway working directory (${process.cwd()}).`,
    "Goal: complete the recruiter workflow task with local tools, inspect failures, apply the smallest safe fix, and report the verification result.",
    `User task: ${task || "Inspect the Jobraker Recruiter workspace, complete the requested task, and verify the result."}`,
    "Preserve unrelated files. Summarize commands, edits, verification, and remaining blockers.",
  ].join("\n")
}

function sendToCodex(session, message) {
  if (session.process.stdin?.writable) {
    session.process.stdin.write(`${JSON.stringify(message)}\n`)
  }
}

function sendCodexRequest(session, method, params = {}, timeoutMs = 30000) {
  const id = ++session.requestId

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!session.pendingRequests.has(id)) return
      session.pendingRequests.delete(id)
      reject(new Error(`Codex App Server request ${method} timed out`))
    }, timeoutMs)

    session.pendingRequests.set(id, { resolve, reject, timeout })
    sendToCodex(session, { id, method, params })
  })
}

function rejectPendingRequests(session, error) {
  session.pendingRequests.forEach(({ reject, timeout }) => {
    clearTimeout(timeout)
    reject(error)
  })
  session.pendingRequests.clear()
}

function createAppServerSession({ onNotification, stderr = "inherit" } = {}) {
  const command = getCodexSpawnCommand(["app-server"])
  const proc = spawn(command.command, command.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", stderr],
    windowsHide: false,
  })

  const session = {
    process: proc,
    readline: null,
    requestId: 0,
    pendingRequests: new Map(),
    onNotification,
    initialized: false,
    closed: false,
  }

  session.readline = createInterface({ input: proc.stdout })
  session.readline.on("line", (line) => {
    try {
      const message = JSON.parse(line)
      if (message.id !== undefined && !message.method) {
        const pending = session.pendingRequests.get(message.id)
        if (!pending) return
        clearTimeout(pending.timeout)
        session.pendingRequests.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
        else pending.resolve(message.result)
        return
      }
      session.onNotification?.(message, session)
    } catch {
      // App Server can emit non-JSON diagnostic output. Ignore it.
    }
  })

  proc.on("error", (error) => {
    session.closed = true
    rejectPendingRequests(session, error)
  })

  proc.on("exit", (code) => {
    session.closed = true
    session.readline?.close()
    rejectPendingRequests(session, new Error(`Codex App Server exited with code ${code}`))
  })

  return session
}

async function initializeAppServerSession(session) {
  if (session.initialized) return session
  await sendCodexRequest(session, "initialize", {
    clientInfo: {
      name: "jobraker-recruiter",
      title: "Jobraker Recruiter",
      version: "0.1.0",
    },
    capabilities: { experimentalApi: true },
  })
  sendToCodex(session, { method: "initialized", params: {} })
  session.initialized = true
  return session
}

function handleControlNotification(message) {
  if (!message.method) return
  const params = message.params || {}

  if (message.method === "account/updated") {
    latestAccountUpdate = {
      authMode: params.authMode ?? null,
      planType: params.planType ?? null,
    }
  }

  if (message.method === "account/login/completed") {
    activeLogin = activeLogin && activeLogin.loginId === params.loginId
      ? { ...activeLogin, completed: true, success: Boolean(params.success), error: params.error || null }
      : activeLogin
  }
}

async function ensureControlSession() {
  if (controlSession && !controlSession.closed) return controlSession
  if (controlSessionPromise) return controlSessionPromise

  controlSessionPromise = (async () => {
    const session = createAppServerSession({ onNotification: handleControlNotification })
    try {
      await initializeAppServerSession(session)
      controlSession = session
      return session
    } catch (error) {
      cleanupSession(session)
      throw error
    } finally {
      controlSessionPromise = null
    }
  })()

  return controlSessionPromise
}

async function readAccount({ refreshToken = false } = {}) {
  const session = await ensureControlSession()
  const result = await sendCodexRequest(session, "account/read", { refreshToken })
  const account = result?.account ?? null
  const planType = result?.planType ?? account?.planType ?? latestAccountUpdate.planType ?? null
  return {
    account,
    planType,
    requiresOpenaiAuth: Boolean(result?.requiresOpenaiAuth),
  }
}

async function startDeviceCodeLogin() {
  const session = await ensureControlSession()

  if (activeLogin?.loginId && !activeLogin.completed) {
    try {
      await sendCodexRequest(session, "account/login/cancel", { loginId: activeLogin.loginId })
    } catch {
      // A stale login may already have expired; continue with a fresh request.
    }
  }

  const result = await sendCodexRequest(session, "account/login/start", {
    type: "chatgptDeviceCode",
  })

  if (!result?.loginId || !result?.verificationUrl || !result?.userCode) {
    throw new Error("Codex App Server did not return a device-code login challenge")
  }

  activeLogin = {
    loginId: result.loginId,
    verificationUrl: result.verificationUrl,
    userCode: result.userCode,
    completed: false,
    success: false,
    error: null,
  }

  return activeLogin
}

function cleanupSession(session) {
  if (!session || session.closed) return
  session.closed = true
  session.readline?.close()
  rejectPendingRequests(session, new Error("Codex App Server session closed"))
  if (!session.process.killed) {
    session.process.kill("SIGTERM")
    setTimeout(() => {
      if (!session.process.killed) session.process.kill("SIGKILL")
    }, 5000).unref?.()
  }
}

function encodeWebSocketFrame(text) {
  const payload = Buffer.from(text)
  const length = payload.length

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload])
  }

  if (length < 65536) {
    const header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(length, 2)
    return Buffer.concat([header, payload])
  }

  const header = Buffer.alloc(10)
  header[0] = 0x81
  header[1] = 127
  header.writeBigUInt64BE(BigInt(length), 2)
  return Buffer.concat([header, payload])
}

function encodeWebSocketCloseFrame() {
  return Buffer.from([0x88, 0x00])
}

function decodeWebSocketFrames(buffer) {
  const messages = []
  let offset = 0

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset]
    const second = buffer[offset + 1]
    const opcode = first & 0x0f
    const masked = Boolean(second & 0x80)
    let length = second & 0x7f
    let headerLength = 2

    if (length === 126) {
      if (offset + 4 > buffer.length) break
      length = buffer.readUInt16BE(offset + 2)
      headerLength = 4
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break
      const bigLength = buffer.readBigUInt64BE(offset + 2)
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("WebSocket frame too large")
      length = Number(bigLength)
      headerLength = 10
    }

    const maskLength = masked ? 4 : 0
    const frameLength = headerLength + maskLength + length
    if (offset + frameLength > buffer.length) break

    const maskOffset = offset + headerLength
    const payloadOffset = maskOffset + maskLength
    const payload = Buffer.from(buffer.subarray(payloadOffset, payloadOffset + length))

    if (masked) {
      const mask = buffer.subarray(maskOffset, maskOffset + 4)
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4]
      }
    }

    if (opcode === 0x1) messages.push(payload.toString("utf8"))
    if (opcode === 0x8) messages.push("__close__")

    offset += frameLength
  }

  return { messages, rest: buffer.subarray(offset) }
}

function sendToClient(socket, message) {
  if (!socket.destroyed) {
    socket.write(encodeWebSocketFrame(JSON.stringify(message)))
  }
}

async function startCodexTaskSession(socket, config) {
  sendToClient(socket, { type: "status", status: "connecting" })

  const session = createAppServerSession({
    onNotification: (message) => handleTaskNotification(session, message),
  })
  session.socket = socket
  session.agentText = ""
  session.threadId = undefined

  try {
    await initializeAppServerSession(session)
    const accountResult = await sendCodexRequest(session, "account/read", { refreshToken: false })
    if (!accountResult?.account) {
      throw new Error("Connect a ChatGPT account in Settings before running Codex tasks")
    }

    const dynamicTools = Array.isArray(config.tools)
      ? config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }))
      : []

    const threadResult = await sendCodexRequest(
      session,
      config.threadId ? "thread/resume" : "thread/start",
      {
        ...(config.threadId ? { threadId: config.threadId } : {}),
        model: config.model,
        cwd: process.cwd(),
        approvalPolicy: "never",
        sandbox: "workspaceWrite",
        baseInstructions: config.systemPrompt,
        dynamicTools,
        serviceName: "jobraker-recruiter",
      }
    )

    session.threadId = threadResult?.thread?.id
    if (!session.threadId) throw new Error("Codex App Server did not return a thread id")
    sendToClient(socket, { type: "thread", threadId: session.threadId })
    sendToClient(socket, { type: "status", status: "thinking" })

    await sendCodexRequest(session, "turn/start", {
      threadId: session.threadId,
      input: [{ type: "text", text: config.userMessage }],
    })

    return session
  } catch (error) {
    cleanupSession(session)
    throw error
  }
}

function handleTaskNotification(session, message) {
  if (!message.method) return
  const params = message.params || {}

  if (message.id !== undefined && message.method === "item/tool/call") {
    sendToClient(session.socket, {
      type: "tool_call",
      id: String(message.id),
      name: params.tool || "unknown_tool",
      args: params.arguments || {},
    })
    sendToClient(session.socket, { type: "status", status: "executing" })
    return
  }

  if (
    message.id !== undefined &&
    (message.method === "item/commandExecution/requestApproval" || message.method === "item/fileChange/requestApproval")
  ) {
    sendToCodex(session, { id: message.id, result: { decision: "decline" } })
    return
  }

  switch (message.method) {
    case "item/agentMessage/delta": {
      const delta = params.delta
      if (!delta) return
      session.agentText += delta
      sendToClient(session.socket, { type: "delta", text: delta })
      break
    }
    case "item/started": {
      if (params.item?.type === "dynamicToolCall" || params.item?.type === "commandExecution" || params.item?.type === "fileChange") {
        sendToClient(session.socket, { type: "status", status: "executing" })
      }
      break
    }
    case "item/completed": {
      const item = params.item
      if (item?.type === "dynamicToolCall" && item.tool) {
        sendToClient(session.socket, {
          type: "tool_status",
          id: item.id || "",
          name: item.tool,
          status: item.status === "completed" ? "completed" : "failed",
        })
      }
      sendToClient(session.socket, { type: "status", status: "thinking" })
      break
    }
    case "turn/completed": {
      sendToClient(session.socket, { type: "turn_complete", text: session.agentText })
      cleanupSession(session)
      break
    }
    case "turn/failed": {
      sendToClient(session.socket, {
        type: "error",
        message: params.turn?.error?.message || "Codex turn failed",
        fatal: true,
      })
      cleanupSession(session)
      break
    }
  }
}

function acceptWebSocket(request, socket) {
  const key = request.headers["sec-websocket-key"]
  if (!key) {
    socket.destroy()
    return
  }

  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64")

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"))
}

function handleCodexWebSocket(request, socket) {
  if (!isAllowedOrigin(request.headers.origin)) {
    socket.destroy()
    return
  }

  acceptWebSocket(request, socket)

  let session = null
  let buffered = Buffer.alloc(0)
  const socketId = randomBytes(4).toString("hex")

  socket.on("data", async (chunk) => {
    try {
      buffered = Buffer.concat([buffered, chunk])
      const decoded = decodeWebSocketFrames(buffered)
      buffered = decoded.rest

      for (const rawMessage of decoded.messages) {
        if (rawMessage === "__close__") {
          if (!socket.destroyed) socket.write(encodeWebSocketCloseFrame())
          socket.end()
          return
        }

        const message = JSON.parse(rawMessage)
        if (message.type === "start") {
          if (session) cleanupSession(session)
          session = await startCodexTaskSession(socket, {
            model: typeof message.model === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(message.model) ? message.model : "gpt-5.6",
            systemPrompt: typeof message.systemPrompt === "string" ? message.systemPrompt : "",
            threadId: typeof message.threadId === "string" ? message.threadId : undefined,
            tools: Array.isArray(message.tools) ? message.tools : [],
            userMessage: buildWorkspaceTaskPrompt({
              task: typeof message.userMessage === "string" ? message.userMessage.trim() : "",
            }),
          })
        } else if (message.type === "abort" && session) {
          cleanupSession(session)
          session = null
          sendToClient(socket, { type: "status", status: "aborted" })
        }
      }
    } catch (error) {
      sendToClient(socket, {
        type: "error",
        message: error instanceof Error ? error.message : `App Server gateway socket ${socketId} failed`,
        fatal: true,
      })
      if (session) cleanupSession(session)
      session = null
    }
  })

  socket.on("close", () => {
    if (session) cleanupSession(session)
    session = null
  })

  socket.on("error", () => {
    if (session) cleanupSession(session)
    session = null
  })
}

const server = createServer(async (req, res) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    return sendJson(req, res, 403, { ok: false, error: "Origin is not allowed" })
  }

  if (req.method === "OPTIONS") return sendJson(req, res, 204, {})

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(req, res, 200, {
      ok: true,
      service: "jobraker-codex-app-server-gateway",
      transport: "stdio",
      websocket: "/ws/codex",
    })
  }

  if (req.method === "POST" && req.url === "/codex/connect") {
    try {
      const login = await startDeviceCodeLogin()
      return sendJson(req, res, 200, {
        ok: true,
        loginId: login.loginId,
        verificationUrl: login.verificationUrl,
        userCode: login.userCode,
      })
    } catch (error) {
      return sendJson(req, res, 503, {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to start ChatGPT sign-in",
      })
    }
  }

  if (req.method === "POST" && req.url === "/codex/logout") {
    try {
      const session = await ensureControlSession()
      await sendCodexRequest(session, "account/logout", {})
      activeLogin = null
      return sendJson(req, res, 200, { ok: true })
    } catch (error) {
      return sendJson(req, res, 503, {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to disconnect ChatGPT",
      })
    }
  }

  if (req.method === "GET" && req.url === "/codex/status") {
    try {
      const accountState = await readAccount({ refreshToken: false })
      const account = accountState.account
      const connected = Boolean(account)
      return sendJson(req, res, 200, {
        ok: true,
        available: true,
        connected,
        account: account
          ? {
              type: account.type || latestAccountUpdate.authMode || "unknown",
              email: account.email || null,
            }
          : null,
        planType: accountState.planType,
        requiresOpenaiAuth: accountState.requiresOpenaiAuth,
        login: activeLogin
          ? {
              loginId: activeLogin.loginId,
              completed: activeLogin.completed,
              success: activeLogin.success,
              error: activeLogin.error,
            }
          : null,
        output: connected
          ? `Connected through Codex App Server${accountState.planType ? ` (${accountState.planType})` : ""}`
          : activeLogin?.error || "No ChatGPT account connected",
      })
    } catch (error) {
      return sendJson(req, res, 503, {
        ok: false,
        available: false,
        connected: false,
        error: error instanceof Error ? error.message : "Codex App Server is unavailable",
      })
    }
  }

  return sendJson(req, res, 404, { ok: false, error: "Not found" })
})

server.on("upgrade", (request, socket) => {
  if (request.url === "/ws/codex") {
    handleCodexWebSocket(request, socket)
    return
  }
  socket.destroy()
})

server.listen(PORT, HOST, () => {
  console.log(`Jobraker Codex App Server gateway listening on http://${HOST}:${PORT}`)
  console.log(`Codex task stream ready at ws://${HOST}:${PORT}/ws/codex`)
})

function shutdown() {
  cleanupSession(controlSession)
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
