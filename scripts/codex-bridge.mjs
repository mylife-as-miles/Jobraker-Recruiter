import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { platform } from "node:os"

const HOST = "127.0.0.1"
const PORT = Number(process.env.JOBRAKER_CODEX_BRIDGE_PORT || 17373)
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

function runCodex(args, options = {}) {
  return new Promise((resolve) => {
    const command = getCodexSpawnCommand(args)
    const child = spawn(command.command, command.args, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
      windowsHide: false,
    })

    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.on("error", (error) => {
      resolve({ ok: false, output: error.message, code: -1 })
    })
    child.on("close", (code) => {
      const trimmed = output.trim()
      const normalized = trimmed.toLowerCase()
      const commandMissing = normalized.includes("not recognized as an internal or external command") || normalized.includes("access is denied")
      resolve({ ok: !commandMissing && (code === 0 || Boolean(options.allowNonZero)), output: trimmed, code })
    })
  })
}

function openCodexLogin() {
  const command = getCodexSpawnCommand(["login"])
  const child = spawn(command.command, command.args, {
    cwd: process.cwd(),
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: false,
  })
  child.unref()
}

function buildNotebookPrompt({ notebookPath, task }) {
  const target = notebookPath
    ? `Target notebook: ${notebookPath}`
    : "Target notebook: ask me for the notebook path if the workspace does not make it obvious."

  return [
    "You are running inside Jobraker Recruiter as a local Codex app-server task.",
    target,
    "Goal: use Python/Jupyter tooling to run the notebook, inspect failures, apply the smallest safe fix, and report the verification result.",
    `User task: ${task || "Run the notebook and fix failures."}`,
    "Preserve unrelated files. Summarize commands, edits, verification, and remaining blockers.",
  ].join("\n")
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

function sendToCodex(session, message) {
  if (session.process.stdin?.writable) {
    session.process.stdin.write(`${JSON.stringify(message)}\n`)
  }
}

function sendCodexRequest(session, method, params) {
  const id = ++session.requestId

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!session.pendingRequests.has(id)) return
      session.pendingRequests.delete(id)
      reject(new Error(`Codex request ${method} timed out`))
    }, 30000)

    session.pendingRequests.set(id, { resolve, reject, timeout })
    sendToCodex(session, { id, method, params })
  })
}

async function startCodexSession(socket, config) {
  sendToClient(socket, { type: "status", status: "connecting" })

  const command = getCodexSpawnCommand(["app-server"])
  const proc = spawn(command.command, command.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: false,
  })

  const session = {
    process: proc,
    readline: createInterface({ input: proc.stdout }),
    socket,
    requestId: 0,
    pendingRequests: new Map(),
    pendingToolCalls: new Map(),
    agentText: "",
    threadId: undefined,
  }

  session.readline.on("line", (line) => {
    try {
      handleCodexMessage(session, JSON.parse(line))
    } catch {
      // Codex can emit non-JSON logs; ignore those.
    }
  })

  proc.on("exit", (code) => {
    if (!socket.destroyed) {
      sendToClient(socket, {
        type: "error",
        message: `Codex app-server exited with code ${code}`,
        fatal: true,
      })
    }
  })

  await sendCodexRequest(session, "initialize", {
    clientInfo: { name: "jobraker-recruiter", title: "Jobraker Recruiter", version: "0.1.0" },
    capabilities: { experimentalApi: true },
  })
  sendToCodex(session, { method: "initialized", params: {} })

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
      baseInstructions: config.systemPrompt,
      dynamicTools,
      serviceName: "jobraker-recruiter",
    }
  )

  session.threadId = threadResult?.thread?.id
  if (session.threadId) sendToClient(socket, { type: "thread", threadId: session.threadId })

  sendToClient(socket, { type: "status", status: "thinking" })
  sendToCodex(session, {
    id: ++session.requestId,
    method: "turn/start",
    params: {
      threadId: session.threadId,
      input: [{ type: "text", text: config.userMessage }],
    },
  })

  return session
}

function handleCodexMessage(session, message) {
  if (message.id !== undefined && !message.method) {
    const pending = session.pendingRequests.get(message.id)
    if (!pending) return

    clearTimeout(pending.timeout)
    session.pendingRequests.delete(message.id)
    if (message.error) pending.reject(new Error(JSON.stringify(message.error)))
    else pending.resolve(message.result)
    return
  }

  if (message.id !== undefined && message.method === "item/tool/call") {
    const params = message.params || {}
    session.pendingToolCalls.set(message.id, { resolve: () => {} })
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
    sendToCodex(session, { id: message.id, result: { decision: "accept" } })
    return
  }

  if (!message.method) return
  const params = message.params || {}

  switch (message.method) {
    case "item/agentMessage/delta": {
      const delta = params.delta
      if (!delta) return
      session.agentText += delta
      sendToClient(session.socket, { type: "delta", text: delta })
      break
    }
    case "item/started": {
      if (params.item?.type === "dynamicToolCall") {
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
        sendToClient(session.socket, { type: "status", status: "thinking" })
      }
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

function handleToolResult(session, message) {
  const rpcId = Number.parseInt(String(message.id), 10)
  if (!Number.isFinite(rpcId)) return
  const pending = session.pendingToolCalls.get(rpcId)
  if (!pending) return

  session.pendingToolCalls.delete(rpcId)
  const result = tryParseJson(String(message.result || ""))
  sendToCodex(session, {
    id: rpcId,
    result: {
      contentItems: [{ type: "inputText", text: typeof result === "string" ? result : JSON.stringify(result) }],
      success: Boolean(message.success),
    },
  })
  pending.resolve(null)
}

function cleanupSession(session) {
  session.readline?.close()
  if (!session.process.killed) {
    session.process.kill("SIGTERM")
    setTimeout(() => {
      if (!session.process.killed) session.process.kill("SIGKILL")
    }, 5000)
  }
  session.pendingRequests.forEach(({ reject, timeout }) => {
    clearTimeout(timeout)
    reject(new Error("Session closed"))
  })
  session.pendingRequests.clear()
  session.pendingToolCalls.clear()
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
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
          session = await startCodexSession(socket, {
            model: typeof message.model === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(message.model) ? message.model : "gpt-5.6",
            systemPrompt: typeof message.systemPrompt === "string" ? message.systemPrompt : "",
            threadId: typeof message.threadId === "string" ? message.threadId : undefined,
            tools: Array.isArray(message.tools) ? message.tools : [],
            userMessage: buildNotebookPrompt({
              notebookPath: typeof message.notebookPath === "string" ? message.notebookPath.trim() : "",
              task: typeof message.userMessage === "string" ? message.userMessage.trim() : "",
            }),
          })
        } else if (message.type === "tool_result" && session) {
          handleToolResult(session, message)
        } else if (message.type === "abort" && session) {
          cleanupSession(session)
          session = null
          sendToClient(socket, { type: "status", status: "aborted" })
        }
      }
    } catch (error) {
      sendToClient(socket, {
        type: "error",
        message: error instanceof Error ? error.message : `Bridge socket ${socketId} failed`,
        fatal: true,
      })
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
    return sendJson(req, res, 200, { ok: true, service: "jobraker-codex-bridge", websocket: "/ws/codex" })
  }

  if (req.method === "POST" && req.url === "/codex/connect") {
    openCodexLogin()
    return sendJson(req, res, 200, { ok: true, opened: true })
  }

  if (req.method === "GET" && req.url === "/codex/status") {
    const version = await runCodex(["--version"], { allowNonZero: true })
    const login = await runCodex(["login", "status"], { allowNonZero: true })
    const normalized = login.output.toLowerCase()
    const commandMissing = normalized.includes("not recognized as an internal or external command") || normalized.includes("access is denied")
    const connected = login.ok && !commandMissing && !normalized.includes("not logged in") && !normalized.includes("not authenticated")
    return sendJson(req, res, 200, {
      ok: true,
      available: version.ok,
      connected,
      version: version.output,
      output: login.output || version.output,
    })
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
  console.log(`Jobraker Codex bridge listening on http://${HOST}:${PORT}`)
  console.log(`Codex WebSocket bridge ready at ws://${HOST}:${PORT}/ws/codex`)
})
