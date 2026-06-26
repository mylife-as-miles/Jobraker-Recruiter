import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type PageTransitionProps = {
  children: React.ReactNode
  className?: string
}

export const PageTransition = React.forwardRef<HTMLDivElement, PageTransitionProps>(
  function PageTransition({ children, className }, ref) {
    return (
      <div ref={ref} className={cn('premium-page-enter', className)}>
        {children}
      </div>
    )
  },
)

type ScrollRevealProps = {
  children: React.ReactNode
  className?: string
  delay?: number
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('premium-scroll-reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function PremiumSkeleton({ className }: { className?: string }) {
  return <div className={cn('premium-skeleton', className)} aria-hidden="true" />
}

export function PremiumListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="premium-skeleton-panel">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="premium-skeleton-row">
          <PremiumSkeleton className="size-9 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <PremiumSkeleton className="h-3.5 w-2/5" />
            <PremiumSkeleton className="h-3 w-3/4" />
          </div>
          <PremiumSkeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function PremiumGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="premium-skeleton-card">
          <PremiumSkeleton className="size-10 rounded-2xl" />
          <PremiumSkeleton className="mt-5 h-4 w-2/3" />
          <PremiumSkeleton className="mt-3 h-3 w-full" />
          <PremiumSkeleton className="mt-2 h-3 w-4/5" />
          <div className="mt-6 flex gap-2">
            <PremiumSkeleton className="h-7 w-20 rounded-full" />
            <PremiumSkeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

type PremiumEmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function PremiumEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: PremiumEmptyStateProps) {
  return (
    <div className={cn('premium-empty-state', className)}>
      <div className="premium-empty-state__orb">
        {icon ?? <Sparkles className="size-6" />}
      </div>
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
