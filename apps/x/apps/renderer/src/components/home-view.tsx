import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Bot,
  Briefcase,
  Calendar,
  ChevronDown,
  FileText,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { PageTransition, PremiumEmptyState, PremiumSkeleton, ScrollReveal } from '@/components/premium-states'
import { type Candidate } from './recruiter/data'
import { buildHomeMetrics, topMatchCandidates } from './recruiter/metrics'
import { Avatar, ScoreRing } from './recruiter/shared'
import { useRecruiterData } from './recruiter/state'
import { loadMeetingEvents, type MeetingEvent } from '@/lib/calendar/meeting-events'
import type { blocks } from '@x/shared'

interface TreeNode {
  path: string
  name: string
  kind: 'file' | 'dir'
  children?: TreeNode[]
  stat?: { size: number; mtimeMs: number }
}

type RunItem = { id: string; title?: string; createdAt: string }
type TaskItem = { slug: string; name: string; active: boolean; lastRunAt?: string; lastAttemptAt?: string }

type HomeViewProps = {
  tree: TreeNode[]
  runs: RunItem[]
  bgTaskSummaries: TaskItem[]
  onOpenEmail: () => void
  onOpenMeetings: () => void
  onOpenAgents: () => void
  onOpenAgent: (slug: string) => void
  onOpenNote: (path: string) => void
  onOpenRun: (runId: string) => void
  onTakeMeetingNotes: () => void
  onOpenChat?: (prompt?: string) => void
  onOpenRecruiterScreen?: (
    screen: 'roles' | 'candidates' | 'pipeline' | 'analytics',
    candidateId?: string | null,
    initialAction?: 'add-candidate' | 'add-role' | null
  ) => void
  onOpenSearch?: () => void
}

const TOP_MATCHES_LIMIT = 5

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function CandidateAvatar({ candidate, size = 44 }: { candidate: Candidate; size?: number }) {
  if (candidate.photoUrl) {
    return (
      <img
        src={candidate.photoUrl}
        alt=""
        className="shrink-0 rounded-full border border-white/10 object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return <Avatar name={candidate.name} size={size} />
}

function formatInboxTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `${Math.round(diffMin / 60)}h`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yest'
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })
}

function extractAddress(fromStr?: string): string {
  if (!fromStr) return ''
  const match = fromStr.match(/<([^>]+)>/)
  return match ? match[1].trim() : fromStr.trim()
}

function extractName(fromStr?: string): string {
  if (!fromStr) return 'Unknown'
  const match = fromStr.match(/^([^<]+)</)
  if (match?.[1]) return match[1].replace(/^["']|["']$/g, '').trim()
  const address = fromStr.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1] ?? fromStr
  return address.replace(/@.*/, '').replace(/[._+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
export function HomeView({
  bgTaskSummaries,
  onOpenEmail,
  onOpenMeetings,
  onOpenAgents,
  onOpenAgent,
  onOpenChat,
  onOpenRecruiterScreen,
  onOpenSearch,
}: HomeViewProps) {
  const [prompt, setPrompt] = useState('')
  const [isSettled, setIsSettled] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false)

  const { candidates, roles } = useRecruiterData()
  const [realMeetings, setRealMeetings] = useState<MeetingEvent[]>([])
  const [realInbox, setRealInbox] = useState<blocks.GmailThread[]>([])

  useEffect(() => {
    loadMeetingEvents({ upcomingDays: 2 })
      .then((events) => {
        setRealMeetings(events)
      })
      .catch((err) => {
        console.error('Failed to load meeting events:', err)
      })

    window.ipc.invoke('gmail:getImportant', { limit: 5 })
      .then((res) => {
        setRealInbox(res.threads || [])
      })
      .catch((err) => {
        console.error('Failed to load important emails:', err)
      })
  }, [])

  const activeAgents = useMemo(() => {
    return bgTaskSummaries.filter((task) => task.active).slice(0, 3)
  }, [bgTaskSummaries])

  const topMatches = useMemo(
    () => topMatchCandidates(candidates, TOP_MATCHES_LIMIT),
    [candidates],
  )

  const pipeline = useMemo(() => {
    const sourced = candidates.filter(c => c.stage === 'New').length
    const screening = candidates.filter(
      c => c.stage === 'Screening' || c.stage === 'In Review' || c.stage === 'Shortlisted'
    ).length
    const interview = candidates.filter(c => c.stage === 'Interview').length
    const offer = candidates.filter(c => c.stage === 'Offer' || c.stage === 'Hired').length

    return [
      { label: 'Sourced', value: String(sourced), icon: Users, tone: 'text-cyan-300' },
      { label: 'Screening', value: String(screening), icon: FileText, tone: 'text-lime-300' },
      { label: 'Interview', value: String(interview), icon: Send, tone: 'text-amber-300' },
      { label: 'Offer', value: String(offer), icon: Briefcase, tone: 'text-lime-300' },
    ]
  }, [candidates])

  const notifications = useMemo(() => {
    const items = []
    
    // 1. Alert for active agents if any
    const activeRunning = bgTaskSummaries.filter(t => t.active)
    if (activeRunning.length > 0) {
      items.push({
        id: 'notif-agents',
        title: 'Sourcing agent running',
        body: `${activeRunning.length} AI agent(s) finding top candidates`,
        onClick: () => onOpenAgents(),
      })
    }

    // 2. Alert for candidates in Interview stage
    candidates.filter(c => c.stage === 'Interview').slice(0, 2).forEach((c) => {
      items.push({
        id: `notif-int-${c.id}`,
        title: `${c.name} interview scheduled`,
        body: `Interview setup for ${c.title}`,
        onClick: () => onOpenRecruiterScreen?.('candidates', c.id),
      })
    })

    // 3. Alert for candidates in Offer stage
    candidates.filter(c => c.stage === 'Offer').slice(0, 2).forEach((c) => {
      items.push({
        id: `notif-off-${c.id}`,
        title: `${c.name} offer pending`,
        body: `Awaiting response from candidate`,
        onClick: () => onOpenRecruiterScreen?.('candidates', c.id),
      })
    })

    return items
  }, [candidates, bgTaskSummaries, onOpenRecruiterScreen, onOpenAgents])

  const inboxItems = useMemo(() => {
    return realInbox.map((thread) => {
      const latest = thread.messages?.[thread.messages.length - 1] || thread
      const fromStr = latest.from || thread.from || ''
      const senderName = extractName(fromStr)
      const senderEmail = extractAddress(fromStr).toLowerCase()
      const subjectStr = latest.subject || thread.subject || '(No Subject)'
      
      const isLinkedIn = senderEmail.includes('linkedin.com') || senderName.toLowerCase().includes('linkedin')
      
      return {
        id: thread.threadId,
        type: isLinkedIn ? 'linkedin' : 'gmail',
        sender: senderName,
        subject: subjectStr,
        time: formatInboxTime(latest.date || thread.date),
      }
    })
  }, [realInbox])

  const agendaEvents = useMemo(() => {
    return realMeetings.map((event) => {
      const start = event.start.getTime()
      const end = event.end ? event.end.getTime() : start + 30 * 60 * 1000
      const diffMin = Math.round((end - start) / 60000)
      const durationStr = event.isAllDay
        ? 'All day'
        : diffMin >= 60
        ? `${Math.round(diffMin / 60)}h`
        : `${diffMin}m`

      // Format time with meridiem e.g. "10:00 AM"
      const timeStr = event.isAllDay
        ? 'All day'
        : event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

      // Action: match to candidate name in summary if possible
      const matchedCandidate = candidates.find((c) =>
        event.summary.toLowerCase().includes(c.name.toLowerCase())
      )

      return {
        id: event.id,
        time: timeStr,
        title: event.summary,
        duration: durationStr,
        action: () => {
          if (matchedCandidate) {
            onOpenRecruiterScreen?.('candidates', matchedCandidate.id)
          } else {
            onOpenMeetings()
          }
        },
      }
    })
  }, [realMeetings, candidates, onOpenMeetings, onOpenRecruiterScreen])

  const metrics = useMemo(() => {
    const cards = buildHomeMetrics(candidates, roles)
    return cards.map((card) => ({
      ...card,
      icon: card.label === 'Open Roles' ? Briefcase : card.label === 'Active Searches' ? Users : Send,
    }))
  }, [candidates, roles])

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsSettled(true), 220)
    return () => window.clearTimeout(timeout)
  }, [])

  const openRecruiterChat = () => {
    if (prompt.trim()) {
      onOpenChat?.(prompt)
      setPrompt('')
    } else {
      onOpenChat?.()
    }
  }

  const handleAppendToken = (tokenType: string) => {
    const templates: Record<string, string> = {
      'Job Title': 'role:"Senior Product Designer"',
      'Industry': 'industry:"Fintech"',
      'Skills': 'skills:"Figma, CSS"',
      'Experience': 'experience:">5 years"',
      'Job Location': 'location:"Lagos, Nigeria"',
    }
    const appendText = templates[tokenType] || ''
    setPrompt((prev) => (prev ? `${prev} ${appendText}` : appendText))
  }

  const handleImprovePrompt = () => {
    if (!prompt.trim()) {
      setPrompt('Source senior product designers with SaaS startup experience, focusing on strong systems thinking and interaction design portfolio.')
    } else {
      setPrompt((prev) => `Enhance: ${prev} - prioritizing startup-fit, high interaction fidelity, and 4+ years experience with design systems.`)
    }
  }

  return (
    <PageTransition className="recruiter-scroll h-full overflow-auto bg-black text-white">
      <div className="flex min-h-full w-full flex-col gap-4 px-6 py-5 lg:px-7">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[27px] font-medium tracking-[-0.04em] text-white">
              {greeting()}, Miles <span className="text-[24px]">{'\uD83D\uDC4B'}</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400">AI agentic recruiting, running for you.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSearch}
              className="flex h-10 w-[318px] items-center gap-3 rounded-xl border border-white/10 bg-[#050608] px-4 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-left hover:border-white/20 transition cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-xs text-zinc-600 select-none">Search candidates, roles, or notes</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400">Ctrl K</span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsNewDropdownOpen(false)
                }}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[#050608] text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#49ff16] text-[10px] font-bold text-black animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 z-45 w-[280px] rounded-xl border border-zinc-800 bg-[#09090b]/95 p-1.5 shadow-2xl backdrop-blur-md text-white">
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
                onClick={() => {
                  setIsNewDropdownOpen(!isNewDropdownOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex h-10 items-center gap-3 rounded-xl border border-[#2e7b19]/80 bg-[#113f08] px-4 text-sm font-medium text-white shadow-[0_0_24px_rgba(68,255,22,0.18)] hover:brightness-110 transition cursor-pointer"
              >
                <Plus className="h-4 w-4 text-[#62ff28]" />
                New
                <ChevronDown className="h-4 w-4 text-[#62ff28]" />
              </button>
              {isNewDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsNewDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 z-45 w-[200px] rounded-xl border border-zinc-800 bg-[#09090b]/95 p-1.5 shadow-2xl backdrop-blur-md text-white">
                    <button
                      onClick={() => {
                        setIsNewDropdownOpen(false)
                        onOpenRecruiterScreen?.('candidates', null, 'add-candidate')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition text-zinc-200 cursor-pointer"
                    >
                      <Users className="h-4 w-4 text-[#4dff18]" />
                      Add Candidate
                    </button>
                    <button
                      onClick={() => {
                        setIsNewDropdownOpen(false)
                        onOpenRecruiterScreen?.('roles', null, 'add-role')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition text-zinc-200 cursor-pointer"
                    >
                      <Briefcase className="h-4 w-4 text-[#4dff18]" />
                      Create Job Position
                    </button>
                    <button
                      onClick={() => {
                        setIsNewDropdownOpen(false)
                        setPrompt("Draft a LinkedIn outreach sequence to candidates sourced for the Senior Product Designer role.")
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition text-zinc-200 cursor-pointer"
                    >
                      <Send className="h-4 w-4 text-[#4dff18]" />
                      Draft AI Outreach
                    </button>
                    <button
                      onClick={() => {
                        setIsNewDropdownOpen(false)
                        setPrompt("Source product designers in Lagos with 5+ years experience.")
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition text-zinc-200 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-[#4dff18]" />
                      Start Sourcing Search
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {!isSettled ? (
          <div className="grid flex-1 grid-cols-3 gap-4">
            <PremiumSkeleton className="h-[172px] rounded-xl" />
            <PremiumSkeleton className="h-[172px] rounded-xl" />
            <PremiumSkeleton className="h-[172px] rounded-xl" />
            <PremiumSkeleton className="col-span-2 h-[378px] rounded-xl" />
            <PremiumSkeleton className="h-[378px] rounded-xl" />
            <PremiumSkeleton className="h-[230px] rounded-xl" />
            <PremiumSkeleton className="h-[230px] rounded-xl" />
            <PremiumSkeleton className="h-[230px] rounded-xl" />
          </div>
        ) : (
          <>
            <ScrollReveal>
              <section className="grid grid-cols-3 gap-4">
                {metrics.map((metric) => (
                  <article
                    key={metric.label}
                    onClick={() => onOpenRecruiterScreen?.(metric.screen)}
                    className="premium-lift group relative overflow-hidden rounded-xl border border-white/10 bg-[#080a0d] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] cursor-pointer hover:border-[#4dff18]/25 transition duration-300"
                  >
                    <div className="absolute right-6 top-4 h-20 w-20 rounded-full bg-[#3cff0b]/10 blur-xl transition group-hover:bg-[#3cff0b]/20" />
                    <div className="relative flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-400">{metric.label}</p>
                        <p className="mt-2 text-3xl font-light tracking-[-0.06em]">{metric.value}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-zinc-400">
                          {metric.hasDelta ? (
                            <>
                              {metric.trend === 'down' ? (
                                <ArrowDown className="h-3 w-3 text-red-400" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-[#4dff18]" />
                              )}
                              <span className={metric.trend === 'down' ? 'text-red-400' : 'text-[#4dff18]'}>
                                {metric.deltaPrefix}
                              </span>
                              <span>{metric.deltaSuffix}</span>
                            </>
                          ) : (
                            <span className="text-zinc-500">{metric.sub}</span>
                          )}
                        </div>
                      </div>
                      <div className="grid h-16 w-16 place-items-center rounded-full border border-[#43ff15]/20 bg-[#42ff12]/10 text-[#52ff1f] shadow-[0_0_35px_rgba(66,255,18,0.24)]">
                        <metric.icon className="h-8 w-8" />
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <section className="grid grid-cols-[1fr_372px] gap-4">
                <article className="premium-lift relative overflow-hidden rounded-xl border border-white/10 bg-[#07090b] p-0">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_90%_5%,rgba(72,255,22,0.58),transparent_17%),radial-gradient(circle_at_82%_28%,rgba(62,255,14,0.15),transparent_34%)]" />
                  <div className="absolute right-[-2rem] top-[-2rem] h-48 w-80 rotate-[-18deg] rounded-full border border-[#4cff19]/20 bg-[#4cff19]/10 blur-sm" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_40%)]" />
                  <div className="relative">
                    <div className="px-7 pb-5 pt-6">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium tracking-[-0.03em]">AI Recruiter</h2>
                        <span className="rounded-full border border-[#42ff13]/20 bg-[#42ff13]/10 px-3 py-1 text-xs text-[#5fff2a]">Command Center</span>
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d1014]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_36px_rgba(77,255,24,0.05)]">
                        <div className="relative min-h-[118px] px-6 pt-5">
                          <div className="pointer-events-none absolute left-5 top-5 h-7 w-40 rounded-full bg-white/15 blur-2xl" />
                          <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            onKeyDown={(event) => {
                              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') openRecruiterChat()
                            }}
                            className="relative min-h-[72px] w-full resize-none bg-transparent text-xl font-medium leading-8 tracking-[-0.04em] text-white outline-none placeholder:text-zinc-500"
                            placeholder="Example: Find cybersecurity analysts in Lagos"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {['Job Title', 'Industry', 'Skills', 'Experience', 'Job Location'].map((chip) => (
                              <button
                                key={chip}
                                onClick={() => handleAppendToken(chip)}
                                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-[#4dff18]/25 hover:bg-[#4dff18]/10 hover:text-white cursor-pointer"
                              >
                                {chip} <span className="ml-1 text-[#4dff18]">+</span>
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleImprovePrompt}
                              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-[#4dff18]/25 hover:text-[#4dff18] cursor-pointer"
                              aria-label="Improve prompt"
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                            <button
                              onClick={openRecruiterChat}
                              className="grid h-11 w-16 place-items-center rounded-full bg-[#4dff18] text-black shadow-[0_0_26px_rgba(77,255,24,0.42)] transition hover:scale-[1.03] cursor-pointer"
                              aria-label="Start recruiter search"
                            >
                              <ArrowUp className="h-5 w-5 rotate-90" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 px-7 pb-6 pt-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                          <Search className="h-4 w-4 text-[#4dff18]" />
                          Smart Searches
                        </div>
                        <p className="hidden text-sm text-zinc-500 lg:block">Suggested searches based on high-performing recruiter workflows</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          ['Software Engineer', 'Find TypeScript and Node.js engineers at Series A companies', FileText],
                          ['Data Analyst', 'Find SQL, Python, and dashboarding talent with 3+ years', Briefcase],
                          ['Cloud Engineer', 'Find AWS-certified engineers skilled in Terraform', Users],
                        ].map(([title, description, Icon]) => (
                          <button
                            key={title as string}
                            onClick={() => onOpenChat?.(description as string)}
                            className="group rounded-xl border border-white/10 bg-[#101318]/82 p-4 text-left transition hover:border-[#4dff18]/28 hover:bg-[#142013] cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-[#4dff18]" />
                                <p className="text-sm font-semibold text-zinc-100">{title as string}</p>
                              </div>
                              <ArrowUp className="h-4 w-4 rotate-90 text-zinc-500 transition group-hover:text-[#4dff18]" />
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{description as string}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className="premium-lift rounded-xl border border-white/10 bg-[#07090b] p-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium tracking-[-0.03em]">Top Matches</h2>
                    <button
                      onClick={() => onOpenRecruiterScreen?.('candidates')}
                      className="text-xs text-zinc-400 hover:text-[#4dff18] cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  <div className="mt-5 space-y-4">
                    {topMatches.length === 0 ? (
                      <PremiumEmptyState
                        className="min-h-[250px]"
                        icon={<Users className="h-6 w-6" />}
                        title="No matches yet"
                        description="Ask the AI Recruiter to source candidates and the strongest evidence-backed matches will appear here."
                      />
                    ) : (
                      topMatches.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => onOpenRecruiterScreen?.('candidates', candidate.id)}
                          className="flex w-full items-center gap-4 text-left hover:bg-white/[0.03] p-1.5 rounded-xl transition cursor-pointer"
                        >
                          <CandidateAvatar candidate={candidate} size={44} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{candidate.name}</p>
                            <p className="truncate text-xs text-zinc-400">{candidate.title}</p>
                            <p className="truncate text-xs text-zinc-500">{`${candidate.location} · ${candidate.experienceYears}y exp`}</p>
                          </div>
                          <ScoreRing score={candidate.matchScore} size={44} />
                        </button>
                      ))
                    )}
                  </div>
                </article>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={140}>
              <section className="grid grid-cols-[1.03fr_0.88fr_1.55fr] gap-4">
                <article className="premium-lift rounded-xl border border-white/10 bg-[#07090b] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium tracking-[-0.03em]">Pipeline Overview</h2>
                    <button
                      onClick={() => onOpenRecruiterScreen?.('pipeline')}
                      className="text-xs text-zinc-500 hover:text-[#4dff18] cursor-pointer"
                    >
                      View pipeline
                    </button>
                  </div>
                  <div className="mt-8">
                    {candidates.length === 0 ? (
                      <PremiumEmptyState
                        className="min-h-[120px] py-4"
                        icon={<Briefcase className="h-5 w-5 text-zinc-500" />}
                        title="Pipeline is empty"
                        description="Define a job position and source talent to see candidates move through your pipeline."
                      />
                    ) : (
                      <div className="grid grid-cols-4 gap-5">
                        {pipeline.map((stage) => (
                          <button
                            key={stage.label}
                            onClick={() => onOpenRecruiterScreen?.('pipeline')}
                            className="space-y-4 text-left hover:bg-white/[0.02] p-1.5 rounded-xl transition cursor-pointer"
                          >
                            <p className="text-xs text-zinc-300">{stage.label}</p>
                            <p className="text-2xl font-light tracking-[-0.05em]">{stage.value}</p>
                            <stage.icon className={`h-5 w-5 ${stage.tone}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>

                <article className="premium-lift rounded-xl border border-white/10 bg-[#07090b] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium tracking-[-0.03em]">Active Agents</h2>
                    <button onClick={onOpenAgents} className="text-xs text-zinc-500 hover:text-[#4dff18] cursor-pointer">View all</button>
                  </div>
                  <div className="mt-4 divide-y divide-white/8">
                    {activeAgents.length === 0 ? (
                      <PremiumEmptyState
                        className="min-h-[140px] py-4"
                        icon={<Bot className="h-5 w-5 text-zinc-500" />}
                        title="No active agents"
                        description="Launch a sourcing search or outreach agent to see progress here."
                      />
                    ) : (
                      activeAgents.map((agent, index) => (
                        <button
                          key={agent.slug}
                          onClick={() => onOpenAgent(agent.slug)}
                          className="flex w-full items-center gap-3 py-3 text-left cursor-pointer hover:bg-white/[0.02] px-1 rounded-lg transition"
                        >
                          <span className={`grid h-9 w-9 place-items-center rounded-full ${index === 0 ? 'bg-cyan-500/20 text-cyan-300' : index === 1 ? 'bg-lime-500/20 text-lime-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            <Bot className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white">{agent.name}</span>
                            <span className="block truncate text-xs text-zinc-500">{agent.lastAttemptAt || agent.lastRunAt || 'Monitoring recruiter workflow'}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[#4dff18]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4dff18]" />
                            Running
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </article>

                <div className="grid grid-cols-2 gap-4">
                  <article className="premium-lift rounded-xl border border-white/10 bg-[#07090b] p-5">
                    <div className="flex items-center gap-6 border-b border-white/8 pb-3 text-sm">
                      <span className="text-white border-b-2 border-brand pb-3 -mb-3.5 z-10 cursor-pointer">Agenda</span>
                      <button
                        onClick={onOpenEmail}
                        className="text-zinc-500 hover:text-white transition pb-3 -mb-3.5 cursor-pointer"
                      >
                        Inbox
                      </button>
                    </div>
                    <div className="mt-4 space-y-4">
                      {agendaEvents.length === 0 ? (
                        <div className="py-6 text-center text-xs text-zinc-500">
                          No upcoming events
                        </div>
                      ) : (
                        agendaEvents.map((event) => (
                          <button
                            key={event.id || event.title}
                            onClick={event.action}
                            className="flex w-full items-center gap-3 text-left hover:bg-white/[0.02] p-1 rounded-lg transition cursor-pointer"
                          >
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-zinc-500">{event.time}</p>
                              <p className="truncate text-xs text-zinc-300">{event.title}</p>
                            </div>
                            <span className="text-[11px] text-zinc-500">{event.duration}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={onOpenMeetings}
                      className="mt-6 text-sm text-[#4dff18] hover:underline cursor-pointer"
                    >
                      View full agenda -&gt;
                    </button>
                  </article>

                  <article className="premium-lift rounded-xl border border-white/10 bg-[#07090b] p-5">
                    <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                      <h2 className="text-lg font-medium tracking-[-0.03em]">Inbox</h2>
                      {inboxItems.length > 0 && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#4dff18] text-[11px] font-bold text-black">
                          {inboxItems.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-5 space-y-6">
                      {inboxItems.length === 0 ? (
                        <div className="py-6 text-center text-xs text-zinc-500">
                          Your inbox is empty
                        </div>
                      ) : (
                        inboxItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={onOpenEmail}
                            className="flex w-full gap-3 text-left hover:bg-white/[0.02] p-1 rounded-lg transition cursor-pointer"
                          >
                            {item.type === 'linkedin' ? (
                              <span className="grid h-7 w-7 place-items-center rounded bg-[#0a66c2] text-xs font-bold text-white shrink-0">in</span>
                            ) : (
                              <span className="grid h-7 w-7 place-items-center rounded bg-white/10 text-[#ff4c4c] shrink-0">
                                <Mail className="h-4 w-4" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-zinc-200">{item.type === 'linkedin' ? 'LinkedIn' : 'Gmail'}</p>
                              <p className="truncate text-xs text-zinc-500">{item.sender}: {item.subject}</p>
                            </div>
                            <span className="text-[11px] text-zinc-500 shrink-0">{item.time}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={onOpenEmail}
                      className="mt-8 text-sm text-[#4dff18] hover:underline cursor-pointer"
                    >
                      Go to inbox -&gt;
                    </button>
                  </article>
                </div>
              </section>
            </ScrollReveal>
          </>
        )}
      </div>
    </PageTransition>
  )
}
