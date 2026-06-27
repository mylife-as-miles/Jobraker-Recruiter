import * as React from 'react'
import { toast } from 'sonner'
import {
  Briefcase,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Sparkles,
  Trophy,
  UserPlus,
  Send,
  Users,
  Calendar,
  Gift,
  CheckCircle2,
  Plus,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  PIPELINE_INSIGHTS,
  PIPELINE_ROLE_OPTIONS,
  PIPELINE_STAGES,
  type Candidate,
  type CandidateStage,
  type PipelineStage,
} from './data'
import {
  Avatar,
  EmptyState,
  RecruiterHeader,
  Reveal,
  ScoreRing,
  Skeleton,
  SkeletonCard,
  useFakeLoading,
  Delta,
  SectionCard,
} from './shared'
import { cn } from '@/lib/utils'

const STAGE_ICONS: Record<PipelineStage, React.ReactNode> = {
  Sourced: <UserPlus className="size-4" />,
  Contacted: <Send className="size-4" />,
  Screening: <Users className="size-4" />,
  Interview: <Calendar className="size-4" />,
  Offer: <Gift className="size-4" />,
  Hired: <CheckCircle2 className="size-4" />,
}

const STAGE_DOT: Record<PipelineStage, string> = {
  Sourced: 'bg-sky-400',
  Contacted: 'bg-cyan-400',
  Screening: 'bg-amber-400',
  Interview: 'bg-violet-400',
  Offer: 'bg-orange-400',
  Hired: 'bg-brand',
}

type PipelinePageProps = {
  candidatesList: Candidate[]
  onAskCopilot?: (prompt: string) => void
  onNavigateCandidates?: (candidateId?: string) => void
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
  onOpenEmail?: (threadId?: string) => void
  onOpenMeetings?: () => void
  onStageChange: (id: string, stage: CandidateStage) => void
  onAddCandidateAtStage: (stage: CandidateStage) => void
  onOpenOutreachModal: (c: Candidate) => void
  onOpenScheduleModal: (c: Candidate) => void
}

export function PipelinePage({
  candidatesList,
  onAskCopilot,
  onNavigateCandidates,
  onOpenSearch,
  onOpenChat,
  onTakeMeetingNotes,
  onOpenAgents,
  onOpenMeetings,
  onStageChange,
  onAddCandidateAtStage,
  onOpenOutreachModal,
  onOpenScheduleModal,
}: PipelinePageProps) {
  const loading = useFakeLoading(700)
  const [search, setSearch] = React.useState('')
  const [role, setRole] = React.useState(PIPELINE_ROLE_OPTIONS[0])
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overStage, setOverStage] = React.useState<PipelineStage | null>(null)
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null)

  // Construct board dynamically from candidatesList
  const board = React.useMemo(() => {
    const columns: Record<PipelineStage, string[]> = {
      Sourced: [],
      Contacted: [],
      Screening: [],
      Interview: [],
      Offer: [],
      Hired: [],
    }

    candidatesList.forEach((c) => {
      // Filter by active role (title matches selected role option)
      if (role && c.title !== role) return

      if (c.stage === 'New' || c.stage === 'Shortlisted') {
        columns.Sourced.push(c.id)
      } else if (c.stage === 'In Review') {
        columns.Contacted.push(c.id)
      } else if (c.stage === 'Screening') {
        columns.Screening.push(c.id)
      } else if (c.stage === 'Interview') {
        columns.Interview.push(c.id)
      } else if (c.stage === 'Offer') {
        columns.Offer.push(c.id)
      } else if (c.stage === 'Hired') {
        columns.Hired.push(c.id)
      }
    })

    return columns
  }, [candidatesList, role])

  const conversionRate = React.useMemo(() => {
    const sourced = board.Sourced?.length ?? 0
    const hired = board.Hired?.length ?? 0
    if (sourced === 0) return 0
    return Math.round((hired / sourced) * 1000) / 10
  }, [board])

  const dynamicDelta = React.useMemo(() => {
    const deltas = {} as Record<PipelineStage, number>
    PIPELINE_STAGES.forEach((stage) => {
      const currentCount = board[stage]?.length ?? 0
      const hash = stage.charCodeAt(0) + stage.charCodeAt(stage.length - 1)
      const baseDelta = (hash % 15) - 5 // deterministic -5% to +9%
      deltas[stage] = currentCount > 0 ? (baseDelta === 0 ? 4 : baseDelta) : -2
    })
    return deltas
  }, [board])

  const sparklinePoints = React.useMemo(() => {
    const counts = PIPELINE_STAGES.map((s) => board[s]?.length ?? 0)
    const max = Math.max(...counts, 1)
    return PIPELINE_STAGES.map((_, i) => {
      const x = i * 20
      const pct = counts[i] / max
      const y = 35 - pct * 30 // scale between 5 and 35
      return `${x},${y}`
    }).join(' ')
  }, [board])

  const moveCard = (candidateId: string, toStage: PipelineStage) => {
    let targetCandidateStage: CandidateStage = 'New'
    if (toStage === 'Sourced') targetCandidateStage = 'New'
    else if (toStage === 'Contacted') targetCandidateStage = 'In Review'
    else if (toStage === 'Screening') targetCandidateStage = 'Screening'
    else if (toStage === 'Interview') targetCandidateStage = 'Interview'
    else if (toStage === 'Offer') targetCandidateStage = 'Offer'
    else if (toStage === 'Hired') targetCandidateStage = 'Hired'

    onStageChange(candidateId, targetCandidateStage)
    
    const c = candidatesList.find((cand) => cand.id === candidateId)
    toast.success(`Moved ${c?.name ?? 'Candidate'} to ${toStage}`)
  }

  const filteredBoard = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return board
    const result = {} as Record<PipelineStage, string[]>
    for (const stage of PIPELINE_STAGES) {
      result[stage] = board[stage].filter((id) => {
        const c = candidatesList.find((cand) => cand.id === id)
        return c && (c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.skills.some(s => s.toLowerCase().includes(q)))
      })
    }
    return result
  }, [board, search, candidatesList])

  // Recommended outreach candidate
  const outreachCandidate = React.useMemo(() => {
    return candidatesList.find(c => c.stage === 'New' || c.stage === 'Shortlisted') ?? candidatesList[0]
  }, [candidatesList])

  if (loading) {
    return (
      <div className="recruiter-scroll flex h-full flex-col overflow-auto">
        <div className="px-6 pt-6"><Skeleton className="h-8 w-40" /></div>
        <div className="grid grid-cols-3 gap-3 px-6 py-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="!p-3" />)}
        </div>
        <Skeleton className="mx-6 h-80 rounded-2xl" />
      </div>
    )
  }

  if (candidatesList.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <RecruiterHeader
          title="Pipeline"
          subtitle="Visualize and manage your candidate flow."
          searchPlaceholder="Search candidates..."
          onOpenSearch={onOpenSearch}
          onOpenChat={onOpenChat}
          onTakeMeetingNotes={onTakeMeetingNotes}
          onOpenAgents={onOpenAgents}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<Trophy className="size-6" />}
            title="No candidates in pipeline"
            body="Add candidates to job roles to see them in your kanban board and track their progress."
            action={
              <button
                type="button"
                onClick={() => onNavigateCandidates?.()}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
              >
                <span>Go to Candidates</span>
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const totalCards = PIPELINE_STAGES.reduce((n, s) => n + (filteredBoard[s]?.length ?? 0), 0)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <RecruiterHeader
        title="Pipeline"
        subtitle="Visualize and manage your candidate flow."
        searchPlaceholder="Search candidates, roles, or notes"
        searchValue={search}
        onSearchChange={setSearch}
        onOpenSearch={onOpenSearch}
        onOpenChat={onOpenChat}
        onTakeMeetingNotes={onTakeMeetingNotes}
        onOpenAgents={onOpenAgents}
        rightExtra={
          <div className="relative">
            <Briefcase className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 appearance-none rounded-xl border border-border/60 bg-foreground/5 pl-9 pr-8 text-sm text-foreground outline-none focus:border-brand/40 text-white cursor-pointer"
            >
              {PIPELINE_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-[#09090b]">{r}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        }
      />

      {/* Stage metrics */}
      <div className="grid grid-cols-2 gap-2 px-6 lg:grid-cols-6">
        {PIPELINE_STAGES.map((stage, i) => (
          <Reveal key={stage} delay={i * 0.04}>
            <div className="recruiter-kpi recruiter-card rounded-xl border border-border/50 p-3 bg-[#050705]/20">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
                  {STAGE_ICONS[stage]}
                </span>
                <span className="text-xl font-bold tabular-nums">{board[stage]?.length ?? 0}</span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">{stage}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Delta value={dynamicDelta[stage]} suffix="%" />
                vs last 7 days
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 gap-4 px-6 pb-4">
        {/* Kanban */}
        <div className="recruiter-scroll min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {totalCards === 0 ? (
            <EmptyState
              icon={<Trophy className="size-6" />}
              title="Pipeline is empty"
              body="Add candidates or clear your search to see the kanban board."
              action={
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="flex h-full min-w-max gap-3 pb-2">
              {PIPELINE_STAGES.map((stage) => {
                const ids = filteredBoard[stage] ?? []
                return (
                  <div
                    key={stage}
                    data-over={overStage === stage}
                    className="recruiter-kanban-col flex w-[240px] shrink-0 flex-col rounded-2xl border border-border/50 bg-foreground/[0.02] p-2 transition-colors"
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOverStage(stage)
                    }}
                    onDragLeave={() => setOverStage(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const id = e.dataTransfer.getData('text/candidate-id')
                      if (id) moveCard(id, stage)
                      setDragId(null)
                      setOverStage(null)
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className={cn('size-2 rounded-full', STAGE_DOT[stage])} />
                      <span className="text-xs font-semibold text-foreground">{stage}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{ids.length}</span>
                    </div>
                    <div className="recruiter-scroll flex flex-1 flex-col gap-2 overflow-y-auto">
                      {ids.map((id) => {
                        const c = candidatesList.find((cand) => cand.id === id)
                        if (!c) return null
                        return (
                          <div
                            key={id}
                            draggable
                            data-dragging={dragId === id}
                            className="recruiter-kanban-card cursor-grab rounded-xl border border-border/50 bg-[#09090b]/80 p-3 active:cursor-grabbing"
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/candidate-id', id)
                              setDragId(id)
                            }}
                            onDragEnd={() => {
                              setDragId(null)
                              setOverStage(null)
                            }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div
                                onClick={() => onNavigateCandidates?.(c.id)}
                                className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-[#4dff18] transition-colors"
                              >
                                <div className="relative shrink-0">
                                  <Avatar name={c.name} size={28} />
                                  {c.intentSignal !== 'Passive' && (
                                    <span className="absolute -bottom-0.5 -right-0.5 flex size-1.5">
                                      <span className={cn(
                                        "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                                        c.intentSignal === 'Actively Sourcing' ? 'bg-emerald-500' :
                                        c.intentSignal === 'Recently Promoted' ? 'bg-amber-500' : 'bg-sky-500'
                                      )} />
                                      <span className={cn(
                                        "relative inline-flex size-1.5 rounded-full",
                                        c.intentSignal === 'Actively Sourcing' ? 'bg-emerald-500' :
                                        c.intentSignal === 'Recently Promoted' ? 'bg-amber-500' : 'bg-sky-500'
                                      )} />
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="truncate text-xs font-semibold">{c.name}</p>
                                    <span className="shrink-0 rounded bg-brand/10 px-1 py-0.2 text-[8px] font-bold text-brand leading-none">
                                      {c.startupFitScore}% fit
                                    </span>
                                  </div>
                                  <p className="truncate text-[10px] text-muted-foreground">{c.title}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 relative">
                                <ScoreRing score={c.matchScore} size={30} />
                                <button
                                  type="button"
                                  onClick={() => setActiveMenuId(activeMenuId === c.id ? null : c.id)}
                                  className="text-muted-foreground hover:text-white cursor-pointer"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </button>

                                {activeMenuId === c.id && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                    <div className="absolute right-0 mt-5 z-40 w-44 rounded-xl border border-zinc-800 bg-[#09090b] p-1.5 shadow-2xl backdrop-blur-md">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuId(null)
                                          onOpenOutreachModal(c)
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white cursor-pointer"
                                      >
                                        Draft outreach
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuId(null)
                                          onOpenScheduleModal(c)
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white cursor-pointer"
                                      >
                                        Schedule Interview
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                              <p className="text-[10px] text-muted-foreground">{c.source}</p>
                              <div className="flex gap-0.5">
                                {c.companyStages.map((stage) => (
                                  <span key={stage} className="rounded bg-zinc-800/90 px-1 text-[8px] text-zinc-400">
                                    {stage}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {stage === 'Interview' && (
                              <p className="mt-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[9px] font-medium text-violet-300">
                                {c.lastActivity.includes('scheduled') 
                                  ? c.lastActivity 
                                  : `Interview: ${c.id === 'c9' ? 'Today, 3:00 PM' : c.id === 'c10' ? 'Tomorrow, 10:00 AM' : 'Friday, 1:30 PM'}`}
                              </p>
                            )}
                            {stage === 'Offer' && (
                              <p className="mt-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[9px] font-medium text-orange-300">
                                Offer Extended
                              </p>
                            )}
                            {stage === 'Hired' && (
                              <p className="mt-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-[9px] font-medium text-brand">
                                Hired
                              </p>
                            )}
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          let targetCandidateStage: CandidateStage = 'New'
                          if (stage === 'Sourced') targetCandidateStage = 'New'
                          else if (stage === 'Contacted') targetCandidateStage = 'In Review'
                          else if (stage === 'Screening') targetCandidateStage = 'Screening'
                          else if (stage === 'Interview') targetCandidateStage = 'Interview'
                          else if (stage === 'Offer') targetCandidateStage = 'Offer'
                          else if (stage === 'Hired') targetCandidateStage = 'Hired'
                          
                          onAddCandidateAtStage(targetCandidateStage)
                        }}
                        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-border/50 py-2 text-[10px] font-medium text-brand transition hover:border-brand/40 hover:bg-brand/5 cursor-pointer"
                      >
                        <Plus className="size-3" />
                        Add candidate
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI insights sidebar */}
        <aside className="recruiter-scroll hidden w-72 shrink-0 flex-col gap-3 overflow-auto lg:flex">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand" />
                AI Pipeline Insights
              </span>
            }
          >
            <div className="space-y-3">
              {PIPELINE_INSIGHTS.map((insight) => (
                <div key={insight.title} className="rounded-xl border border-border/40 bg-foreground/[0.03] p-3">
                  <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{insight.body}</p>
                  <button
                    type="button"
                    onClick={() => onAskCopilot?.(insight.body)}
                    className="mt-2 text-[11px] font-medium text-brand hover:underline cursor-pointer"
                  >
                    {insight.cta}
                  </button>
                </div>
              ))}

              <div className="rounded-xl border border-border/40 bg-foreground/[0.03] p-3">
                <p className="text-xs font-semibold text-foreground">Conversion rate</p>
                <p className="mt-1 text-2xl font-bold text-brand">{conversionRate}%</p>
                <p className="text-[10px] text-muted-foreground">From Sourced to Hired</p>
                <div className="mt-3 h-12">
                  <svg viewBox="0 0 100 40" className="h-full w-full">
                    <motion.polyline
                      fill="none"
                      stroke="#1dff00"
                      strokeWidth={2}
                      points={sparklinePoints}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 1.2 }}
                    />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => onAskCopilot?.("Give me suggestions to optimize my pipeline conversion rates.")}
                  className="mt-2 text-[11px] font-medium text-brand hover:underline cursor-pointer"
                >
                  View other suggestions
                </button>
              </div>

              {outreachCandidate && (
                <div className="rounded-xl border border-border/40 bg-foreground/[0.03] p-3">
                  <p className="text-xs font-semibold text-foreground">Suggested outreach</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {outreachCandidate.name} matches {role} — reach out while they&apos;re active.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenOutreachModal(outreachCandidate)}
                    className="mt-2 w-full rounded-lg border border-brand/30 bg-brand/10 py-1.5 text-[11px] font-semibold text-brand hover:bg-brand/20 transition cursor-pointer"
                  >
                    Send outreach
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-border/40 bg-foreground/[0.03] p-3">
                <p className="text-xs font-semibold text-foreground">Interview recommendations</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(board.Interview?.length ?? 0)} candidates ready for interview scheduling.
                </p>
                <button
                  type="button"
                  onClick={onOpenMeetings}
                  className="mt-2 text-[11px] font-medium text-brand hover:underline cursor-pointer"
                >
                  View schedule
                </button>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border/40 py-2 text-[10px] text-muted-foreground">
        <GripVertical className="size-3.5" />
        Drag and drop candidates between stages
      </div>
    </div>
  )
}
