"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Server, Shield, Palette, Monitor, Sun, Moon, Loader2, CheckCircle2, Plus, X, Wrench, Search, ChevronRight, Link2, Tags, Mail, BookOpen, User, Plug, MessageCircle, Bug, Terminal, AlertTriangle, RefreshCw } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useTheme } from "@/contexts/theme-context"
import { toast } from "sonner"
import { AccountSettings } from "@/components/settings/account-settings"
import { ConnectedAccountsSettings } from "@/components/settings/connected-accounts-settings"
import { ConnectorApiKeysSettings } from "@/components/settings/connector-api-keys-settings"

type ConfigTab = "account" | "connections" | "models" | "mcp" | "security" | "code-mode" | "appearance" | "note-tagging" | "help"

interface TabConfig {
  id: ConfigTab
  label: string
  icon: React.ElementType
  path?: string
  description: string
}

const tabs: TabConfig[] = [
  {
    id: "account",
    label: "Account",
    icon: User,
    description: "Manage your recruiting workspace and subscription",
  },
  {
    id: "connections",
    label: "Connections",
    icon: Plug,
    description: "Manage accounts and tools",
  },
  {
    id: "models",
    label: "Codex",
    icon: Terminal,
    description: "Connect Codex to this workspace",
  },
  {
    id: "mcp",
    label: "MCP Servers",
    icon: Server,
    path: "config/mcp.json",
    description: "Configure MCP server connections",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    path: "config/security.json",
    description: "Configure allowed shell commands",
  },
  {
    id: "code-mode",
    label: "Code Mode",
    icon: Terminal,
    description: "Delegate coding tasks to Claude Code or Codex",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Customize the look and feel",
  },
  {
    id: "note-tagging",
    label: "Note Tagging",
    icon: Tags,
    path: "config/tags.json",
    description: "Tune recruiter labels for candidates, roles, interviews, and hiring signals",
  },
]

interface SettingsDialogProps {
  /** Optional trigger element. Omit when controlling `open` externally. */
  children?: React.ReactNode
  /** Tab to open on when the dialog is shown. Defaults to "account". */
  defaultTab?: ConfigTab
  /** Controlled open state. When provided, the dialog is fully controlled. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// --- Help & Support tab ---

function HelpSettings() {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">Help &amp; Support</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Get help from our community</p>
      </div>
      <Button
        variant="outline"
        className="w-full justify-start gap-3 h-auto py-3"
        onClick={() => window.open("https://github.com/jobraker-recruiter/jobraker-recruiter/issues/new", "_blank")}
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-destructive/10">
          <Bug className="size-4 text-destructive" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">Report a bug</span>
          <span className="text-xs text-muted-foreground">Send feedback to the Jobraker Recruiter team</span>
        </div>
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start gap-3 h-auto py-3"
        onClick={() => window.open("https://discord.com/invite/wajrgmJQ6b", "_blank")}
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-[#5865F2]">
          <MessageCircle className="size-4 text-white" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">Join our Discord</span>
          <span className="text-xs text-muted-foreground">Chat with the community</span>
        </div>
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start gap-3 h-auto py-3"
        onClick={() => window.open("mailto:contact@jobrakerRecruiter.com", "_blank")}
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <Mail className="size-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">Contact us</span>
          <span className="text-xs text-muted-foreground">contact@jobrakerRecruiter.com</span>
        </div>
      </Button>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <a
          href="https://www.jobrakerRecruiter.com/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Terms of Service
        </a>
        <span>·</span>
        <a
          href="https://www.jobrakerRecruiter.com/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  )
}

// --- Theme option for Appearance tab ---

function ThemeOption({
  label,
  icon: Icon,
  isSelected,
  onClick,
}: {
  label: string
  icon: React.ElementType
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <Icon className={cn("size-6", isSelected ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>
        {label}
      </span>
    </button>
  )
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Theme</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Select your preferred color scheme
        </p>
        <div className="grid grid-cols-3 gap-3">
          <ThemeOption
            label="Light"
            icon={Sun}
            isSelected={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <ThemeOption
            label="Dark"
            icon={Moon}
            isSelected={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
          <ThemeOption
            label="System"
            icon={Monitor}
            isSelected={theme === "system"}
            onClick={() => setTheme("system")}
          />
        </div>
      </div>
    </div>
  )
}

// --- Codex Settings UI ---

function ModelSettings({ dialogOpen }: { dialogOpen: boolean }) {
  void dialogOpen
  const [testState, setTestState] = useState<{ status: "idle" | "success" }>({ status: "idle" })
  const codexInstallCommand = "npm i -g @openai/codex"
  const codexLoginCommand = "codex login"
  const codexStatusCommand = "codex login status"
  const codexModelCommand = "codex --model gpt-5.6"
  const codexTaskCommand = 'codex exec --model gpt-5.6 "Describe the task here"'

  const handleCopyCommand = useCallback((command: string, label: string) => {
    void navigator.clipboard.writeText(command)
    toast.success(`${label} copied`)
  }, [])

  const handleConnectCodex = useCallback(() => {
    setTestState({ status: "success" })
    void navigator.clipboard.writeText(codexLoginCommand)
    toast.success("Codex ChatGPT sign-in command copied")
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/45 bg-primary/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Terminal className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Codex CLI</span>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">Connect Codex with ChatGPT Plus</h3>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Install Codex locally, sign in with ChatGPT in the browser, and use your ChatGPT plan access for coding tasks in this workspace.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-primary/20 bg-background/70 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Use ChatGPT sign-in for Plus plan usage.</span>{" "}
          API-key login is for usage-based OpenAI Platform billing and can limit ChatGPT workspace/cloud features.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}
            className="mt-3 w-full sm:w-auto"
          >
            Open ChatGPT
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">1. Install Codex CLI</div>
                <div className="text-xs text-muted-foreground">Run once on this machine.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyCommand(codexInstallCommand, "Install command")}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 font-mono text-sm text-primary">
              {codexInstallCommand}
            </code>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">2. Sign in with ChatGPT</div>
                <div className="text-xs text-muted-foreground">This opens the browser so you can choose your ChatGPT workspace.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyCommand(codexLoginCommand, "ChatGPT sign-in command")}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 font-mono text-sm text-primary">
              {codexLoginCommand}
            </code>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">3. Verify the active auth method</div>
                <div className="text-xs text-muted-foreground">Confirm Codex is signed in before running workspace tasks.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyCommand(codexStatusCommand, "Status command")}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 font-mono text-sm text-primary">
              {codexStatusCommand}
            </code>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">4. Start Codex with a GPT-5.6 model</div>
                <div className="text-xs text-muted-foreground">Use the model flag when you want Codex CLI to run with a specific available GPT model.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyCommand(codexModelCommand, "Model command")}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 font-mono text-sm text-primary">
              {codexModelCommand}
            </code>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">5. Run an app task with Codex CLI</div>
                <div className="text-xs text-muted-foreground">
                  This is the command shape a local bridge would run when the web app delegates a coding task.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopyCommand(codexTaskCommand, "Task command")}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 font-mono text-sm text-primary">
              {codexTaskCommand}
            </code>
          </div>
        </div>

        {testState.status === "success" && (
          <div className="mt-4 flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="size-4" />
            Run the copied command to complete ChatGPT sign-in in your browser.
          </div>
        )}
      </div>

      <Button
        type="button"
        onClick={handleConnectCodex}
        className="w-full"
      >
        Copy ChatGPT sign-in command
      </Button>
    </div>
  )
}

// --- Tools Library Settings ---

interface ToolkitInfo {
  slug: string
  name: string
  meta: { description: string; logo: string; tools_count: number; triggers_count: number }
  no_auth?: boolean
  auth_schemes?: string[]
  composio_managed_auth_schemes?: string[]
}

function ToolsLibrarySettings({ dialogOpen, jobrakerRecruiterConnected }: { dialogOpen: boolean; jobrakerRecruiterConnected: boolean }) {
  // API key state
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  // Toolkit browsing state
  const [toolkits, setToolkits] = useState<ToolkitInfo[]>([])
  const [toolkitsLoading, setToolkitsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Connection state
  const [connectedToolkits, setConnectedToolkits] = useState<Set<string>>(new Set())
  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null)

  // Check API key configuration
  const checkApiKey = useCallback(async () => {
    try {
      const result = await window.ipc.invoke("composio:is-configured", null)
      setApiKeyConfigured(result.configured)
      if (!result.configured) {
        setShowApiKeyInput(true)
      }
    } catch {
      setApiKeyConfigured(false)
    }
  }, [])

  // Load connected toolkits
  const loadConnected = useCallback(async () => {
    try {
      const result = await window.ipc.invoke("composio:list-connected", null)
      setConnectedToolkits(new Set(result.toolkits))
    } catch {
      // ignore
    }
  }, [])

  // Load toolkits
  const loadToolkits = useCallback(async () => {
    setToolkitsLoading(true)
    try {
      const result = await window.ipc.invoke("composio:list-toolkits", {})
      setToolkits(result.items)
    } catch {
      toast.error("Failed to load toolkits")
    } finally {
      setToolkitsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    if (!dialogOpen) return
    checkApiKey()
    loadConnected()
  }, [dialogOpen, checkApiKey, loadConnected])

  // Load toolkits when API key is configured
  useEffect(() => {
    if (dialogOpen && apiKeyConfigured) {
      loadToolkits()
    }
  }, [dialogOpen, apiKeyConfigured, loadToolkits])

  // Listen for composio connection events
  useEffect(() => {
    const cleanup = window.ipc.on('composio:didConnect', (event) => {
      const { toolkitSlug, success, error } = event
      setConnectingToolkit(null)
      if (success) {
        setConnectedToolkits(prev => new Set([...prev, toolkitSlug]))
        toast.success(`Connected to ${toolkitSlug}`)
      } else {
        toast.error(error || `Failed to connect to ${toolkitSlug}`)
      }
    })
    return cleanup
  }, [])

  // Save API key
  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    setApiKeySaving(true)
    try {
      const result = await window.ipc.invoke("composio:set-api-key", { apiKey: trimmed })
      if (result.success) {
        setApiKeyConfigured(true)
        setShowApiKeyInput(false)
        setApiKeyInput("")
        toast.success("Composio API key saved")
      } else {
        toast.error(result.error || "Failed to save API key")
      }
    } catch {
      toast.error("Failed to save API key")
    } finally {
      setApiKeySaving(false)
    }
  }

  // Connect a toolkit
  const handleConnect = async (toolkitSlug: string) => {
    setConnectingToolkit(toolkitSlug)
    try {
      const result = await window.ipc.invoke("composio:initiate-connection", { toolkitSlug })
      if (!result.success) {
        toast.error(result.error || "Failed to connect")
        setConnectingToolkit(null)
      }
      // Success will be handled by composio:didConnect event
    } catch {
      toast.error("Failed to connect")
      setConnectingToolkit(null)
    }
  }

  // Disconnect a toolkit
  const handleDisconnect = async (toolkitSlug: string) => {
    try {
      await window.ipc.invoke("composio:disconnect", { toolkitSlug })
      setConnectedToolkits(prev => {
        const next = new Set(prev)
        next.delete(toolkitSlug)
        return next
      })
      toast.success(`Disconnected from ${toolkitSlug}`)
    } catch {
      toast.error("Failed to disconnect")
    }
  }

  // Filter toolkits by search
  const filteredToolkits = searchQuery.trim()
    ? toolkits.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.meta.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : toolkits

  return (
    <div className="space-y-4">
      {/* Section A: API Key (only in BYOK mode) */}
      {!jobrakerRecruiterConnected && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Composio API Key</span>
          {apiKeyConfigured && !showApiKeyInput ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="size-4" />
                API key configured
              </div>
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Enter your Composio API key to browse and enable tool integrations.
                Get your key from{" "}
                <a
                  href="https://app.composio.dev/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  app.composio.dev/settings
                </a>
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your Composio API key"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim() || apiKeySaving}
                  size="sm"
                >
                  {apiKeySaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </Button>
                {apiKeyConfigured && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowApiKeyInput(false); setApiKeyInput("") }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section B: Toolkit Browser (only when API key configured) */}
      {apiKeyConfigured && (
        <>
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available Toolkits</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search toolkits..."
                className="pl-8"
              />
            </div>
          </div>

          {toolkitsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading toolkits...
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {filteredToolkits.map((toolkit) => {
                const isConnected = connectedToolkits.has(toolkit.slug)
                const isConnecting = connectingToolkit === toolkit.slug

                return (
                  <div key={toolkit.slug} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {/* Logo */}
                      {toolkit.meta.logo ? (
                        <img
                          src={toolkit.meta.logo}
                          alt=""
                          className="size-7 rounded object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
                          <Wrench className="size-3.5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Name & description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{toolkit.name}</span>
                          {isConnected && (
                            <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-green-600">
                              Connected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {toolkit.meta.description}
                        </p>
                      </div>

                      {/* Connect / Disconnect button */}
                      {isConnected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(toolkit.slug)}
                          className="text-xs h-7 shrink-0"
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(toolkit.slug)}
                          disabled={isConnecting}
                          className="text-xs h-7 shrink-0"
                        >
                          {isConnecting ? (
                            <><Loader2 className="size-3 animate-spin mr-1" />Connecting...</>
                          ) : (
                            <><Link2 className="size-3 mr-1" />Connect</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              {filteredToolkits.length === 0 && !toolkitsLoading && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  {searchQuery ? "No toolkits match your search" : "No toolkits available"}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- Jobraker Recruiter Model Settings (when signed in via JobrakerRecruiter) ---

function JobrakerRecruiterModelSettings({ dialogOpen }: { dialogOpen: boolean }) {
  const [gatewayModels, setGatewayModels] = useState<LlmModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedKgModel, setSelectedKgModel] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!dialogOpen) return

    async function load() {
      setLoading(true)
      try {
        // Fetch gateway models
        const listResult = await window.ipc.invoke("models:list", null)
        const jobrakerRecruiterProvider = listResult.providers?.find((p: { id: string }) => p.id === "jobraker-recruiter")
        const models = jobrakerRecruiterProvider?.models || []
        setGatewayModels(models)

        // Read current selection from config
        try {
          const configResult = await window.ipc.invoke("workspace:readFile", { path: "config/models.json" })
          const parsed = JSON.parse(configResult.data)
          if (parsed?.model) setSelectedModel(parsed.model)
          if (parsed?.knowledgeGraphModel) setSelectedKgModel(parsed.knowledgeGraphModel)
        } catch {
          // No config yet — pick first model as default
          if (models.length > 0) setSelectedModel(models[0].id)
        }
      } catch {
        toast.error("Failed to load models")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [dialogOpen])

  const handleSave = useCallback(async () => {
    if (!selectedModel) return
    setSaving(true)
    try {
      await window.ipc.invoke("models:saveConfig", {
        provider: { flavor: "openrouter" as const },
        model: selectedModel,
        knowledgeGraphModel: selectedKgModel || undefined,
      })
      window.dispatchEvent(new Event("models-config-changed"))
      toast.success("Model configuration saved")
    } catch {
      toast.error("Failed to save model configuration")
    } finally {
      setSaving(false)
    }
  }, [selectedModel, selectedKgModel])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Select the models Jobraker Recruiter uses. These are provided through your Jobraker Recruiter account.
      </p>

      {/* Assistant model */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Assistant model</label>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {gatewayModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Knowledge graph model */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Knowledge graph model</label>
        <Select value={selectedKgModel || "__same__"} onValueChange={(v) => setSelectedKgModel(v === "__same__" ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Same as assistant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__same__">Same as assistant</SelectItem>
            {gatewayModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={!selectedModel || saving}>
        {saving ? (
          <><Loader2 className="size-4 animate-spin mr-2" />Saving...</>
        ) : (
          "Save"
        )}
      </Button>
    </div>
  )
}

// --- Note Tagging Settings ---

interface TagDef {
  tag: string
  type: string
  applicability: "email" | "notes" | "both"
  description: string
  example?: string
  noteEffect?: "create" | "skip" | "none"
}

const NOTE_TAG_TYPE_ORDER = [
  "relationship", "relationship-sub", "topic", "action", "status", "source",
]

const EMAIL_TAG_TYPE_ORDER = [
  "relationship", "topic", "email-type", "noise", "action", "status",
]

const TAG_TYPE_LABELS: Record<string, string> = {
  "relationship": "Relationship",
  "relationship-sub": "Relationship Sub-Tags",
  "topic": "Topic",
  "email-type": "Email Type",
  "noise": "Noise",
  "action": "Action",
  "status": "Status",
  "source": "Source",
}


function TagGroupTable({
  group,
  tags: _tags,
  collapsed,
  onToggle,
  onAdd,
  onUpdate,
  onRemove,
  getGlobalIndex,
  isEmail,
}: {
  group: { type: string; label: string; tags: TagDef[] }
  tags: TagDef[]
  collapsed: boolean
  onToggle: () => void
  onAdd: () => void
  onUpdate: (index: number, field: keyof TagDef, value: string | boolean) => void
  onRemove: (index: number) => void
  getGlobalIndex: (type: string, localIndex: number) => number
  isEmail: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")} />
          {group.label}
          <span className="text-[10px] ml-0.5">({group.tags.length})</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onAdd}
        >
          <Plus className="size-3 mr-1" />
          Add
        </Button>
      </div>
      {!collapsed && group.tags.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <div className={cn(
            "gap-1 bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider grid",
            isEmail ? "grid-cols-[100px_1fr_1fr_60px_24px]" : "grid-cols-[100px_1fr_1fr_24px]"
          )}>
            <div>Label</div>
            <div>Description</div>
            <div>Example</div>
            {isEmail && <div className="text-center" title="Emails with this label will be excluded from creating notes">Skip notes</div>}
            <div />
          </div>
          {group.tags.map((tag, localIdx) => {
            const globalIdx = getGlobalIndex(group.type, localIdx)
            return (
              <div key={globalIdx} className={cn(
                "gap-1 border-t px-2 py-0.5 items-center grid",
                isEmail ? "grid-cols-[100px_1fr_1fr_60px_24px]" : "grid-cols-[100px_1fr_1fr_24px]"
              )}>
                <Input
                  value={tag.tag}
                  onChange={e => onUpdate(globalIdx, "tag", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="tag-name"
                  title={tag.tag}
                />
                <Input
                  value={tag.description}
                  onChange={e => onUpdate(globalIdx, "description", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Description"
                  title={tag.description}
                />
                <Input
                  value={tag.example || ""}
                  onChange={e => onUpdate(globalIdx, "example", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Example"
                  title={tag.example || ""}
                />
                {isEmail && (
                  <div className="flex justify-center">
                    <Switch
                      checked={tag.noteEffect === "skip"}
                      onCheckedChange={checked => onUpdate(globalIdx, "noteEffect", checked ? "skip" : "create")}
                      className="scale-75"
                    />
                  </div>
                )}
                <button
                  onClick={() => onRemove(globalIdx)}
                  className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {!collapsed && group.tags.length === 0 && (
        <div className="text-xs text-muted-foreground italic px-2">No tags in this group</div>
      )}
    </div>
  )
}

function NoteTaggingSettings({ dialogOpen }: { dialogOpen: boolean }) {
  const [tags, setTags] = useState<TagDef[]>([])
  const [originalTags, setOriginalTags] = useState<TagDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeSection, setActiveSection] = useState<"notes" | "email">("notes")

  const hasChanges = JSON.stringify(tags) !== JSON.stringify(originalTags)

  useEffect(() => {
    if (!dialogOpen) return
    async function load() {
      setLoading(true)
      try {
        const result = await window.ipc.invoke("workspace:readFile", { path: "config/tags.json" })
        const parsed = JSON.parse(result.data)
        setTags(parsed)
        setOriginalTags(parsed)
      } catch {
        setTags([])
        setOriginalTags([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dialogOpen])

  const noteGroups = useMemo(() => {
    const map = new Map<string, TagDef[]>()
    for (const tag of tags) {
      if (tag.applicability === "email") continue
      const list = map.get(tag.type) ?? []
      list.push(tag)
      map.set(tag.type, list)
    }
    return NOTE_TAG_TYPE_ORDER.filter(type => map.has(type)).map(type => ({
      type,
      label: TAG_TYPE_LABELS[type],
      tags: map.get(type) ?? [],
    }))
  }, [tags])

  const emailGroups = useMemo(() => {
    const map = new Map<string, TagDef[]>()
    for (const tag of tags) {
      if (tag.applicability === "notes") continue
      const list = map.get(tag.type) ?? []
      list.push(tag)
      map.set(tag.type, list)
    }
    return EMAIL_TAG_TYPE_ORDER.filter(type => map.has(type)).map(type => ({
      type,
      label: TAG_TYPE_LABELS[type],
      tags: map.get(type) ?? [],
    }))
  }, [tags])

  const getGlobalIndex = useCallback((type: string, localIndex: number) => {
    let count = 0
    for (let i = 0; i < tags.length; i++) {
      if (tags[i].type === type) {
        if (count === localIndex) return i
        count++
      }
    }
    return -1
  }, [tags])

  const updateTag = useCallback((index: number, field: keyof TagDef, value: string | boolean) => {
    setTags(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }, [])

  const removeTag = useCallback((index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index))
  }, [])

  const addTag = useCallback((type: string) => {
    const isEmailSection = activeSection === "email"
    const applicability = isEmailSection ? "email" as const : "notes" as const
    // For email-only types, always use "email"; for notes-only types, always use "notes"; otherwise use "both"
    const emailOnlyTypes = ["email-type", "noise"]
    const notesOnlyTypes = ["relationship-sub", "source"]
    let finalApplicability: "email" | "notes" | "both" = "both"
    if (emailOnlyTypes.includes(type)) finalApplicability = "email"
    else if (notesOnlyTypes.includes(type)) finalApplicability = "notes"
    else finalApplicability = isEmailSection ? "email" : applicability

    const newTag: TagDef = {
      tag: "",
      type,
      applicability: finalApplicability === "email" && !isEmailSection ? "both" : finalApplicability === "notes" && isEmailSection ? "both" : finalApplicability,
      description: "",
      noteEffect: isEmailSection ? "create" : "none",
    }
    const lastIndex = tags.reduce((acc, t, i) => t.type === type ? i : acc, -1)
    if (lastIndex === -1) {
      setTags(prev => [...prev, newTag])
    } else {
      setTags(prev => [...prev.slice(0, lastIndex + 1), newTag, ...prev.slice(lastIndex + 1)])
    }
  }, [tags, activeSection])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.ipc.invoke("workspace:writeFile", {
        path: "config/tags.json",
        data: JSON.stringify(tags, null, 2),
      })
      setOriginalTags([...tags])
      toast.success("Tag configuration saved")
    } catch {
      toast.error("Failed to save tag configuration")
    } finally {
      setSaving(false)
    }
  }, [tags])

  const toggleGroup = useCallback((type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading...
      </div>
    )
  }

  const currentGroups = activeSection === "notes" ? noteGroups : emailGroups

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 mb-3 border-b">
        <button
          onClick={() => setActiveSection("notes")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
            activeSection === "notes"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="size-3.5" />
          Note Tags
        </button>
        <button
          onClick={() => setActiveSection("email")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
            activeSection === "email"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Mail className="size-3.5" />
          Email Labels
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {currentGroups.map(group => (
          <TagGroupTable
            key={group.type}
            group={group}
            tags={tags}
            collapsed={collapsedGroups.has(group.type)}
            onToggle={() => toggleGroup(group.type)}
            onAdd={() => addTag(group.type)}
            onUpdate={updateTag}
            onRemove={removeTag}
            getGlobalIndex={getGlobalIndex}
            isEmail={activeSection === "email"}
          />
        ))}
      </div>
      <div className="pt-3 border-t mt-3 flex items-center justify-between">
        <div>
          {hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Code Mode Settings ---

type AgentStatus = { installed: boolean; signedIn: boolean }
type CodeModeAgentStatus = { claude: AgentStatus; codex: AgentStatus }

function AgentStatusRow({
  name,
  installLink,
  signInCommand,
  status,
}: {
  name: string
  installLink: string
  signInCommand: string
  status: AgentStatus | null
}) {
  const ready = status?.installed && status?.signedIn
  const needsSignInOnly = status?.installed && !status?.signedIn
  return (
    <div className="rounded-md border px-3 py-2.5 flex items-center gap-3">
      <Terminal className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
          <span className={cn("inline-flex items-center gap-1", status?.installed ? "text-green-600" : "text-muted-foreground")}>
            {status?.installed ? <CheckCircle2 className="size-3" /> : <X className="size-3" />}
            Installed
          </span>
          <span className={cn("inline-flex items-center gap-1", status?.signedIn ? "text-green-600" : "text-muted-foreground")}>
            {status?.signedIn ? <CheckCircle2 className="size-3" /> : <X className="size-3" />}
            Signed in
          </span>
        </div>
      </div>
      {ready ? (
        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium leading-none text-green-600">
          Ready
        </span>
      ) : needsSignInOnly ? (
        <span className="text-xs text-muted-foreground shrink-0">
          Run <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{signInCommand}</code>
        </span>
      ) : (
        <a
          href={installLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline shrink-0"
        >
          Install &amp; sign in
        </a>
      )}
    </div>
  )
}

function CodeModeSettings({ dialogOpen }: { dialogOpen: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<CodeModeAgentStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const result = await window.ipc.invoke("codeMode:checkAgentStatus", null)
      setStatus(result)
    } catch {
      setStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await window.ipc.invoke("codeMode:getConfig", null)
        if (!cancelled) setEnabled(result.enabled)
      } catch {
        if (!cancelled) setEnabled(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    loadStatus()
    return () => { cancelled = true }
  }, [dialogOpen, loadStatus])

  const handleToggle = useCallback(async (next: boolean) => {
    setSaving(true)
    setEnabled(next)
    try {
      await window.ipc.invoke("codeMode:setConfig", { enabled: next })
      window.dispatchEvent(new Event("code-mode-config-changed"))
      toast.success(next ? "Code mode enabled" : "Code mode disabled")
    } catch {
      setEnabled(!next)
      toast.error("Failed to update code mode")
    } finally {
      setSaving(false)
    }
  }, [])

  const anyReady = status?.claude.installed && status?.claude.signedIn
    || status?.codex.installed && status?.codex.signedIn

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>
          <strong className="text-foreground">Code mode</strong> lets the assistant delegate coding tasks
          to <strong className="text-foreground">Claude Code</strong> or <strong className="text-foreground">Codex</strong> running
          on your machine. Pick the agent inline from the composer; the assistant calls it via
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[11px]">acpx</code>
          and streams results back into chat.
        </p>
        <p>
          Requires an active <strong className="text-foreground">Claude Code</strong> subscription or
          a <strong className="text-foreground">ChatGPT/Codex</strong> subscription. You can have one or both.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent status</span>
          <button
            onClick={() => { void loadStatus() }}
            disabled={statusLoading}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {statusLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Re-check
          </button>
        </div>
        <div className="space-y-2">
          <AgentStatusRow
            name="Claude Code"
            installLink="https://claude.ai/code"
            signInCommand="claude login"
            status={status?.claude ?? null}
          />
          <AgentStatusRow
            name="Codex"
            installLink="https://developers.openai.com/codex/cli"
            signInCommand="codex login"
            status={status?.codex ?? null}
          />
        </div>
      </div>

      <div className="rounded-md border px-3 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Enable code mode</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Shows the code mode chip in the composer and lets the assistant delegate to your installed agents.
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {enabled && status && !anyReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 flex items-start gap-2 text-xs">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200">
            Neither Claude Code nor Codex is ready. Install at least one and sign in with a subscription
            account, then click Re-check.
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Settings Dialog ---

export function SettingsDialog({ children, defaultTab = "account", open: controlledOpen, onOpenChange }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = useCallback((next: boolean) => {
    if (onOpenChange) onOpenChange(next)
    else setInternalOpen(next)
  }, [onOpenChange])
  const [activeTab, setActiveTab] = useState<ConfigTab>(defaultTab)
  const [content, setContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobrakerRecruiterConnected, setJobrakerRecruiterConnected] = useState(false)

  // Reset to the requested default tab each time the dialog is opened
  useEffect(() => {
    if (open) setActiveTab(defaultTab)
  }, [open, defaultTab])

  // Check if user is signed in to Jobraker Recruiter
  useEffect(() => {
    if (!open) return
    window.ipc.invoke('oauth:getState', null).then((result) => {
      const connected = result.config?.['jobraker-recruiter']?.connected ?? false
      setJobrakerRecruiterConnected(connected)
    }).catch(() => {
      setJobrakerRecruiterConnected(false)
    })
  }, [open])

  const visibleTabs = useMemo(() => jobrakerRecruiterConnected ? tabs.filter(t => t.id !== "models") : tabs, [jobrakerRecruiterConnected])

  const activeTabConfig = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0]
  const isJsonTab = activeTab === "mcp" || activeTab === "security"

  const formatJson = (jsonString: string): string => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2)
    } catch {
      return jsonString
    }
  }

  const loadConfig = useCallback(async (tab: ConfigTab) => {
    if (tab === "appearance" || tab === "models" || tab === "note-tagging" || tab === "account" || tab === "connections" || tab === "help" || tab === "code-mode") return
    const tabConfig = tabs.find((t) => t.id === tab)!
    if (!tabConfig.path) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.ipc.invoke("workspace:readFile", {
        path: tabConfig.path,
      })
      const formattedContent = formatJson(result.data)
      setContent(formattedContent)
      setOriginalContent(formattedContent)
    } catch {
      setError(`Failed to load ${tabConfig.label} config`)
      setContent("")
      setOriginalContent("")
    } finally {
      setLoading(false)
    }
  }, [])

  const saveConfig = async () => {
    if (!isJsonTab || !activeTabConfig.path) return
    setSaving(true)
    setError(null)
    try {
      JSON.parse(content)
      await window.ipc.invoke("workspace:writeFile", {
        path: activeTabConfig.path,
        data: content,
      })
      setOriginalContent(content)
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON syntax")
      } else {
        setError(`Failed to save ${activeTabConfig.label} config`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFormat = () => {
    setContent(formatJson(content))
  }

  const hasChanges = content !== originalContent

  useEffect(() => {
    if (open && isJsonTab) {
      loadConfig(activeTab)
    }
  }, [open, activeTab, isJsonTab, loadConfig])

  const handleTabChange = (tab: ConfigTab) => {
    if (isJsonTab && hasChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return
      }
    }
    setActiveTab(tab)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className="max-w-[900px]! w-[900px] h-[600px] p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account, connections, models, and app preferences.
        </DialogDescription>
        <div className="flex h-full overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-2 flex flex-col">
            <div className="px-2 py-3 mb-2">
              <h2 className="font-semibold text-sm">Settings</h2>
            </div>
            <nav className="flex flex-col gap-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Header */}
            <div className="px-4 py-3 border-b">
              <h3 className="font-medium text-sm">{activeTabConfig.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "models" && jobrakerRecruiterConnected
                  ? "Select your default models"
                  : activeTabConfig.description}
              </p>
            </div>

            {/* Content */}
            <div className={cn("flex-1 p-4 min-h-0", (activeTab === "models" || activeTab === "connections" || activeTab === "account" || activeTab === "code-mode") ? "overflow-y-auto" : activeTab === "note-tagging" ? "overflow-hidden flex flex-col" : "overflow-hidden")}>
              {activeTab === "account" ? (
                <AccountSettings dialogOpen={open} />
              ) : activeTab === "connections" ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Primary accounts</h4>
                    <ConnectedAccountsSettings dialogOpen={open} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Library</h4>
                    <ConnectorApiKeysSettings dialogOpen={open} />
                    <ToolsLibrarySettings dialogOpen={open} jobrakerRecruiterConnected={jobrakerRecruiterConnected} />
                  </div>
                </div>
              ) : activeTab === "models" ? (
                jobrakerRecruiterConnected
                  ? <JobrakerRecruiterModelSettings dialogOpen={open} />
                  : <ModelSettings dialogOpen={open} />
              ) : activeTab === "note-tagging" ? (
                <NoteTaggingSettings dialogOpen={open} />
              ) : activeTab === "appearance" ? (
                <AppearanceSettings />
              ) : activeTab === "help" ? (
                <HelpSettings />
              ) : activeTab === "code-mode" ? (
                <CodeModeSettings dialogOpen={open} />
              ) : loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full resize-none bg-muted/50 rounded-md p-3 font-mono text-sm border-0 focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                  placeholder="Loading configuration..."
                />
              )}
            </div>

            {/* Footer - only show for JSON config tabs */}
            {isJsonTab && (
              <div className="px-4 py-3 border-t flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {error && (
                    <span className="text-xs text-destructive">{error}</span>
                  )}
                  {hasChanges && !error && (
                    <span className="text-xs text-muted-foreground">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFormat}
                    disabled={loading || saving}
                  >
                    Format
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveConfig}
                    disabled={loading || saving || !hasChanges}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
