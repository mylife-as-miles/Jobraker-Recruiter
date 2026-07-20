import type { CandidateStage } from './data'

export const AUTOPILOT_STAGES: CandidateStage[] = [
  'New',
  'Screening',
  'In Review',
  'Shortlisted',
  'Interview',
  'Offer',
  'Hired',
]

export function stripJsonFence(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
}

export function asCandidateStage(value: unknown, fallback: CandidateStage): CandidateStage {
  return AUTOPILOT_STAGES.includes(value as CandidateStage) ? (value as CandidateStage) : fallback
}
