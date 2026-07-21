import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { platform } from "node:os"

const HOST = "127.0.0.1"
const PORT = Number(process.env.JOBRAKER_CODEX_BRIDGE_PORT || 17373)
const CODEX_BIN = process.env.CODEX_BIN || (platform() === "win32" ? "codex.cmd" : "codex")
const MAX_BODY_BYTES = 1024 * 64
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
  const origin = req.headers.origin
  res.writeHead(statusCode, {
    ...getCorsHeaders(origin),
    "Content-Type": "application/json",
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"))
        req.destroy()
      }
    })
    req.on("end", () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })
    req.on("error", reject)
  })
}

function runCodex(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(CODEX_BIN, args, {
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
      resolve({ ok: code === 0 || Boolean(options.allowNonZero), output: output.trim(), code })
    })
  })
}

function openCodexLogin() {
  const child = spawn(CODEX_BIN, ["login"], {
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
    : "Target notebook: ask me to provide the notebook path if the workspace does not make it obvious."

  return [
    "You are running inside Jobraker Recruiter as a local Codex CLI task.",
    target,
    "Goal: use Python/Jupyter tooling to run the notebook, inspect failures, apply the smallest safe fix, and report the verification result.",
    `User task: ${task || "Run the notebook and fix failures."}`,
    "Preserve unrelated files and summarize commands, edits, and any remaining blockers.",
  ].join("\n")
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (!isAllowedOrigin(origin)) {
    return sendJson(req, res, 403, { ok: false, error: "Origin is not allowed" })
  }

  if (req.method === "OPTIONS") return sendJson(req, res, 204, {})

  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(req, res, 200, { ok: true, service: "jobraker-codex-bridge" })
    }

    if (req.method === "POST" && req.url === "/codex/connect") {
      openCodexLogin()
      return sendJson(req, res, 200, { ok: true, opened: true })
    }

    if (req.method === "GET" && req.url === "/codex/status") {
      const result = await runCodex(["login", "status"], { allowNonZero: true })
      const normalized = result.output.toLowerCase()
      const connected = result.ok && !normalized.includes("not logged in") && !normalized.includes("not authenticated")
      return sendJson(req, res, 200, { ok: true, connected, output: result.output })
    }

    if (req.method === "POST" && req.url === "/codex/run-notebook") {
      const body = await readBody(req)
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-5.6"
      if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
        return sendJson(req, res, 400, { ok: false, error: "Invalid Codex model name" })
      }

      const notebookPath = typeof body.notebookPath === "string" ? body.notebookPath.trim() : ""
      const task = typeof body.task === "string" ? body.task.trim() : ""
      const prompt = buildNotebookPrompt({ notebookPath, task })
      const result = await runCodex(["exec", "--model", model, prompt])

      return sendJson(req, res, result.ok ? 200 : 500, {
        ok: result.ok,
        output: result.output,
        code: result.code,
        model,
      })
    }

    return sendJson(req, res, 404, { ok: false, error: "Not found" })
  } catch (error) {
    return sendJson(req, res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown bridge error",
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Jobraker Codex bridge listening on http://${HOST}:${PORT}`)
})
