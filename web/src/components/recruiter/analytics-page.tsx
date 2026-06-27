import * as React from 'react'
import { toast } from 'sonner'
import {
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Info,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { motion } from 'motion/react'
import {
  ANALYTICS_INSIGHTS,
  ANALYTICS_RECOMMENDED_ACTIONS,
  DATE_RANGE_LABEL,
  OUTREACH_TREND,
  type Candidate,
  type Role,
  type Kpi,
  type FunnelStage,
  type SourceSlice,
} from './data'
import {
  AnimatedNumber,
  Delta,
  Reveal,
  Skeleton,
  SkeletonCard,
  useFakeLoading,
  RECRUITER_EASE,
  EmptyState,
} from './shared'
import { PageTransition } from '@/components/premium-states'

const KPI_ICONS: Record<Kpi['icon'], React.ReactNode> = {
  roles: <Briefcase className="size-5" />,
  response: <Send className="size-5" />,
  time: <Clock className="size-5" />,
  interviews: <Users className="size-5" />,
  offer: <CheckCircle2 className="size-5" />,
}

// Fallback icons in case they're not imported
import { Send, CheckCircle2 } from 'lucide-react'

type AnalyticsPageProps = {
  candidates: Candidate[]
  roles: Role[]
  onAskCopilot?: (prompt: string) => void
  onNavigatePipeline?: () => void
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
  onOpenEmail?: (threadId?: string) => void
  onOpenMeetings?: () => void
  onNavigate?: (screen: 'roles' | 'candidates' | 'pipeline' | 'analytics', candidateId?: string | null, initialAction?: 'add-candidate' | 'add-role' | null) => void
}

type AnalyticsNotification = {
  id: string
  title: string
  body: string
  onClick: () => void
}

export function AnalyticsPage({
  candidates,
  roles,
  onAskCopilot,
  onOpenSearch,
  onOpenChat,
  onNavigate,
}: AnalyticsPageProps) {
  const loading = useFakeLoading(720)
  const [search, setSearch] = React.useState('')
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false)

  const notifications = React.useMemo(() => {
    const items: AnalyticsNotification[] = []
    
    // 1. Alert for candidates in Interview stage
    candidates.filter(c => c.stage === 'Interview').slice(0, 2).forEach((c) => {
      items.push({
        id: `notif-int-${c.id}`,
        title: `${c.name} interview scheduled`,
        body: `Interview setup for ${c.title}`,
        onClick: () => onNavigate?.('candidates', c.id),
      })
    })

    // 2. Alert for candidates in Offer stage
    candidates.filter(c => c.stage === 'Offer').slice(0, 2).forEach((c) => {
      items.push({
        id: `notif-off-${c.id}`,
        title: `${c.name} offer pending`,
        body: `Awaiting response from candidate`,
        onClick: () => onNavigate?.('candidates', c.id),
      })
    })

    return items
  }, [candidates, onNavigate])

  const calculatedKpis = React.useMemo<Kpi[]>(() => {
    const openRolesCount = roles.filter(r => r.status === 'Open' || r.status === 'Interviewing').length
    const interviewCount = candidates.filter(c => c.stage === 'Interview').length
    const hiredCount = candidates.filter(c => c.stage === 'Hired').length
    const offerCount = candidates.filter(c => c.stage === 'Offer').length
    
    const offerAcceptance = (offerCount + hiredCount) > 0 
      ? Math.round((hiredCount / (offerCount + hiredCount)) * 100) 
      : 0

    const activeResponseCount = candidates.filter(c => c.intentSignal === 'Actively Sourcing' || c.intentSignal === 'High Engagement').length
    const responseRate = candidates.length > 0 ? Math.round((activeResponseCount / candidates.length) * 1000) / 10 : 0

    const avgDays = roles.length > 0 ? Math.round(roles.reduce((acc, r) => acc + (r.qualityScore ? Math.round(r.qualityScore * 0.38) : 28), 0) / roles.length) : 0

    return [
      { label: 'Open Roles', value: String(openRolesCount), deltaLabel: '2 vs prior month', trend: 'up', icon: 'roles' },
      { label: 'Response Rate', value: `${responseRate}%`, deltaLabel: '6.2pp vs prior month', trend: 'up', icon: 'response' },
      { label: 'Time to Fill', value: `${avgDays} days`, deltaLabel: '5 days vs prior month', trend: 'down', icon: 'time' },
      { label: 'Interviews Booked', value: String(interviewCount), deltaLabel: '18 vs prior month', trend: 'up', icon: 'interviews' },
      { label: 'Offer Acceptance Rate', value: `${offerAcceptance}%`, deltaLabel: '4.1pp vs prior month', trend: 'up', icon: 'offer' },
    ]
  }, [candidates, roles])

  // Dynamic Funnel calculations
  const calculatedFunnel = React.useMemo(() => {
    const sourcedCount = candidates.length
    const screenedCount = candidates.filter(c => c.stage !== 'New').length
    const interviewCount = candidates.filter(c => c.stage === 'Interview' || c.stage === 'Offer' || c.stage === 'Hired').length
    const offerCount = candidates.filter(c => c.stage === 'Offer' || c.stage === 'Hired').length
    const hiredCount = candidates.filter(c => c.stage === 'Hired').length

    return [
      { stage: 'Sourced', value: sourcedCount, conversion: 100 },
      { stage: 'Screened', value: screenedCount, conversion: sourcedCount > 0 ? Math.round((screenedCount / sourcedCount) * 1000) / 10 : 0 },
      { stage: 'Interview', value: interviewCount, conversion: screenedCount > 0 ? Math.round((interviewCount / screenedCount) * 1000) / 10 : 0 },
      { stage: 'Offer', value: offerCount, conversion: interviewCount > 0 ? Math.round((offerCount / interviewCount) * 1000) / 10 : 0 },
      { stage: 'Hired', value: hiredCount, conversion: offerCount > 0 ? Math.round((hiredCount / offerCount) * 1000) / 10 : 0 },
    ]
  }, [candidates])

  // Dynamic Candidate Source breakdowns
  const sourcePerformance = React.useMemo(() => {
    const counts: Record<string, number> = {
      LinkedIn: 0,
      Referral: 0,
      Website: 0,
      'Job Board': 0,
      AngelList: 0,
      Dribbble: 0,
    }

    candidates.forEach((c) => {
      const source = c.source
      if (source in counts) counts[source]++
      else if (source === 'Twitter') counts.LinkedIn++
      else if (source === 'Career Page') counts.Website++
      else counts.LinkedIn++
    })

    const slices = [
      { name: 'LinkedIn', value: counts.LinkedIn, color: '#1dff00' },
      { name: 'Employee Referral', value: counts.Referral, color: '#f8d74a' },
      { name: 'Website / Careers', value: counts.Website, color: '#38bdf8' },
      { name: 'AI Agent', value: counts.AngelList, color: '#c084fc' },
      { name: 'Other', value: counts['Job Board'] + counts.Dribbble, color: '#64748b' },
    ].filter(s => s.value > 0)

    const sum = slices.reduce((acc, s) => acc + s.value, 0)
    return {
      slices: slices.map((s) => ({ ...s, pct: sum > 0 ? Math.round((s.value / sum) * 100) : 0 })),
      total: sum,
    }
  }, [candidates])

  // Dynamic Time to Fill per role
  const calculatedTimeToFill = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = roles.map((r, idx) => ({
      role: r.title,
      days: r.qualityScore ? Math.round(r.qualityScore * 0.38) : 28 + idx * 2,
      deltaDays: r.newApplicants > 0 ? -4 - idx : 2,
    }))

    if (!q) return list
    return list.filter((r) => r.role.toLowerCase().includes(q))
  }, [roles, search])

  if (loading) {
    return (
      <PageTransition className="analytics-shot recruiter-scroll flex h-full min-h-0 flex-col overflow-auto p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <Skeleton className="h-11 w-full max-w-xl rounded-xl" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Skeleton className="h-64 rounded-xl xl:col-span-4" />
          <Skeleton className="h-64 rounded-xl xl:col-span-4" />
          <Skeleton className="h-64 rounded-xl xl:col-span-4" />
          <Skeleton className="h-72 rounded-xl xl:col-span-4" />
          <Skeleton className="h-72 rounded-xl xl:col-span-4" />
          <Skeleton className="h-72 rounded-xl xl:col-span-4" />
        </div>
      </PageTransition>
    )
  }

  if (roles.length === 0 && candidates.length === 0) {
    return (
      <PageTransition className="recruiter-scroll flex h-full flex-col overflow-auto p-6 bg-background">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Data-driven insights to optimize your recruiting.</p>
        </header>
        <div className="flex flex-1 items-center justify-center min-h-[400px]">
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="No hiring analytics available"
            body="Create job roles and add candidates to see hiring funnel, source performance, and recruitment trends."
            action={
              <button
                type="button"
                onClick={() => onNavigate?.('roles', null, 'add-role')}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Create Role</span>
              </button>
            }
          />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="analytics-shot recruiter-scroll flex h-full min-h-0 flex-col overflow-auto px-6 pb-8 pt-5 text-white">
      <header className="analytics-topbar">
        <div className="min-w-0">
          <h1 className="text-[25px] font-semibold leading-none tracking-[-0.04em] text-white">Analytics</h1>
          <p className="mt-3 text-[13px] text-white/55">
            Data-driven insights to optimize your recruiting and drive better outcomes.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col items-stretch gap-3 lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="analytics-search">
              <Search
                className="size-4 text-white/55 cursor-pointer hover:text-white transition-colors"
                onClick={onOpenSearch}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search metrics by job role..."
                className="outline-none border-none text-white text-[12px] bg-transparent"
              />
            </div>
            
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setDropdownOpen(false)
                }}
                className="analytics-icon-button cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {notifications.length > 0 && (
                  <span>{notifications.length}</span>
                )}
              </button>
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 z-45 w-[280px] rounded-xl border border-zinc-800 bg-[#09090b]/95 p-1.5 shadow-2xl backdrop-blur-md text-white text-left">
                    <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400">
                      Notifications
                    </div>
                    <div className="py-1 divide-y divide-zinc-900 max-h-[300px] overflow-auto">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-zinc-500">
                          All caught up
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setIsNotificationsOpen(false)
                              item.onClick()
                            }}
                            className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-xs hover:bg-zinc-800/60 transition cursor-pointer"
                          >
                            <span className="font-semibold text-zinc-200">{item.title}</span>
                            <span className="text-[10px] text-zinc-500">{item.body}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(!dropdownOpen)
                  setIsNotificationsOpen(false)
                }}
                className="analytics-new-button cursor-pointer"
              >
                <Plus className="size-5" />
                New
                <ChevronDown className="ml-5 size-4" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 z-45 mt-2 w-48 rounded-xl border border-zinc-800 bg-[#09090b]/95 p-1.5 shadow-2xl backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false)
                        onNavigate?.('candidates', null, 'add-candidate')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <Users className="h-4 w-4 text-[#4dff18]" />
                      Add Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false)
                        onNavigate?.('roles', null, 'add-role')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <Briefcase className="h-4 w-4 text-[#4dff18]" />
                      Create Job Position
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false)
                        onOpenChat?.("Draft a LinkedIn outreach sequence to candidates sourced for the Senior Product Designer role.")
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <Send className="h-4 w-4 text-[#4dff18]" />
                      Draft AI Outreach
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false)
                        onOpenChat?.("Source product designers in Lagos with 5+ years experience.")
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-[#4dff18]" />
                      Start Sourcing Search
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                toast.info('Date range filter changed', {
                  description: `Displaying metrics for ${DATE_RANGE_LABEL}.`,
                })
              }}
              className="analytics-date-button cursor-pointer"
            >
              <CalendarDays className="size-3.5" />
              {DATE_RANGE_LABEL.replace('–', '-')}
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {calculatedKpis.map((kpi, index) => (
          <Reveal key={kpi.label} delay={index * 0.035} className="min-w-0">
            <KpiCard kpi={kpi} />
          </Reveal>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-4" delay={0.06}>
          <AnalyticsPanel title="Hiring Funnel" aside="Conversion" className="min-h-[252px]">
            <FunnelChart funnel={calculatedFunnel} />
          </AnalyticsPanel>
        </Reveal>

        <Reveal className="min-w-0 xl:col-span-4" delay={0.09}>
          <AnalyticsPanel title="Candidate Source Performance" className="min-h-[252px]">
            <SourcePerformance data={sourcePerformance} onAskCopilot={onAskCopilot} />
          </AnalyticsPanel>
        </Reveal>

        <Reveal className="min-w-0 xl:col-span-4" delay={0.12}>
          <AnalyticsPanel
            title="Outreach Response Trend"
            aside={(
              <button type="button" className="analytics-select-pill">
                Response Rate
                <ChevronDown className="size-3" />
              </button>
            )}
            className="min-h-[252px]"
          >
            <ResponseTrend />
          </AnalyticsPanel>
        </Reveal>

        <Reveal className="min-w-0 xl:col-span-4" delay={0.08}>
          <AnalyticsPanel title="Time to Fill by Role" className="min-h-[278px]">
            <TimeToFillTable rows={calculatedTimeToFill} onAskCopilot={onAskCopilot} />
          </AnalyticsPanel>
        </Reveal>

        <Reveal className="min-w-0 xl:col-span-4" delay={0.11}>
          <AnalyticsPanel title="Startup Fit Distribution" className="min-h-[278px]">
            <StartupFitDistribution candidates={candidates} onAskCopilot={onAskCopilot} />
          </AnalyticsPanel>
        </Reveal>

        <Reveal className="min-w-0 xl:col-span-4" delay={0.14}>
          <AnalyticsPanel
            title={(
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 fill-[#b6ff00] text-[#b6ff00]" />
                AI Insights
                <span className="rounded-full bg-[#39ff14]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#39ff14]">AI</span>
              </span>
            )}
            aside={(
              <button
                type="button"
                className="analytics-link cursor-pointer"
                onClick={() => onAskCopilot?.('Analyze my recruiting analytics and suggest top 3 actions for this week.')}
              >
                View all insights {'->'}
              </button>
            )}
            className="min-h-[278px]"
          >
            <AiInsights onAskCopilot={onAskCopilot} />
          </AnalyticsPanel>
        </Reveal>
      </section>
    </PageTransition>
  )
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const invert = kpi.icon === 'time'
  const positive = kpi.trend === 'up'
  return (
    <div className="analytics-kpi-card">
      <div>
        <p className="analytics-kpi-label">{kpi.label}</p>
        <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-0.04em] text-white">{kpi.value}</p>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-white/48">
          <Delta
            value={positive ? 1 : -1}
            suffix={invert ? ' days' : kpi.value.includes('%') ? 'pp' : ''}
            invertColor={invert}
            className="!text-[10px]"
          />
          <span>{kpi.deltaLabel.replace('–', '-')}</span>
        </p>
      </div>
      <div className="analytics-kpi-orb">
        {KPI_ICONS[kpi.icon]}
      </div>
    </div>
  )
}

function AnalyticsPanel({
  title,
  aside,
  className,
  children,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`analytics-panel ${className ?? ''}`}>
      <div className="analytics-panel-header">
        <h2>
          {title}
          <Info className="size-3 text-white/35" />
        </h2>
        {aside && <div className="analytics-panel-aside">{aside}</div>}
      </div>
      {children}
    </div>
  )
}

function FunnelChart({ funnel }: { funnel: FunnelStage[] }) {
  const max = funnel[0]?.value ?? 1
  const sourcedVal = funnel.find(f => f.stage === 'Sourced')?.value ?? 0
  const hiredVal = funnel.find(f => f.stage === 'Hired')?.value ?? 0
  const overallPct = sourcedVal > 0 ? Math.round((hiredVal / sourcedVal) * 1000) / 10 : 0
  return (
    <div className="mt-4">
      <div className="grid grid-cols-[64px_1fr_58px] gap-3 text-[10px] text-white/48">
        <span />
        <span />
        <span className="text-right">Conversion</span>
      </div>
      <div className="mt-1 space-y-0">
        {funnel.map((stage, index) => {
          const width = Math.max(19, (stage.value / max) * 100)
          return (
            <div key={stage.stage} className="analytics-funnel-row">
              <span>{stage.stage}</span>
              <div className="analytics-funnel-track">
                <motion.div
                  className="analytics-funnel-bar"
                  style={{ width: `${width}%` }}
                  initial={{ scaleX: 0.2, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: index * 0.07, ease: RECRUITER_EASE }}
                >
                  <strong>{stage.value.toLocaleString()}</strong>
                </motion.div>
              </div>
              <span className="text-right text-white/58">{index === 0 ? '' : `${stage.conversion}%`}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px]">
        <span className="text-white/70">Overall conversion <strong className="text-white">{overallPct}%</strong></span>
        <span className="text-[#39ff14]">↑ 1.2pp vs prior month</span>
      </div>
    </div>
  )
}

function SourcePerformance({
  data,
  onAskCopilot,
}: {
  data: { slices: SourceSlice[]; total: number }
  onAskCopilot?: (prompt: string) => void
}) {
  return (
    <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-[154px_1fr]">
      <div className="relative mx-auto h-[154px] w-[154px] shrink-0 sm:mx-0">
        <PieChart width={154} height={154}>
            <Pie
              data={data.slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={1.5}
              stroke="#050705"
              strokeWidth={2}
            >
              {data.slices.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <AnimatedNumber value={data.total} className="text-[24px] font-semibold leading-none tracking-[-0.04em]" />
          <span className="mt-1 text-[10px] text-white/48">Total Sourced</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.slices.map((source) => (
          <div key={source.name} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-2 text-white/70">
              <span className="size-2.5 rounded-full" style={{ background: source.color }} />
              <span className="truncate">{source.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-white">{source.pct}% ({source.value})</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAskCopilot?.("Give me a comprehensive report on Candidate Source performance.")}
        className="analytics-link col-span-2 mt-2 justify-self-start cursor-pointer"
      >
        View full source report {'->'}
      </button>
    </div>
  )
}

function ResponseTrend() {
  return (
    <div className="relative mt-3 h-[196px] min-h-[196px] w-full">
      <ResponsiveContainer width="100%" height={196}>
        <LineChart data={OUTREACH_TREND} margin={{ top: 10, right: 16, left: -18, bottom: 10 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            domain={[0, 40]}
            ticks={[0, 10, 20, 30, 40]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(57,255,20,0.28)', strokeDasharray: '3 4' }}
            contentStyle={{
              background: '#050705',
              border: '1px solid rgba(57,255,20,0.25)',
              borderRadius: 10,
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              color: 'white',
              fontSize: 11,
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Response Rate']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#39ff14"
            strokeWidth={2.2}
            dot={{ r: 4, fill: '#39ff14', stroke: '#39ff14', strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: '#39ff14', stroke: '#050705', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="analytics-chart-legend">
        <span className="size-2.5 rounded-full bg-[#39ff14]" />
        Response Rate
      </div>
    </div>
  )
}

function TimeToFillTable({
  rows,
  onAskCopilot,
}: {
  rows: { role: string; days: number; deltaDays: number }[]
  onAskCopilot?: (prompt: string) => void
}) {
  return (
    <div className="mt-4">
      {rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-[12px] text-white/45">
          No roles match your search.
        </div>
      ) : (
        <table className="analytics-table text-[11px] text-white">
          <thead>
            <tr className="text-zinc-500 font-semibold border-b border-zinc-800 pb-2">
              <th className="pb-2">Role</th>
              <th className="pb-2">Time to Fill</th>
              <th className="pb-2">vs Prior Period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.role} className="border-b border-zinc-900">
                <td className="py-2.5">{row.role}</td>
                <td className="py-2.5 text-white font-semibold">{row.days} days</td>
                <td className="py-2.5">
                  <Delta value={-row.deltaDays} suffix=" days" invertColor />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        type="button"
        onClick={() => onAskCopilot?.("Give me a detailed report of recruiting Time to Fill metrics by role.")}
        className="analytics-link mt-6 cursor-pointer"
      >
        View full report {'->'}
      </button>
    </div>
  )
}

function StartupFitDistribution({
  candidates,
  onAskCopilot,
}: {
  candidates: Candidate[]
  onAskCopilot?: (prompt: string) => void
}) {
  const stats = React.useMemo(() => {
    if (candidates.length === 0) return { avg: 0, stages: {} as Record<string, number> }

    const avg = Math.round(candidates.reduce((acc, c) => acc + c.startupFitScore, 0) / candidates.length)
    const stagesCount = { Seed: 0, 'Series A': 0, 'Series B': 0, Growth: 0, Enterprise: 0 }

    candidates.forEach((c) => {
      c.companyStages.forEach((stage) => {
        if (stage in stagesCount) stagesCount[stage as keyof typeof stagesCount]++
      })
    })

    return { avg, stages: stagesCount }
  }, [candidates])

  const stageSlices = Object.entries(stats.stages).map(([name, val]) => ({
    name,
    val,
    pct: candidates.length > 0 ? Math.round((val / candidates.length) * 100) : 0,
  }))

  return (
    <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[120px_1fr]">
      <div className="flex flex-col items-center">
        <div className="relative flex size-[112px] items-center justify-center shrink-0">
          <svg className="-rotate-90" width={112} height={112}>
            <circle cx={56} cy={56} r={44} fill="none" stroke="rgba(29,255,0,0.08)" strokeWidth={8} />
            <motion.circle
              cx={56}
              cy={56}
              r={44}
              fill="none"
              stroke="#1dff00"
              strokeLinecap="round"
              strokeWidth={8}
              strokeDasharray={2 * Math.PI * 44}
              initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - stats.avg / 100) }}
              transition={{ duration: 1, ease: RECRUITER_EASE }}
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-[28px] font-semibold leading-none text-brand">
              <AnimatedNumber value={stats.avg} />
            </span>
            <p className="mt-1 text-[9px] font-bold text-white/50 tracking-wider">AVG FIT</p>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-zinc-400 leading-normal px-1">
          Average candidate alignment with startup requirements.
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
          Stage Experience Breakdown
        </div>
        <div className="space-y-2.5">
          {stageSlices.map((stage) => (
            <div key={stage.name} className="grid grid-cols-[72px_1fr_36px] items-center gap-2">
              <span className="text-[11px] text-white/70 truncate">{stage.name}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full bg-[#1dff00]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, stage.pct * 1.5)}%` }}
                  transition={{ duration: 0.62, ease: RECRUITER_EASE }}
                />
              </div>
              <span className="text-right text-[10px] font-medium text-zinc-400 tabular-nums">
                {stage.val}
              </span>
            </div>
          ))}
        </div>
        
        <button
          type="button"
          onClick={() => onAskCopilot?.("Explain the startup fit distribution of my candidate pipeline.")}
          className="analytics-link mt-6 cursor-pointer"
        >
          View detailed fit audit {'->'}
        </button>
      </div>
    </div>
  )
}

function AiInsights({ onAskCopilot }: { onAskCopilot?: AnalyticsPageProps['onAskCopilot'] }) {
  return (
    <div className="mt-3 space-y-2">
      {ANALYTICS_INSIGHTS.map((insight, index) => (
        <div
          key={insight.title}
          onClick={() => onAskCopilot?.(`Analyze recruiting insight: ${insight.title} - ${insight.body}`)}
          className="analytics-insight-row cursor-pointer hover:bg-white/5 transition rounded-lg p-1"
        >
          <span className={index === 0 ? 'analytics-insight-icon analytics-insight-icon--green' : 'analytics-insight-icon analytics-insight-icon--purple'}>
            {index === 0 ? <TrendingUp className="size-5" /> : <Zap className="size-5" />}
          </span>
          <span className="min-w-0">
            <strong>{insight.title}</strong>
            <span>{insight.body}</span>
          </span>
        </div>
      ))}

      <div className="analytics-actions-box">
        <p>Recommended actions</p>
        {ANALYTICS_RECOMMENDED_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAskCopilot?.(`Help me execute recommended action: ${action}`)}
            className="flex w-full items-center gap-2 text-left hover:text-[#b6ff00] transition-colors py-0.5 cursor-pointer"
          >
            <Check className="size-3 shrink-0" />
            <span>{action}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="analytics-link mt-2 cursor-pointer"
        onClick={() => onAskCopilot?.('What should I prioritize in my recruiting pipeline this week?')}
      >
        Ask AI Agent for more insights {'->'}
      </button>
    </div>
  )
}
