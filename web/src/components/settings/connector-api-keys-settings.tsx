"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Globe, Loader2, Volume2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ElevenLabsVoice = {
  voice_id: string
  name: string
}

const DEFAULT_ELEVENLABS_VOICE_ID = "UgBBYS2sOqTuMpoF3BR0"

function formatVoiceName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    const voiceName = parts[0].trim();
    const desc = parts.slice(1).join("-").trim();
    const capitalizedDesc = desc
      .split(/\s+/)
      .map((word, index) => {
        const lowercaseWords = ["and", "or", "a", "an", "the", "of", "to", "for", "with", "in", "on", "at", "by", "from", "but", "as", "if"];
        const cleanWord = word.replace(/[^\w]/g, "");
        if (index > 0 && lowercaseWords.includes(cleanWord.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
    return `${voiceName} - ${capitalizedDesc}`;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const voiceName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const desc = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    return `${voiceName} - ${desc}`;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

interface ConnectorApiKeysSettingsProps {
  dialogOpen: boolean
}

async function readConfigFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await window.ipc.invoke("workspace:readFile", { path, encoding: "utf8" })
    if (!result?.data) return null
    return JSON.parse(result.data) as Record<string, unknown>
  } catch {
    return null
  }
}

async function writeConfigFile(path: string, data: Record<string, unknown>) {
  await window.ipc.invoke("workspace:writeFile", {
    path,
    data: `${JSON.stringify(data, null, 2)}\n`,
  })
}

function notifyConnectorsUpdated() {
  window.dispatchEvent(new Event("connectors:updated"))
}

export function ConnectorApiKeysSettings({ dialogOpen }: ConnectorApiKeysSettingsProps) {
  const [elevenLabsConfigured, setElevenLabsConfigured] = useState(false)
  const [elevenLabsInput, setElevenLabsInput] = useState("")
  const [elevenLabsSaving, setElevenLabsSaving] = useState(false)
  const [showElevenLabsInput, setShowElevenLabsInput] = useState(false)
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>(DEFAULT_ELEVENLABS_VOICE_ID)
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [elevenLabsVoicesLoading, setElevenLabsVoicesLoading] = useState(false)
  const [elevenLabsVoicesError, setElevenLabsVoicesError] = useState<string | null>(null)
  const [voiceSaving, setVoiceSaving] = useState(false)

  const [firecrawlConfigured, setFirecrawlConfigured] = useState(false)
  const [firecrawlInput, setFirecrawlInput] = useState("")
  const [firecrawlSaving, setFirecrawlSaving] = useState(false)
  const [showFirecrawlInput, setShowFirecrawlInput] = useState(false)

  const [elasticConfigured, setElasticConfigured] = useState(false)
  const [elasticKibanaUrl, setElasticKibanaUrl] = useState("")
  const [elasticApiKey, setElasticApiKey] = useState("")
  const [elasticSpace, setElasticSpace] = useState("default")
  const [elasticEnabled, setElasticEnabled] = useState(false)
  const [elasticSaving, setElasticSaving] = useState(false)
  const [showElasticInput, setShowElasticInput] = useState(false)

  const loadElevenLabsVoices = useCallback(async (apiKeyOverride?: string) => {
    setElevenLabsVoicesLoading(true)
    setElevenLabsVoicesError(null)
    try {
      const result = await window.ipc.invoke("elevenlabs:listVoices", apiKeyOverride ? { apiKey: apiKeyOverride } : null)
      const voices = Array.isArray(result?.voices) ? result.voices : []
      setElevenLabsVoices(voices)
      if (voices.length === 0) {
        const message = "No voices returned for this API key."
        setElevenLabsVoicesError(message)
        toast.error(message)
      }
      return voices as ElevenLabsVoice[]
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load ElevenLabs voices"
      setElevenLabsVoices([])
      setElevenLabsVoicesError(message)
      toast.error(message)
      return []
    } finally {
      setElevenLabsVoicesLoading(false)
    }
  }, [])

  const loadElevenLabs = useCallback(async () => {
    const config = await readConfigFile("config/elevenlabs.json")
    const apiKey = typeof config?.apiKey === "string" ? config.apiKey.trim() : ""
    const voiceId = typeof config?.voiceId === "string" && config.voiceId.trim()
      ? config.voiceId.trim()
      : DEFAULT_ELEVENLABS_VOICE_ID

    setElevenLabsConfigured(Boolean(apiKey))
    setElevenLabsVoiceId(voiceId)
    setShowElevenLabsInput(!apiKey)

    if (apiKey) {
      await loadElevenLabsVoices()
    } else {
      setElevenLabsVoices([])
    }
  }, [loadElevenLabsVoices])

  const loadFirecrawl = useCallback(async () => {
    const config = await readConfigFile("config/firecrawl.json")
    const apiKey = typeof config?.apiKey === "string" ? config.apiKey.trim() : ""
    setFirecrawlConfigured(Boolean(apiKey))
    setShowFirecrawlInput(!apiKey)
  }, [])

  const loadElastic = useCallback(async () => {
    const config = await readConfigFile("config/elastic.json")
    const kibanaUrl = typeof config?.kibanaUrl === "string" ? config.kibanaUrl.trim() : ""
    const apiKey = typeof config?.apiKey === "string" ? config.apiKey.trim() : ""
    const space = typeof config?.space === "string" ? config.space.trim() : "default"
    const enabled = typeof config?.enabled === "boolean" ? config.enabled : false

    setElasticKibanaUrl(kibanaUrl)
    setElasticApiKey(apiKey)
    setElasticSpace(space)
    setElasticEnabled(enabled)
    setElasticConfigured(Boolean(kibanaUrl && apiKey))
    setShowElasticInput(!kibanaUrl || !apiKey)
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    void loadElevenLabs()
    void loadFirecrawl()
    void loadElastic()
  }, [dialogOpen, loadElevenLabs, loadFirecrawl, loadElastic])

  const handleSaveElevenLabs = async () => {
    const trimmed = elevenLabsInput.trim()
    if (!trimmed) return

    setElevenLabsSaving(true)
    try {
      const existing = await readConfigFile("config/elevenlabs.json")
      const voiceId = typeof existing?.voiceId === "string" && existing.voiceId.trim()
        ? existing.voiceId.trim()
        : DEFAULT_ELEVENLABS_VOICE_ID

      await writeConfigFile("config/elevenlabs.json", {
        apiKey: trimmed,
        voiceId,
      })

      const voices = await loadElevenLabsVoices(trimmed)
      const resolvedVoiceId = voices.some((voice) => voice.voice_id === voiceId)
        ? voiceId
        : voices[0]?.voice_id ?? DEFAULT_ELEVENLABS_VOICE_ID

      if (resolvedVoiceId !== voiceId) {
        await writeConfigFile("config/elevenlabs.json", {
          apiKey: trimmed,
          voiceId: resolvedVoiceId,
        })
      }

      setElevenLabsConfigured(true)
      setElevenLabsVoiceId(resolvedVoiceId)
      setShowElevenLabsInput(false)
      setElevenLabsInput("")
      notifyConnectorsUpdated()
      toast.success("ElevenLabs API key saved")
    } catch {
      toast.error("Failed to save ElevenLabs API key")
    } finally {
      setElevenLabsSaving(false)
    }
  }

  const handleClearElevenLabs = async () => {
    setElevenLabsSaving(true)
    try {
      await writeConfigFile("config/elevenlabs.json", {})
      setElevenLabsConfigured(false)
      setShowElevenLabsInput(true)
      setElevenLabsInput("")
      setElevenLabsVoices([])
      setElevenLabsVoiceId(DEFAULT_ELEVENLABS_VOICE_ID)
      notifyConnectorsUpdated()
      toast.success("ElevenLabs disconnected")
    } catch {
      toast.error("Failed to remove ElevenLabs API key")
    } finally {
      setElevenLabsSaving(false)
    }
  }

  const handleVoiceChange = async (nextVoiceId: string) => {
    setElevenLabsVoiceId(nextVoiceId)
    setVoiceSaving(true)
    try {
      const existing = await readConfigFile("config/elevenlabs.json")
      const apiKey = typeof existing?.apiKey === "string" ? existing.apiKey : ""
      if (!apiKey) return

      await writeConfigFile("config/elevenlabs.json", {
        apiKey,
        voiceId: nextVoiceId,
      })
      notifyConnectorsUpdated()
      toast.success("Voice updated")
    } catch {
      toast.error("Failed to save voice selection")
    } finally {
      setVoiceSaving(false)
    }
  }

  const handleSaveFirecrawl = async () => {
    const trimmed = firecrawlInput.trim()
    if (!trimmed) return

    setFirecrawlSaving(true)
    try {
      await writeConfigFile("config/firecrawl.json", { apiKey: trimmed })
      setFirecrawlConfigured(true)
      setShowFirecrawlInput(false)
      setFirecrawlInput("")
      notifyConnectorsUpdated()
      toast.success("Firecrawl API key saved")
    } catch {
      toast.error("Failed to save Firecrawl API key")
    } finally {
      setFirecrawlSaving(false)
    }
  }

  const handleClearFirecrawl = async () => {
    setFirecrawlSaving(true)
    try {
      await writeConfigFile("config/firecrawl.json", {})
      setFirecrawlConfigured(false)
      setShowFirecrawlInput(true)
      setFirecrawlInput("")
      notifyConnectorsUpdated()
      toast.success("Firecrawl disconnected")
    } catch {
      toast.error("Failed to remove Firecrawl API key")
    } finally {
      setFirecrawlSaving(false)
    }
  }

  const handleSaveElastic = async () => {
    const kibanaUrlTrimmed = elasticKibanaUrl.trim()
    const apiKeyTrimmed = elasticApiKey.trim()
    const spaceTrimmed = elasticSpace.trim() || "default"

    if (!kibanaUrlTrimmed || !apiKeyTrimmed) {
      toast.error("Kibana URL and Elastic API Key are required")
      return
    }

    setElasticSaving(true)
    try {
      const existing = await readConfigFile("config/elastic.json")
      const existingIndices = Array.isArray(existing?.indices)
        ? existing.indices
        : ["jobraker-workspaces", "jobraker-knowledge", "jobraker-bases", "jobraker-graph", "jobraker-candidates", "jobraker-recruiting-*"]

      const newConfig = {
        ...existing,
        enabled: elasticEnabled,
        kibanaUrl: kibanaUrlTrimmed,
        apiKey: apiKeyTrimmed,
        space: spaceTrimmed,
        indices: existingIndices,
      }

      await writeConfigFile("config/elastic.json", newConfig)
      await window.ipc.invoke("mcp:resetServers", null)

      setElasticConfigured(true)
      setShowElasticInput(false)
      notifyConnectorsUpdated()
      toast.success("Elastic Search config saved")
    } catch {
      toast.error("Failed to save Elastic Search config")
    } finally {
      setElasticSaving(false)
    }
  }

  const handleToggleElastic = async (checked: boolean) => {
    setElasticEnabled(checked)
    if (elasticConfigured) {
      setElasticSaving(true)
      try {
        const existing = await readConfigFile("config/elastic.json")
        if (existing) {
          const newConfig = {
            ...existing,
            enabled: checked,
          }
          await writeConfigFile("config/elastic.json", newConfig)
          await window.ipc.invoke("mcp:resetServers", null)
          notifyConnectorsUpdated()
          toast.success(checked ? "Elastic Search enabled" : "Elastic Search disabled")
        }
      } catch {
        toast.error("Failed to update Elastic Search status")
      } finally {
        setElasticSaving(false)
      }
    }
  }

  const handleClearElastic = async () => {
    setElasticSaving(true)
    try {
      await writeConfigFile("config/elastic.json", {})
      await window.ipc.invoke("mcp:resetServers", null)
      setElasticConfigured(false)
      setShowElasticInput(true)
      setElasticKibanaUrl("")
      setElasticApiKey("")
      setElasticSpace("default")
      setElasticEnabled(false)
      notifyConnectorsUpdated()
      toast.success("Elastic Search disconnected")
    } catch {
      toast.error("Failed to remove Elastic Search config")
    } finally {
      setElasticSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ElevenLabs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Volume2 className="size-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            ElevenLabs
          </span>
        </div>

        {elevenLabsConfigured && !showElevenLabsInput ? (
          <div className="space-y-3 rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="size-4" />
                API key configured
              </div>
              <button
                type="button"
                onClick={() => setShowElevenLabsInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => { void handleClearElevenLabs() }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remove
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Voice</label>
              {elevenLabsVoicesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading voices...
                </div>
              ) : elevenLabsVoices.length > 0 ? (
                <Select
                  value={elevenLabsVoiceId}
                  onValueChange={(value) => { void handleVoiceChange(value) }}
                  disabled={voiceSaving}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsVoices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {formatVoiceName(voice.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {elevenLabsVoicesError ?? "No voices returned. Check your API key and try again."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { void loadElevenLabsVoices() }}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-3">
            <p className="text-xs text-muted-foreground">
              Powers voice input, meeting transcription (Scribe v2), and text-to-speech. Get your key from{" "}
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                elevenlabs.io
              </a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={elevenLabsInput}
                onChange={(e) => setElevenLabsInput(e.target.value)}
                placeholder="Paste your ElevenLabs API key"
                onKeyDown={(e) => e.key === "Enter" && void handleSaveElevenLabs()}
                className="flex-1"
              />
              <Button
                onClick={() => { void handleSaveElevenLabs() }}
                disabled={!elevenLabsInput.trim() || elevenLabsSaving}
                size="sm"
              >
                {elevenLabsSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
              {elevenLabsConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowElevenLabsInput(false)
                    setElevenLabsInput("")
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Firecrawl */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Globe className="size-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Firecrawl
          </span>
        </div>

        {firecrawlConfigured && !showFirecrawlInput ? (
          <div className="flex items-center gap-2 rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="size-4" />
              API key configured
            </div>
            <button
              type="button"
              onClick={() => setShowFirecrawlInput(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => { void handleClearFirecrawl() }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-3">
            <p className="text-xs text-muted-foreground">
              Powers web search and scrape tools in chat. Get your key from{" "}
              <a
                href="https://www.firecrawl.dev/app/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                firecrawl.dev
              </a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={firecrawlInput}
                onChange={(e) => setFirecrawlInput(e.target.value)}
                placeholder="Paste your Firecrawl API key"
                onKeyDown={(e) => e.key === "Enter" && void handleSaveFirecrawl()}
                className="flex-1"
              />
              <Button
                onClick={() => { void handleSaveFirecrawl() }}
                disabled={!firecrawlInput.trim() || firecrawlSaving}
                size="sm"
              >
                {firecrawlSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
              {firecrawlConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFirecrawlInput(false)
                    setFirecrawlInput("")
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Elastic Search */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-muted">
              <Search className="size-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Elastic Search
            </span>
          </div>
          {elasticConfigured && (
            <div className="flex items-center gap-2 pr-3">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch
                checked={elasticEnabled}
                onCheckedChange={handleToggleElastic}
                disabled={elasticSaving}
              />
            </div>
          )}
        </div>

        {elasticConfigured && !showElasticInput ? (
          <div className="space-y-3 rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="size-4" />
                Configured {elasticEnabled ? "and enabled" : "but disabled"}
              </div>
              <button
                type="button"
                onClick={() => setShowElasticInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => { void handleClearElastic() }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remove
              </button>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Kibana: <span className="font-mono">{elasticKibanaUrl}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-3">
            <p className="text-xs text-muted-foreground">
              Powers semantic search, filtering, and evidence-backed candidate retrieval.
            </p>
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Kibana URL</label>
                <Input
                  type="text"
                  value={elasticKibanaUrl}
                  onChange={(e) => setElasticKibanaUrl(e.target.value)}
                  placeholder="https://your-deployment.kb.your-region.elastic-cloud.com"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Elastic API Key</label>
                <Input
                  type="password"
                  value={elasticApiKey}
                  onChange={(e) => setElasticApiKey(e.target.value)}
                  placeholder="Paste your Elastic API key"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Kibana Space (Optional)</label>
                <Input
                  type="text"
                  value={elasticSpace}
                  onChange={(e) => setElasticSpace(e.target.value)}
                  placeholder="default"
                  className="h-9"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-muted-foreground">Enable integration</span>
                <Switch
                  checked={elasticEnabled}
                  onCheckedChange={setElasticEnabled}
                />
              </div>
              <div className="flex gap-2 justify-end">
                {elasticConfigured && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowElasticInput(false)
                      void loadElastic()
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={() => { void handleSaveElastic() }}
                  disabled={!elasticKibanaUrl.trim() || !elasticApiKey.trim() || elasticSaving}
                  size="sm"
                >
                  {elasticSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
