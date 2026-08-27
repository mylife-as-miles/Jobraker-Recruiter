"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type TestState = "idle" | "testing" | "success" | "error"

export function GeminiSettings({ dialogOpen: _dialogOpen }: { dialogOpen: boolean }) {
  const [state, setState] = useState<TestState>("idle")
  const [output, setOutput] = useState("")
  const [error, setError] = useState("")

  const runTest = useCallback(async () => {
    setState("testing")
    setOutput("")
    setError("")

    try {
      const result = await window.ipc.invoke("recruiter:generateLlm", {
        systemPrompt: "You are Jobraker Recruiter's Gemini orchestration layer.",
        prompt: "Reply with exactly: Gemini recruiter runtime ready.",
        temperature: 0,
      }) as { text?: string; error?: string; model?: string; provider?: string; sdk?: string }

      if (result.error) throw new Error(result.error)
      setOutput([result.text, result.model ? `Model: ${result.model}` : "", result.sdk ? `SDK: ${result.sdk}` : ""].filter(Boolean).join("\n"))
      setState("success")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setState("error")
    }
  }, [])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Gemini Agent Runtime</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recruiter AI runs server-side through Google GenAI SDK. Credentials stay in Supabase secrets and are never exposed to the browser.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-muted/35 p-4 text-sm">
          <div className="font-medium">Required server configuration</div>
          <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
            <div>GEMINI_API_KEY=&lt;server secret&gt;</div>
            <div>GEMINI_MODEL=gemini-3.5-flash</div>
          </div>
        </div>

        <Button type="button" className="mt-4" onClick={runTest} disabled={state === "testing"}>
          {state === "testing" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Test Gemini
        </Button>
      </div>

      {state === "success" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            Gemini connected
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{output}</pre>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
