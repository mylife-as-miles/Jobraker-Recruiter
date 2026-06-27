import * as React from "react"
import { Loader2, CheckCircle2, ArrowLeft, Calendar, FileText, KeyRound } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { GmailIcon, SlackIcon } from "../provider-icons"
import type { OnboardingState } from "../use-onboarding-state"
import { toast } from "sonner"

interface CoreConnectionsStepProps {
  state: OnboardingState
}

function ConnectionCard({
  name,
  description,
  icon,
  iconBg,
  iconColor,
  isConnected,
  isLoading,
  isConnecting,
  onConnect,
  index,
}: {
  name: string
  description: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  isConnected: boolean
  isLoading: boolean
  isConnecting: boolean
  onConnect: () => void
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors",
        isConnected
          ? "border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-900/10"
          : "hover:bg-muted/50 bg-background"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground truncate">{description}</div>
        </div>
      </div>
      <div className="shrink-0">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : isConnected ? (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            <span className="font-medium">Connected</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export function CoreConnectionsStep({ state }: CoreConnectionsStepProps) {
  const {
    providerStates, handleConnect, handleNext, handleBack,
  } = state

  // Composio states (we will expand use-onboarding-state.ts to expose these)
  const [composioApiKey, setComposioApiKey] = React.useState("")
  const [composioConfigured, setComposioConfigured] = React.useState(false)
  const [composioLoading, setComposioLoading] = React.useState(true)
  const [composioSaving, setComposioSaving] = React.useState(false)

  // Toolkit connections
  const [slackConnected, setSlackConnected] = React.useState(false)
  const [slackConnecting, setSlackConnecting] = React.useState(false)
  const [gdocsConnected, setGdocsConnected] = React.useState(false)
  const [gdocsConnecting, setGdocsConnecting] = React.useState(false)

  const checkComposioStatus = React.useCallback(async () => {
    try {
      setComposioLoading(true)
      const configRes = await window.ipc.invoke("composio:is-configured", null)
      setComposioConfigured(configRes.configured)
      
      if (configRes.configured) {
        // Fetch slack & gdocs connection status from Composio
        const slackRes = await window.ipc.invoke("composio:get-connection-status", { toolkitSlug: "slack" })
        setSlackConnected(slackRes.isConnected)
        
        const gdocsRes = await window.ipc.invoke("composio:get-connection-status", { toolkitSlug: "googledocs" })
        setGdocsConnected(gdocsRes.isConnected)
      }
    } catch (error) {
      console.error("Failed to fetch Composio status:", error)
    } finally {
      setComposioLoading(false)
    }
  }, [])

  React.useEffect(() => {
    checkComposioStatus()
  }, [checkComposioStatus])

  // Listen for Composio connection events
  React.useEffect(() => {
    const cleanup = window.ipc.on("composio:didConnect", (event) => {
      const { toolkitSlug, success } = event
      if (toolkitSlug === "slack") {
        setSlackConnected(success)
        setSlackConnecting(false)
        if (success) toast.success("Slack connected!")
      }
      if (toolkitSlug === "googledocs") {
        setGdocsConnected(success)
        setGdocsConnecting(false)
        if (success) toast.success("Google Docs connected!")
      }
    })
    return cleanup
  }, [])

  const handleSaveComposioKey = async () => {
    const trimmed = composioApiKey.trim()
    if (!trimmed) return
    setComposioSaving(true)
    try {
      const result = await window.ipc.invoke("composio:set-api-key", { apiKey: trimmed })
      if (result.success) {
        setComposioConfigured(true)
        setComposioApiKey("")
        toast.success("Composio API Key saved successfully!")
        // Re-check status
        await checkComposioStatus()
      } else {
        toast.error(result.error || "Failed to save API key.")
      }
    } catch {
      toast.error("Failed to save API key.")
    } finally {
      setComposioSaving(false)
    }
  }

  const handleConnectSlack = async () => {
    if (!composioConfigured) {
      toast.error("Please configure your Composio API Key first.")
      return
    }
    setSlackConnecting(true)
    try {
      const result = await window.ipc.invoke("composio:initiate-connection", { toolkitSlug: "slack" })
      if (!result.success) {
        toast.error(result.error || "Failed to initiate Slack connection.")
        setSlackConnecting(false)
      }
    } catch {
      toast.error("Failed to initiate Slack connection.")
      setSlackConnecting(false)
    }
  }

  const handleConnectGdocs = async () => {
    if (!composioConfigured) {
      toast.error("Please configure your Composio API Key first.")
      return
    }
    setGdocsConnecting(true)
    try {
      const result = await window.ipc.invoke("composio:initiate-connection", { toolkitSlug: "googledocs" })
      if (!result.success) {
        toast.error(result.error || "Failed to initiate Google Docs connection.")
        setGdocsConnecting(false)
      }
    } catch {
      toast.error("Failed to initiate Google Docs connection.")
      setGdocsConnecting(false)
    }
  }

  const googleConnected = providerStates['google']?.isConnected ?? false

  let cardIndex = 0

  return (
    <div className="flex flex-col flex-1">
      {/* Title */}
      <h2 className="text-3xl font-bold tracking-tight text-center mb-2">
        Connect Core Services
      </h2>
      <p className="text-base text-muted-foreground text-center leading-relaxed mb-6">
        Link the essential tools your AI agent uses to coordinate outreach, sync calendar events, and build documents.
      </p>

      <div className="space-y-6 flex-1">
        {/* Google Native Suite */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Google Workspace (Native Sync)
          </span>
          <ConnectionCard
            name="Gmail"
            description="Sync candidate threads and automate personalized outreach."
            icon={<GmailIcon />}
            iconBg="bg-red-500/10"
            iconColor="text-red-500"
            isConnected={googleConnected}
            isLoading={false}
            isConnecting={providerStates['google']?.isConnecting ?? false}
            onConnect={() => handleConnect('google')}
            index={cardIndex++}
          />
          <ConnectionCard
            name="Google Calendar"
            description="Synchronize interview schedules and meetings to your pipeline."
            icon={<Calendar className="size-5" />}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            isConnected={googleConnected}
            isLoading={false}
            isConnecting={providerStates['google']?.isConnecting ?? false}
            onConnect={() => handleConnect('google')}
            index={cardIndex++}
          />
        </div>

        {/* Composio Suite */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Agent Integrations (Composio)
            </span>
            {composioConfigured && (
              <span className="text-[10px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded font-medium">
                Composio Connected
              </span>
            )}
          </div>

          {!composioConfigured && !composioLoading && (
            /* Inline Composio API key prompt */
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <KeyRound className="size-4 text-foreground" />
                <span>Enter Composio API Key to connect Slack & Google Docs</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={composioApiKey}
                  onChange={(e) => setComposioApiKey(e.target.value)}
                  placeholder="Paste your API key (from app.composio.dev)"
                  className="font-mono text-xs h-9"
                />
                <Button
                  size="sm"
                  onClick={handleSaveComposioKey}
                  disabled={composioSaving || !composioApiKey}
                  className="h-9 font-medium"
                >
                  {composioSaving ? "Saving..." : "Save Key"}
                </Button>
              </div>
            </div>
          )}

          <ConnectionCard
            name="Slack"
            description="Send notifications and coordinate team channels."
            icon={<SlackIcon />}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
            isConnected={slackConnected}
            isLoading={composioLoading}
            isConnecting={slackConnecting}
            onConnect={handleConnectSlack}
            index={cardIndex++}
          />

          <ConnectionCard
            name="Google Docs"
            description="Draft job specs, interview outlines, and feedback forms."
            icon={<FileText className="size-5" />}
            iconBg="bg-blue-600/10"
            iconColor="text-blue-600"
            isConnected={gdocsConnected}
            isLoading={composioLoading}
            isConnecting={gdocsConnecting}
            onConnect={handleConnectGdocs}
            index={cardIndex++}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 mt-8 pt-4 border-t shrink-0">
        <Button onClick={handleNext} size="lg" className="h-11 text-sm font-medium">
          Continue
        </Button>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-xs">
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNext} className="text-muted-foreground text-xs">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
