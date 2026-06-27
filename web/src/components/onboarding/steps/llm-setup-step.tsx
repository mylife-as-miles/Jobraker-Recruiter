import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react"
import { motion } from "motion/react"
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

interface LlmSetupStepProps {
  state: OnboardingState
}

const providers: Array<{ id: LlmProviderFlavor; name: string; description: string; color: string; icon: React.ReactNode }> = [
  { id: "google", name: "Gemini", description: "Google AI Studio", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: <GoogleIcon /> },
  { id: "ollama", name: "Ollama", description: "Gemma 4 Models", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: <OllamaIcon /> },
]

export function LlmSetupStep({ state }: LlmSetupStepProps) {
  const {
    llmProvider, setLlmProvider, modelsCatalog, modelsLoading, modelsError,
    activeConfig, testState, setTestState, showApiKey,
    showBaseURL, isLocalProvider, canTest,
    updateProviderConfig, handleTestAndSaveLlmConfig, handleBack,
  } = state

  const modelsForProvider = modelsCatalog[llmProvider] || []
  const showModelInput = isLocalProvider || modelsForProvider.length === 0

  const renderProviderCard = (provider: typeof providers[0], index: number) => {
    const isSelected = llmProvider === provider.id
    return (
      <motion.button
        key={provider.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => {
          setLlmProvider(provider.id)
          setTestState({ status: "idle" })
        }}
        className={cn(
          "rounded-xl border-2 p-4 text-left transition-all",
          isSelected
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-transparent bg-muted/50 hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", provider.color)}>
            {provider.icon}
          </div>
          <div>
            <div className="text-sm font-semibold">{provider.name}</div>
            <div className="text-xs text-muted-foreground">{provider.description}</div>
          </div>
        </div>
      </motion.button>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Title */}
      <h2 className="text-3xl font-bold tracking-tight text-center mb-2">
        Choose your model
      </h2>
      <p className="text-base text-muted-foreground text-center mb-6">
        Select a provider and configure your API key
      </p>

      {/* Provider selection */}
      <div className="space-y-3 mb-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((p, i) => renderProviderCard(p, i))}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-border my-4" />

      {/* Model configuration */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Model Configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">
              Assistant Model
            </label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : showModelInput ? (
              <Input
                value={activeConfig.model}
                onChange={(e) => updateProviderConfig(llmProvider, { model: e.target.value })}
                placeholder="Enter model"
              />
            ) : (
              <Select
                value={activeConfig.model}
                onValueChange={(value) => updateProviderConfig(llmProvider, { model: value })}
              >
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelsForProvider.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name || model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {modelsError && (
              <div className="text-xs text-destructive">{modelsError}</div>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">
              Knowledge Graph Model
            </label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : showModelInput ? (
              <Input
                value={activeConfig.knowledgeGraphModel}
                onChange={(e) => updateProviderConfig(llmProvider, { knowledgeGraphModel: e.target.value })}
                placeholder={activeConfig.model || "Enter model"}
              />
            ) : (
              <Select
                value={activeConfig.knowledgeGraphModel || "__same__"}
                onValueChange={(value) => updateProviderConfig(llmProvider, { knowledgeGraphModel: value === "__same__" ? "" : value })}
              >
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__same__">Same as assistant</SelectItem>
                  {modelsForProvider.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name || model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">
              Meeting Notes Model
            </label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : showModelInput ? (
              <Input
                value={activeConfig.meetingNotesModel}
                onChange={(e) => updateProviderConfig(llmProvider, { meetingNotesModel: e.target.value })}
                placeholder={activeConfig.model || "Enter model"}
              />
            ) : (
              <Select
                value={activeConfig.meetingNotesModel || "__same__"}
                onValueChange={(value) => updateProviderConfig(llmProvider, { meetingNotesModel: value === "__same__" ? "" : value })}
              >
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__same__">Same as assistant</SelectItem>
                  {modelsForProvider.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name || model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-xs font-medium text-muted-foreground">
              Track Block Model
            </label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            ) : showModelInput ? (
              <Input
                value={activeConfig.liveNoteAgentModel}
                onChange={(e) => updateProviderConfig(llmProvider, { liveNoteAgentModel: e.target.value })}
                placeholder={activeConfig.model || "Enter model"}
              />
            ) : (
              <Select
                value={activeConfig.liveNoteAgentModel || "__same__"}
                onValueChange={(value) => updateProviderConfig(llmProvider, { liveNoteAgentModel: value === "__same__" ? "" : value })}
              >
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__same__">Same as assistant</SelectItem>
                  {modelsForProvider.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name || model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {showApiKey && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              API Key {!state.requiresApiKey && "(optional)"}
            </label>
            <Input
              type="password"
              value={activeConfig.apiKey}
              onChange={(e) => updateProviderConfig(llmProvider, { apiKey: e.target.value })}
              placeholder="Paste your API key"
              className="font-mono"
            />
          </div>
        )}

        {showBaseURL && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Base URL
            </label>
            <Input
              value={activeConfig.baseURL}
              onChange={(e) => updateProviderConfig(llmProvider, { baseURL: e.target.value })}
              placeholder={
                llmProvider === "ollama"
                  ? "http://localhost:11434"
                  : llmProvider === "openai-compatible"
                    ? "http://localhost:1234/v1"
                    : "https://ai-gateway.vercel.sh/v1"
              }
              className="font-mono"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button variant="ghost" onClick={handleBack} className="gap-1">
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {testState.status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"
            >
              <CheckCircle2 className="size-4" />
              Connected
            </motion.div>
          )}
          {testState.status === "error" && (
            <span className="text-sm text-destructive max-w-[200px] truncate">
              {testState.error}
            </span>
          )}
          <Button
            onClick={handleTestAndSaveLlmConfig}
            disabled={!canTest || testState.status === "testing"}
            className="min-w-[140px]"
          >
            {testState.status === "testing" ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Testing...</>
            ) : (
              "Test & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
