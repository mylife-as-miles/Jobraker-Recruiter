import { extractConferenceLink } from '@/lib/calendar-event'

export const CALENDAR_DIR = 'calendar_sync'
export const UPCOMING_MAX_DAYS = 4

export type CalendarPerson = {
  email?: string
  displayName?: string
  self?: boolean
}

export type CalendarAttendee = CalendarPerson & {
  responseStatus?: string
  optional?: boolean
}

export type RawCalendarEvent = {
  id?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
  status?: string
  creator?: CalendarPerson
  organizer?: CalendarPerson
  attendees?: CalendarAttendee[]
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
  hangoutLink?: string
  conferenceLink?: string
}

export type MeetingEvent = {
  id: string
  summary: string
  start: Date
  end: Date | null
  isAllDay: boolean
  location: string | null
  description: string | null
  htmlLink: string | null
  conferenceLink: string | null
  creator: CalendarPerson | null
  organizer: CalendarPerson | null
  attendees: CalendarAttendee[]
  source: string
  rawStart: { dateTime?: string; date?: string } | undefined
  rawEnd: { dateTime?: string; date?: string } | undefined
  dateKey: string
}

export type DayGroup = {
  dateKey: string
  date: Date
  events: MeetingEvent[]
}

export type MeetingsCalendarGridEvent = {
  id: string
  date: Date
  title: string
  subtitle?: string
  kind: 'video' | 'in-person' | 'all-day'
  event: MeetingEvent
}

export function isCalendarPath(path: string | undefined): boolean {
  return typeof path === 'string' && (path === CALENDAR_DIR || path.startsWith(`${CALENDAR_DIR}/`))
}

export function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function parseAllDayDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function normalizeMeetingEvent(raw: RawCalendarEvent, sourcePath: string): MeetingEvent | null {
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

  const conferenceLink = extractConferenceLink(raw as unknown as Record<string, unknown>) ?? null

  return {
    id: raw.id ?? sourcePath,
    summary: raw.summary?.trim() || '(No title)',
    start,
    end,
    isAllDay,
    location: raw.location?.trim() || null,
    description: raw.description?.trim() || null,
    htmlLink: raw.htmlLink ?? null,
    conferenceLink,
    creator: raw.creator ?? null,
    organizer: raw.organizer ?? null,
    attendees: raw.attendees ?? [],
    source: sourcePath,
    rawStart: raw.start,
    rawEnd: raw.end,
    dateKey: localDateKey(start),
  }
}

export function triggerMeetingCapture(event: MeetingEvent, openConference: boolean) {
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

export function meetingPlatformLabel(link: string | null): string | null {
  if (!link) return null
  if (/zoom\.us|zoomgov\.com/i.test(link)) return 'Zoom'
  if (/teams\.(?:microsoft|live)\.com/i.test(link)) return 'Teams'
  if (/meet\.google\.com/i.test(link)) return 'Meet'
  return 'Video call'
}

export function isEventNow(event: MeetingEvent): boolean {
  if (event.isAllDay) return false
  const now = Date.now()
  const start = event.start.getTime()
  const end = event.end ? event.end.getTime() : start + 30 * 60 * 1000
  return start <= now && now < end
}

export function formatEventTimeRange(event: MeetingEvent): string {
  if (event.isAllDay) return 'All day'
  const start = event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (!event.end) return start
  const sameDay = localDateKey(event.start) === localDateKey(event.end)
  if (!sameDay) {
    const startLong = event.start.toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    const endLong = event.end.toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${startLong} – ${endLong}`
  }
  const end = event.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${start} – ${end}`
}

export function formatEventTimeRangeCompact(event: MeetingEvent): string {
  if (event.isAllDay) return 'All day'
  const startStr = event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (!event.end) return startStr
  const sameDay = localDateKey(event.start) === localDateKey(event.end)
  if (!sameDay) return formatEventTimeRange(event)
  const endStr = event.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const meridiemRe = /\s*[AP]M$/i
  const startMer = startStr.match(meridiemRe)?.[0]?.trim().toUpperCase()
  const endMer = endStr.match(meridiemRe)?.[0]?.trim().toUpperCase()
  if (startMer && endMer && startMer === endMer) {
    return `${startStr.replace(meridiemRe, '')} – ${endStr}`
  }
  return `${startStr} – ${endStr}`
}

export function formatEventDetailTime(event: MeetingEvent): string {
  if (!event.isAllDay) {
    const date = event.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    return `${date}, ${formatEventTimeRange(event)}`
  }

  const start = event.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  if (!event.end) return `${start}, all day`

  const exclusiveEnd = addDays(event.end, -1)
  if (localDateKey(exclusiveEnd) === localDateKey(event.start)) return `${start}, all day`

  const end = exclusiveEnd.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  return `${start} – ${end}, all day`
}

export function personLabel(person: CalendarPerson | null | undefined): string | null {
  if (!person) return null
  return person.displayName?.trim() || person.email?.trim() || null
}

export function attendeeLabel(attendee: CalendarAttendee): string | null {
  const label = personLabel(attendee)
  if (!label) return null
  if (attendee.self) return `${label} (you)`
  return label
}

export function buildDayWindow(now: Date, days: number): DayGroup[] {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i)
    return { dateKey: localDateKey(date), date, events: [] }
  })
}

export function selectVisibleDays(allDays: DayGroup[]): DayGroup[] {
  if (allDays.length === 0) return []
  const out: DayGroup[] = [allDays[0]]
  const cap = Math.min(allDays.length, UPCOMING_MAX_DAYS)
  for (let i = 1; i < cap; i++) {
    if (allDays[i].events.length > 0) out.push(allDays[i])
  }
  return out
}

export function toCalendarGridEvents(events: MeetingEvent[]): MeetingsCalendarGridEvent[] {
  return events.map((event) => {
    const platform = meetingPlatformLabel(event.conferenceLink)
    const kind: MeetingsCalendarGridEvent['kind'] = event.isAllDay
      ? 'all-day'
      : event.conferenceLink
        ? 'video'
        : 'in-person'
    return {
      id: event.id,
      date: event.start,
      title: event.summary,
      subtitle: platform ?? event.location ?? undefined,
      kind,
      event,
    }
  })
}

export function eventsForDay(events: MeetingEvent[], date: Date): MeetingEvent[] {
  const key = localDateKey(date)
  return events
    .filter((ev) => ev.dateKey === key)
    .sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
      return a.start.getTime() - b.start.getTime()
    })
}

export type LoadMeetingEventsOptions = {
  /** Only include events overlapping [now, now + days) */
  upcomingDays?: number
  /** Only include events whose start falls within this month */
  month?: Date
}

export async function loadMeetingEvents(options: LoadMeetingEventsOptions = {}): Promise<MeetingEvent[]> {
  const exists = await window.ipc.invoke('workspace:exists', { path: CALENDAR_DIR })
  if (!exists.exists) return []

  const entries = await window.ipc.invoke('workspace:readdir', {
    path: CALENDAR_DIR,
    opts: { recursive: false, includeHidden: false, includeStats: false },
  })
  const jsonEntries = entries.filter((e) => e.kind === 'file' && e.name.endsWith('.json'))

  const now = new Date()
  const todayStart = startOfDay(now)
  const upcomingEnd = options.upcomingDays != null ? addDays(todayStart, options.upcomingDays) : null
  const monthStart = options.month ? startOfMonth(options.month) : null
  const monthEnd = options.month
    ? new Date(options.month.getFullYear(), options.month.getMonth() + 1, 0, 23, 59, 59, 999)
    : null

  const settled = await Promise.allSettled(
    jsonEntries.map(async (entry): Promise<MeetingEvent | null> => {
      const result = await window.ipc.invoke('workspace:readFile', {
        path: entry.path,
        encoding: 'utf8',
      })
      const raw = JSON.parse(result.data) as RawCalendarEvent
      const ev = normalizeMeetingEvent(raw, entry.path)
      if (!ev) return null

      if (upcomingEnd) {
        const effectiveEnd = ev.end ?? (ev.isAllDay ? addDays(ev.start, 1) : ev.start)
        if (effectiveEnd <= now) return null
        if (ev.start >= upcomingEnd) return null
      }

      if (monthStart && monthEnd) {
        if (ev.start > monthEnd) return null
        const effectiveEnd = ev.end ?? (ev.isAllDay ? addDays(ev.start, 1) : ev.start)
        if (effectiveEnd < monthStart) return null
      }

      return ev
    }),
  )

  const collected: MeetingEvent[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) collected.push(r.value)
  }
  collected.sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
    return a.start.getTime() - b.start.getTime()
  })
  return collected
}
