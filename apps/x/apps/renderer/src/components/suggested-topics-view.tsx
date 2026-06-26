import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Lightbulb, Loader2 } from 'lucide-react'
import { SuggestedTopicBlockSchema, type SuggestedTopicBlock } from '@x/shared/dist/blocks.js'
import { PageTransition, PremiumEmptyState, PremiumGridSkeleton, ScrollReveal } from '@/components/premium-states'

const SUGGESTED_TOPICS_PATH = 'suggested-topics.md'
const LEGACY_SUGGESTED_TOPICS_PATHS = [
  'config/suggested-topics.md',
  'knowledge/Notes/Suggested Topics.md',
]

/** Parse suggestedtopic code-fence blocks from the markdown file content. */
function parseTopics(content: string): SuggestedTopicBlock[] {
  const topics: SuggestedTopicBlock[] = []
  const regex = /```suggestedtopic\s*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const topic = SuggestedTopicBlockSchema.parse(parsed)
      topics.push(topic)
    } catch {
      // Skip malformed blocks
    }
  }

  if (topics.length > 0) return topics

  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      const topic = SuggestedTopicBlockSchema.parse(parsed)
      topics.push(topic)
    } catch {
      // Skip malformed lines
    }
  }

  return topics
}

function serializeTopics(topics: SuggestedTopicBlock[]): string {
  const blocks = topics.map((topic) => [
    '```suggestedtopic',
    JSON.stringify(topic),
    '```',
  ].join('\n'))

  return ['# Suggested Topics', ...blocks].join('\n\n') + '\n'
}

const CATEGORY_COLORS: Record<string, string> = {
  Meetings: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  Projects: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  People: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Organizations: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Topics: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function getCategoryColor(category?: string): string {
  if (!category) return 'bg-muted text-muted-foreground'
  return CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground'
}

interface TopicCardProps {
  topic: SuggestedTopicBlock
  onTrack: () => void
  isRemoving: boolean
}

function TopicCard({ topic, onTrack, isRemoving }: TopicCardProps) {
  return (
    <div className="premium-lift group flex h-full flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {topic.title}
        </h3>
        {topic.category && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getCategoryColor(topic.category)}`}
          >
            {topic.category}
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {topic.description}
      </p>
      <button
        type="button"
        onClick={onTrack}
        disabled={isRemoving}
        className="mt-auto flex w-fit items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRemoving ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Tracking…
          </>
        ) : (
          <>
            Track
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  )
}

interface SuggestedTopicsViewProps {
  onExploreTopic: (topic: SuggestedTopicBlock) => void
}

export function SuggestedTopicsView({ onExploreTopic }: SuggestedTopicsViewProps) {
  const [topics, setTopics] = useState<SuggestedTopicBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let result
        try {
          result = await window.ipc.invoke('workspace:readFile', {
            path: SUGGESTED_TOPICS_PATH,
          })
        } catch {
          let legacyResult: { data?: string } | null = null
          let legacyPath: string | null = null
          for (const path of LEGACY_SUGGESTED_TOPICS_PATHS) {
            try {
              legacyResult = await window.ipc.invoke('workspace:readFile', { path })
              legacyPath = path
              break
            } catch {
              // Try next legacy location.
            }
          }
          if (!legacyResult || !legacyPath || legacyResult.data === undefined) {
            throw new Error('Suggested topics file not found')
          }
          await window.ipc.invoke('workspace:writeFile', {
            path: SUGGESTED_TOPICS_PATH,
            data: legacyResult.data,
            opts: { encoding: 'utf8' },
          })
          await window.ipc.invoke('workspace:remove', {
            path: legacyPath,
            opts: { trash: true },
          })
          result = legacyResult
        }
        if (cancelled) return
        if (result.data) {
          setTopics(parseTopics(result.data))
        }
      } catch {
        if (!cancelled) setError('No suggested roles or searches yet. Check back once your recruiting pipeline has more data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const handleTrack = useCallback(
    async (topic: SuggestedTopicBlock, topicIndex: number) => {
      if (removingIndex !== null) return
      const nextTopics = topics.filter((_, idx) => idx !== topicIndex)
      setRemovingIndex(topicIndex)
      setError(null)
      try {
        await window.ipc.invoke('workspace:writeFile', {
          path: SUGGESTED_TOPICS_PATH,
          data: serializeTopics(nextTopics),
          opts: { encoding: 'utf8' },
        })
        setTopics(nextTopics)
      } catch (err) {
        console.error('Failed to remove suggested topic:', err)
        setError('Failed to update suggested topics. Please try again.')
        return
      } finally {
        setRemovingIndex(null)
      }

      onExploreTopic(topic)
    },
    [onExploreTopic, removingIndex, topics],
  )

  if (loading) {
    return (
      <PageTransition className="h-full overflow-y-auto p-6">
        <PremiumGridSkeleton count={6} />
      </PageTransition>
    )
  }

  if (error || topics.length === 0) {
    return (
      <PageTransition className="flex h-full items-center justify-center p-8">
        <PremiumEmptyState
          icon={<Lightbulb className="size-6" />}
          title="No suggested topics yet"
          description={error ?? 'Suggested roles and searches will appear once your recruiting pipeline has more evidence to work with.'}
        />
      </PageTransition>
    )
  }

  return (
    <PageTransition className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Suggested Topics</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Suggested searches surfaced from your recruiting pipeline. Track one to start a role brief.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic, i) => (
            <ScrollReveal key={`${topic.title}-${i}`} delay={i * 45}>
              <TopicCard
                topic={topic}
                onTrack={() => { void handleTrack(topic, i) }}
                isRemoving={removingIndex === i}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
