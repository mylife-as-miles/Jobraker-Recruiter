import { type Candidate, type Role } from './data'
import { loadRecruiterState } from './storage'

const METRICS_PREFIX = 'jobraker-recruiter-ui'

export type RecruiterMetricsSnapshot = {
  at: string
  openRoles: number
  activeCandidates: number
  responseRate: number
}

export type HomeMetricCard = {
  label: string
  value: string
  sub: string
  hasDelta: boolean
  trend: 'up' | 'down' | 'flat'
  deltaPrefix: string
  deltaSuffix: string
  screen: 'roles' | 'candidates' | 'analytics'
}

const SNAPSHOT_KEY = 'home-metrics-snapshots'
const DAY_MS = 24 * 60 * 60 * 1000

function countOpenRoles(roles: Role[]): number {
  return roles.filter((r) => r.status === 'Open' || r.status === 'Interviewing').length
}

function countActiveCandidates(candidates: Candidate[]): number {
  return candidates.filter((c) => c.stage !== 'Hired').length
}

export function computeResponseRate(candidates: Candidate[]): number {
  if (candidates.length === 0) return 0
  const responded = candidates.filter(
    (c) => c.intentSignal === 'Actively Sourcing' || c.intentSignal === 'High Engagement',
  ).length
  return Math.round((responded / candidates.length) * 1000) / 10
}

function pruneSnapshots(snapshots: RecruiterMetricsSnapshot[]): RecruiterMetricsSnapshot[] {
  const cutoff = Date.now() - 30 * DAY_MS
  return snapshots.filter((s) => new Date(s.at).getTime() >= cutoff)
}

function recordSnapshot(candidates: Candidate[], roles: Role[]): void {
  const openRoles = countOpenRoles(roles)
  const activeCandidates = countActiveCandidates(candidates)
  const responseRate = computeResponseRate(candidates)
  const today = new Date().toISOString().slice(0, 10)

  const snapshots = pruneSnapshots(loadRecruiterState<RecruiterMetricsSnapshot[]>(SNAPSHOT_KEY, []))
  const todayIndex = snapshots.findIndex((s) => s.at.startsWith(today))
  const entry: RecruiterMetricsSnapshot = {
    at: new Date().toISOString(),
    openRoles,
    activeCandidates,
    responseRate,
  }

  const prior = todayIndex >= 0 ? snapshots[todayIndex] : null
  const unchanged =
    prior &&
    prior.openRoles === entry.openRoles &&
    prior.activeCandidates === entry.activeCandidates &&
    prior.responseRate === entry.responseRate
  if (unchanged) return

  const next =
    todayIndex >= 0
      ? snapshots.map((s, i) => (i === todayIndex ? entry : s))
      : [...snapshots, entry]

  try {
    localStorage.setItem(`${METRICS_PREFIX}:${SNAPSHOT_KEY}`, JSON.stringify(pruneSnapshots(next)))
  } catch {
    /* quota / private mode */
  }
}

function closestSnapshot(
  snapshots: RecruiterMetricsSnapshot[],
  targetMs: number,
  windowMs: number,
): RecruiterMetricsSnapshot | null {
  let best: RecruiterMetricsSnapshot | null = null
  let bestDiff = Infinity

  for (const snapshot of snapshots) {
    const time = new Date(snapshot.at).getTime()
    const diff = Math.abs(time - targetMs)
    if (diff <= windowMs && diff < bestDiff) {
      bestDiff = diff
      best = snapshot
    }
  }

  return best
}

function formatCountDelta(current: number, prior: number): { text: string; trend: 'up' | 'down' | 'flat' } {
  const delta = current - prior
  if (delta === 0) return { text: '0 vs last week', trend: 'flat' }
  const sign = delta > 0 ? '+' : ''
  return { text: `${sign}${delta} vs last week`, trend: delta > 0 ? 'up' : 'down' }
}

function formatRateDelta(current: number, prior: number): { text: string; trend: 'up' | 'down' | 'flat' } {
  const delta = Math.round((current - prior) * 10) / 10
  if (delta === 0) return { text: '0% vs last 7 days', trend: 'flat' }
  const sign = delta > 0 ? '+' : ''
  return { text: `${sign}${delta}% vs last 7 days`, trend: delta > 0 ? 'up' : 'down' }
}

function splitDeltaLabel(label: string): { prefix: string; suffix: string } {
  const match = label.match(/^([+-]?\d+(?:\.\d+)?%?)\s+(.*)$/)
  if (!match) return { prefix: '', suffix: label }
  return { prefix: match[1], suffix: ` ${match[2]}` }
}

export function buildHomeMetrics(candidates: Candidate[], roles: Role[]): HomeMetricCard[] {
  recordSnapshot(candidates, roles)

  const openRoles = countOpenRoles(roles)
  const activeCandidates = countActiveCandidates(candidates)
  const responseRate = computeResponseRate(candidates)

  const snapshots = loadRecruiterState<RecruiterMetricsSnapshot[]>(SNAPSHOT_KEY, [])
  const weekAgo = closestSnapshot(snapshots, Date.now() - 7 * DAY_MS, 2 * DAY_MS)

  const openRolesDelta = weekAgo
    ? formatCountDelta(openRoles, weekAgo.openRoles)
    : null
  const activeDelta = weekAgo
    ? formatCountDelta(activeCandidates, weekAgo.activeCandidates)
    : null
  const responseDelta = weekAgo
    ? formatRateDelta(responseRate, weekAgo.responseRate)
    : null

  const openRolesParts = openRolesDelta ? splitDeltaLabel(openRolesDelta.text) : null
  const activeParts = activeDelta ? splitDeltaLabel(activeDelta.text) : null
  const responseParts = responseDelta ? splitDeltaLabel(responseDelta.text) : null

  return [
    {
      label: 'Open Roles',
      value: String(openRoles),
      sub: openRolesDelta?.text ?? (openRoles > 0 ? 'Open positions' : 'No active positions'),
      hasDelta: Boolean(openRolesDelta && openRolesDelta.trend !== 'flat'),
      trend: openRolesDelta?.trend ?? 'flat',
      deltaPrefix: openRolesParts?.prefix ?? '',
      deltaSuffix: openRolesParts?.suffix ?? '',
      screen: 'roles',
    },
    {
      label: 'Active Searches',
      value: String(activeCandidates),
      sub: activeDelta?.text ?? (activeCandidates > 0 ? 'Active in pipeline' : 'No active candidates'),
      hasDelta: Boolean(activeDelta && activeDelta.trend !== 'flat'),
      trend: activeDelta?.trend ?? 'flat',
      deltaPrefix: activeParts?.prefix ?? '',
      deltaSuffix: activeParts?.suffix ?? '',
      screen: 'candidates',
    },
    {
      label: 'Response Rate',
      value: `${responseRate.toFixed(1)}%`,
      sub: responseDelta?.text ?? (candidates.length > 0 ? 'Engaged candidates' : 'No outreach campaigns'),
      hasDelta: Boolean(responseDelta && responseDelta.trend !== 'flat'),
      trend: responseDelta?.trend ?? 'flat',
      deltaPrefix: responseParts?.prefix ?? '',
      deltaSuffix: responseParts?.suffix ?? '',
      screen: 'analytics',
    },
  ]
}

export function topMatchCandidates(candidates: Candidate[], limit = 5): Candidate[] {
  return [...candidates]
    .filter((c) => c.stage !== 'Hired')
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)
}
