import { ArrowUpRight, Bot, Mail, MessageSquare, Search, UserCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/relative-time'

export interface ChatEmptyStateRun {
  id: string
  title?: string
  createdAt: string
}

interface ChatEmptyStateProps {
  recentRuns?: ChatEmptyStateRun[]
  onSelectRun?: (runId: string) => void
  onOpenChatHistory?: () => void
  /** Fill the composer with a starter prompt (does not submit). */
  onPickPrompt: (prompt: string) => void
  /** Use a wider column — for the full-screen chat where the narrow column looks cramped. */
  wide?: boolean
}

const SUGGESTED_ACTIONS: { icon: typeof Mail; title: string; description: string; prompt: string }[] = [
  {
    icon: Search,
    title: 'Find candidates',
    description: 'Search 800M+ profiles for your open role',
    prompt: 'Find candidates for our [role title] opening — prioritize people with seed-stage startup experience',
  },
  {
    icon: Mail,
    title: 'Draft outreach',
    description: 'Personalized messages that get replies',
    prompt: "Write a personalized outreach message to [candidate name] for our [role] opening",
  },
  {
    icon: UserCheck,
    title: 'Screen a profile',
    description: 'Assess startup fit and growth trajectory',
    prompt: "Summarize [candidate name]'s fit for our [role] — highlight early-stage experience and growth trajectory",
  },
]

/**
 * Empty-state body for the chat surface: greeting, recent chats, and starter
 * action cards. Shown in both the side-pane copilot and full-screen chat.
 */
export function ChatEmptyState({
  recentRuns = [],
  onSelectRun,
  onOpenChatHistory,
  onPickPrompt,
  wide = false,
}: ChatEmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col items-center justify-center px-4 py-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700',
        wide ? 'max-w-2xl' : 'max-w-md'
      )}
    >
      <div className="mb-4 flex justify-center">
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-brand/20 bg-foreground/5 shadow-[0_0_15px_rgba(29,255,0,0.05)]">
          <Bot className="size-8 text-brand" />
          <div className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-brand">
            <span className="size-1.5 rounded-full bg-primary-foreground" />
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
        How can <span className="text-brand">Jobraker Recruiter</span> help you today?
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
        Source candidates, draft outreach, and screen profiles — all from one chat.
      </p>

      <div
        className={cn(
          'mt-6 grid w-full gap-3 md:mt-8 md:gap-4',
          wide ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}
      >
        {SUGGESTED_ACTIONS.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => onPickPrompt(action.prompt)}
            className="chat-suggestion-card chat-glass-panel flex min-h-[120px] flex-col justify-between rounded-xl p-4 text-left transition-all"
          >
            <div>
              <action.icon className="mb-2 size-5 text-brand" />
              <h4 className="mb-1 text-sm font-semibold text-card-foreground">{action.title}</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">{action.description}</p>
            </div>
          </button>
        ))}
      </div>

      {recentRuns.length > 0 && (
        <div className="mt-8 w-full text-left">
          <div className="mb-2 flex items-center px-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex-1">Recent chats</span>
            {onOpenChatHistory && (
              <button
                type="button"
                onClick={onOpenChatHistory}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium normal-case tracking-normal text-brand hover:underline"
              >
                View all
                <ArrowUpRight className="size-3" />
              </button>
            )}
          </div>
          <div className="chat-glass-panel flex flex-col gap-1 rounded-xl p-2">
            {recentRuns.slice(0, 4).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun?.(run.id)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand/8"
              >
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{run.title || '(Untitled chat)'}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(run.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
