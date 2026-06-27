"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import {
  Bot,
  ChevronRight,
  ChevronDown,
  FilePlus,
  Globe,
  AlertTriangle,
  Mic,
  SquarePen,
  Plug,
  LoaderIcon,
  Settings,
  Square,
  Video,
  TrendingUp,
  LayoutDashboard,
  Briefcase,
  Users,
  Send,
  Workflow,
  BarChart3,
  Calendar,
  MessageSquare,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SettingsDialog } from "@/components/settings-dialog"
import { extractConferenceLink } from "@/lib/calendar-event"
import { useBilling } from "@/hooks/useBilling"
import { toast } from "@/lib/toast"
import { ServiceEvent } from "@x/shared/src/service-events.js"
import z from "zod"
import { ROLES } from "@/components/recruiter/data"
import { googleDisplayName } from "@/lib/google-profile"

// Profile shown in the sidebar account card. Edit these to change the
// displayed recruiter identity (avatar initials are derived from the name).
const PROFILE_NAME = "Miles Okafor"
const PROFILE_ROLE = "Senior Recruiter"

interface TreeNode {
  path: string
  name: string
  kind: "file" | "dir"
  children?: TreeNode[]
  loaded?: boolean
  stat?: { size: number; mtimeMs: number }
}

type KnowledgeActions = {
  createNote: (parentPath?: string) => void
  createFolder: (parentPath?: string) => Promise<string>
  openGraph: () => void
  openBases: () => void
  openKnowledgeView: () => void
  openWorkspaceAt: (path?: string) => void
  createWorkspace: (name: string) => Promise<string>
  expandAll: () => void
  collapseAll: () => void
  rename: (path: string, newName: string, isDir: boolean) => Promise<void>
  remove: (path: string) => Promise<void>
  copyPath: (path: string) => void
  revealInFileManager: (path: string, isDir: boolean) => void
  onOpenInNewTab?: (path: string) => void
}

function displayNoteName(node: TreeNode): string {
  if (node.kind === 'file' && node.name.toLowerCase().endsWith('.md')) {
    return node.name.slice(0, -3)
  }
  return node.name
}

function formatBillingPlanName(plan: string | null | undefined) {
  if (!plan) return 'No plan'
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`
}

type TaskSummary = {
  slug: string
  name: string
  active: boolean
  createdAt: string
  lastAttemptAt?: string
  lastRunAt?: string
  lastRunError?: string
}

type ServiceEventType = z.infer<typeof ServiceEvent>

const MAX_SYNC_EVENTS = 1000
const RUN_STALE_MS = 2 * 60 * 60 * 1000

const SERVICE_LABELS: Record<string, string> = {
  gmail: "Syncing Gmail",
  calendar: "Syncing Calendar",
  fireflies: "Syncing Fireflies",
  granola: "Syncing Granola",
  graph: "Updating knowledge",
  voice_memo: "Processing voice memo",
  email_labeling: "Labeling emails",
  note_tagging: "Tagging notes",
  agent_notes: "Updating agent notes",
}

function summarizeServiceError(error: string): string {
  const firstLine = error.split("\n").find((line) => line.trim().length > 0)
  return firstLine?.trim() || error.trim()
}

function collectServiceErrors(events: ServiceEventType[]): Map<string, string> {
  const errors = new Map<string, string>()
  for (const event of events) {
    if (event.type === "error") {
      errors.set(event.service, summarizeServiceError(event.error))
      continue
    }
    if (event.type === "run_complete" && event.outcome !== "error") {
      errors.delete(event.service)
    }
  }
  return errors
}

type SidebarContentPanelProps = {
  tree: TreeNode[]
  onSelectFile: (path: string, kind: "file" | "dir") => void
  knowledgeActions: KnowledgeActions
  bgTaskSummaries?: TaskSummary[]
  onOpenMeetings?: () => void
  onOpenBgTasks?: () => void
  onOpenAgent?: (slug: string) => void
  recentRuns?: { id: string; title?: string; createdAt: string }[]
  onOpenRun?: (runId: string) => void
  onOpenEmail?: (threadId?: string) => void
  onOpenHome?: () => void
  onOpenRoles?: () => void
  onOpenCandidates?: () => void
  onOpenSourcing?: () => void
  onOpenPipeline?: () => void
  onOpenAnalytics?: () => void
  onOpenChat?: () => void
  onNewChat?: () => void
  onToggleBrowser?: () => void
  onVoiceNoteCreated?: (path: string) => void
  /** Which primary destination is currently active, for nav highlighting. */
  activeNav?: 'home' | 'chat' | 'roles' | 'candidates' | 'sourcing' | 'pipeline' | 'analytics' | 'email' | 'meetings' | 'knowledge' | 'agents' | 'workspaces' | null
  /** Live meeting recording state, so the recording row can show its indicator/stop. */
  meetingRecordingState?: 'idle' | 'connecting' | 'recording' | 'stopping'
  recordingMeetingSource?: string | null
  onToggleMeetingRecording?: () => void
} & React.ComponentProps<typeof Sidebar>

function formatEventTime(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function SyncStatusBar() {
  const { state } = useSidebar()
  const [activeServices, setActiveServices] = useState<Map<string, string>>(new Map())
  const [serviceErrors, setServiceErrors] = useState<Map<string, string>>(new Map())
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [logEvents, setLogEvents] = useState<ServiceEventType[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const runTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Track active runs from real-time events
  useEffect(() => {
    const cleanup = window.ipc.on('services:events', (event) => {
      const nextEvent = event as ServiceEventType
      if (nextEvent.type === 'run_start') {
        setActiveServices((prev) => {
          const next = new Map(prev)
          next.set(nextEvent.runId, nextEvent.service)
          return next
        })
        const existingTimeout = runTimeoutsRef.current.get(nextEvent.runId)
        if (existingTimeout) clearTimeout(existingTimeout)
        const timeout = setTimeout(() => {
          setActiveServices((prev) => {
            if (!prev.has(nextEvent.runId)) return prev
            const next = new Map(prev)
            next.delete(nextEvent.runId)
            return next
          })
          runTimeoutsRef.current.delete(nextEvent.runId)
        }, RUN_STALE_MS)
        runTimeoutsRef.current.set(nextEvent.runId, timeout)
      } else if (nextEvent.type === 'run_complete') {
        setActiveServices((prev) => {
          const next = new Map(prev)
          next.delete(nextEvent.runId)
          return next
        })
        if (nextEvent.outcome !== 'error') {
          setServiceErrors((prev) => {
            if (!prev.has(nextEvent.service)) return prev
            const next = new Map(prev)
            next.delete(nextEvent.service)
            return next
          })
        }
        const existingTimeout = runTimeoutsRef.current.get(nextEvent.runId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          runTimeoutsRef.current.delete(nextEvent.runId)
        }
      } else if (nextEvent.type === 'error') {
        setServiceErrors((prev) => {
          const next = new Map(prev)
          next.set(nextEvent.service, summarizeServiceError(nextEvent.error))
          return next
        })
      }
    })
    return cleanup
  }, [])

  useEffect(() => {
    return () => {
      runTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      runTimeoutsRef.current.clear()
    }
  }, [])

  // Load logs from JSONL file when popover opens
  useEffect(() => {
    if (!popoverOpen) return
    let cancelled = false
    async function loadLogs() {
      setLogLoading(true)
      try {
        const result = await window.ipc.invoke('workspace:readFile', {
          path: 'logs/services.jsonl',
          encoding: 'utf8',
        })
        if (cancelled) return
        const lines = result.data.trim().split('\n').filter(Boolean)
        const parsed: ServiceEventType[] = []
        for (const line of lines) {
          try {
            parsed.push(JSON.parse(line))
          } catch {
            // skip malformed lines
          }
        }
        setServiceErrors(collectServiceErrors(parsed))
        // Newest first, limit to 1000
        setLogEvents(parsed.reverse().slice(0, MAX_SYNC_EVENTS))
      } catch {
        if (!cancelled) {
          setLogEvents([])
          setServiceErrors(new Map())
        }
      } finally {
        if (!cancelled) setLogLoading(false)
      }
    }
    loadLogs()
    return () => { cancelled = true }
  }, [popoverOpen])

  const isSyncing = activeServices.size > 0
  const isCollapsed = state === "collapsed"
  const errorEntries = Array.from(serviceErrors.entries())
  const primaryErrorService = errorEntries[0]?.[0] ?? null
  const hasServiceErrors = errorEntries.length > 0

  // Build status label from active services
  const activeServiceNames = [...new Set(activeServices.values())]
  const statusLabel = isSyncing
    ? activeServiceNames.map((s) => SERVICE_LABELS[s] || s).join(", ")
    : hasServiceErrors
      ? errorEntries.length === 1
        ? `${SERVICE_LABELS[primaryErrorService ?? ""] || primaryErrorService} failed`
        : "Recent sync issues"
      : "All caught up"

  return (
    <>
      <SidebarFooter className="jobraker-sidebar-footer border-t border-border/40 px-2 py-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center justify-between rounded-xl transition-colors hover:bg-foreground/5",
                isCollapsed ? "mx-auto h-8 w-8 justify-center p-0" : "w-full px-2 py-1.5 text-xs",
                hasServiceErrors && !isSyncing ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
              )}
              title={isCollapsed ? statusLabel : undefined}
            >
              <span className={cn("flex items-center min-w-0", isCollapsed ? "justify-center" : "gap-2")}>
                {isSyncing ? (
                  <LoaderIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
                ) : hasServiceErrors ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                ) : (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                )}
                {!isCollapsed && <span className="truncate">{statusLabel}</span>}
              </span>
              {!isCollapsed && <ChevronRight className="h-3 w-3 shrink-0" />}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={4}
            className="w-96 p-0"
          >
            <div className="p-3 border-b">
              <h4 className="font-semibold text-sm">Sync Activity</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSyncing || hasServiceErrors ? statusLabel : "All services up to date"}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {logLoading ? (
                <div className="flex items-center justify-center py-4">
                  <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : logEvents.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No recent activity.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logEvents.map((event, idx) => (
                    <div
                      key={`${event.runId}-${event.ts}-${idx}`}
                      className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
                    >
                      <span className="shrink-0 text-[10px] leading-4 text-muted-foreground/70">
                        {formatEventTime(event.ts)}
                      </span>
                      <span className="shrink-0">
                        <span className={cn(
                          "inline-block rounded px-1 py-0.5 text-[10px] font-medium leading-none",
                          event.level === 'error' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          event.level === 'warn' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {SERVICE_LABELS[event.service]?.split(" ").slice(-1)[0] || event.service}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="leading-4 text-foreground/80">{event.message}</p>
                        {event.type === 'error' && (
                          <p
                            className="truncate text-[11px] leading-4 text-red-600/90 dark:text-red-400/90"
                            title={event.error}
                          >
                            {summarizeServiceError(event.error)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </>
  )
}

export function SidebarContentPanel({
  tree,
  onSelectFile,
  knowledgeActions,
  bgTaskSummaries = [],
  onOpenMeetings,
  onOpenBgTasks,
  onOpenAgent,
  recentRuns = [],
  onOpenRun,
  onOpenEmail,
  onOpenHome,
  onOpenRoles,
  onOpenCandidates,
  onOpenSourcing,
  onOpenPipeline,
  onOpenAnalytics,
  onOpenChat,
  onNewChat,
  onToggleBrowser,
  onVoiceNoteCreated,
  activeNav,
  meetingRecordingState = 'idle',
  recordingMeetingSource = null,
  onToggleMeetingRecording,
  ...props
}: SidebarContentPanelProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  const [profileName, setProfileName] = useState(PROFILE_NAME)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [profileEmail, setProfileEmail] = useState<string | null>(null)

  const profileInitials = React.useMemo(() => {
    return profileName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }, [profileName])

  const [hasOauthError, setHasOauthError] = useState(false)
  const [showOauthAlert, setShowOauthAlert] = useState(true)
  const [connectionsSettingsOpen, setConnectionsSettingsOpen] = useState(false)
  const [openConnectionsAfterClose, setOpenConnectionsAfterClose] = useState(false)
  const connectorsButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isJobrakerRecruiterConnected, setIsJobrakerRecruiterConnected] = useState(false)
  const [appUrl, setAppUrl] = useState<string | null>(null)
  const { billing } = useBilling(isJobrakerRecruiterConnected)

  // Nav previews: unread important email count + next upcoming meeting.
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([])
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadEmail = async () => {
      try {
        const result = await window.ipc.invoke('gmail:getImportant', { limit: 50 })
        if (cancelled) return
        const unread = result.threads.filter((t) => t.unread === true)
        setUnreadEmailCount(unread.length)
      } catch { /* ignore */ }
    }
    void loadEmail()
    const cleanup = window.ipc.on('workspace:didChange', (event) => {
      const paths = event.type === 'bulkChanged' ? (event.paths ?? [])
        : event.type === 'moved' ? [event.from, event.to]
        : 'path' in event ? [event.path] : []
      if (paths.some((p) => typeof p === 'string' && p.startsWith('gmail_sync'))) void loadEmail()
    })
    return () => { cancelled = true; cleanup() }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadNext = async () => {
      try {
        const exists = await window.ipc.invoke('workspace:exists', { path: 'calendar_sync' })
        if (!exists.exists) { if (!cancelled) setMeetings([]); return }
        const entries = await window.ipc.invoke('workspace:readdir', {
          path: 'calendar_sync',
          opts: { recursive: false, includeHidden: false, includeStats: false },
        })
        const jsonEntries = entries.filter((e) => e.kind === 'file' && e.name.endsWith('.json'))
        const settled = await Promise.allSettled(jsonEntries.map(async (entry) => {
          const result = await window.ipc.invoke('workspace:readFile', { path: entry.path, encoding: 'utf8' })
          return normalizeUpcomingMeeting(JSON.parse(result.data) as RawCalendarEvent, entry.path)
        }))
        const items: UpcomingMeeting[] = []
        for (const r of settled) if (r.status === 'fulfilled' && r.value) items.push(r.value)
        items.sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
          return a.start.getTime() - b.start.getTime()
        })
        if (!cancelled) setMeetings(items.slice(0, 1))
      } catch { /* ignore */ }
    }
    void loadNext()
    const cleanup = window.ipc.on('workspace:didChange', (event) => {
      const paths = event.type === 'bulkChanged' ? (event.paths ?? [])
        : event.type === 'moved' ? [event.from, event.to]
        : 'path' in event ? [event.path] : []
      if (paths.some((p) => typeof p === 'string' && p.startsWith('calendar_sync'))) void loadNext()
    })
    const tick = setInterval(() => void loadNext(), 60 * 60 * 1000)
    return () => { cancelled = true; clearInterval(tick); cleanup() }
  }, [])

  const recentNotes = React.useMemo<TreeNode[]>(() => {
    const out: TreeNode[] = []
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.path === 'knowledge/Meetings' || n.path === 'knowledge/Workspace') continue
        if (n.kind === 'file') out.push(n)
        else if (n.children?.length) walk(n.children)
      }
    }
    walk(tree)
    return out
      .filter((n) => n.stat?.mtimeMs)
      .sort((a, b) => (b.stat?.mtimeMs ?? 0) - (a.stat?.mtimeMs ?? 0))
      .slice(0, 5)
  }, [tree])

  // Recents: most recently touched notes / agents / chats, interleaved by
  // recency. Capped per type (3 notes, 2 agents, 1 chat) and 5 overall.
  type QuickAccessItem = {
    key: string
    label: string
    recency: number
    type: 'note' | 'agent' | 'chat'
    onClick: () => void
  }
  const quickAccessItems = React.useMemo<QuickAccessItem[]>(() => {
    const items: QuickAccessItem[] = []

    for (const note of recentNotes.slice(0, 3)) {
      items.push({
        key: `note:${note.path}`,
        label: displayNoteName(note),
        recency: note.stat?.mtimeMs ?? 0,
        type: 'note',
        onClick: () => onSelectFile(note.path, 'file'),
      })
    }

    const agentRecency = (t: TaskSummary) => {
      const ts = t.lastRunAt ?? t.lastAttemptAt ?? t.createdAt
      const ms = ts ? new Date(ts).getTime() : 0
      return Number.isFinite(ms) ? ms : 0
    }
    for (const t of [...bgTaskSummaries].sort((a, b) => agentRecency(b) - agentRecency(a)).slice(0, 2)) {
      items.push({
        key: `agent:${t.slug}`,
        label: t.name,
        recency: agentRecency(t),
        type: 'agent',
        onClick: () => onOpenAgent?.(t.slug),
      })
    }

    const chatRecency = (r: { createdAt: string }) => {
      const ms = new Date(r.createdAt).getTime()
      return Number.isFinite(ms) ? ms : 0
    }
    for (const r of [...recentRuns].sort((a, b) => chatRecency(b) - chatRecency(a)).slice(0, 1)) {
      items.push({
        key: `chat:${r.id}`,
        label: r.title || '(Untitled chat)',
        recency: chatRecency(r),
        type: 'chat',
        onClick: () => onOpenRun?.(r.id),
      })
    }

    return items.sort((a, b) => b.recency - a.recency).slice(0, 5)
  }, [recentNotes, bgTaskSummaries, recentRuns, onSelectFile, onOpenAgent, onOpenRun])

  const openRolesCount = React.useMemo(
    () => ROLES.filter((r) => r.status === 'Open' || r.status === 'Interviewing').length,
    [],
  )

  useEffect(() => {
    let mounted = true

    const refreshOauthError = async () => {
      try {
        const result = await window.ipc.invoke('oauth:getState', null)
        const config = result.config || {}
        const hasError = Object.values(config).some((entry) => Boolean(entry?.error))
        const connected = config['jobraker-recruiter']?.connected ?? false
        
        // Extract Google profile if connected
        const googleEntry = config['google'] as {
          connected?: boolean
          profileName?: string | null
          profileImage?: string | null
          profileEmail?: string | null
        }
        if (googleEntry?.connected) {
          setProfileName(googleDisplayName(googleEntry.profileName, googleEntry.profileEmail, PROFILE_NAME))
          setProfileImage(googleEntry.profileImage || null)
          setProfileEmail(googleEntry.profileEmail || null)
        } else {
          setProfileName(PROFILE_NAME)
          setProfileImage(null)
          setProfileEmail(null)
        }

        if (mounted) {
          setHasOauthError(hasError)
          setIsJobrakerRecruiterConnected(connected)
          if (!hasError) {
            setShowOauthAlert(true)
          }
        }
        if (connected && mounted) {
          try {
            const account = await window.ipc.invoke('account:getJobrakerRecruiter', null)
            if (mounted) setAppUrl(account.config?.appUrl ?? null)
          } catch { /* ignore */ }
        }
      } catch (error) {
        console.error('Failed to fetch OAuth state:', error)
        if (mounted) {
          setHasOauthError(false)
          setIsJobrakerRecruiterConnected(false)
          setShowOauthAlert(true)
        }
      }
    }

    refreshOauthError()
    const cleanup = window.ipc.on('oauth:didConnect', () => {
      refreshOauthError()
    })

    return () => {
      mounted = false
      cleanup()
    }
  }, [])

  // Upcoming meeting used for the hover take-notes / join actions on the
  // Meetings nav button.
  const previewMeeting = meetings[0]
  // Drive the recording indicator off the global recording state — there is only
  // one active recording, so it must show even for ad-hoc recordings or meetings
  // that aren't the upcoming one previewed here.
  const meetingIsRecording = meetingRecordingState === 'recording'
    || meetingRecordingState === 'connecting'
    || meetingRecordingState === 'stopping'
  const meetingIsBusy = meetingRecordingState === 'connecting' || meetingRecordingState === 'stopping'
  // Title of the meeting being recorded, when it's the upcoming one we preview.
  const recordingMeeting = previewMeeting != null && recordingMeetingSource === previewMeeting.source
    ? previewMeeting
    : null

  return (
    <Sidebar className="jobraker-recruiter-sidebar border-r-0" {...props}>
      <SidebarHeader className="titlebar-drag-region pb-3">
        {/* Top spacer to clear the traffic lights + fixed toggle row */}
        <div className="h-8" />
        {/* Brand mark */}
        <div className={cn("titlebar-no-drag flex items-center pb-1", isCollapsed ? "justify-center px-0" : "gap-2.5 px-4 justify-between")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo-only.png"
                alt="Jobraker Recruiter"
                className="size-7 shrink-0 rounded-lg object-cover brand-glow"
              />
              <span className="text-[17px] font-bold tracking-tight truncate">
                Jobraker <span className="text-brand">Recruiter</span>
              </span>
            </div>
          )}
          <SidebarTrigger className="text-foreground/60 hover:text-foreground hover:bg-foreground/5 size-8" />
        </div>
        {/* Profile card */}
        <div className={cn("titlebar-no-drag pt-1", isCollapsed ? "px-0 flex justify-center" : "px-3")}>
          <SettingsDialog>
            <button
              type="button"
              className={cn(
                "jobraker-sidebar-profile group",
                isCollapsed ? "flex items-center justify-center p-0 border-0 bg-transparent" : "w-full"
              )}
            >
              <span className="jobraker-sidebar-avatar flex items-center justify-center overflow-hidden">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={profileName}
                    className="h-full w-full object-cover"
                    onError={() => setProfileImage(null)}
                  />
                ) : (
                  profileInitials
                )}
                <span className="jobraker-sidebar-avatar-dot" />
              </span>
              {!isCollapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-sm font-semibold text-foreground">{profileName}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{profileEmail || PROFILE_ROLE}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
                </>
              )}
            </button>
          </SettingsDialog>
        </div>
        {/* Quick actions */}
        {!isCollapsed && (
          <div className="jobraker-recruiter-quick-actions titlebar-no-drag flex items-center gap-1.5 px-3">
            {onNewChat && (
              <ActionButton icon={SquarePen} label="New chat" onClick={onNewChat} />
            )}
            <ActionButton icon={FilePlus} label="New note" onClick={() => knowledgeActions.createNote()} />
            <VoiceNoteButton onNoteCreated={onVoiceNoteCreated} variant="action" />
            {onToggleBrowser && (
              <ActionButton icon={Globe} label="Run browser task" onClick={onToggleBrowser} />
            )}
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        {/* Primary navigation */}
        <SidebarGroup className="flex flex-col">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeNav === 'home'} onClick={onOpenHome} tooltip="Dashboard">
                  <LayoutDashboard className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeNav === 'chat'} onClick={onOpenChat ?? onNewChat} tooltip="Chat">
                  <MessageSquare className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'roles'}
                  onClick={onOpenRoles}
                  tooltip="Roles"
                >
                  <Briefcase className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Roles</span>
                  {openRolesCount > 0 && (
                    <span className="shrink-0 self-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {openRolesCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'candidates'}
                  onClick={onOpenCandidates}
                  tooltip="Candidates"
                >
                  <Users className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Candidates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'sourcing'}
                  onClick={onOpenSourcing}
                  tooltip="Sourcing"
                >
                  <Globe className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Sourcing</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'email'}
                  onClick={() => onOpenEmail?.()}
                  tooltip="Outreach"
                >
                  <Send className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Outreach</span>
                  {unreadEmailCount > 0 && (
                    <span className="shrink-0 self-center rounded-full bg-brand/80 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                      {unreadEmailCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeNav === 'pipeline'} onClick={onOpenPipeline} tooltip="Pipeline">
                  <Workflow className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Pipeline</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'meetings'}
                  onClick={onOpenMeetings}
                  tooltip="Meetings"
                >
                  <Calendar className={cn('size-5 shrink-0', meetingIsRecording && 'text-red-500')} />
                  <span className="flex-1 truncate">Meetings</span>
                </SidebarMenuButton>
                {!isCollapsed && (meetingIsRecording ? (
                  <div className="absolute inset-y-0 right-1 flex items-center gap-1.5">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Stop recording"
                          disabled={meetingIsBusy}
                          onClick={(e) => { e.stopPropagation(); onToggleMeetingRecording?.() }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex aspect-square w-5 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {meetingIsBusy ? <LoaderIcon className="size-4 animate-spin" /> : <Square className="size-3.5 fill-current" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {meetingRecordingState === 'connecting'
                          ? 'Starting…'
                          : meetingRecordingState === 'stopping'
                            ? 'Stopping…'
                            : recordingMeeting
                              ? `Stop recording — ${recordingMeeting.summary}`
                              : 'Stop recording'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : previewMeeting ? (
                  <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Take notes"
                          onClick={(e) => { e.stopPropagation(); triggerMeetingCapture(previewMeeting, false) }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex aspect-square w-5 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <Mic className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Take notes</TooltipContent>
                    </Tooltip>
                    {previewMeeting.conferenceLink && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Join & take notes"
                            onClick={(e) => { e.stopPropagation(); triggerMeetingCapture(previewMeeting, true) }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex aspect-square w-5 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          >
                            <Video className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Join & take notes</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ) : null)}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeNav === 'agents'}
                  onClick={onOpenBgTasks}
                  tooltip="AI Agents"
                >
                  <Bot className="size-5 shrink-0" />
                  <span className="flex-1 truncate">AI Agents</span>
                  {!isCollapsed && <span className="jobraker-sidebar-badge-new shrink-0 self-center">New</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeNav === 'analytics'} onClick={onOpenAnalytics} tooltip="Analytics">
                  <BarChart3 className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setConnectionsSettingsOpen(true)} tooltip="Integrations">
                  <Plug className="size-5 shrink-0" />
                  <span className="flex-1 truncate">Integrations</span>
                  {!isCollapsed && hasOauthError && (
                    <AlertTriangle className="size-3.5 shrink-0 self-center text-amber-500/90" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SettingsDialog>
                  <SidebarMenuButton tooltip="Settings">
                    <Settings className="size-5 shrink-0" />
                    <span className="flex-1 truncate">Settings</span>
                  </SidebarMenuButton>
                </SettingsDialog>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isCollapsed && (
          <>
            <div className="jobraker-sidebar-divider" />

            {/* Favorites */}
            <SidebarGroup className="flex flex-col">
              <SidebarGroupContent>
                <button
                  type="button"
                  onClick={() => setQuickAccessExpanded((v) => !v)}
                  className="jobraker-sidebar-section-label mb-2 flex w-full items-center gap-1.5 px-3 py-0 text-left"
                >
                  <ChevronRight className={cn('size-3 transition-transform', quickAccessExpanded && 'rotate-90')} />
                  <span className="flex-1">Favorites</span>
                </button>
                {quickAccessExpanded && (
                  quickAccessItems.length === 0 ? (
                    <div className="px-4 pb-2 text-[11.5px] italic text-muted-foreground">
                      Pin roles and notes to see them here.
                    </div>
                  ) : (
                    <SidebarMenu>
                      {quickAccessItems.map((item, index) => (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton onClick={item.onClick} className="jobraker-sidebar-favorite">
                            <span
                              className={cn(
                                'jobraker-sidebar-favorite-dot',
                                index === 0 && 'jobraker-sidebar-favorite-dot--active',
                              )}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      {/* Billing / upgrade CTA */}
      {!isCollapsed && isJobrakerRecruiterConnected && billing ? (
        <div className="shrink-0 border-t border-border/40 bg-card/40 p-4">
          <button
            type="button"
            onClick={() => appUrl && window.open(`${appUrl}?intent=upgrade`)}
            className="jobraker-sidebar-plan-card group w-full p-4 text-left"
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-brand">
                  {formatBillingPlanName(billing.subscriptionPlan)}
                </h3>
                {billing.subscriptionStatus === 'trialing' && billing.trialExpiresAt && (() => {
                  const days = Math.max(0, Math.ceil((new Date(billing.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  return (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {days === 0 ? 'Trial expires today' : days === 1 ? '1 day left' : `${days} days left`}
                    </p>
                  )
                })()}
                {!billing.subscriptionPlan || billing.subscriptionPlan === 'free' || billing.subscriptionPlan === 'starter' ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">Unlock advanced sourcing and automation</p>
                ) : null}
              </div>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="relative z-10 mt-3 flex items-center gap-2 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              <span>{!billing.subscriptionPlan || billing.subscriptionPlan === 'free' || billing.subscriptionPlan === 'starter' ? 'Upgrade plan' : 'Manage billing'}</span>
              <ChevronRight className="size-3" />
            </div>
          </button>
        </div>
      ) : null}
      {/* Bottom actions — reconnect prompt (Settings & Integrations live in nav) */}
      {!isCollapsed && hasOauthError && (
        <div className="jobraker-sidebar-footer px-2 py-2">
          <AlertDialog open={showOauthAlert} onOpenChange={setShowOauthAlert}>
            <AlertDialogTrigger asChild>
              <button
                ref={connectorsButtonRef}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-amber-500/90"
                aria-label="OAuth connection issues"
              >
                <AlertTriangle className="size-4 animate-pulse" />
                <span>Reconnect accounts</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                if (openConnectionsAfterClose) {
                  setOpenConnectionsAfterClose(false)
                  setConnectionsSettingsOpen(true)
                }
                connectorsButtonRef.current?.focus()
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Reconnect your accounts</AlertDialogTitle>
                <AlertDialogDescription>
                  One or more connected accounts need attention. Open Connected accounts
                  to review the status and reconnect if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setOpenConnectionsAfterClose(false)
                    setShowOauthAlert(false)
                  }}
                >
                  Dismiss
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOpenConnectionsAfterClose(true)
                    setShowOauthAlert(false)
                  }}
                >
                  View connected accounts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <SettingsDialog
        defaultTab="connections"
        open={connectionsSettingsOpen}
        onOpenChange={setConnectionsSettingsOpen}
      />
      <SyncStatusBar />
      <SidebarRail />
    </Sidebar>
  )
}

async function transcribeWithScribe(audioBlob: Blob): Promise<string | null> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        '',
      ),
    )
    const result = await window.ipc.invoke('elevenlabs:transcribeAudio', {
      audioBase64: base64,
      mimeType: audioBlob.type || 'audio/webm',
    })
    return result.text?.trim() || null
  } catch (err) {
    console.error('ElevenLabs Scribe transcription failed:', err)
    return null
  }
}

// Voice Note Recording Button
export function VoiceNoteButton({ onNoteCreated, variant = 'icon' }: { onNoteCreated?: (path: string) => void; variant?: 'icon' | 'action' }) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [hasElevenLabsKey, setHasElevenLabsKey] = React.useState(false)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const notePathRef = React.useRef<string | null>(null)
  const timestampRef = React.useRef<string | null>(null)
  const relativePathRef = React.useRef<string | null>(null)
  // Keep a ref to always call the latest onNoteCreated (avoids stale closure in recorder.onstop)
  const onNoteCreatedRef = React.useRef(onNoteCreated)
  React.useEffect(() => { onNoteCreatedRef.current = onNoteCreated }, [onNoteCreated])

  React.useEffect(() => {
    const load = () => {
      window.ipc.invoke('voice:getConfig', null).then((config) => {
        setHasElevenLabsKey(!!config.elevenlabs)
      }).catch(() => {
        setHasElevenLabsKey(false)
      })
    }
    load()
    window.addEventListener('connectors:updated', load)
    return () => window.removeEventListener('connectors:updated', load)
  }, [])

  const startRecording = async () => {
    try {
      // Generate timestamp and paths immediately
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-')
      const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
      const noteName = `voice-memo-${timestamp}`
      const notePath = `knowledge/Voice Memos/${dateStr}/${noteName}.md`

      timestampRef.current = timestamp
      notePathRef.current = notePath
      // Relative path for linking (from knowledge/ root, without .md extension)
      const relativePath = `Voice Memos/${dateStr}/${noteName}`
      relativePathRef.current = relativePath

      // Create the note immediately with a "Recording..." placeholder
      await window.ipc.invoke('workspace:mkdir', {
        path: `knowledge/Voice Memos/${dateStr}`,
        recursive: true,
      })

      const initialContent = `---
type: voice memo
recorded: "${now.toISOString()}"
path: ${relativePath}
---
# Voice Memo

## Transcript

*Recording in progress...*
`
      await window.ipc.invoke('workspace:writeFile', {
        path: notePath,
        data: initialContent,
        opts: { encoding: 'utf8' },
      })

      // Select the note so the user can see it
      onNoteCreatedRef.current?.(notePath)

      // Start actual recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType === 'audio/mp4' ? 'm4a' : 'webm'
        const audioFilename = `voice-memo-${timestampRef.current}.${ext}`

        // Save audio file to voice_memos folder (for backup/reference)
        try {
          await window.ipc.invoke('workspace:mkdir', {
            path: 'voice_memos',
            recursive: true,
          })

          const arrayBuffer = await blob.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              '',
            ),
          )

          await window.ipc.invoke('workspace:writeFile', {
            path: `voice_memos/${audioFilename}`,
            data: base64,
            opts: { encoding: 'base64' },
          })
        } catch {
          console.error('Failed to save audio file')
        }

        // Update note to show transcribing status
        const currentNotePath = notePathRef.current
        const currentRelativePath = relativePathRef.current
        if (currentNotePath && currentRelativePath) {
          const transcribingContent = `---
type: voice memo
recorded: "${new Date().toISOString()}"
path: ${currentRelativePath}
---
# Voice Memo

## Transcript

*Transcribing...*
`
          await window.ipc.invoke('workspace:writeFile', {
            path: currentNotePath,
            data: transcribingContent,
            opts: { encoding: 'utf8' },
          })
        }

        // Transcribe and update the note with the transcript
        const transcript = await transcribeWithScribe(blob)
        if (currentNotePath && currentRelativePath) {
          const finalContent = transcript
            ? `---
type: voice memo
recorded: "${new Date().toISOString()}"
path: ${currentRelativePath}
---
# Voice Memo

## Transcript

${transcript}
`
            : `---
type: voice memo
recorded: "${new Date().toISOString()}"
path: ${currentRelativePath}
---
# Voice Memo

## Transcript

*Transcription failed. Please try again.*
`
          await window.ipc.invoke('workspace:writeFile', {
            path: currentNotePath,
            data: finalContent,
            opts: { encoding: 'utf8' },
          })

          // Re-select to trigger refresh
          onNoteCreatedRef.current?.(currentNotePath)

          if (transcript) {
            toast('Voice note transcribed', 'success')
          } else {
            toast('Transcription failed', 'error')
          }
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      toast('Recording started', 'success')
    } catch {
      toast('Could not access microphone', 'error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  if (!hasElevenLabsKey) return null

  const actionClass = "flex h-9 flex-1 items-center justify-center rounded-xl border border-border/60 bg-foreground/5 text-foreground/60 transition-all hover:border-brand/30 hover:bg-brand/10 hover:text-brand"
  const iconClass = "rounded-xl p-1.5 text-foreground/60 transition-all hover:border-brand/30 hover:bg-brand/10 hover:text-brand"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={variant === 'action' ? actionClass : iconClass}
          aria-label={isRecording ? 'Stop recording' : 'New voice note'}
        >
          {isRecording ? (
            <Square className="size-4 fill-red-500 text-red-500 animate-pulse" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isRecording ? 'Stop Recording' : 'New Voice Note'}
      </TooltipContent>
    </Tooltip>
  )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Mic; label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex h-9 flex-1 items-center justify-center rounded-xl border border-border/60 bg-foreground/5 text-foreground/60 transition-all hover:border-brand/30 hover:bg-brand/10 hover:text-brand"
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

type UpcomingMeeting = {
  id: string
  summary: string
  start: Date
  isAllDay: boolean
  location: string | null
  htmlLink: string | null
  conferenceLink: string | null
  source: string
  rawStart: { dateTime?: string; date?: string } | undefined
  rawEnd: { dateTime?: string; date?: string } | undefined
}

type RawCalendarEvent = {
  id?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  location?: string
  htmlLink?: string
  status?: string
  attendees?: Array<{ self?: boolean; responseStatus?: string }>
}

function parseAllDayDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function normalizeUpcomingMeeting(raw: RawCalendarEvent, sourcePath: string): UpcomingMeeting | null {
  if (raw.status === 'cancelled') return null
  const declined = raw.attendees?.find((a) => a.self)?.responseStatus === 'declined'
  if (declined) return null
  const allDayStart = raw.start?.date
  const timedStart = raw.start?.dateTime
  const isAllDay = !timedStart && Boolean(allDayStart)
  let start: Date | null = null
  let end: Date | null = null
  if (timedStart) {
    start = new Date(timedStart)
    end = raw.end?.dateTime ? new Date(raw.end.dateTime) : null
  } else if (allDayStart) {
    start = parseAllDayDate(allDayStart)
    end = raw.end?.date ? parseAllDayDate(raw.end.date) : null
  }
  if (!start || Number.isNaN(start.getTime())) return null
  const now = new Date()
  const effectiveEnd = end ?? (isAllDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : start)
  if (effectiveEnd <= now) return null
  const conferenceLink = extractConferenceLink(raw as unknown as Record<string, unknown>) ?? null
  return {
    id: raw.id ?? sourcePath,
    summary: raw.summary?.trim() || '(No title)',
    start,
    isAllDay,
    location: raw.location?.trim() || null,
    htmlLink: raw.htmlLink ?? null,
    conferenceLink,
    source: sourcePath,
    rawStart: raw.start,
    rawEnd: raw.end,
  }
}

function triggerMeetingCapture(event: UpcomingMeeting, openConference: boolean) {
  window.__pendingCalendarEvent = {
    summary: event.summary,
    start: event.rawStart,
    end: event.rawEnd,
    location: event.location ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
    conferenceLink: event.conferenceLink ?? undefined,
    source: event.source,
  }
  if (openConference && event.conferenceLink) {
    window.open(event.conferenceLink, '_blank')
  }
  window.dispatchEvent(new Event('calendar-block:join-meeting'))
}
