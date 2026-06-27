import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  addMonths,
  isSameDay,
  localDateKey,
  startOfMonth,
  type MeetingsCalendarGridEvent,
} from '@/lib/calendar/meeting-events'
import { cn } from '@/lib/utils'

export type MeetingsCalendarProps = {
  month?: Date
  selectedDate?: Date | null
  onMonthChange?: (date: Date) => void
  onSelectDate?: (date: Date) => void
  events?: MeetingsCalendarGridEvent[]
  maxVisibleEventsPerDay?: number
  viewMode?: 'month' | 'week'
  onViewModeChange?: (mode: 'month' | 'week') => void
  className?: string
}

function eventKindColor(kind: MeetingsCalendarGridEvent['kind']): string {
  switch (kind) {
    case 'video':
      return 'hsl(var(--primary))'
    case 'all-day':
      return 'hsl(var(--muted-foreground))'
    case 'in-person':
    default:
      return 'hsl(142 76% 36%)'
  }
}

export function MeetingsCalendar({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  events = [],
  maxVisibleEventsPerDay = 3,
  viewMode = 'month',
  onViewModeChange,
  className,
}: MeetingsCalendarProps) {
  const today = new Date()
  const viewMonth = startOfMonth(month ?? today)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set())

  const grid = useMemo(() => {
    if (viewMode === 'week' && selectedDate) {
      const base = selectedDate
      const weekday = base.getDay()
      const start = new Date(base)
      start.setDate(base.getDate() - weekday)
      const cells: { date: Date; inCurrent: boolean }[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        cells.push({ date: d, inCurrent: d.getMonth() === viewMonth.getMonth() })
      }
      return cells
    }
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const offset = first.getDay()
    const cells: { date: Date; inCurrent: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const dayNum = i - offset + 1
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum)
      cells.push({ date: d, inCurrent: d.getMonth() === viewMonth.getMonth() })
    }
    return cells
  }, [viewMonth, viewMode, selectedDate])

  const eventsByDay = useMemo(() => {
    const map: Record<string, MeetingsCalendarGridEvent[]> = {}
    for (const ev of events) {
      const key = localDateKey(ev.date)
      ;(map[key] ||= []).push(ev)
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return map
  }, [events])

  const monthLabel = viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  const weekdayLabels = useMemo(() => {
    const base: string[] = []
    for (let i = 0; i < 7; i++) {
      const ref = new Date(2021, 7, i + 1)
      base.push(new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(ref))
    }
    return base
  }, [])

  const toggleExpanded = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    setExpandedDays(new Set())
  }, [viewMonth, viewMode])

  return (
    <div className={cn('w-full', className)} aria-label="Meetings calendar">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange?.(addMonths(viewMonth, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="min-w-[140px] select-none text-center text-base font-semibold text-foreground">
            {monthLabel}
          </h3>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange?.(addMonths(viewMonth, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMonthChange?.(startOfMonth(new Date()))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-accent"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.(viewMode === 'month' ? 'week' : 'month')}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-accent"
          >
            {viewMode === 'month' ? 'Week' : 'Month'}
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekdayLabels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="select-none py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          const isToday = isSameDay(cell.date, today)
          const isSelected = selectedDate != null && isSameDay(cell.date, selectedDate)
          const dayKey = localDateKey(cell.date)
          const dayEvents = eventsByDay[dayKey] ?? []
          const expanded = expandedDays.has(dayKey)
          const limit = expanded ? dayEvents.length : maxVisibleEventsPerDay
          const extra = dayEvents.length - limit

          return (
            <motion.button
              key={`${dayKey}-${idx}`}
              type="button"
              layout={false}
              onClick={() => onSelectDate?.(cell.date)}
              className={cn(
                'group relative flex min-h-[72px] flex-col gap-1 rounded-lg border p-1.5 text-left transition sm:min-h-[96px] sm:p-2',
                'border-border/60 bg-card hover:border-border hover:bg-accent/30',
                !cell.inCurrent && 'opacity-45',
                isToday && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20',
                isSelected && !isToday && 'border-primary/30 bg-primary/[0.07]',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    'text-sm font-semibold leading-none',
                    isToday ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {cell.date.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, limit).map((ev) => (
                  <span
                    key={ev.id}
                    title={ev.subtitle ? `${ev.title} · ${ev.subtitle}` : ev.title}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight text-foreground sm:text-[11px]"
                    style={{ backgroundColor: `${eventKindColor(ev.kind)}18` }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: eventKindColor(ev.kind) }}
                    />
                    <span className="truncate">{ev.title}</span>
                  </span>
                ))}
                {extra > 0 && !expanded ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpanded(dayKey)
                    }}
                    className="truncate px-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    +{extra} more
                  </button>
                ) : null}
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Video
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" /> In person
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" /> All day
        </span>
      </div>
    </div>
  )
}
