import * as React from 'react'
import { toast } from 'sonner'
import {
  Briefcase,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Star,
  Plus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { PIPELINE_STAGES, type Role, type Candidate, type PipelineStage } from './data'
import {
  AnimatedNumber,
  Delta,
  EmptyState,
  RecruiterHeader,
  Reveal,
  ScoreRing,
  SectionCard,
  Skeleton,
  useFakeLoading,
  RECRUITER_EASE,
} from './shared'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<Role['status'], string> = {
  Open: 'bg-brand/15 text-brand border-brand/30',
  Interviewing: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Closing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Draft: 'bg-foreground/10 text-muted-foreground border-border/50',
}

type RolesPageProps = {
  roles: Role[]
  candidates: Candidate[]
  onNavigatePipeline?: () => void
  onAskCopilot?: (prompt: string) => void
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
  onOpenEmail?: (threadId?: string) => void
  onOpenMeetings?: () => void
  onToggleFavorite: (id: string) => void
  onSelectRoleFilter: (roleId: string) => void
  onCreateRole: () => void
  onEditRole: (role: Role) => void
}

export function RolesPage({
  roles,
  candidates,
  onNavigatePipeline,
  onAskCopilot,
  onOpenSearch,
  onOpenChat,
  onTakeMeetingNotes,
  onOpenAgents,
  onToggleFavorite,
  onSelectRoleFilter,
  onCreateRole,
  onEditRole,
}: RolesPageProps) {
  const loading = useFakeLoading(660)
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string>(roles[0]?.id ?? '')

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roles
    return roles.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
    )
  }, [search, roles])

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  React.useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  if (loading) {
    return (
      <div className="recruiter-scroll flex h-full overflow-hidden">
        <div className="w-full max-w-md border-r border-border/40 p-4 lg:w-[380px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-24 rounded-2xl" />
          ))}
        </div>
        <div className="hidden flex-1 p-6 lg:block">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <RecruiterHeader
        title="Roles"
        subtitle="Manage open positions and track hiring progress."
        searchPlaceholder="Search roles by title, department, location…"
        searchValue={search}
        onSearchChange={setSearch}
        onOpenSearch={onOpenSearch}
        onOpenChat={onOpenChat}
        onTakeMeetingNotes={onTakeMeetingNotes}
        onOpenAgents={onOpenAgents}
        rightExtra={
          <button
            type="button"
            onClick={onCreateRole}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-brand/35 bg-brand/10 px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-black cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Role</span>
          </button>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Role list */}
        <div className="recruiter-scroll w-full max-w-md shrink-0 overflow-auto border-r border-border/50 lg:w-[380px]">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Briefcase className="size-6" />}
                title="No roles found"
                body="Try a different search or create a new role."
                action={
                  <button
                    type="button"
                    onClick={onCreateRole}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-black hover:brightness-110 cursor-pointer"
                  >
                    <Plus className="mr-1 inline size-3.5" />
                    Create role
                  </button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-2 p-3">
              {filtered.map((role, i) => {
                const roleApplicants = candidates.filter((c) => c.title === role.title)
                const newCount = roleApplicants.filter((c) => c.stage === 'New').length
                return (
                  <Reveal key={role.id} delay={i * 0.04}>
                    <li>
                      <button
                        type="button"
                        data-selected={selected?.id === role.id}
                        onClick={() => setSelectedId(role.id)}
                        className={cn(
                          'recruiter-row w-full rounded-2xl border border-border/50 p-4 text-left transition cursor-pointer',
                          selected?.id === role.id && 'border-brand/35 bg-brand/8',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn('rounded-md border px-1.5 py-0.5 text-[9px] font-semibold', STATUS_STYLES[role.status])}>
                                {role.status}
                              </span>
                              {role.favorite && (
                                <Star className="size-3 fill-brand text-brand" />
                              )}
                            </div>
                            <p className="mt-1 font-semibold text-foreground">{role.title}</p>
                            <p className="text-[11px] text-muted-foreground">{role.department} · {role.location}</p>
                          </div>
                          <ScoreRing score={role.qualityScore} size={36} />
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {roleApplicants.length} applicants
                          </span>
                          {newCount > 0 && (
                            <span className="font-semibold text-brand">+{newCount} new</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {role.postedAgo}
                          </span>
                        </div>
                      </button>
                    </li>
                  </Reveal>
                )
              })}
            </ul>
          )}
        </div>

        {/* Role detail */}
        <div className="recruiter-scroll hidden min-w-0 flex-1 overflow-auto lg:block bg-[#050705]/10">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: RECRUITER_EASE }}
                className="p-6"
              >
                <RoleDetail
                  role={selected}
                  candidates={candidates}
                  isFavorite={!!selected.favorite}
                  onToggleFavorite={() => onToggleFavorite(selected.id)}
                  onOpenPipeline={onNavigatePipeline}
                  onBrowseCandidates={() => onSelectRoleFilter(selected.id)}
                  onEditRole={() => onEditRole(selected)}
                  onAskCopilot={onAskCopilot}
                />
              </motion.div>
            ) : (
              <EmptyState
                icon={<Briefcase className="size-6" />}
                title="Select a role"
                body="Choose a role from the list to view details and pipeline progress."
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function RoleDetail({
  role,
  candidates,
  isFavorite,
  onToggleFavorite,
  onOpenPipeline,
  onBrowseCandidates,
  onEditRole,
  onAskCopilot,
}: {
  role: Role
  candidates: Candidate[]
  isFavorite: boolean
  onToggleFavorite: () => void
  onOpenPipeline?: () => void
  onBrowseCandidates: () => void
  onEditRole: () => void
  onAskCopilot?: (prompt: string) => void
}) {
  const applicants = React.useMemo(() => {
    return candidates.filter((c) => c.title === role.title)
  }, [candidates, role.title])

  const stageCounts = React.useMemo(() => {
    const counts: Record<PipelineStage, number> = {
      Sourced: 0,
      Contacted: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Hired: 0,
    }
    applicants.forEach((c) => {
      if (c.stage === 'New' || c.stage === 'Shortlisted') counts.Sourced++
      else if (c.stage === 'In Review') counts.Contacted++
      else if (c.stage === 'Screening') counts.Screening++
      else if (c.stage === 'Interview') counts.Interview++
      else if (c.stage === 'Offer') counts.Offer++
      else if (c.stage === 'Hired') counts.Hired++
    })
    return counts
  }, [applicants])

  const maxStage = Math.max(...Object.values(stageCounts), 1)

  const avgFit = React.useMemo(() => {
    return applicants.length > 0
      ? Math.round(applicants.reduce((acc, c) => acc + c.startupFitScore, 0) / applicants.length)
      : null
  }, [applicants])

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLES[role.status])}>
              {role.status}
            </span>
            <span className="text-[11px] text-muted-foreground">{role.employmentType} · {role.level}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{role.title}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{role.location}</span>
            <span className="flex items-center gap-1"><Briefcase className="size-3.5" />{role.salaryRange}</span>
            <span className="flex items-center gap-1"><Clock className="size-3.5" />Posted {role.postedAgo}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              'flex size-10 items-center justify-center rounded-xl border transition cursor-pointer',
              isFavorite ? 'border-brand/40 bg-brand/15 text-brand' : 'border-border/50 text-muted-foreground hover:text-foreground',
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('size-4', isFavorite && 'fill-current')} />
          </button>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-black hover:brightness-110 cursor-pointer"
          >
            View pipeline
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Stage funnel */}
      <SectionCard className="mt-6 bg-[#050705]/20" title="Hiring funnel">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PIPELINE_STAGES.map((stage) => {
            const count = stageCounts[stage]
            return (
              <button
                key={stage}
                type="button"
                onClick={onOpenPipeline}
                className="text-center cursor-pointer group hover:bg-foreground/[0.02] p-1.5 rounded-xl transition"
              >
                <div className="mx-auto flex h-16 w-full max-w-[72px] items-end justify-center">
                  <motion.div
                    className="w-full rounded-t-lg bg-gradient-to-t from-brand/30 to-brand/70 group-hover:brightness-110 transition-all"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(12, (count / maxStage) * 100)}%` }}
                    transition={{ duration: 0.6, ease: RECRUITER_EASE }}
                    style={{ minHeight: 8 }}
                  />
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums">
                  <AnimatedNumber value={count} />
                </p>
                <p className="text-[10px] text-muted-foreground group-hover:text-brand transition-colors">{stage}</p>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5 text-brand" />
            <AnimatedNumber value={applicants.length} /> total applicants
          </span>
          <span className="flex items-center gap-1">
            <Delta value={applicants.filter(c => c.stage === 'New').length} suffix="" />
            new this week
          </span>
          <span>Quality score: <strong className="text-brand">{role.qualityScore}%</strong></span>
        </div>
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard className="bg-[#050705]/20 lg:col-span-1" title="About the role">
          <p className="text-sm leading-relaxed text-muted-foreground">{role.description}</p>
        </SectionCard>
        <SectionCard className="bg-[#050705]/20 lg:col-span-1" title="Required skills">
          <div className="flex flex-wrap gap-1.5">
            {role.skills.map((s) => (
              <span key={s} className="rounded-lg border border-border/50 bg-foreground/[0.04] px-2 py-1 text-[11px] text-zinc-300">
                {s}
              </span>
            ))}
          </div>
        </SectionCard>
        <SectionCard className="bg-[#050705]/20 lg:col-span-1" title="Startup Target Profile">
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-zinc-500 font-semibold">Target Stages:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(role.title.includes('Senior') || role.title.includes('Staff') || role.title.includes('Lead')) ? (
                  ['Series A', 'Series B', 'Growth'].map(s => (
                    <span key={s} className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand leading-none">{s}</span>
                  ))
                ) : (
                  ['Seed', 'Series A'].map(s => (
                    <span key={s} className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand leading-none">{s}</span>
                  ))
                )}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 font-semibold">Growth Mindset:</span>
              <p className="mt-1 text-[11px] font-semibold text-white">
                {(role.title.includes('Senior') || role.title.includes('Staff') || role.title.includes('Lead')) ? 'High Velocity execution' : 'Agile builder mindset'}
              </p>
            </div>
            {avgFit !== null && (
              <div>
                <span className="text-zinc-500 font-semibold">Applicants Avg Fit:</span>
                <p className="mt-1 text-base font-bold text-[#1dff00]">{avgFit}% Match</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard className="bg-[#050705]/20" title="Responsibilities">
          <ul className="space-y-2">
            {role.responsibilities.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-brand">•</span>
                {r}
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard className="bg-[#050705]/20" title="Requirements">
          <ul className="space-y-2">
            {role.requirements.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-brand">•</span>
                {r}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBrowseCandidates}
          className="rounded-xl border border-brand/35 bg-brand/10 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/15 hover:border-brand/40 transition cursor-pointer"
        >
          Browse candidates
        </button>
        <button
          type="button"
          onClick={onEditRole}
          className="rounded-xl border border-border/50 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
        >
          Edit role details
        </button>
        <button
          type="button"
          onClick={() => onAskCopilot?.(`Help me refine the job role template for ${role.title} using AI.`)}
          className="rounded-xl border border-border/50 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
        >
          Refine with Copilot
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`https://jobraker.com/careers/${role.id}`)
            toast.success("Job posting link copied!", {
              description: `The careers page URL for ${role.title} is now in your clipboard.`,
            })
          }}
          className="rounded-xl border border-border/50 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
        >
          Share posting
        </button>
      </div>
    </>
  )
}
