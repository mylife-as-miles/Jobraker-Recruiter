import { Mail, Search, UserCheck, Bot, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Suggestion {
  id: string
  label: string
  prompt: string
  icon: React.ReactNode
}

const defaultSuggestions: Suggestion[] = [
  {
    id: 'find-candidates',
    label: 'Find candidates',
    prompt: 'Find candidates for our [role title] — prioritize seed-stage startup experience',
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: 'draft-outreach',
    label: 'Draft outreach',
    prompt: 'Write personalized outreach to [candidate name] for our [role] opening',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    id: 'screen-profile',
    label: 'Screen a profile',
    prompt: "Summarize [candidate name]'s fit for our [role] — highlight startup experience",
    icon: <UserCheck className="h-4 w-4" />,
  },
  {
    id: 'pipeline-followup',
    label: 'Pipeline follow-ups',
    prompt: 'Set up automated follow-ups for candidates in our [role] pipeline',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    id: 'interview-prep',
    label: 'Prep for interview',
    prompt: 'Prep me for my interview with [candidate name] — summarize their background and startup fit',
    icon: <Users className="h-4 w-4" />,
  },
]

interface SuggestionsProps {
  suggestions?: Suggestion[]
  onSelect: (prompt: string) => void
  className?: string
  vertical?: boolean
}

export function Suggestions({
  suggestions = defaultSuggestions,
  onSelect,
  className,
  vertical = false,
}: SuggestionsProps) {
  return (
    <div className={cn(
      'flex gap-2',
      vertical ? 'flex-col items-end' : 'flex-wrap justify-center',
      className
    )}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.prompt)}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
            'text-sm text-muted-foreground',
            'border border-border bg-background',
            'hover:bg-muted hover:text-foreground hover:border-muted-foreground/30',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          {suggestion.icon}
          <span>{suggestion.label}</span>
        </button>
      ))}
    </div>
  )
}
