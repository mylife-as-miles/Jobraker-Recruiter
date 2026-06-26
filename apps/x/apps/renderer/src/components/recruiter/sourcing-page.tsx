import * as React from 'react'
import {
  Link,
  Loader2,
  Sparkles,
  UserPlus,
  Settings,
  Plus,
  Check,
  AlertCircle,
  FileText,
  Trash2,
  ExternalLink,
  Send,
  Linkedin,
  Globe,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type Candidate,
  type Role,
  type CandidateStage,
} from './data'
import {
  RecruiterHeader,
  useFakeLoading,
  ScoreRing,
} from './shared'
import { cn } from '@/lib/utils'
import { enrichLinkedInProfile, getApiKey } from './enrichment'
import type { EnrichmentProvider } from './enrichment'

type SourcingPageProps = {
  candidates: Candidate[]
  roles: Role[]
  onAddEnrichedCandidate: (candidate: Partial<Candidate>) => void
  onNavigateCandidates: (id: string) => void
  onAskCopilot?: (prompt: string) => void
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
  onOpenApiSettings: () => void
  onOpenQuickImport: () => void
}

type SourcedItem = {
  id: string
  url: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  error?: string
  enrichedData?: Partial<Candidate>
  importedId?: string
}

export function SourcingPage({
  roles,
  onAddEnrichedCandidate,
  onOpenSearch,
  onOpenChat,
  onTakeMeetingNotes,
  onOpenAgents,
  onOpenApiSettings,
  onOpenQuickImport,
}: SourcingPageProps) {
  const loading = useFakeLoading(500)
  const [urlsInput, setUrlsInput] = React.useState('')
  const [provider, setProvider] = React.useState<EnrichmentProvider>('pdl')
  const [sourcedItems, setSourcedItems] = React.useState<SourcedItem[]>([])
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null)
  const [isProcessingAll, setIsProcessingAll] = React.useState(false)
  
  // Sourcing defaults
  const [assignRoleId, setAssignRoleId] = React.useState<string>('none')
  const [initialStage, setInitialStage] = React.useState<CandidateStage>('New')

  // Tab selection: 'queue' or 'search'
  const [activeTab, setActiveTab] = React.useState<'queue' | 'search'>('queue')
  
  // Elastic Search AI state
  const [elasticConfig, setElasticConfig] = React.useState<{ enabled: boolean } | null>(null)
  const [elasticQuery, setElasticQuery] = React.useState('')
  const [elasticSearching, setElasticSearching] = React.useState(false)
  const [elasticResults, setElasticResults] = React.useState<any[]>([])
  const [elasticSearchError, setElasticSearchError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await window.ipc.invoke("workspace:readFile", { path: "config/elastic.json", encoding: "utf8" })
        if (res && res.data) {
          const config = JSON.parse(res.data)
          setElasticConfig({ enabled: !!config.enabled })
        } else {
          setElasticConfig({ enabled: false })
        }
      } catch (err) {
        setElasticConfig({ enabled: false })
      }
    }
    loadConfig()
    
    // Add event listener to reload configuration when updated
    const handleUpdate = () => {
      loadConfig()
    }
    window.addEventListener("connectors:updated", handleUpdate)
    return () => window.removeEventListener("connectors:updated", handleUpdate)
  }, [])

  const handleElasticSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!elasticQuery.trim()) {
      toast.error('Please enter a search query.')
      return
    }

    setElasticSearching(true)
    setElasticSearchError(null)
    setElasticResults([])

    try {
      const res = await window.ipc.invoke('search:query', {
        query: elasticQuery,
        limit: 20
      })
      
      if (res && Array.isArray(res.results)) {
        setElasticResults(res.results)
        if (res.results.length === 0) {
          toast.info('No results found for your query.')
        } else {
          toast.success(`Found ${res.results.length} results.`)
        }
      } else {
        setElasticResults([])
      }
    } catch (err: any) {
      setElasticSearchError(err.message || 'Elastic retrieval failed.')
      toast.error('Search failed. Check your connection or configuration.')
    } finally {
      setElasticSearching(false)
    }
  }

  const activeItem = React.useMemo(
    () => sourcedItems.find((item) => item.id === activeItemId) || null,
    [sourcedItems, activeItemId]
  )

  const activeEnrichedCandidate = activeItem?.enrichedData || null

  const handleClearAll = () => {
    setSourcedItems([])
    setActiveItemId(null)
    setUrlsInput('')
  }

  // Parse pasted URLs
  const handleLoadUrls = () => {
    if (!urlsInput.trim()) {
      toast.error('Please paste at least one LinkedIn URL.')
      return
    }

    const lines = urlsInput.split('\n')
    const newItems: SourcedItem[] = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      // Simple LinkedIn validation or general URL format
      if (trimmed.includes('linkedin.com/') || trimmed.startsWith('http')) {
        newItems.push({
          id: `sourced_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          url: trimmed,
          status: 'pending',
        })
      }
    })

    if (newItems.length === 0) {
      toast.error('No valid profile links found. Make sure they contain linkedin.com/')
      return
    }

    setSourcedItems((prev) => [...prev, ...newItems])
    setUrlsInput('')
    setActiveItemId(newItems[0].id)
    toast.success(`Loaded ${newItems.length} profile link(s) into queue.`)
  }

  // Enrich a single item
  const handleEnrichItem = async (itemId: string) => {
    setSourcedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: 'processing', error: undefined } : item))
    )

    const targetItem = sourcedItems.find((item) => item.id === itemId)
    if (!targetItem) return

    const res = await enrichLinkedInProfile(targetItem.url, provider)
    
    setSourcedItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            status: res.success ? 'success' : 'failed',
            enrichedData: res.success ? res.candidate : undefined,
            error: res.success ? undefined : res.error,
          }
        }
        return item
      })
    )

    return res.success
  }

  // Enrich all pending/failed items in sequence
  const handleEnrichAll = async () => {
    const itemsToProcess = sourcedItems.filter((item) => item.status === 'pending' || item.status === 'failed')
    if (itemsToProcess.length === 0) {
      toast.error('No pending or failed profiles in the queue to enrich.')
      return
    }

    setIsProcessingAll(true)
    let successCount = 0

    // Check if API key exists. If not, notify that it's running in Mock demo mode
    const hasKey = getApiKey(provider)
    if (!hasKey) {
      toast.info('No API key configured. Running in high-fidelity mock demo mode.', {
        description: 'Configure API keys in settings to use live profile data.',
        duration: 4000,
      })
    }

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i]
      // Set active item so user sees current progress
      setActiveItemId(item.id)
      
      const ok = await handleEnrichItem(item.id)
      if (ok) successCount++
      
      // Delay slightly between requests to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    setIsProcessingAll(false)
    toast.success(`Enrichment finished. Successfully enriched ${successCount}/${itemsToProcess.length} profiles.`)
  }

  // Import a single enriched candidate
  const handleImportItem = (itemId: string) => {
    const item = sourcedItems.find((item) => item.id === itemId)
    if (!item || item.status !== 'success' || !item.enrichedData) return

    // Apply sourcing defaults (assigned role, initial stage)
    const assignedRole = roles.find((r) => r.id === assignRoleId)
    const candData: Partial<Candidate> = {
      ...item.enrichedData,
      stage: initialStage,
      title: assignRoleId !== 'none' && assignedRole ? assignedRole.title : item.enrichedData.title,
    }

    onAddEnrichedCandidate(candData)

    // Find the candidate we just added to get their ID (which is timestamp based)
    // Wait, onAddEnrichedCandidate will add it. Since it happens synchronously in react state,
    // we can mark this item as imported.
    setSourcedItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, importedId: 'imported' } : it))
    )
  }

  // Import all successfully enriched items
  const handleImportAll = () => {
    const readyItems = sourcedItems.filter((item) => item.status === 'success' && !item.importedId)
    if (readyItems.length === 0) {
      toast.error('No enriched candidates ready to import.')
      return
    }

    let importCount = 0
    readyItems.forEach((item) => {
      if (item.enrichedData) {
        const assignedRole = roles.find((r) => r.id === assignRoleId)
        const candData: Partial<Candidate> = {
          ...item.enrichedData,
          stage: initialStage,
          title: assignRoleId !== 'none' && assignedRole ? assignedRole.title : item.enrichedData.title,
        }
        onAddEnrichedCandidate(candData)
        importCount++
      }
    })

    setSourcedItems((prev) =>
      prev.map((item) =>
        item.status === 'success' && !item.importedId ? { ...item, importedId: 'imported' } : item
      )
    )

    toast.success(`Successfully imported ${importCount} candidates to your list.`)
  }

  const handleRemoveFromQueue = (itemId: string) => {
    setSourcedItems((prev) => prev.filter((item) => item.id !== itemId))
    if (activeItemId === itemId) {
      const remaining = sourcedItems.filter((item) => item.id !== itemId)
      setActiveItemId(remaining[0]?.id || null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#050705]">
      <RecruiterHeader
        title="Candidate Sourcing"
        subtitle="Paste LinkedIn profile links, enrich with API intelligence, and save to recruiter candidate database."
        searchPlaceholder="Search sourcing queue..."
        onOpenSearch={onOpenSearch}
        onOpenChat={onOpenChat}
        onTakeMeetingNotes={onTakeMeetingNotes}
        onOpenAgents={onOpenAgents}
        rightExtra={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenQuickImport}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#09090b] px-3.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/80 hover:text-white cursor-pointer"
            >
              <Plus className="size-4 text-brand" />
              <span>Quick Import</span>
            </button>
            <button
              type="button"
              onClick={onOpenApiSettings}
              className="flex size-10 items-center justify-center rounded-xl border border-zinc-800 bg-[#09090b] text-zinc-400 transition hover:border-zinc-700 hover:text-white cursor-pointer"
              title="API Key Configuration"
            >
              <Settings className="size-4.5" />
            </button>
          </div>
        }
      />

      <div className="flex border-b border-zinc-900 bg-zinc-950/40 px-6 shrink-0">
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            "px-4 py-3 text-xs font-bold transition-all relative cursor-pointer border-b-2",
            activeTab === 'queue'
              ? "text-brand border-brand"
              : "text-zinc-400 border-transparent hover:text-white"
          )}
        >
          LinkedIn Queue
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={cn(
            "px-4 py-3 text-xs font-bold transition-all relative cursor-pointer border-b-2",
            activeTab === 'search'
              ? "text-brand border-brand"
              : "text-zinc-400 border-transparent hover:text-white"
          )}
        >
          Search AI (Elastic)
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-brand" />
        </div>
      ) : activeTab === 'queue' ? (
        <div className="grid flex-1 min-h-0 grid-cols-1 divide-y divide-zinc-900 border-t border-zinc-900 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          
          {/* Left panel - Queue Management & Import controls */}
          <div className="flex flex-col min-h-0 p-5 lg:col-span-4 bg-[#070907]/30">
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Bulk Paste LinkedIn Links
                </label>
                <div className="mt-1.5 relative">
                  <textarea
                    rows={4}
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    placeholder="https://www.linkedin.com/in/alex-smith&#10;https://www.linkedin.com/in/sarah-jones"
                    className="w-full rounded-xl border border-zinc-800 bg-black/60 p-3.5 text-xs text-white placeholder:text-zinc-600 outline-none transition focus:border-brand/40 resize-none font-mono"
                  />
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleLoadUrls}
                      className="rounded-lg bg-brand px-3 py-1.5 text-[10px] font-semibold text-black transition hover:brightness-110 cursor-pointer"
                    >
                      Load Queue
                    </button>
                  </div>
                </div>
              </div>

              {/* API Configuration & Sourcing Settings */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-brand" />
                  <span>Sourcing Settings</span>
                </h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Enrichment Service Provider</span>
                    <div className="mt-1 flex rounded-lg border border-zinc-800 p-0.5 bg-black/40">
                      <button
                        type="button"
                        onClick={() => setProvider('pdl')}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[10px] font-bold transition-all cursor-pointer",
                          provider === 'pdl'
                            ? "bg-brand text-black"
                            : "text-zinc-400 hover:text-white"
                        )}
                      >
                        People Data Labs (PDL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setProvider('enrich.so')}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[10px] font-bold transition-all cursor-pointer",
                          provider === 'enrich.so'
                            ? "bg-brand text-black"
                            : "text-zinc-400 hover:text-white"
                        )}
                      >
                        Enrich.so
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Target Role</span>
                      <select
                        value={assignRoleId}
                        onChange={(e) => setAssignRoleId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 px-2 py-1.5 text-[10px] text-zinc-300 outline-none transition focus:border-brand/40"
                      >
                        <option value="none">Auto-detect from profile</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Initial Pipeline Stage</span>
                      <select
                        value={initialStage}
                        onChange={(e) => setInitialStage(e.target.value as CandidateStage)}
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 px-2 py-1.5 text-[10px] text-zinc-300 outline-none transition focus:border-brand/40"
                      >
                        <option value="New">Sourced (New)</option>
                        <option value="Screening">Screening</option>
                        <option value="In Review">In Review</option>
                        <option value="Shortlisted">Shortlisted</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sourced Queue List */}
            <div className="flex-1 min-h-0 flex flex-col mt-6 border-t border-zinc-900 pt-4">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Queue List</span>
                  {sourcedItems.length > 0 && (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-semibold text-zinc-400">
                      {sourcedItems.length}
                    </span>
                  )}
                </div>
                {sourcedItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      disabled={isProcessingAll}
                      className="text-[10px] text-zinc-500 hover:text-red-400 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      <span>Clear Queue</span>
                    </button>
                  </div>
                )}
              </div>

              {sourcedItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-900 bg-black/20 p-8 text-center">
                  <Link className="size-6 text-zinc-700 animate-pulse" />
                  <span className="mt-2 text-xs font-semibold text-zinc-500">Queue is empty</span>
                  <span className="mt-1 text-[10px] text-zinc-600 max-w-[200px]">
                    Paste profile links and load them to start.
                  </span>
                </div>
              ) : (
                <div className="flex flex-1 flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto recruiter-scroll space-y-2 pr-1 pb-4">
                    {sourcedItems.map((item, idx) => {
                      const isActive = activeItemId === item.id
                      const isProcessing = item.status === 'processing'
                      const isSuccess = item.status === 'success'
                      const isFailed = item.status === 'failed'

                      return (
                        <div
                          key={item.id}
                          onClick={() => !isProcessingAll && setActiveItemId(item.id)}
                          className={cn(
                            "group flex items-center justify-between rounded-xl border p-3.5 transition-all",
                            isActive
                              ? "border-brand bg-brand/5 shadow-md shadow-brand/2"
                              : "border-zinc-800 bg-zinc-950/20 hover:border-zinc-700",
                            isProcessingAll ? "cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2.5">
                            <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium text-white block truncate">
                                {item.enrichedData?.name || item.url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')}
                              </span>
                              <span className="text-[10px] text-zinc-500 block truncate font-mono mt-0.5">
                                {item.url}
                              </span>
                            </div>
                          </div>

                          <div className="ml-3 shrink-0 flex items-center gap-2">
                            {isProcessing && (
                              <Loader2 className="size-3.5 animate-spin text-brand" />
                            )}
                            {isSuccess && !item.importedId && (
                              <span className="rounded-full bg-brand/10 border border-brand/20 p-0.5 text-brand" title="Enriched Successfully">
                                <Check className="size-3" />
                              </span>
                            )}
                            {isSuccess && item.importedId && (
                              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">
                                Imported
                              </span>
                            )}
                            {isFailed && (
                              <span className="rounded-full bg-red-500/10 border border-red-500/20 p-0.5 text-red-400" title={item.error || 'Failed to enrich'}>
                                <AlertCircle className="size-3" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveFromQueue(item.id)
                              }}
                              disabled={isProcessing || isProcessingAll}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-all disabled:opacity-0"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Batch Enrichment Actions */}
                  <div className="border-t border-zinc-900 pt-4 mt-auto flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleEnrichAll}
                      disabled={isProcessingAll || sourcedItems.filter((i) => i.status === 'pending' || i.status === 'failed').length === 0}
                      className="w-full flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isProcessingAll ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Enriching Profile Queue...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          <span>Enrich All Profile Queue</span>
                        </>
                      )}
                    </button>
                    {sourcedItems.filter((i) => i.status === 'success' && !i.importedId).length > 0 && (
                      <button
                        type="button"
                        onClick={handleImportAll}
                        className="w-full flex h-10 items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand/10 text-xs font-semibold text-brand hover:bg-brand/20 transition cursor-pointer"
                      >
                        <UserPlus className="size-4" />
                        <span>Import All Enriched ({sourcedItems.filter((i) => i.status === 'success' && !i.importedId).length})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Enrichment Detailed View */}
          <div className="flex flex-col min-h-0 lg:col-span-8 bg-[#030403]">
            {activeItem ? (
              <div className="flex flex-1 min-h-0 flex-col">
                {/* Header status bar */}
                <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950/20 px-6 py-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Linkedin className="size-4 text-brand shrink-0" />
                    <span className="text-xs text-zinc-400 font-mono truncate">{activeItem.url}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {activeItem.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleEnrichItem(activeItem.id)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-brand bg-brand/10 px-3 text-xs font-semibold text-brand hover:bg-brand/20 transition cursor-pointer"
                      >
                        <Sparkles className="size-3.5" />
                        <span>Enrich Profile</span>
                      </button>
                    )}

                    {activeItem.status === 'success' && !activeItem.importedId && (
                      <button
                        type="button"
                        onClick={() => handleImportItem(activeItem.id)}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                      >
                        <UserPlus className="size-3.5" />
                        <span>Add to Candidates</span>
                      </button>
                    )}

                    {activeItem.status === 'success' && activeItem.importedId && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                        <Check className="size-3.5" />
                        <span>Imported Successfully</span>
                      </div>
                    )}

                    {activeItem.status === 'failed' && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-red-400 flex items-center gap-1 font-medium bg-red-500/15 border border-red-500/30 rounded-lg px-2.5 py-1.5">
                          <AlertCircle className="size-3.5" />
                          <span>Enrichment Failed</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnrichItem(activeItem.id)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#09090b] px-3 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main View Area */}
                <div className="flex-1 overflow-y-auto recruiter-scroll p-6">
                  {activeItem.status === 'pending' && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="relative">
                        <div className="absolute inset-0 -m-3 animate-ping rounded-full bg-brand/5" />
                        <Sparkles className="size-10 text-brand/60" />
                      </div>
                      <h3 className="mt-4 text-sm font-bold text-white tracking-tight">Profile Enrichment Pending</h3>
                      <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                        Configure keys or click "Enrich Profile" to fetch details. If no keys are set, it will run in a demo-mode mockup using realistic candidate generation.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleEnrichItem(activeItem.id)}
                        className="mt-5 flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                      >
                        <Sparkles className="size-4" />
                        <span>Enrich Profile Now</span>
                      </button>
                    </div>
                  )}

                  {activeItem.status === 'processing' && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 -m-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand" style={{ animationDuration: '1.5s' }} />
                        <Linkedin className="size-8 text-brand animate-pulse" />
                      </div>
                      <h3 className="mt-4 text-sm font-bold text-white tracking-tight">Connecting to Enrichment APIs...</h3>
                      <p className="mt-1 text-xs text-zinc-500 font-mono truncate max-w-sm">
                        Querying {provider === 'pdl' ? 'People Data Labs' : 'Enrich.so'} for profile metadata...
                      </p>
                    </div>
                  )}

                  {activeItem.status === 'failed' && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <AlertCircle className="size-10 text-red-500" />
                      <h3 className="mt-4 text-sm font-bold text-white tracking-tight">Enrichment Missed</h3>
                      <p className="mt-2 text-xs text-zinc-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 max-w-md font-mono text-left">
                        {activeItem.error || 'The profile was not found or could not be scraped due to rate limits or invalid keys.'}
                      </p>
                      <div className="mt-5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleEnrichItem(activeItem.id)}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                        >
                          Retry Enrichment
                        </button>
                        <button
                          type="button"
                          onClick={onOpenApiSettings}
                          className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#09090b] px-3.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/80 cursor-pointer"
                        >
                          <Settings className="size-4 text-zinc-400" />
                          <span>Configure API Keys</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeItem.status === 'success' && activeEnrichedCandidate && (
                    <div className="space-y-6">
                      {/* Enriched Profile Header */}
                      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-900 bg-zinc-950/20 p-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          {activeEnrichedCandidate.photoUrl ? (
                            <img
                              src={activeEnrichedCandidate.photoUrl}
                              alt={activeEnrichedCandidate.name}
                              className="size-16 rounded-xl object-cover border border-zinc-800"
                            />
                          ) : (
                            <div className="size-16 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-600 text-2xl font-bold">
                              {activeEnrichedCandidate.name ? activeEnrichedCandidate.name.charAt(0) : 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                              <span>{activeEnrichedCandidate.name}</span>
                              <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[9px] font-bold text-brand flex items-center gap-1">
                                <Linkedin className="size-2.5" />
                                <span>Enriched</span>
                              </span>
                            </h2>
                            <p className="text-xs text-zinc-400 font-medium mt-0.5 leading-relaxed">
                              {activeEnrichedCandidate.headline || activeEnrichedCandidate.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px] text-zinc-500 mt-2">
                              <span>📍 {activeEnrichedCandidate.location}</span>
                              <span>•</span>
                              <span>💼 {activeEnrichedCandidate.experienceYears} Years Exp</span>
                              <span>•</span>
                              <span>✉️ {activeEnrichedCandidate.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Fit Scores */}
                        <div className="flex items-center gap-4 shrink-0 sm:self-center">
                          <div className="flex flex-col items-center">
                            <ScoreRing score={activeEnrichedCandidate.matchScore ?? 85} size={48} />
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Match Score</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <ScoreRing score={activeEnrichedCandidate.startupFitScore ?? 80} size={48} />
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Startup Fit</span>
                          </div>
                        </div>
                      </div>

                      {/* Content Columns */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Center Column - Bio & Experience */}
                        <div className="md:col-span-8 space-y-6">
                          {/* Summary */}
                          {activeEnrichedCandidate.summary && (
                            <div className="rounded-xl border border-zinc-900 bg-zinc-950/10 p-4">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Summary</h4>
                              <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                                {activeEnrichedCandidate.summary}
                              </p>
                            </div>
                          )}

                          {/* Work Experience */}
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                              <FileText className="size-4 text-brand" />
                              <span>Work History</span>
                            </h4>
                            <div className="relative border-l border-zinc-800 pl-4 space-y-5 ml-2">
                              {activeEnrichedCandidate.experience?.map((exp, idx) => (
                                <div key={idx} className="relative group">
                                  {/* Bullet point */}
                                  <div className={cn(
                                    "absolute -left-[21.5px] top-1 size-3.5 rounded-full border-2 bg-[#050705] transition",
                                    exp.isCurrent
                                      ? "border-brand shadow-sm shadow-brand/4"
                                      : "border-zinc-800"
                                  )} />
                                  
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white">{exp.title}</span>
                                      {exp.isCurrent && (
                                        <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[8px] font-bold text-brand uppercase">
                                          Current
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                                      {exp.company}
                                    </span>
                                    <span className="text-[9px] text-zinc-600 block mt-1 font-mono">
                                      {exp.startDate} {exp.endDate ? `— ${exp.endDate}` : '— Present'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {(!activeEnrichedCandidate.experience || activeEnrichedCandidate.experience.length === 0) && (
                                <div className="text-xs text-zinc-500 italic pl-1">No experience details enriched.</div>
                              )}
                            </div>
                          </div>

                          {/* Education */}
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                              <Globe className="size-4 text-brand" />
                              <span>Education</span>
                            </h4>
                            <div className="space-y-3 pl-1">
                              {activeEnrichedCandidate.education?.map((edu, idx) => (
                                <div key={idx} className="rounded-xl border border-zinc-900 bg-zinc-950/10 p-3.5 flex items-start gap-3">
                                  <div className="size-8 rounded-lg bg-zinc-900 flex items-center justify-center font-bold text-zinc-400 text-xs shrink-0">
                                    🎓
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-white block truncate">{edu.school}</span>
                                    <span className="text-[10px] text-zinc-400 block mt-0.5 leading-normal">
                                      {edu.degree} {edu.field ? `in ${edu.field}` : ''}
                                    </span>
                                    {edu.startYear && (
                                      <span className="text-[9px] text-zinc-600 block mt-1 font-mono">
                                        {edu.startYear} — {edu.endYear || 'Present'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {(!activeEnrichedCandidate.education || activeEnrichedCandidate.education.length === 0) && (
                                <div className="text-xs text-zinc-500 italic">No education details enriched.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Column - Skills & Insights */}
                        <div className="md:col-span-4 space-y-6">
                          {/* AI Fit Insight */}
                          <div className="rounded-xl border border-brand/15 bg-brand/3 p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1.5 flex items-center gap-1.5">
                              <Sparkles className="size-3.5" />
                              <span>AI Sourcing Insight</span>
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                              {activeEnrichedCandidate.aiInsight}
                            </p>
                          </div>

                          {/* Contact Details */}
                          <div className="rounded-xl border border-zinc-900 bg-zinc-950/10 p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Enriched Contacts</h4>
                            <div className="space-y-2.5 text-xs">
                              {activeEnrichedCandidate.emails?.map((mail, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-1.5 font-mono text-[10.5px]">
                                  <span className="text-zinc-400 truncate">{mail}</span>
                                  <span className="shrink-0 text-[8px] bg-zinc-800 px-1 py-0.2 rounded text-zinc-400">email</span>
                                </div>
                              ))}
                              {activeEnrichedCandidate.phones?.map((phone, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-1.5 font-mono text-[10.5px]">
                                  <span className="text-zinc-400">{phone}</span>
                                  <span className="shrink-0 text-[8px] bg-zinc-800 px-1 py-0.2 rounded text-zinc-400">phone</span>
                                </div>
                              ))}
                              {activeEnrichedCandidate.socialProfiles && Object.entries(activeEnrichedCandidate.socialProfiles).map(([soc, path], idx) => (
                                <a
                                  key={idx}
                                  href={path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between text-zinc-400 hover:text-brand transition font-mono text-[10.5px]"
                                >
                                  <span className="capitalize">{soc} Profile</span>
                                  <ExternalLink className="size-3" />
                                </a>
                              ))}
                              {(!activeEnrichedCandidate.emails || activeEnrichedCandidate.emails.length === 0) &&
                               (!activeEnrichedCandidate.phones || activeEnrichedCandidate.phones.length === 0) && (
                                <div className="text-[10px] text-zinc-600 italic">No direct contact details found.</div>
                              )}
                            </div>
                          </div>

                          {/* Skills badges */}
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Skills ({activeEnrichedCandidate.skills?.length || 0})</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {activeEnrichedCandidate.skills?.map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg border border-zinc-900 bg-zinc-950/20 px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:border-brand/20 transition-all duration-200"
                                >
                                  {skill}
                                </span>
                              ))}
                              {(!activeEnrichedCandidate.skills || activeEnrichedCandidate.skills.length === 0) && (
                                <div className="text-xs text-zinc-500 italic">No skills listed.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#050705]/10">
                <Linkedin className="size-12 text-zinc-800 animate-pulse mb-3" />
                <h3 className="text-sm font-bold text-white tracking-tight">No LinkedIn Profile Selected</h3>
                <p className="mt-1.5 text-xs text-zinc-500 max-w-sm">
                  Click a candidate URL in your queue to inspect its enrichment details, or load new URLs into the queue.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenQuickImport}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                  >
                    <Plus className="size-4" />
                    <span>Quick Import Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenApiSettings}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#09090b] px-3.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/80 cursor-pointer"
                  >
                    <span>Configure Sourcing APIs</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Elastic Search AI view */
        <div className="flex-1 min-h-0 flex flex-col p-6 max-w-5xl mx-auto w-full">
          {!elasticConfig ? (
            <div className="flex-grow flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : !elasticConfig.enabled ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="relative mb-4">
                <div className="absolute inset-0 -m-4 animate-ping rounded-full bg-brand/5" />
                <Sparkles className="size-12 text-brand/60" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Elastic Search AI Disabled</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Unlock semantic search across your entire workspace, knowledge base, candidate pool, and recruiting graphs using the Elastic Search AI Platform.
              </p>
              <button
                type="button"
                onClick={onOpenApiSettings}
                className="mt-6 flex h-10 items-center gap-1.5 rounded-xl bg-brand px-5 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
              >
                <Settings className="size-4" />
                <span>Configure & Enable Elastic</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Search input */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-white tracking-tight mb-2">Search AI Sourcing Pool</h3>
                <form onSubmit={handleElasticSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={elasticQuery}
                      onChange={(e) => setElasticQuery(e.target.value)}
                      placeholder="Search candidates semantically (e.g., 'VP of Engineering with Golang and startup scale experience')"
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-800 bg-black/60 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-brand/40 transition"
                    />
                    <Sparkles className="absolute left-3.5 top-3.5 size-4 text-zinc-600" />
                  </div>
                  <button
                    type="submit"
                    disabled={elasticSearching}
                    className="h-10 px-5 rounded-xl bg-brand text-xs font-bold text-black hover:brightness-110 transition disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    {elasticSearching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Error state */}
              {elasticSearchError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-4 text-xs text-red-400">
                  {elasticSearchError}
                </div>
              )}

              {/* Results list */}
              <div className="flex-1 min-h-0 overflow-y-auto recruiter-scroll space-y-3 pb-6">
                {elasticSearching ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <Loader2 className="size-8 animate-spin text-brand mb-3" />
                    <span className="text-xs text-zinc-500">Querying Elastic Search AI Platform...</span>
                  </div>
                ) : elasticResults.length > 0 ? (
                  elasticResults.map((item, idx) => (
                    <ElasticResultCard
                      key={idx}
                      item={item}
                      onAdd={onAddEnrichedCandidate}
                    />
                  ))
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed border-zinc-900 rounded-2xl bg-black/10">
                    <Globe className="size-8 text-zinc-700 animate-pulse mb-3" />
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Semantic Candidate Query</h4>
                    <p className="mt-1 text-xs text-zinc-600 max-w-xs leading-relaxed">
                      Type a natural language prompt to perform a vector-based semantic retrieval across your indexed records.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ElasticResultCard({
  item,
  onAdd,
}: {
  item: any
  onAdd: (c: Partial<Candidate>) => void
}) {
  const [importing, setImporting] = React.useState(false)
  const [imported, setImported] = React.useState(false)

  const handleImport = async (enhance: boolean) => {
    setImporting(true)
    try {
      if (enhance) {
        toast.info('AI is structuring the profile from search context...')
        const systemPrompt = "You are a professional recruiting assistant. Extract the candidate profile details from the search result and return it as a clean JSON object."
        const prompt = `Convert the following search result into a candidate profile.
Title: ${item.title}
Snippet: ${item.preview}

Generate a JSON object matching this schema:
{
  "name": "Candidate Name",
  "title": "Job Title",
  "location": "City, Country",
  "experienceYears": 5,
  "skills": ["Skill1", "Skill2"],
  "highlights": ["Achievement1", "Achievement2"],
  "aiInsight": "A summary of why this person fits and their background.",
  "email": "email@example.com",
  "companyStages": ["Series A", "Series B"],
  "growthTrajectory": "Fast",
  "vestingStatus": "Unvested",
  "intentSignal": "Passive",
  "startupFitScore": 85,
  "startupFitInsight": "Insight about startup culture compatibility."
}

Return ONLY raw JSON, no markdown formatting.`

        const res = await window.ipc.invoke('recruiter:generateLlm', { systemPrompt, prompt })
        if (res && res.text) {
          let cleanJson = res.text.trim()
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim()
          }
          const candidateData = JSON.parse(cleanJson)
          onAdd(candidateData)
          setImported(true)
          toast.success(`Enhanced and imported ${candidateData.name || item.title} successfully!`)
        } else {
          throw new Error('No text generated')
        }
      } else {
        const candidateData: Partial<Candidate> = {
          name: item.title,
          title: "Sourced Candidate",
          note: `Imported from Elastic Search AI result. Snippet: ${item.preview}`,
          source: 'Quick Import',
          skills: ['Sourced'],
          highlights: [item.preview.slice(0, 100)],
          aiInsight: 'Imported from search results index.',
        }
        onAdd(candidateData)
        setImported(true)
        toast.success(`Imported ${item.title} to candidates!`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to import: ' + (err.message || err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0c0d0d]/30 hover:border-zinc-700/60 p-4 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-white tracking-tight truncate">
            {item.title}
          </h4>
          <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-500 capitalize">
            {item.type}
          </span>
        </div>
        <p className="text-xs text-zinc-400 font-normal leading-relaxed break-words line-clamp-3">
          {item.preview}
        </p>
      </div>

      <div className="shrink-0 flex md:flex-col items-center gap-2 self-end md:self-start">
        {imported ? (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
            <Check className="size-3.5" />
            <span>Imported</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleImport(false)}
              disabled={importing}
              className="flex h-8 items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-zinc-900 transition disabled:opacity-50 cursor-pointer"
            >
              <span>Quick Import</span>
            </button>
            <button
              onClick={() => handleImport(true)}
              disabled={importing}
              className="flex h-8 items-center justify-center gap-1 rounded-lg bg-brand px-3 text-[10px] font-bold text-black hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="size-3 text-black" />
              <span>AI Import</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
