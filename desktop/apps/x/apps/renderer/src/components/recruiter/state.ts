import { useCallback, useEffect, useState } from 'react'
import { CANDIDATES, ROLES, normalizeCandidate, type Candidate, type CandidateStage, type Role } from './data'
import { loadRecruiterState, RECRUITER_STATE_EVENT } from './storage'

const STORAGE_PREFIX = 'jobraker-recruiter-ui:'

export function loadMergedCandidates(): Candidate[] {
  const list = loadRecruiterState<Candidate[]>('candidates', CANDIDATES)
  const stages = loadRecruiterState<Record<string, CandidateStage>>('candidate-stages', {})
  const notes = loadRecruiterState<Record<string, string>>('candidate-notes', {})
  return list.map((c) => normalizeCandidate({
    ...c,
    stage: stages[c.id] ?? c.stage,
    note: notes[c.id] ?? c.note ?? '',
  }))
}

export function loadMergedRoles(): Role[] {
  const list = loadRecruiterState<Role[]>('roles', ROLES)
  const favorites = loadRecruiterState<string[]>('role-favorites', [])
  const favSet = new Set(favorites)
  return list.map((r) => ({
    ...r,
    favorite: r.favorite || favSet.has(r.id),
  }))
}

export function useRecruiterData() {
  const [candidates, setCandidates] = useState<Candidate[]>(loadMergedCandidates)
  const [roles, setRoles] = useState<Role[]>(loadMergedRoles)

  const refresh = useCallback(() => {
    setCandidates(loadMergedCandidates())
    setRoles(loadMergedRoles())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(STORAGE_PREFIX)) refresh()
    }
    const onStateChange = () => refresh()

    window.addEventListener('storage', onStorage)
    window.addEventListener(RECRUITER_STATE_EVENT, onStateChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(RECRUITER_STATE_EVENT, onStateChange)
    }
  }, [refresh])

  return { candidates, roles, refresh }
}
