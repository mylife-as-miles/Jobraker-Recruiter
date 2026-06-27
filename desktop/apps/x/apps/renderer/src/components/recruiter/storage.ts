const PREFIX = 'jobraker-recruiter-ui'

export const RECRUITER_STATE_EVENT = 'jobraker-recruiter-state-change'
export const RECRUITER_DB_PATH = 'config/recruiter-db.json'

export type RecruiterDb = {
  candidates: unknown[]
  roles: unknown[]
  pipelineBoard: Record<string, unknown>
  candidateStages: Record<string, unknown>
  candidateNotes: Record<string, unknown>
  roleFavorites: unknown[]
  homeMetricsSnapshots: unknown[]
}

const DB_KEYS = {
  candidates: 'candidates',
  roles: 'roles',
  pipelineBoard: 'pipeline-board',
  candidateStages: 'candidate-stages',
  candidateNotes: 'candidate-notes',
  roleFavorites: 'role-favorites',
  homeMetricsSnapshots: 'home-metrics-snapshots',
} as const

let lastRecruiterDbJson = ''

export function loadRecruiterState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveRecruiterState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(RECRUITER_STATE_EVENT, { detail: { key } }))

    // Asynchronously sync the full database to disk file config/recruiter-db.json
    void syncRecruiterDbToDisk()
  } catch {
    /* quota / private mode */
  }
}

function normalizeRecruiterDb(db: Partial<RecruiterDb> | null | undefined): RecruiterDb {
  return {
    candidates: Array.isArray(db?.candidates) ? db.candidates : [],
    roles: Array.isArray(db?.roles) ? db.roles : [],
    pipelineBoard: db?.pipelineBoard && typeof db.pipelineBoard === 'object' && !Array.isArray(db.pipelineBoard) ? db.pipelineBoard : {},
    candidateStages: db?.candidateStages && typeof db.candidateStages === 'object' && !Array.isArray(db.candidateStages) ? db.candidateStages : {},
    candidateNotes: db?.candidateNotes && typeof db.candidateNotes === 'object' && !Array.isArray(db.candidateNotes) ? db.candidateNotes : {},
    roleFavorites: Array.isArray(db?.roleFavorites) ? db.roleFavorites : [],
    homeMetricsSnapshots: Array.isArray(db?.homeMetricsSnapshots) ? db.homeMetricsSnapshots : [],
  }
}

function writeRawRecruiterState(key: string, value: unknown): void {
  localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
}

export function getRecruiterDbSnapshot(): RecruiterDb {
  return normalizeRecruiterDb({
    candidates: loadRecruiterState('candidates', []),
    roles: loadRecruiterState('roles', []),
    pipelineBoard: loadRecruiterState('pipeline-board', {}),
    candidateStages: loadRecruiterState('candidate-stages', {}),
    candidateNotes: loadRecruiterState('candidate-notes', {}),
    roleFavorites: loadRecruiterState('role-favorites', []),
    homeMetricsSnapshots: loadRecruiterState('home-metrics-snapshots', []),
  })
}

export async function syncRecruiterDbToDisk(): Promise<void> {
  try {
    // Only proceed if window.ipc is available (e.g. running inside Electron)
    if (!window.ipc) return
    const db = getRecruiterDbSnapshot()
    const data = JSON.stringify(db, null, 2)
    if (data === lastRecruiterDbJson) return
    lastRecruiterDbJson = data
    await window.ipc.invoke("workspace:writeFile", {
      path: RECRUITER_DB_PATH,
      data,
      opts: { mkdirp: true },
    })
  } catch (err) {
    console.error("Failed to sync recruiter db to disk", err)
  }
}

export async function loadRecruiterDbFromDisk(): Promise<RecruiterDb | null> {
  try {
    if (!window.ipc) return null
    const result = await window.ipc.invoke("workspace:readFile", { path: RECRUITER_DB_PATH })
    const raw = typeof result === 'string' ? result : result?.data
    if (typeof raw !== 'string' || raw.trim().length === 0) return null
    const db = normalizeRecruiterDb(JSON.parse(raw) as Partial<RecruiterDb>)
    lastRecruiterDbJson = JSON.stringify(db, null, 2)
    return db
  } catch (err) {
    console.warn("Recruiter db not available on disk yet", err)
    return null
  }
}

export function applyRecruiterDbToLocalState(db: Partial<RecruiterDb>, source: 'startup' | 'disk' | 'agent' = 'disk'): void {
  try {
    const normalized = normalizeRecruiterDb(db)
    lastRecruiterDbJson = JSON.stringify(normalized, null, 2)
    writeRawRecruiterState(DB_KEYS.candidates, normalized.candidates)
    writeRawRecruiterState(DB_KEYS.roles, normalized.roles)
    writeRawRecruiterState(DB_KEYS.pipelineBoard, normalized.pipelineBoard)
    writeRawRecruiterState(DB_KEYS.candidateStages, normalized.candidateStages)
    writeRawRecruiterState(DB_KEYS.candidateNotes, normalized.candidateNotes)
    writeRawRecruiterState(DB_KEYS.roleFavorites, normalized.roleFavorites)
    writeRawRecruiterState(DB_KEYS.homeMetricsSnapshots, normalized.homeMetricsSnapshots)
    window.dispatchEvent(new CustomEvent(RECRUITER_STATE_EVENT, {
      detail: { key: 'recruiter-db', source, db: normalized },
    }))
  } catch (err) {
    console.error("Failed to apply recruiter db to local state", err)
  }
}

export async function initializeRecruiterDbFromDisk(): Promise<void> {
  const db = await loadRecruiterDbFromDisk()
  if (db) {
    applyRecruiterDbToLocalState(db, 'startup')
    return
  }
  await syncRecruiterDbToDisk()
}

export async function reloadRecruiterDbFromDisk(source: 'disk' | 'agent' = 'disk'): Promise<void> {
  const db = await loadRecruiterDbFromDisk()
  if (db) applyRecruiterDbToLocalState(db, source)
}

function cleanMockData(): void {
  try {
    const rawCandidates = localStorage.getItem('jobraker-recruiter-ui:candidates')
    if (rawCandidates) {
      const parsed = JSON.parse(rawCandidates) as any[]
      const hasMock = Array.isArray(parsed) && parsed.some((c: any) =>
        c && typeof c === 'object' && ['Teni Ogunleye', 'Morgan Lee', 'Femi Okoro', 'Priya Shah', 'Jason Ng'].includes(c.name)
      )
      if (hasMock) {
        localStorage.removeItem('jobraker-recruiter-ui:candidates')
        localStorage.removeItem('jobraker-recruiter-ui:roles')
        localStorage.removeItem('jobraker-recruiter-ui:candidate-stages')
        localStorage.removeItem('jobraker-recruiter-ui:candidate-notes')
        localStorage.removeItem('jobraker-recruiter-ui:role-favorites')
        localStorage.removeItem('jobraker-recruiter-ui:pipeline-board')
        localStorage.removeItem('jobraker-recruiter-ui:home-metrics-snapshots')
      }
    }
  } catch {
    // Ignore error
  }
}

cleanMockData()
