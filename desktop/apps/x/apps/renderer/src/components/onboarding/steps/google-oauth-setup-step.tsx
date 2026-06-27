import * as React from "react"
import { Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff, HelpCircle, ChevronDown, ChevronUp, Sparkles, KeyRound } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { GoogleIcon, OllamaIcon } from "../provider-icons"
import type { OnboardingState, LlmProviderFlavor } from "../use-onboarding-state"
import { toast } from "sonner"

interface GoogleOauthSetupStepProps {
  state: OnboardingState
}

const llmProviders: Array<{ id: LlmProviderFlavor; name: string; description: string; color: string; icon: React.ReactNode }> = [
  { id: "google", name: "Gemini", description: "Google AI Studio", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: <GoogleIcon /> },
  { id: "ollama", name: "Ollama", description: "Gemma 4 Models", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: <OllamaIcon /> },
]

export function GoogleOauthSetupStep({ state }: GoogleOauthSetupStepProps) {
  const {
    providerStates, handleBack, handleNext,
    llmProvider, setLlmProvider, modelsCatalog, modelsLoading,
    activeConfig, testState, setTestState, showApiKey,
    showBaseURL, isLocalProvider, canTest,
    updateProviderConfig, handleTestAndSaveLlmConfig
  } = state

  const googleState = providerStates['google'] || {
    isConnected: false,
    isLoading: false,
    isConnecting: false,
    profileName: null,
    profileImage: null,
    profileEmail: null
  }

  // Inputs for Google credentials
  const [clientId, setClientId] = React.useState("")
  const [clientSecret, setClientSecret] = React.useState("")
  const [showSecret, setShowSecret] = React.useState(false)
  const [helpExpanded, setHelpExpanded] = React.useState(false)
  const [configExpanded, setConfigExpanded] = React.useState(false)

  // Load saved Client ID if any from state
  React.useEffect(() => {
    if (googleState.clientId) {
      setClientId(googleState.clientId)
    }
  }, [googleState.clientId])

  const handleGoogleConnect = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Google Client ID and Client Secret are required.")
      return
    }
    // Set credentials and start connect
    state.handleGoogleClientIdSubmit(clientId, clientSecret)
  }

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText("http://localhost:8080/oauth/callback")
    toast.success("Redirect URI copied to clipboard!")
  }

  // LLM setup helper fields
  const modelsForProvider = modelsCatalog[llmProvider] || []
  const showModelInput = isLocalProvider || modelsForProvider.length === 0

  return (
    <div className="flex flex-col flex-1">
      {/* Title */}
      <h2 className="text-3xl font-bold tracking-tight text-center mb-2">
        Personalize Your Workspace
      </h2>
      <p className="text-base text-muted-foreground text-center leading-relaxed mb-6">
        Connect your Google Developer credentials to pull your profile, sync emails, and enable integrations.
      </p>

      <div className="space-y-4 flex-1">
        {googleState.isConnected ? (
          /* Successfully Connected Profile Card */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-green-200/50 bg-green-500/5 dark:border-green-500/20 dark:bg-green-500/5 p-6 flex flex-col items-center justify-center text-center gap-4 my-6"
          >
            <div className="relative">
              {googleState.profileImage ? (
                <img
                  src={googleState.profileImage}
                  alt={googleState.profileName || "User"}
                  className="size-20 rounded-full object-cover border-2 border-green-500/50 shadow-md"
                />
              ) : (
                <div className="size-20 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center text-2xl font-bold border border-green-500/20">
                  {googleState.profileName?.charAt(0).toUpperCase() || "G"}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-green-500 flex items-center justify-center text-white border-2 border-background shadow">
                <CheckCircle2 className="size-3.5" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {googleState.profileName || "Connected to Google"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {googleState.profileEmail || "Google Account Connected"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
              <Sparkles className="size-3.5 animate-pulse" />
              Profile synced successfully!
            </div>
          </motion.div>
        ) : (
          /* Credentials Form */
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/30 p-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Google Client ID
                  </label>
                  <button
                    onClick={() => setHelpExpanded(!helpExpanded)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle className="size-3.5" />
                    How to setup?
                  </button>
                </div>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Paste your OAuth 2.0 Client ID"
                  disabled={googleState.isConnecting}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Google Client Secret
                </label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Paste your Client Secret"
                    disabled={googleState.isConnecting}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Redirect URI copy-paste help box */}
              <div className="rounded-lg bg-background border p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Authorized Redirect URI</div>
                  <div className="text-xs font-mono text-foreground truncate mt-0.5 select-all">
                    http://localhost:8080/oauth/callback
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyRedirectUri}
                  className="h-7 text-xs shrink-0"
                >
                  Copy
                </Button>
              </div>

              <Button
                onClick={handleGoogleConnect}
                disabled={googleState.isConnecting || !clientId || !clientSecret}
                className="w-full h-10 mt-2 font-medium"
              >
                {googleState.isConnecting ? (
                  <><Loader2 className="size-4 animate-spin mr-2" />Connecting...</>
                ) : (
                  "Connect Google Account"
                )}
              </Button>
            </div>

            {/* Help instructions dropdown */}
            <AnimatePresence>
              {helpExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border rounded-xl bg-muted/20 p-4 text-xs space-y-2 text-muted-foreground leading-relaxed"
                >
                  <h4 className="font-semibold text-foreground">Quick Google OAuth Credentials setup:</h4>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Open the <a href="https://console.cloud.google.com/" target="_blank" className="text-primary underline">Google Cloud Console</a>.</li>
                    <li>Create a project and enable **Gmail API**, **Google Calendar API**, and **Google Drive API**.</li>
                    <li>Configure the **OAuth Consent Screen** (Testing status, External path).</li>
                    <li>Add your email address under **Test Users**.</li>
                    <li>Create **OAuth Client ID** credentials as a **Web application**.</li>
                    <li>Add <code className="bg-muted px-1 rounded">http://localhost:8080/oauth/callback</code> as the **Authorized redirect URI**.</li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Collapsible Model Config Section (Optional Config) */}
        <div className="rounded-xl border bg-muted/10 overflow-hidden">
          <button
            onClick={() => setConfigExpanded(!configExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              <span>Configure LLM Model (Optional)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span>{configExpanded ? "Collapse" : "Expand"}</span>
              {configExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </button>

          <AnimatePresence>
            {configExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t px-4 pb-5 pt-3 space-y-4 bg-background"
              >
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">LLM Provider</span>
                  <div className="grid gap-2 grid-cols-2">
                    {llmProviders.map((provider) => {
                      const isSelected = llmProvider === provider.id
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setLlmProvider(provider.id)
                            setTestState({ status: "idle" })
                          }}
                          className={cn(
                            "rounded-lg border-2 p-2.5 text-left transition-all flex items-center gap-2",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-transparent bg-muted/50 hover:bg-muted"
                          )}
                        >
                          <div className={cn("size-7 rounded flex items-center justify-center shrink-0 text-xs", provider.color)}>
                            {provider.icon}
                          </div>
                          <div>
                            <div className="text-xs font-semibold leading-none">{provider.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{provider.description}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Assistant Model</label>
                    {modelsLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                        <Loader2 className="size-3.5 animate-spin" /> Loading...
                      </div>
                    ) : showModelInput ? (
                      <Input
                        value={activeConfig.model}
                        onChange={(e) => updateProviderConfig(llmProvider, { model: e.target.value })}
                        placeholder="Enter model name"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <Select
                        value={activeConfig.model}
                        onValueChange={(value) => updateProviderConfig(llmProvider, { model: value })}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelsForProvider.map((model) => (
                            <SelectItem key={model.id} value={model.id} className="text-xs">
                              {model.name || model.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Knowledge Graph Model</label>
                    {modelsLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                        <Loader2 className="size-3.5 animate-spin" /> Loading...
                      </div>
                    ) : showModelInput ? (
                      <Input
                        value={activeConfig.knowledgeGraphModel}
                        onChange={(e) => updateProviderConfig(llmProvider, { knowledgeGraphModel: e.target.value })}
                        placeholder="Same as assistant"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <Select
                        value={activeConfig.knowledgeGraphModel || "__same__"}
                        onValueChange={(value) => updateProviderConfig(llmProvider, { knowledgeGraphModel: value === "__same__" ? "" : value })}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__same__" className="text-xs">Same as assistant</SelectItem>
                          {modelsForProvider.map((model) => (
                            <SelectItem key={model.id} value={model.id} className="text-xs">
                              {model.name || model.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {showApiKey && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">API Key</label>
                    <Input
                      type="password"
                      value={activeConfig.apiKey}
                      onChange={(e) => updateProviderConfig(llmProvider, { apiKey: e.target.value })}
                      placeholder="Paste your API key"
                      className="font-mono h-8 text-xs"
                    />
                  </div>
                )}

                {showBaseURL && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Base URL</label>
                    <Input
                      value={activeConfig.baseURL}
                      onChange={(e) => updateProviderConfig(llmProvider, { baseURL: e.target.value })}
                      placeholder="Custom API endpoint"
                      className="font-mono h-8 text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {testState.status === "success" && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="size-3.5" /> Checked
                    </div>
                  )}
                  {testState.status === "error" && (
                    <span className="text-[10px] text-destructive max-w-[150px] truncate">
                      {testState.error}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestAndSaveLlmConfig}
                    disabled={!canTest || testState.status === "testing"}
                    className="h-8 text-xs px-3"
                  >
                    {testState.status === "testing" ? "Testing..." : "Save Config"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 mt-6 pt-4 border-t shrink-0">
        <Button
          onClick={handleNext}
          size="lg"
          disabled={!googleState.isConnected}
          className="h-11 text-sm font-medium"
        >
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
