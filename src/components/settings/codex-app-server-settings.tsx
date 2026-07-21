"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, CheckCircle2, Copy, Link2, Loader2, RefreshCw, Terminal, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ConnectionStatus =
  | "checking"
  | "disconnected"
  | "connecting"
  | "connected"
  | "thinking"
  | "executing"
  | "gateway-missing"
  | "app-server-unavailable"
  | "error"

interface CodexStatusResponse {
  ok?: boolean
  available?: boolean
  connected?: boolean
  account?: { type?: string; email?: string | null } | null
  planType?: string | null
  output?: string
  error?: string
  login?: {
    loginId?: string
    completed?: boolean
    success?: boolean
    error?: string | null
  } | null
}

interface DeviceCodeLogin {
  loginId: string
  verificationUrl: string
  userCode: string
}

const CODEX_GATEWAY_BASE_URL = "http://127.0.0.1:17373"
const CODEX_GATEWAY_WS_URL = "ws://127.0.0.1:17373/ws/codex"

export function CodexAppServerSettings({ dialogOpen }: { dialogOpen: boolean }) {
  const codexSessionRef = React.useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking")
  const [selectedModel, setSelectedModel] = useState("gpt-5.6")
  const [codexTask, setCodexTask] = useState("Review this Jobraker Recruiter workspace, carry out the requested recruiter workflow task, fix failures safely, and summarize the result.")
  const [runOutput, setRunOutput] = useState("")
  const [isRunningCodexTask, setIsRunningCodexTask] = useState(false)
  const [codexThreadId, setCodexThreadId] = useState<string | null>(null)
  const [loginChallenge, setLoginChallenge] = useState<DeviceCodeLogin | null>(null)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [planType, setPlanType] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const checkCodexStatus = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setConnectionStatus("checking")

    try {
      const response = await fetch(`${CODEX_GATEWAY_BASE_URL}/codex/status`)
      const result = await response.json() as CodexStatusResponse
      if (!response.ok || result.available === false) {
        throw new Error(result.error || "Codex App Server status check failed")
      }

      setAccountEmail(result.account?.email || null)
      setPlanType(result.planType || null)

      if (result.connected) {
        setConnectionStatus("connected")
        setLoginChallenge(null)
        if (!quiet && result.output) setRunOutput(result.output)
        return true
      }

      if (result.login?.error) {
        setConnectionStatus("error")
        setRunOutput(result.login.error)
        return false
      }

      setConnectionStatus(loginChallenge ? "connecting" : "disconnected")
      if (!quiet && result.output) setRunOutput(result.output)
      return false
    } catch (error) {
      setConnectionStatus("gateway-missing")
      if (!quiet) {
        setRunOutput(error instanceof Error ? error.message : "The Codex App Server gateway is unavailable.")
      }
      return false
    }
  }, [loginChallenge])

  useEffect(() => {
    if (!dialogOpen) return
    void checkCodexStatus()
  }, [checkCodexStatus, dialogOpen])

  useEffect(() => {
    if (!dialogOpen || !loginChallenge || connectionStatus !== "connecting") return

    const interval = window.setInterval(() => {
      void checkCodexStatus({ quiet: true })
    }, 2000)

    return () => window.clearInterval(interval)
  }, [checkCodexStatus, connectionStatus, dialogOpen, loginChallenge])

  const handleConnectCodex = useCallback(async () => {
    setConnectionStatus("connecting")
    setRunOutput("")

    try {
      const response = await fetch(`${CODEX_GATEWAY_BASE_URL}/codex/connect`, { method: "POST" })
      const result = await response.json() as Partial<DeviceCodeLogin> & { error?: string }
      if (!response.ok || !result.loginId || !result.verificationUrl || !result.userCode) {
        throw new Error(result.error || "Codex App Server did not return a sign-in code")
      }

      const challenge: DeviceCodeLogin = {
        loginId: result.loginId,
        verificationUrl: result.verificationUrl,
        userCode: result.userCode,
      }
      setLoginChallenge(challenge)
      setCodeCopied(false)
      window.open(challenge.verificationUrl, "_blank", "noopener,noreferrer")
      toast.success("ChatGPT sign-in opened. Enter the code shown in Jobraker Recruiter.")
    } catch (error) {
      setConnectionStatus("gateway-missing")
      setRunOutput(error instanceof Error ? error.message : "Unable to start ChatGPT sign-in")
      toast.error("Start the Jobraker Codex App Server gateway before connecting")
    }
  }, [])

  const handleCopyCode = useCallback(async () => {
    if (!loginChallenge) return
    try {
      await navigator.clipboard.writeText(loginChallenge.userCode)
      setCodeCopied(true)
      toast.success("Sign-in code copied")
      window.setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      toast.error("Could not copy the sign-in code")
    }
  }, [loginChallenge])

  const handleRunCodexTask = useCallback(async () => {
    if (connectionStatus !== "connected") {
      toast.error("Connect ChatGPT before running a Codex task")
      return
    }

    if (codexSessionRef.current && codexSessionRef.current.readyState === WebSocket.OPEN) {
      codexSessionRef.current.send(JSON.stringify({ type: "abort" }))
      codexSessionRef.current.close()
    }

    setIsRunningCodexTask(true)
    setRunOutput("")
    setConnectionStatus("connecting")

    try {
      const socket = new WebSocket(CODEX_GATEWAY_WS_URL)
      codexSessionRef.current = socket

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "start",
          model: selectedModel,
          threadId: codexThreadId || undefined,
          systemPrompt: [
            "You are Jobraker Recruiter's Codex operator.",
            "Use local tools carefully, preserve unrelated files, and report verification honestly.",
            "Run recruiter workflow and workspace tasks with the smallest safe changes.",
          ].join("\n"),
          tools: [],
          userMessage: codexTask.trim(),
        }))
      }

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as {
          type: "thread" | "status" | "delta" | "turn_complete" | "error" | "tool_call" | "tool_status"
          status?: "connecting" | "thinking" | "executing" | "aborted"
          text?: string
          threadId?: string
          message?: string
          fatal?: boolean
          name?: string
        }

        if (message.type === "thread" && message.threadId) {
          setCodexThreadId(message.threadId)
          return
        }

        if (message.type === "status") {
          if (message.status === "thinking") setConnectionStatus("thinking")
          else if (message.status === "executing") setConnectionStatus("executing")
          else if (message.status === "connecting") setConnectionStatus("connecting")
          else if (message.status === "aborted") setConnectionStatus("connected")
          return
        }

        if (message.type === "delta" && message.text) {
          setRunOutput((current) => `${current}${message.text}`)
          return
        }

        if (message.type === "tool_call") {
          setConnectionStatus("executing")
          setRunOutput((current) => `${current}\n\n[Codex tool] ${message.name || "tool"}\n`)
          return
        }

        if (message.type === "turn_complete") {
          setConnectionStatus("connected")
          setIsRunningCodexTask(false)
          if (message.text) setRunOutput(message.text)
          toast.success("Codex finished the recruiter task")
          socket.close()
          return
        }

        if (message.type === "error") {
          setConnectionStatus("error")
          setIsRunningCodexTask(false)
          setRunOutput(message.message || "Codex App Server session failed.")
          if (message.fatal) socket.close()
        }
      }

      socket.onerror = () => {
        setConnectionStatus("gateway-missing")
        setIsRunningCodexTask(false)
        setRunOutput("Start the Jobraker Codex App Server gateway before running workspace tasks.")
        toast.error("The Codex App Server gateway is required to run workspace tasks")
      }

      socket.onclose = () => {
        codexSessionRef.current = null
        setIsRunningCodexTask(false)
      }
    } catch (error) {
      setConnectionStatus("gateway-missing")
      setRunOutput(error instanceof Error ? error.message : "The Codex App Server gateway is required to run workspace tasks.")
      toast.error("The Codex App Server gateway is required to run workspace tasks")
    }
  }, [codexTask, codexThreadId, connectionStatus, selectedModel])

  const handleAbortCodexTask = useCallback(() => {
    if (codexSessionRef.current && codexSessionRef.current.readyState === WebSocket.OPEN) {
      codexSessionRef.current.send(JSON.stringify({ type: "abort" }))
      codexSessionRef.current.close()
    }
    setIsRunningCodexTask(false)
    setConnectionStatus("connected")
    toast.info("Codex task stopped")
  }, [])

  useEffect(() => {
    return () => {
      if (codexSessionRef.current && codexSessionRef.current.readyState === WebSocket.OPEN) {
        codexSessionRef.current.send(JSON.stringify({ type: "abort" }))
        codexSessionRef.current.close()
      }
    }
  }, [])

  const connectionCopy = {
    checking: "Checking App Server",
    disconnected: "Ready to connect",
    connecting: "Waiting for ChatGPT sign-in",
    connected: planType ? `Connected · ${planType}` : "Connected to Codex",
    thinking: "Codex thinking",
    executing: "Codex executing",
    "gateway-missing": "Local gateway needed",
    "app-server-unavailable": "Codex App Server unavailable",
    error: "Connection error",
  }[connectionStatus]

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-primary/40 bg-[radial-gradient(circle_at_top_left,rgba(35,255,35,0.18),transparent_34%),linear-gradient(135deg,rgba(6,18,9,0.96),rgba(0,0,0,0.98))] p-5 text-white shadow-[0_18px_55px_rgba(35,255,35,0.08)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Terminal className="size-3.5" />
              Codex App Server
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Connect with ChatGPT, run with Codex App Server</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Jobraker uses a private local App Server gateway for ChatGPT authentication, Codex threads, streamed agent events, and workspace execution. Codex credentials never enter the browser.
              </p>
              {accountEmail && (
                <p className="mt-2 text-xs text-white/45">Connected as {accountEmail}</p>
              )}
            </div>
          </div>
          <div className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
            connectionStatus === "connected"
              ? "border-primary/45 bg-primary/15 text-primary"
              : connectionStatus === "gateway-missing" || connectionStatus === "app-server-unavailable"
                ? "border-amber-400/45 bg-amber-400/10 text-amber-200"
                : "border-white/15 bg-white/8 text-white/70"
          )}>
            {connectionStatus === "connected" ? <CheckCircle2 className="size-3.5" /> : connectionStatus === "connecting" || connectionStatus === "checking" || connectionStatus === "thinking" || connectionStatus === "executing" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
            {connectionCopy}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Codex model</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="border-white/15 bg-black/45 text-white">
                <SelectValue placeholder="Choose a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5.6">GPT-5.6</SelectItem>
                <SelectItem value="gpt-5.6-sol">GPT-5.6 Sol</SelectItem>
                <SelectItem value="gpt-5.4">GPT-5.4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={handleConnectCodex}
            disabled={connectionStatus === "connecting"}
            className="h-10 bg-primary text-black hover:bg-primary/90"
          >
            {connectionStatus === "connecting" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
            {connectionStatus === "connected" ? "Reconnect ChatGPT" : "Connect ChatGPT"}
          </Button>
        </div>

        {loginChallenge && connectionStatus === "connecting" && (
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4">
            <p className="text-sm font-medium">Complete ChatGPT sign-in</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Open the verification page and enter this one-time code. Jobraker will detect the connection automatically.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-lg font-bold tracking-[0.28em] text-primary">
                {loginChallenge.userCode}
              </code>
              <Button type="button" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={handleCopyCode}>
                {codeCopied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                {codeCopied ? "Copied" : "Copy code"}
              </Button>
              <Button type="button" className="bg-primary text-black hover:bg-primary/90" onClick={() => window.open(loginChallenge.verificationUrl, "_blank", "noopener,noreferrer")}>
                <Link2 className="mr-2 size-4" />
                Open sign-in
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold">Run a Recruiter Task with Codex</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The local gateway communicates with `codex app-server` over stdio and streams the authenticated Codex thread to Jobraker Recruiter.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void checkCodexStatus()}>
            <RefreshCw className="mr-2 size-3.5" />
            Check status
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Recruiter task</label>
            <textarea
              value={codexTask}
              onChange={(event) => setCodexTask(event.target.value)}
              className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          {isRunningCodexTask ? (
            <Button type="button" onClick={handleAbortCodexTask} variant="destructive" className="w-full">
              <X className="mr-2 size-4" />
              Stop Codex Run
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRunCodexTask}
              disabled={!codexTask.trim() || connectionStatus !== "connected"}
              className="w-full bg-primary text-black hover:bg-primary/90"
            >
              <Terminal className="mr-2 size-4" />
              Run Recruiter Task with Codex
            </Button>
          )}
        </div>

        {runOutput && (
          <pre className="mt-4 max-h-52 overflow-auto rounded-xl border border-border bg-black p-3 text-xs leading-5 text-primary">
            {runOutput}
          </pre>
        )}
      </div>

      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
        ChatGPT tokens stay in the local Codex home managed by App Server. The hosted browser receives only connection state, the one-time device code, and streamed task events.
      </div>
    </div>
  )
}
