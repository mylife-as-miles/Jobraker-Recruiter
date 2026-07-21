"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  Server,
  Terminal,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/client"
import { cn } from "@/lib/utils"

type ConnectionStatus =
  | "checking"
  | "disconnected"
  | "connecting"
  | "connected"
  | "worker-unavailable"
  | "queued"
  | "thinking"
  | "executing"
  | "error"

type CodexConnection = {
  status: "disconnected" | "connecting" | "connected" | "error"
  account_email: string | null
  plan_type: string | null
  auth_mode: string | null
  last_error: string | null
}

type DeviceCodeLogin = {
  loginId: string
  verificationUrl: string
  userCode: string
}

type CodexRun = {
  id: string
  thread_id: string | null
  turn_id: string | null
  status: "queued" | "running" | "completed" | "failed" | "cancelling" | "cancelled"
  output: string
  error: string | null
}

type CodexRunEvent = {
  id: number
  sequence: number
  event_type: string
  payload: Record<string, unknown>
}

type StatusResponse = {
  configured?: boolean
  available?: boolean
  connected?: boolean
  connection?: CodexConnection | null
  error?: string
}

const invokeCodex = async <T,>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("codex-control", {
    body: { action, ...payload },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(String(data.error))
  return data as T
}

const eventText = (event: CodexRunEvent) => {
  if (event.event_type === "agent_message_delta") {
    return typeof event.payload.text === "string" ? event.payload.text : ""
  }

  if (event.event_type === "run_failed") {
    return `\n\n[Codex error] ${String(event.payload.error ?? "Run failed")}\n`
  }

  const item = event.payload.item as { type?: string; command?: string } | undefined
  if (event.event_type === "item_started" && item?.type === "commandExecution") {
    return `\n\n[Codex command] ${item.command ?? "Running command"}\n`
  }

  if (event.event_type === "item_started" && item?.type === "fileChange") {
    return "\n\n[Codex] Applying workspace file changes\n"
  }

  return ""
}

export function CodexAppServerSettings({ dialogOpen }: { dialogOpen: boolean }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking")
  const [connection, setConnection] = useState<CodexConnection | null>(null)
  const [selectedModel, setSelectedModel] = useState("gpt-5.6")
  const [codexTask, setCodexTask] = useState(
    "Review this Jobraker Recruiter workspace, carry out the requested recruiter workflow task, fix failures safely, and summarize the result.",
  )
  const [loginChallenge, setLoginChallenge] = useState<DeviceCodeLogin | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [activeRun, setActiveRun] = useState<CodexRun | null>(null)
  const [runOutput, setRunOutput] = useState("")
  const [workerError, setWorkerError] = useState<string | null>(null)

  const isRunning = activeRun
    ? ["queued", "running", "cancelling"].includes(activeRun.status)
    : false

  const applyStatus = useCallback((result: StatusResponse) => {
    setConnection(result.connection ?? null)
    setWorkerError(result.error ?? null)

    if (!result.configured || result.available === false) {
      setConnectionStatus("worker-unavailable")
      return false
    }

    if (result.connected || result.connection?.status === "connected") {
      setConnectionStatus("connected")
      setLoginChallenge(null)
      return true
    }

    if (result.connection?.status === "connecting") {
      setConnectionStatus("connecting")
      return false
    }

    if (result.connection?.status === "error") {
      setConnectionStatus("error")
      return false
    }

    setConnectionStatus("disconnected")
    return false
  }, [])

  const checkCodexStatus = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setConnectionStatus("checking")
    try {
      const result = await invokeCodex<StatusResponse>("status")
      return applyStatus(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach the Codex service."
      setWorkerError(message)
      setConnectionStatus("worker-unavailable")
      return false
    }
  }, [applyStatus])

  useEffect(() => {
    if (!dialogOpen) return
    void checkCodexStatus()
  }, [checkCodexStatus, dialogOpen])

  useEffect(() => {
    if (!dialogOpen || connectionStatus !== "connecting") return
    const interval = window.setInterval(() => {
      void checkCodexStatus({ quiet: true })
    }, 2_000)
    return () => window.clearInterval(interval)
  }, [checkCodexStatus, connectionStatus, dialogOpen])

  useEffect(() => {
    if (!dialogOpen || !activeRun?.id) return

    const supabase = createClient()
    const runId = activeRun.id

    const loadExisting = async () => {
      const [{ data: run }, { data: events }] = await Promise.all([
        supabase.from("codex_runs").select("*").eq("id", runId).maybeSingle(),
        supabase
          .from("codex_run_events")
          .select("*")
          .eq("run_id", runId)
          .order("sequence", { ascending: true }),
      ])

      if (run) {
        const next = run as CodexRun
        setActiveRun(next)
        if (next.output) setRunOutput(next.output)
      }

      if (events?.length) {
        const text = (events as CodexRunEvent[]).map(eventText).join("")
        if (text) setRunOutput(text)
      }
    }

    void loadExisting()

    const channel = supabase
      .channel(`codex-run:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "codex_runs",
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const next = payload.new as CodexRun
          setActiveRun(next)

          if (next.status === "running") setConnectionStatus("thinking")
          if (next.status === "completed") {
            setConnectionStatus("connected")
            if (next.output) setRunOutput(next.output)
            toast.success("Codex finished the recruiter task")
          }
          if (next.status === "failed") {
            setConnectionStatus("error")
            setRunOutput(next.error || "Codex run failed.")
            toast.error("Codex run failed")
          }
          if (next.status === "cancelled") {
            setConnectionStatus("connected")
            toast.info("Codex task stopped")
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "codex_run_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const event = payload.new as CodexRunEvent
          const text = eventText(event)
          if (text) setRunOutput((current) => `${current}${text}`)

          if (event.event_type === "item_started") {
            setConnectionStatus("executing")
          }
          if (event.event_type === "agent_message_delta") {
            setConnectionStatus("thinking")
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeRun?.id, dialogOpen])

  const handleConnect = useCallback(async () => {
    setConnectionStatus("connecting")
    setWorkerError(null)
    try {
      const result = await invokeCodex<DeviceCodeLogin>("connect")
      setLoginChallenge(result)
      setCodeCopied(false)
      window.open(result.verificationUrl, "_blank", "noopener,noreferrer")
      toast.success("ChatGPT sign-in opened. Enter the code shown here.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start ChatGPT sign-in."
      setWorkerError(message)
      setConnectionStatus("worker-unavailable")
      toast.error(message)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    try {
      await invokeCodex("logout")
      setConnection(null)
      setLoginChallenge(null)
      setConnectionStatus("disconnected")
      toast.success("ChatGPT disconnected")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect ChatGPT")
    }
  }, [])

  const handleCopyCode = useCallback(async () => {
    if (!loginChallenge) return
    try {
      await navigator.clipboard.writeText(loginChallenge.userCode)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 2_000)
    } catch {
      toast.error("Could not copy the sign-in code")
    }
  }, [loginChallenge])

  const handleRun = useCallback(async () => {
    if (connectionStatus !== "connected") {
      toast.error("Connect ChatGPT before running Codex")
      return
    }

    setRunOutput("")
    setConnectionStatus("queued")

    try {
      const result = await invokeCodex<{ run: CodexRun }>("start_run", {
        prompt: codexTask.trim(),
        model: selectedModel,
        threadId: activeRun?.thread_id ?? undefined,
      })
      setActiveRun(result.run)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the Codex run."
      setConnectionStatus("error")
      setRunOutput(message)
      toast.error(message)
    }
  }, [activeRun?.thread_id, codexTask, connectionStatus, selectedModel])

  const handleCancel = useCallback(async () => {
    if (!activeRun) return
    try {
      await invokeCodex("cancel_run", { runId: activeRun.id })
      setActiveRun((current) => current ? { ...current, status: "cancelling" } : current)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop the Codex run")
    }
  }, [activeRun])

  const connectionCopy = useMemo(() => ({
    checking: "Checking Supabase",
    disconnected: "Ready to connect",
    connecting: "Waiting for ChatGPT sign-in",
    connected: connection?.plan_type ? `Connected · ${connection.plan_type}` : "Connected to Codex",
    queued: "Codex run queued",
    thinking: "Codex thinking",
    executing: "Codex executing",
    "worker-unavailable": "Codex worker unavailable",
    error: "Codex error",
  })[connectionStatus], [connection?.plan_type, connectionStatus])

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-primary/40 bg-[radial-gradient(circle_at_top_left,rgba(35,255,35,0.18),transparent_34%),linear-gradient(135deg,rgba(6,18,9,0.96),rgba(0,0,0,0.98))] p-5 text-white shadow-[0_18px_55px_rgba(35,255,35,0.08)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Server className="size-3.5" />
              Supabase + Codex App Server
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Connect ChatGPT to Jobraker Recruiter</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Supabase Auth protects every request. A private hosted worker owns the per-user Codex runtime, while run state and streamed events return through Supabase.
              </p>
              {connection?.account_email && (
                <p className="mt-2 text-xs text-white/45">Connected as {connection.account_email}</p>
              )}
            </div>
          </div>

          <div className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
            connectionStatus === "connected"
              ? "border-primary/45 bg-primary/15 text-primary"
              : connectionStatus === "worker-unavailable" || connectionStatus === "error"
                ? "border-amber-400/45 bg-amber-400/10 text-amber-200"
                : "border-white/15 bg-white/8 text-white/70",
          )}>
            {connectionStatus === "connected" ? (
              <CheckCircle2 className="size-3.5" />
            ) : ["checking", "connecting", "queued", "thinking", "executing"].includes(connectionStatus) ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="size-3.5" />
            )}
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
                <SelectItem value="gpt-5.6-terra">GPT-5.6 Terra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {connectionStatus === "connected" && (
              <Button type="button" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={handleDisconnect}>
                <LogOut className="mr-2 size-4" />
                Disconnect
              </Button>
            )}
            <Button
              type="button"
              onClick={handleConnect}
              disabled={connectionStatus === "connecting"}
              className="bg-primary text-black hover:bg-primary/90"
            >
              {connectionStatus === "connecting" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
              {connectionStatus === "connected" ? "Reconnect ChatGPT" : "Connect ChatGPT"}
            </Button>
          </div>
        </div>

        {loginChallenge && connectionStatus === "connecting" && (
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4">
            <p className="text-sm font-medium">Complete ChatGPT sign-in</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Open the verification page and enter this one-time code. Supabase will detect the connected worker account automatically.
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
              The Vite app sends an authenticated request to Supabase. The hosted worker executes the Codex thread and persists reconnect-safe progress events.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void checkCodexStatus()}>
            <RefreshCw className="mr-2 size-3.5" />
            Check status
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <textarea
            value={codexTask}
            onChange={(event) => setCodexTask(event.target.value)}
            className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {isRunning ? (
            <Button type="button" onClick={handleCancel} variant="destructive" className="w-full">
              <X className="mr-2 size-4" />
              Stop Codex Run
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRun}
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

      {(workerError || connectionStatus === "worker-unavailable") && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
          {workerError || "The hosted Codex worker is unavailable. Configure CODEX_WORKER_URL and CODEX_WORKER_SECRET in Supabase."}
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
        ChatGPT tokens are never stored in the Vite app or Postgres. Supabase stores only connection metadata, run state, and streamed events protected by Row Level Security.
      </div>
    </div>
  )
}
