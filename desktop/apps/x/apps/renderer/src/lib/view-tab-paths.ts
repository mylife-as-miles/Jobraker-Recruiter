import type { RecruiterScreenId } from '@/components/recruiter'

export const RECRUITER_ROLES_TAB_PATH = '__jobraker-recruiter_roles__'
export const RECRUITER_CANDIDATES_TAB_PATH = '__jobraker-recruiter_candidates__'
export const RECRUITER_PIPELINE_TAB_PATH = '__jobraker-recruiter_pipeline__'
export const RECRUITER_ANALYTICS_TAB_PATH = '__jobraker-recruiter_analytics__'
export const RECRUITER_SOURCING_TAB_PATH = '__jobraker-recruiter_sourcing__'

export function getRecruiterTabPath(screen: RecruiterScreenId): string {
  switch (screen) {
    case 'roles':
      return RECRUITER_ROLES_TAB_PATH
    case 'candidates':
      return RECRUITER_CANDIDATES_TAB_PATH
    case 'pipeline':
      return RECRUITER_PIPELINE_TAB_PATH
    case 'analytics':
      return RECRUITER_ANALYTICS_TAB_PATH
    case 'sourcing':
      return RECRUITER_SOURCING_TAB_PATH
  }
}

export function getRecruiterScreenFromTabPath(path: string): RecruiterScreenId | null {
  switch (path) {
    case RECRUITER_ROLES_TAB_PATH:
      return 'roles'
    case RECRUITER_CANDIDATES_TAB_PATH:
      return 'candidates'
    case RECRUITER_PIPELINE_TAB_PATH:
      return 'pipeline'
    case RECRUITER_ANALYTICS_TAB_PATH:
      return 'analytics'
    case RECRUITER_SOURCING_TAB_PATH:
      return 'sourcing'
    default:
      return null
  }
}

export function isRecruiterTabPath(path: string): boolean {
  return getRecruiterScreenFromTabPath(path) != null
}

export function getRecruiterTabTitle(path: string): string | null {
  switch (path) {
    case RECRUITER_ROLES_TAB_PATH:
      return 'Roles'
    case RECRUITER_CANDIDATES_TAB_PATH:
      return 'Candidates'
    case RECRUITER_PIPELINE_TAB_PATH:
      return 'Pipeline'
    case RECRUITER_ANALYTICS_TAB_PATH:
      return 'Analytics'
    case RECRUITER_SOURCING_TAB_PATH:
      return 'Sourcing'
    default:
      return null
  }
}
