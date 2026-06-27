import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function ChatAssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 mt-1',
        className
      )}
    >
      <Bot className="size-4 text-brand" />
    </div>
  )
}

export function ChatAssistantRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex w-full max-w-full gap-4 justify-start', className)}>
      <ChatAssistantAvatar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
