import * as React from 'react'
import { motion, useInView, useMotionValue, useMotionValueEvent, useSpring } from 'motion/react'
import {
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { avatarGradient, initials } from './data'

// ───────────────────────── Animation helpers ─────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const

/** Fade + slide up when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    const show = () => setVisible(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show()
          observer.disconnect()
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -6% 0px' },
    )

    observer.observe(node)

    // Parent enter animations can miss the first intersection pass.
    const fallback = window.setTimeout(() => {
      const rect = node.getBoundingClientRect()
      if (rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
        show()
        observer.disconnect()
      }
    }, 320)

    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.5, ease: EASE, delay: visible ? delay : 0 }}
    >
      {children}
    </motion.div>
  )
}

/** Count-up animated number. Accepts the display formatter. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 18, mass: 0.6 })
  const [display, setDisplay] = React.useState(() => format(0))
  const formatRef = React.useRef(format)
  formatRef.current = format

  React.useEffect(() => {
    if (inView) mv.set(value)
  }, [inView, value, mv])

  useMotionValueEvent(spring, 'change', (latest) => {
    setDisplay(formatRef.current(latest))
  })

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}

/** Simulated initial load so skeleton states are exercised on each screen. */
export function useFakeLoading(ms = 650): boolean {
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    const id = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(id)
  }, [ms])
  return loading
}

// ───────────────────────── Header ─────────────────────────

import { toast } from 'sonner'

export function RecruiterHeader({
  title,
  subtitle,
  searchPlaceholder,
  rightExtra,
  onOpenSearch,
  onOpenChat,
  onTakeMeetingNotes,
  onOpenAgents,
}: {
  title: string
  subtitle: string
  searchPlaceholder: string
  searchValue?: string
  onSearchChange?: (v: string) => void
  rightExtra?: React.ReactNode
  onOpenSearch?: () => void
  onOpenChat?: (prompt?: string) => void
  onTakeMeetingNotes?: () => void
  onOpenAgents?: () => void
}) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <div 
          onClick={onOpenSearch}
          className="recruiter-search group relative hidden md:flex cursor-pointer"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            readOnly
            placeholder={searchPlaceholder}
            className="h-10 w-[min(320px,40vw)] rounded-xl border border-border/60 bg-foreground/5 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition group-hover:border-brand/45 cursor-pointer"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        {rightExtra}
        <button
          type="button"
          onClick={() => {
            toast.success("System status: Healthy", {
              description: "3 active sourcing agents running. 0 active errors.",
              duration: 3500,
            })
          }}
          className="relative flex size-10 items-center justify-center rounded-xl border border-border/60 bg-foreground/5 text-muted-foreground transition hover:border-brand/30 hover:text-foreground cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-black">
            3
          </span>
        </button>
        
        {/* Dropdown Container */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="recruiter-new-btn flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>New</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 z-40 w-48 rounded-xl border border-zinc-800 bg-[#09090b] p-1.5 shadow-2xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); onOpenChat?.() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white"
                >
                  New Search Chat
                </button>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); onOpenChat?.("Help me create a new job role template.") }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white"
                >
                  New Job Role
                </button>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); onTakeMeetingNotes?.() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white"
                >
                  New Meeting Notes
                </button>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); onOpenAgents?.() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-800/60 transition-colors text-white"
                >
                  New AI Agent
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function DateRangePill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-foreground/5 px-3 text-sm text-muted-foreground transition hover:border-brand/30 hover:text-foreground"
    >
      <span className="text-brand">▦</span>
      <span>{label}</span>
      <ChevronDown className="size-3.5 opacity-70" />
    </button>
  )
}

// ───────────────────────── Cards / sections ─────────────────────────

export function SectionCard({
  title,
  hint,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  hint?: string
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'recruiter-card flex flex-col rounded-2xl border border-border/50 bg-[var(--jobraker-recruiter-panel,rgba(255,255,255,0.02))] p-5',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {hint && (
                <span
                  className="flex size-4 items-center justify-center rounded-full border border-border/60 text-[9px] text-muted-foreground"
                  title={hint}
                >
                  i
                </span>
              )}
            </div>
          )}
          {action}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </div>
  )
}

export function Delta({
  value,
  suffix = '',
  invertColor = false,
  className,
}: {
  value: number
  suffix?: string
  /** When true, a negative value is "good" (e.g. time-to-fill going down). */
  invertColor?: boolean
  className?: string
}) {
  const up = value >= 0
  const positive = invertColor ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
        positive ? 'text-brand' : 'text-rose-400',
        className,
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value)}
      {suffix}
    </span>
  )
}

export function Avatar({
  name,
  size = 36,
  ring,
  className,
}: {
  name: string
  size?: number
  ring?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-black/90',
        ring && 'ring-2 ring-brand/40',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: avatarGradient(name),
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function ScoreRing({ score, size = 34 }: { score: number; size?: number }) {
  const tone = score >= 85 ? '#1dff00' : score >= 65 ? '#f8d74a' : '#f97316'
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color: tone }}>
        {score}
      </span>
    </span>
  )
}

export function MatchBar({ score }: { score: number }) {
  const tone = score >= 85 ? '#1dff00' : score >= 65 ? '#f8d74a' : '#f97316'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold tabular-nums" style={{ color: tone }}>
        {score}%
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
    </div>
  )
}

// ───────────────────────── Skeletons ─────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('premium-skeleton recruiter-shimmer rounded-md', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('premium-skeleton-card rounded-2xl border border-border/50 bg-foreground/[0.02] p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  )
}

// ───────────────────────── Empty state ─────────────────────────

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative flex flex-col items-center justify-center rounded-3xl border border-border/40 bg-[#050705]/10 px-8 py-16 text-center shadow-2xl backdrop-blur-md overflow-hidden max-w-lg mx-auto"
    >
      {/* Premium ambient glow background effect */}
      <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center overflow-hidden pointer-events-none">
        <div className="w-[300px] h-[300px] bg-brand/5 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>
      
      {/* Advanced animated floating icon orb with pulsing background rings */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Pulsing ring 1 */}
        <motion.div
          className="absolute size-24 rounded-full border border-brand/5 bg-brand/2"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Pulsing ring 2 */}
        <motion.div
          className="absolute size-32 rounded-full border border-brand/2 bg-brand/1"
          animate={{
            scale: [1, 1.6, 1],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        {/* Floating icon container */}
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative flex size-16 items-center justify-center rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/15 to-brand/5 text-brand shadow-[0_8px_30px_rgb(29,255,0,0.08)] backdrop-blur-sm"
        >
          <div className="absolute inset-0 rounded-2xl bg-brand/5 blur-md" />
          <div className="relative z-10">{icon}</div>
        </motion.div>
      </div>

      {/* Staggered text animations */}
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
        className="text-sm font-bold text-white tracking-tight"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
        className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-400"
      >
        {body}
      </motion.p>
      
      {action && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: EASE }}
          className="mt-6"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}

export const RECRUITER_EASE = EASE
