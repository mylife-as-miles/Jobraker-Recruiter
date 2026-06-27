import * as React from 'react'
import {
  Bookmark,
  Briefcase,
  Filter,
  Mail,
  MoreHorizontal,
  Pencil,
  Sparkles,
  User,
  X,
  BarChart3,
  FileText,
  Plus,
  Loader2,
  Linkedin,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import {
  CANDIDATE_KPIS,
  ROLES,
  type Candidate,
  type CandidateStage,
  type Role,
  type CompanyStage,
  type GrowthTrajectory,
  type VestingStatus,
} from './data'
import { loadRecruiterState } from './storage'
import {
  AnimatedNumber,
  Avatar,
  Delta,
  EmptyState,
  MatchBar,
  RecruiterHeader,
  Reveal,
  ScoreRing,
  Skeleton,
  SkeletonCard,
  useFakeLoading,
  RECRUITER_EASE,
} from './shared'
import { cn } from '@/lib/utils'

const STAGE_STYLES: Record<CandidateStage, string> = {
  New: 'bg-foreground/10 text-muted-foreground border-border/50',
  Screening: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'In Review': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Shortlisted: 'bg-brand/15 text-brand border-brand/35',
  Interview: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Offer: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Hired: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

const PAGE_SIZES = [5, 10, 25]

type CandidatesPageProps = {
  candidatesList: Candidate[]
  selectedRoleId: string | null
  onClearRoleFilter: () => void
  onAskCopilot?: (prompt: string) => void
  onNavigatePipeline?: () => void
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
  onOpenEmail?: (threadId?: string) => void
  onStageChange: (id: string, stage: CandidateStage) => void
  onRemoveCandidate: (id: string) => void
  onAddCandidate: () => void
  onEditCandidate: (c: Candidate) => void
  onOpenOutreachModal: (c: Candidate) => void
  onOpenScheduleModal: (c: Candidate) => void
  selectedCandidateId?: string | null
  onUpdateCandidate?: (c: Candidate) => void
  onOpenQuickImport?: () => void
}

export function CandidatesPage({
  candidatesList,
  selectedRoleId,
  onClearRoleFilter,
  onAskCopilot,
  onNavigatePipeline,
  onOpenSearch,
  onOpenChat,
  onTakeMeetingNotes,
  onOpenAgents,
  onStageChange,
  onRemoveCandidate,
  onAddCandidate,
  onEditCandidate,
  onOpenOutreachModal,
  onOpenScheduleModal,
  selectedCandidateId,
  onUpdateCandidate,
  onOpenQuickImport,
}: CandidatesPageProps) {
  const loading = useFakeLoading(680)
  const [search, setSearch] = React.useState('')
  const [stageFilter, setStageFilter] = React.useState<CandidateStage | 'All'>('All')
  const [companyStageFilter, setCompanyStageFilter] = React.useState<CompanyStage | 'All'>('All')
  const [growthFilter, setGrowthFilter] = React.useState<GrowthTrajectory | 'All'>('All')
  const [vestingFilter, setVestingFilter] = React.useState<VestingStatus | 'All'>('All')

  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(5)
  const [selectedId, setSelectedId] = React.useState<string | null>('c1')
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(['c1']))
  const [editingNote, setEditingNote] = React.useState(false)
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null)

  // Resolve role title for filtering
  const rolesList = React.useMemo(() => loadRecruiterState<Role[]>('roles', ROLES), [])
  const selectedRoleTitle = React.useMemo(() => {
    if (!selectedRoleId) return null
    return rolesList.find((r) => r.id === selectedRoleId)?.title ?? null
  }, [selectedRoleId, rolesList])

  const candidates = React.useMemo(() => {
    const q = search.trim().toLowerCase()

    return candidatesList.filter((c) => {
      if (selectedRoleTitle && c.title !== selectedRoleTitle) return false
      if (stageFilter !== 'All' && c.stage !== stageFilter) return false
      if (companyStageFilter !== 'All' && !c.companyStages.includes(companyStageFilter)) return false
      if (growthFilter !== 'All' && c.growthTrajectory !== growthFilter) return false
      if (vestingFilter !== 'All' && c.vestingStatus !== vestingFilter) return false

      // Regular search query
      if (q) {
        const match = c.name.toLowerCase().includes(q) ||
                      c.title.toLowerCase().includes(q) ||
                      c.location.toLowerCase().includes(q) ||
                      c.skills.some((s) => s.toLowerCase().includes(q))
        if (!match) return false
      }

      return true
    })
  }, [candidatesList, search, stageFilter, selectedRoleTitle, companyStageFilter, growthFilter, vestingFilter])

  const totalPages = Math.max(1, Math.ceil(candidates.length / pageSize))
  const pageItems = candidates.slice((page - 1) * pageSize, page * pageSize)
  const selected = candidates.find((c) => c.id === selectedId) ?? pageItems[0] ?? null

  React.useEffect(() => {
    if (selectedCandidateId) {
      setSelectedId(selectedCandidateId)
      const index = candidates.findIndex((c) => c.id === selectedCandidateId)
      if (index !== -1) {
        const pageIdx = Math.ceil((index + 1) / pageSize)
        setPage(pageIdx)
      }
    }
  }, [selectedCandidateId, candidates, pageSize])

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  if (loading) {
    return (
      <div className="recruiter-scroll flex h-full overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-6 pt-6"><Skeleton className="h-8 w-48" /></div>
          <div className="grid grid-cols-2 gap-3 px-6 py-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <Skeleton className="mx-6 h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (candidatesList.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <RecruiterHeader
          title="Candidates"
          subtitle="Search, evaluate, and engage top talent."
          searchPlaceholder="Search candidates..."
          onOpenSearch={onOpenSearch}
          onOpenChat={onOpenChat}
          onTakeMeetingNotes={onTakeMeetingNotes}
          onOpenAgents={onOpenAgents}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<User className="size-6" />}
            title="Your candidate database is empty"
            body="Import candidates from LinkedIn, quick import details, or add them manually to start building your talent pool."
            action={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenQuickImport}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0c0d0d] px-3.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white cursor-pointer"
                >
                  <Linkedin className="size-3.5 text-brand" />
                  <span>Import LinkedIn</span>
                </button>
                <button
                  type="button"
                  onClick={onAddCandidate}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Candidate</span>
                </button>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="recruiter-scroll flex min-w-0 flex-1 flex-col overflow-auto">
        <RecruiterHeader
          title="Candidates"
          subtitle="Search, evaluate, and engage top talent."
          searchPlaceholder="Search candidates by name, role, skill…"
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          onOpenSearch={onOpenSearch}
          onOpenChat={onOpenChat}
          onTakeMeetingNotes={onTakeMeetingNotes}
          onOpenAgents={onOpenAgents}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
          {[
            { label: 'Total Candidates', value: candidatesList.length, delta: CANDIDATE_KPIS.totalDeltaPct, icon: Briefcase },
            { label: 'Shortlisted', value: candidatesList.filter(c => c.stage === 'Shortlisted').length, delta: CANDIDATE_KPIS.shortlistedDeltaPct, icon: Bookmark },
            { label: 'In Review', value: candidatesList.filter(c => c.stage === 'In Review').length, delta: CANDIDATE_KPIS.inReviewDeltaPct, icon: User },
            { label: 'Avg Match Score', value: candidatesList.length > 0 ? Math.round(candidatesList.reduce((sum, c) => sum + c.matchScore, 0) / candidatesList.length) : 0, delta: CANDIDATE_KPIS.avgMatchDeltaPct, icon: BarChart3, suffix: '%' },
          ].map((kpi, i) => (
            <Reveal key={kpi.label} delay={i * 0.05}>
              <div className="recruiter-kpi recruiter-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      <AnimatedNumber value={kpi.value} format={(n) => `${Math.round(n)}${kpi.suffix ?? ''}`} />
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Delta value={kpi.delta} suffix="%" />
                      vs last 7 days
                    </p>
                  </div>
                  <span className="flex size-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
                    <kpi.icon className="size-4" />
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2 px-6">
          {selectedRoleTitle && (
            <div className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] text-brand">
              <span className="font-semibold">Role: {selectedRoleTitle}</span>
              <button
                type="button"
                onClick={onClearRoleFilter}
                className="hover:text-white transition cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {/* Interactive Filters Dropdowns */}
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value as CandidateStage | 'All'); setPage(1) }}
            className="h-8 rounded-lg border border-border/50 bg-[#0c0d0d] px-2.5 text-[11px] text-muted-foreground outline-none hover:border-brand/30 focus:border-brand/40 cursor-pointer"
          >
            <option value="All">All Stages</option>
            {(['New', 'Screening', 'In Review', 'Shortlisted', 'Interview', 'Offer', 'Hired'] as CandidateStage[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={companyStageFilter}
            onChange={(e) => { setCompanyStageFilter(e.target.value as CompanyStage | 'All'); setPage(1) }}
            className="h-8 rounded-lg border border-border/50 bg-[#0c0d0d] px-2.5 text-[11px] text-muted-foreground outline-none hover:border-brand/30 focus:border-brand/40 cursor-pointer"
          >
            <option value="All">All Company Stages</option>
            {(['Seed', 'Series A', 'Series B', 'Growth', 'Enterprise'] as CompanyStage[]).map((cs) => (
              <option key={cs} value={cs}>{cs}</option>
            ))}
          </select>

          <select
            value={growthFilter}
            onChange={(e) => { setGrowthFilter(e.target.value as GrowthTrajectory | 'All'); setPage(1) }}
            className="h-8 rounded-lg border border-border/50 bg-[#0c0d0d] px-2.5 text-[11px] text-muted-foreground outline-none hover:border-brand/30 focus:border-brand/40 cursor-pointer"
          >
            <option value="All">All Trajectories</option>
            {(['Fast', 'Moderate', 'Steady'] as GrowthTrajectory[]).map((gt) => (
              <option key={gt} value={gt}>{gt} Growth</option>
            ))}
          </select>

          <select
            value={vestingFilter}
            onChange={(e) => { setVestingFilter(e.target.value as VestingStatus | 'All'); setPage(1) }}
            className="h-8 rounded-lg border border-border/50 bg-[#0c0d0d] px-2.5 text-[11px] text-muted-foreground outline-none hover:border-brand/30 focus:border-brand/40 cursor-pointer"
          >
            <option value="All">All Vesting Statuses</option>
            {(['Fully Vested', 'Partially Vested', 'Unvested'] as VestingStatus[]).map((vs) => (
              <option key={vs} value={vs}>{vs}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenQuickImport}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0c0d0d] px-3 text-[11px] font-semibold text-zinc-300 transition hover:bg-zinc-800/80 hover:text-white cursor-pointer"
          >
            <Linkedin className="size-3.5 text-brand" />
            Import LinkedIn
          </button>

          <button
            type="button"
            onClick={onAddCandidate}
            className="flex h-8 items-center gap-1 rounded-lg border border-brand/35 bg-brand/10 px-3 text-[11px] font-semibold text-brand transition hover:bg-brand hover:text-black cursor-pointer"
          >
            <Plus className="size-3.5" />
            Add Candidate
          </button>

          <button
            type="button"
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-border/50 px-2.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
        </div>

        {/* Table */}
        <Reveal className="mt-4 flex-1 px-6 pb-4" delay={0.1}>
          {candidates.length === 0 ? (
            <EmptyState
              icon={<User className="size-6" />}
              title="No candidates found"
              body="Adjust your filters or search to discover talent in your pipeline."
              action={
                <button
                  type="button"
                  onClick={() => { setSearch(''); setStageFilter('All'); onClearRoleFilter() }}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-[#050705]/20">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-foreground/[0.02] text-muted-foreground">
                    <th className="w-10 p-3" />
                    <th className="p-3 font-medium">Candidate</th>
                    <th className="hidden p-3 font-medium md:table-cell">Experience</th>
                    <th className="p-3 font-medium">Match</th>
                    <th className="p-3 font-medium">Stage</th>
                    <th className="hidden p-3 font-medium lg:table-cell">Source</th>
                    <th className="hidden p-3 font-medium sm:table-cell">Last activity</th>
                    <th className="w-10 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr
                      key={c.id}
                      data-selected={selectedId === c.id}
                      className="recruiter-row cursor-pointer border-b border-border/20"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(c.id)}
                          onChange={() => {
                            setChecked((prev) => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return next
                            })
                          }}
                          className="size-3.5 rounded border-border accent-brand cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <Avatar name={c.name} size={32} />
                            {c.intentSignal !== 'Passive' && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex size-2">
                                <span className={cn(
                                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                                  c.intentSignal === 'Actively Sourcing' ? 'animate-ping bg-emerald-500' :
                                  c.intentSignal === 'Recently Promoted' ? 'bg-amber-500' : 'bg-sky-500'
                                )} />
                                <span className={cn(
                                  "relative inline-flex size-2 rounded-full",
                                  c.intentSignal === 'Actively Sourcing' ? 'bg-emerald-500' :
                                  c.intentSignal === 'Recently Promoted' ? 'bg-amber-500' : 'bg-sky-500'
                                )} />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground">{c.name}</span>
                              {c.fit && (
                                <span className="rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                                  {c.fit}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{c.title}</p>
                            <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                              <span>{c.location} · {c.experienceYears} yrs · </span>
                              <div className="flex gap-0.5">
                                {(c.companyStages ?? []).map((stage) => (
                                  <span key={stage} className="rounded bg-zinc-800/80 px-1 text-[9px] text-zinc-400">
                                    {stage}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden p-3 tabular-nums text-muted-foreground md:table-cell">
                        {c.experienceYears} yrs
                      </td>
                      <td className="p-3"><MatchBar score={c.matchScore} /></td>
                      <td className="p-3">
                        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', STAGE_STYLES[c.stage])}>
                          {c.stage}
                        </span>
                      </td>
                      <td className="hidden p-3 text-muted-foreground lg:table-cell">{c.source}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{c.lastActivity}</td>
                      <td className="relative p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === c.id ? null : c.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground cursor-pointer"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {activeMenuId === c.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                            <div className="absolute right-2 mt-1 z-40 w-44 rounded-xl border border-zinc-800 bg-[#09090b] p-1.5 shadow-2xl backdrop-blur-md">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onOpenOutreachModal(c)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white cursor-pointer"
                              >
                                Send Email
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onOpenScheduleModal(c)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white cursor-pointer"
                              >
                                Schedule Interview
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onEditCandidate(c)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white cursor-pointer"
                              >
                                Edit Profile
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onRemoveCandidate(c.id)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                Remove Candidate
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Reveal>

        {/* Pagination */}
        {candidates.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-6 py-3 text-[11px] text-muted-foreground">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, candidates.length)} of{' '}
              {candidates.length.toLocaleString()} candidates
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border/50 px-2 py-1 disabled:opacity-40 cursor-pointer"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'min-w-7 rounded-lg border px-2 py-1 tabular-nums cursor-pointer',
                    page === n ? 'border-brand/40 bg-brand/15 text-brand' : 'border-border/50',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border/50 px-2 py-1 disabled:opacity-40 cursor-pointer"
              >
                ›
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="rounded-lg border border-border/50 bg-transparent px-2 py-1 outline-none text-zinc-300"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s} className="bg-[#09090b]">Show {s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.aside
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.35, ease: RECRUITER_EASE }}
            className="recruiter-scroll hidden w-[min(380px,38vw)] shrink-0 flex-col overflow-auto border-l border-border/50 bg-[var(--jobraker-recruiter-panel,rgba(255,255,255,0.02))] lg:flex"
          >
            <CandidateDetailPanel
              candidate={selected}
              note={selected.note ?? ''}
              editingNote={editingNote}
              onEditNote={() => setEditingNote(true)}
              onSaveNote={(text) => {
                const updated = { ...selected, note: text }
                if (onUpdateCandidate) {
                  onUpdateCandidate(updated)
                } else {
                  onEditCandidate(updated)
                }
                setEditingNote(false)
              }}
              onClose={() => setSelectedId(null)}
              onStageChange={(stage) => onStageChange(selected.id, stage)}
              onAskCopilot={onAskCopilot}
              onNavigatePipeline={onNavigatePipeline}
              onEditProfileClick={() => onEditCandidate(selected)}
              onOpenOutreachModal={onOpenOutreachModal}
              onOpenScheduleModal={onOpenScheduleModal}
              roles={rolesList}
              onUpdateCandidate={onUpdateCandidate}
            />
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  )
}

function CandidateDetailPanel({
  candidate,
  note,
  editingNote,
  onEditNote,
  onSaveNote,
  onClose,
  onStageChange,
  onAskCopilot,
  onNavigatePipeline,
  onEditProfileClick,
  onOpenOutreachModal,
  onOpenScheduleModal,
  roles = [],
  onUpdateCandidate,
}: {
  candidate: Candidate
  note: string
  editingNote: boolean
  onEditNote: () => void
  onSaveNote: (text: string) => void
  onClose: () => void
  onStageChange: (stage: CandidateStage) => void
  onAskCopilot?: (prompt: string) => void
  onNavigatePipeline?: () => void
  onEditProfileClick: () => void
  onOpenOutreachModal: (c: Candidate) => void
  onOpenScheduleModal: (c: Candidate) => void
  roles?: Role[]
  onUpdateCandidate?: (c: Candidate) => void
}) {
  const [draft, setDraft] = React.useState(note)
  React.useEffect(() => setDraft(note), [note, candidate.id])

  const [isGenerating, setIsGenerating] = React.useState(false)

  const handleRegenerateAiAnalysis = async () => {
    setIsGenerating(true)
    try {
      const targetRole = roles.find(r => r.title === candidate.title) || roles[0]
      const roleContext = targetRole 
        ? `Title: ${targetRole.title}\nDescription: ${targetRole.description}\nRequirements:\n${targetRole.requirements.join('\n')}`
        : `Title: ${candidate.title}`

      const res = await window.ipc.invoke('recruiter:generateLlm', {
        systemPrompt: 'You are a senior technical recruiter and talent evaluator. Analyze the candidate details against the role requirements. Return a JSON object containing matchScore (number 1-100), startupFitScore (number 1-100), sourcingInsight (1-2 sentences), and startupFitInsight (1-2 sentences).',
        prompt: `Analyze candidate ${candidate.name} for the role of ${candidate.title}.\nCandidate background:\nLocation: ${candidate.location}\nSkills: ${candidate.skills.join(', ')}\nHighlights: ${candidate.highlights.join('\n')}\nExperience: ${candidate.experienceYears} years\nStartup attributes: company stages: ${candidate.companyStages.join('/')}, growth trajectory: ${candidate.growthTrajectory}, vesting: ${candidate.vestingStatus}, intent: ${candidate.intentSignal}.\n\nRole requirements:\n${roleContext}\n\nRespond with ONLY a valid JSON object matching this schema:\n{\n  "matchScore": number,\n  "startupFitScore": number,\n  "sourcingInsight": "string",\n  "startupFitInsight": "string"\n}\nNo markdown formatting or extra text.`,
      })

      if (res.error) throw new Error(res.error)
      let text = res.text || ''
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      const data = JSON.parse(text)
      
      const updatedCandidate = {
        ...candidate,
        aiInsight: data.sourcingInsight || candidate.aiInsight,
        startupFitInsight: data.startupFitInsight || candidate.startupFitInsight,
        matchScore: data.matchScore ? Number(data.matchScore) : candidate.matchScore,
        startupFitScore: data.startupFitScore ? Number(data.startupFitScore) : candidate.startupFitScore,
      }

      onUpdateCandidate?.(updatedCandidate)
      toast.success('AI Insights regenerated successfully!')
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to regenerate AI insights', {
        description: err?.message || String(err)
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex gap-3">
          <Avatar name={candidate.name} size={48} ring />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">{candidate.name}</h2>
              {candidate.fit && (
                <span className="rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                  {candidate.fit}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{candidate.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {candidate.location} · {candidate.experienceYears} yrs experience
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEditProfileClick}
            className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/5 hover:text-white transition cursor-pointer"
            title="Edit profile"
          >
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/5 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mx-5 rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/12 to-transparent p-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={candidate.matchScore} size={52} />
          <div>
            <p className="text-lg font-bold text-brand">{candidate.matchScore}% Match score</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Why this is a great match</span>
              <br />
              Strong alignment on {(candidate.skills ?? []).slice(0, 3).join(', ')} with relevant experience in {candidate.title.toLowerCase()} roles.
            </p>
          </div>
        </div>
      </div>

      {/* AI Startup Fit Summary Card */}
      <div className="mx-5 mt-3 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={candidate.startupFitScore} size={52} />
          <div>
            <p className="text-sm font-bold text-violet-400">Startup Fit: {candidate.startupFitScore}%</p>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
              <span className={cn(
                "px-1.5 py-0.5 rounded font-bold",
                candidate.intentSignal === 'Actively Sourcing' ? 'bg-emerald-500/15 text-emerald-400' :
                candidate.intentSignal === 'Recently Promoted' ? 'bg-amber-500/15 text-amber-400' :
                candidate.intentSignal === 'High Engagement' ? 'bg-sky-500/15 text-sky-400' :
                'bg-zinc-800 text-zinc-400'
              )}>
                {candidate.intentSignal}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 font-semibold">
                {candidate.growthTrajectory} Growth
              </span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {candidate.vestingStatus}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {candidate.startupFitInsight}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <p className="text-xs font-semibold text-foreground">Top skills</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(candidate.skills ?? []).map((s) => (
            <span key={s} className="rounded-lg border border-border/50 bg-foreground/[0.04] px-2 py-1 text-[10px] text-zinc-300">
              {s}
            </span>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold text-foreground">Experience highlights</p>
        <ul className="mt-2 space-y-1.5">
          {(candidate.highlights ?? []).map((h) => (
            <li key={h} className="flex gap-2 text-[11px] text-muted-foreground">
              <span className="text-brand">•</span>
              {h}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border border-border/40 bg-foreground/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-violet-400" />
            AI Insights
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{candidate.aiInsight}</p>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onAskCopilot?.(`Give me a full analysis of candidate ${candidate.name} for the ${candidate.title} role.`)}
              className="text-[11px] font-medium text-brand hover:underline cursor-pointer"
            >
              View full analysis
            </button>
            <button
              type="button"
              onClick={handleRegenerateAiAnalysis}
              disabled={isGenerating}
              className="flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="size-3 animate-spin text-brand" />
              ) : (
                <Sparkles className="size-3 text-brand" />
              )}
              <span>Regenerate AI</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Notes</p>
            <button type="button" onClick={onEditNote} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <Pencil className="size-3.5" />
            </button>
          </div>
          {editingNote ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onSaveNote(draft)}
              className="mt-2 w-full resize-none rounded-xl border border-border/50 bg-foreground/[0.03] p-3 text-[11px] text-zinc-200 outline-none focus:border-brand/40"
              rows={3}
              autoFocus
            />
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {note || 'Add a note about this candidate…'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-zinc-800 p-5">
        <button
          type="button"
          onClick={() => onStageChange('Shortlisted')}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
        >
          <Bookmark className="size-4" />
          Shortlist
        </button>
        <button
          type="button"
          onClick={() => {
            onStageChange('Interview')
            onNavigatePipeline?.()
          }}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-brand/40 text-sm font-semibold text-brand transition hover:bg-brand/10 cursor-pointer"
        >
          <Briefcase className="size-4" />
          Move to Interview
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenOutreachModal(candidate)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-brand/40 cursor-pointer"
          >
            <Mail className="size-3.5" />
            Draft outreach
          </button>
          <button
            type="button"
            onClick={() => onOpenScheduleModal(candidate)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-brand/40 cursor-pointer"
          >
            <FileText className="size-3.5" />
            Schedule Interview
          </button>
        </div>
      </div>
    </>
  )
}
