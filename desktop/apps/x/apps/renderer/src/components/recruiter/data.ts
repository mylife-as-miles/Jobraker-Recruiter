// Mock recruiter data powering the Roles / Candidates / Pipeline / Analytics
// dashboards. These screens are presentation-first; the data here mirrors the
// product design so the UI renders with realistic, premium content. Swap these
// for live IPC-backed sources when a recruiting backend exists.

export type PipelineStage =
  | 'Sourced'
  | 'Contacted'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Hired'

export const PIPELINE_STAGES: PipelineStage[] = [
  'Sourced',
  'Contacted',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
]

export type CandidateStage =
  | 'New'
  | 'Screening'
  | 'In Review'
  | 'Shortlisted'
  | 'Interview'
  | 'Offer'
  | 'Hired'

export type CandidateSource =
  | 'LinkedIn'
  | 'Referral'
  | 'Website'
  | 'Job Board'
  | 'AngelList'
  | 'Dribbble'
  | 'Twitter'
  | 'Career Page'
  | 'PDL Enrichment'
  | 'Enrich.so'
  | 'Quick Import'

export type CompanyStage = 'Seed' | 'Series A' | 'Series B' | 'Growth' | 'Enterprise'
export type GrowthTrajectory = 'Fast' | 'Moderate' | 'Steady'
export type VestingStatus = 'Fully Vested' | 'Partially Vested' | 'Unvested'
export type IntentSignal = 'Actively Sourcing' | 'Recently Promoted' | 'High Engagement' | 'Passive'

export type CandidateEducation = {
  school: string
  degree?: string
  field?: string
  startYear?: number
  endYear?: number
}

export type CandidateExperience = {
  company: string
  title: string
  startDate?: string
  endDate?: string
  isCurrent?: boolean
}

export type Candidate = {
  id: string
  name: string
  title: string
  location: string
  experienceYears: number
  matchScore: number
  stage: CandidateStage
  source: CandidateSource
  lastActivity: string
  fit?: 'High fit' | 'Recommended' | null
  skills: string[]
  highlights: string[]
  aiInsight: string
  note?: string
  email: string
  companyStages: CompanyStage[]
  growthTrajectory: GrowthTrajectory
  vestingStatus: VestingStatus
  intentSignal: IntentSignal
  startupFitScore: number
  startupFitInsight: string

  // LinkedIn Enrichment Extensions
  linkedinUrl?: string
  enrichedAt?: string
  enrichmentSource?: 'pdl' | 'enrich.so' | 'manual'
  photoUrl?: string
  headline?: string
  summary?: string
  education?: CandidateEducation[]
  experience?: CandidateExperience[]
  emails?: string[]
  phones?: string[]
  socialProfiles?: Record<string, string>
}

// Deterministic avatar gradient from a name so colors stay stable per person.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1dff00 0%, #0b8f12 100%)',
  'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
  'linear-gradient(135deg, #f8d74a 0%, #f97316 100%)',
  'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
  'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
]

export function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Fill defaults for candidates loaded from storage or quick import (partial records). */
export function normalizeCandidate(raw: Partial<Candidate> & Pick<Candidate, 'id' | 'name'>): Candidate {
  return {
    id: raw.id,
    name: raw.name,
    title: raw.title ?? 'Unknown Role',
    location: raw.location ?? 'Remote',
    experienceYears: raw.experienceYears ?? 0,
    matchScore: raw.matchScore ?? 70,
    stage: raw.stage ?? 'New',
    source: raw.source ?? 'Quick Import',
    lastActivity: raw.lastActivity ?? 'Just now',
    fit: raw.fit ?? null,
    skills: raw.skills ?? [],
    highlights: raw.highlights ?? [],
    aiInsight: raw.aiInsight ?? '',
    note: raw.note ?? '',
    email: raw.email ?? '',
    companyStages: raw.companyStages ?? ['Seed'],
    growthTrajectory: raw.growthTrajectory ?? 'Moderate',
    vestingStatus: raw.vestingStatus ?? 'Unvested',
    intentSignal: raw.intentSignal ?? 'Passive',
    startupFitScore: raw.startupFitScore ?? 70,
    startupFitInsight: raw.startupFitInsight ?? '',
    linkedinUrl: raw.linkedinUrl,
    enrichedAt: raw.enrichedAt,
    enrichmentSource: raw.enrichmentSource,
    photoUrl: raw.photoUrl,
    headline: raw.headline,
    summary: raw.summary,
    education: raw.education ?? [],
    experience: raw.experience ?? [],
    emails: raw.emails ?? [],
    phones: raw.phones ?? [],
    socialProfiles: raw.socialProfiles,
  }
}

export function matchTone(score: number): { text: string; bg: string; ring: string } {
  if (score >= 85) return { text: '#1dff00', bg: 'rgba(29,255,0,0.12)', ring: 'rgba(29,255,0,0.45)' }
  if (score >= 65) return { text: '#f8d74a', bg: 'rgba(248,215,74,0.12)', ring: 'rgba(248,215,74,0.4)' }
  return { text: '#f97316', bg: 'rgba(249,115,22,0.12)', ring: 'rgba(249,115,22,0.4)' }
}

// ───────────────────────── Candidates ─────────────────────────

export const CANDIDATES: Candidate[] = []

export const CANDIDATE_KPIS = {
  total: 0,
  shortlisted: 0,
  inReview: 0,
  avgMatch: 0,
  totalDeltaPct: 0,
  shortlistedDeltaPct: 0,
  inReviewDeltaPct: 0,
  avgMatchDeltaPct: 0,
}

// ───────────────────────── Pipeline ─────────────────────────

export type PipelineColumn = {
  stage: PipelineStage
  count: number
  deltaPct: number
  candidateIds: string[]
}

export const PIPELINE_ROLE_OPTIONS = [
  'Senior Product Designer',
  'Backend Engineer',
  'Data Scientist',
  'Product Manager',
  'Sales Executive',
]

export const PIPELINE_COLUMNS: PipelineColumn[] = []

export type PipelineInsight = {
  kind: 'bottleneck' | 'conversion' | 'outreach' | 'interview'
  title: string
  body: string
  cta: string
}

export const PIPELINE_INSIGHTS: PipelineInsight[] = [
  {
    kind: 'bottleneck',
    title: 'Bottleneck',
    body: 'Screening is taking the longest on average (5.6 days).',
    cta: 'Review screening tasks',
  },
  {
    kind: 'conversion',
    title: 'Conversion rate',
    body: 'From Sourced to Hired',
    cta: 'View other suggestions',
  },
]

// ───────────────────────── Roles ─────────────────────────

export type Role = {
  id: string
  title: string
  department: string
  location: string
  employmentType: string
  level: string
  salaryRange: string
  status: 'Open' | 'Interviewing' | 'Closing' | 'Draft'
  postedAgo: string
  applicants: number
  newApplicants: number
  qualityScore: number
  favorite?: boolean
  description: string
  responsibilities: string[]
  requirements: string[]
  skills: string[]
  stageCounts: { stage: PipelineStage; count: number }[]
}

export const ROLES: Role[] = []

// ───────────────────────── Analytics ─────────────────────────

export type Kpi = {
  label: string
  value: string
  deltaLabel: string
  trend: 'up' | 'down'
  icon: 'roles' | 'response' | 'time' | 'interviews' | 'offer'
}

export const ANALYTICS_KPIS: Kpi[] = []

export type FunnelStage = { stage: string; value: number; conversion: number }

export const HIRING_FUNNEL: FunnelStage[] = []

export type SourceSlice = { name: string; value: number; pct: number; color: string }

export const SOURCE_PERFORMANCE: SourceSlice[] = []

export const SOURCE_TOTAL = 0

export type TrendPoint = { label: string; value: number }

export const OUTREACH_TREND: TrendPoint[] = []

export type TimeToFillRow = { role: string; days: number; deltaDays: number }

export const TIME_TO_FILL_BY_ROLE: TimeToFillRow[] = []

export type PipelineHealthStage = { stage: string; pct: number; deltaPct: number }

export const PIPELINE_HEALTH = {
  score: 0,
  label: 'N/A',
  note: 'No candidates in pipeline.',
  stages: [] as PipelineHealthStage[],
}

export type AnalyticsInsight = {
  kind: 'response' | 'time'
  title: string
  body: string
}

export const ANALYTICS_INSIGHTS: AnalyticsInsight[] = []

export const ANALYTICS_RECOMMENDED_ACTIONS: string[] = []

export const DATE_RANGE_LABEL = 'May 11 – Jun 10, 2025'

export function candidateById(id: string): Candidate | undefined {
  try {
    const raw = localStorage.getItem('jobraker-recruiter-ui:candidates')
    if (raw) {
      const parsed = JSON.parse(raw) as Candidate[]
      const found = parsed.find((c) => c.id === id)
      if (found) return found
    }
  } catch {}
  return CANDIDATES.find((c) => c.id === id)
}
