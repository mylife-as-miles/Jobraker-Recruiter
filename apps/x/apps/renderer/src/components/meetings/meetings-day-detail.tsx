import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Clock, MapPin, Mic, Video, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  formatEventTimeRangeCompact,
  isEventNow,
  meetingPlatformLabel,
  triggerMeetingCapture,
  type MeetingEvent,
} from '@/lib/calendar/meeting-events'
import { cn } from '@/lib/utils'

export type MeetingsDayDetailProps = {
  date: Date | null
  events: MeetingEvent[]
  onClose: () => void
}

function NowBadge() {
  return (
    <span className="shrink-0 rounded bg-green-600 px-1.5 py-px text-[10px] font-bold uppercase leading-[1.5] tracking-wide text-white">
      Now
    </span>
  )
}

function DayEventRow({ event }: { event: MeetingEvent }) {
  const isNow = isEventNow(event)
  const platform = meetingPlatformLabel(event.conferenceLink)
  const subtitle = platform ?? event.location

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4',
        isNow && 'border-primary/30 bg-primary/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{event.summary}</h4>
            {isNow ? <NowBadge /> : null}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatEventTimeRangeCompact(event)}
          </p>
          {subtitle ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {platform ? <Video className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
              <span className="truncate">{subtitle}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {event.conferenceLink ? (
          <>
            <Button type="button" size="sm" onClick={() => triggerMeetingCapture(event, true)}>
              <Video className="mr-1.5 size-3.5" />
              Join & take notes
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => triggerMeetingCapture(event, false)}>
              Take notes only
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => triggerMeetingCapture(event, false)}>
            <Mic className="mr-1.5 size-3.5" />
            Take notes
          </Button>
        )}
      </div>
    </div>
  )
}

export function MeetingsDayDetail({ date, events, onClose }: MeetingsDayDetailProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const active = date != null

  const dayEvents = useMemo(() => {
    if (!date) return []
    return events
  }, [date, events])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (active) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        overlayRef.current &&
        e.target instanceof Node &&
        overlayRef.current === e.target
      ) {
        onClose()
      }
    }
    if (active) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [active, onClose])

  const headerLabel = date
    ? date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-foreground">{headerLabel}</h3>
                  <p className="text-xs text-muted-foreground">
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-5">
              {dayEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No events on this day.</p>
              ) : (
                dayEvents.map((event) => <DayEventRow key={event.id} event={event} />)
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
