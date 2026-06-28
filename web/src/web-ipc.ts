type IpcHandler = (event: unknown) => void

const FILE_PREFIX = 'jobraker-recruiter-web:file:'
const DIR_PREFIX = 'jobraker-recruiter-web:dir:'
const listeners = new Map<string, Set<IpcHandler>>()

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')

const fileKey = (path: string) => `${FILE_PREFIX}${normalizePath(path)}`
const dirKey = (path: string) => `${DIR_PREFIX}${normalizePath(path)}`
const readFile = (path: string) => window.localStorage.getItem(fileKey(path))

const stat = (data = '', kind: 'file' | 'dir' = 'file') => ({
  kind,
  size: data.length,
  mtimeMs: Date.now(),
  ctimeMs: Date.now(),
})

const emit = (channel: string, event: unknown) => {
  listeners.get(channel)?.forEach((handler) => handler(event))
}

const writeFile = (path: string, data: string) => {
  const normalized = normalizePath(path)
  window.localStorage.setItem(fileKey(normalized), data)
  const parts = normalized.split('/')
  for (let index = 1; index < parts.length; index += 1) {
    window.localStorage.setItem(dirKey(parts.slice(0, index).join('/')), '1')
  }
  emit('workspace:didChange', { type: 'changed', path: normalized, kind: 'file' })
}

const hasDirectory = (path: string) => {
  const normalized = normalizePath(path)
  if (!normalized) return true
  const prefix = `${normalized}/`
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? ''
    if (key === dirKey(normalized)) return true
    if (key.startsWith(FILE_PREFIX) && key.slice(FILE_PREFIX.length).startsWith(prefix)) return true
  }
  return false
}

const readdir = (path: string, recursive = false) => {
  const normalized = normalizePath(path)
  const prefix = normalized ? `${normalized}/` : ''
  const entries = new Map<string, { name: string; path: string; kind: 'file' | 'dir'; stat: { size: number; mtimeMs: number } }>()

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? ''
    if (!key.startsWith(FILE_PREFIX)) continue
    const relPath = key.slice(FILE_PREFIX.length)
    if (!relPath.startsWith(prefix)) continue
    const rest = relPath.slice(prefix.length)
    if (!rest) continue

    if (recursive || !rest.includes('/')) {
      const data = window.localStorage.getItem(key) ?? ''
      entries.set(relPath, {
        name: relPath.split('/').pop() ?? relPath,
        path: relPath,
        kind: 'file',
        stat: { size: data.length, mtimeMs: Date.now() },
      })
    } else {
      const name = rest.split('/')[0]
      const dirPath = prefix ? `${prefix}${name}` : name
      entries.set(dirPath, {
        name,
        path: dirPath,
        kind: 'dir',
        stat: { size: 0, mtimeMs: Date.now() },
      })
    }
  }

  return Array.from(entries.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

const createRun = (agentId = 'copilot') => ({
  id: `web-run-${Date.now()}`,
  title: 'Web chat',
  createdAt: new Date().toISOString(),
  agentId,
  model: 'web-shim',
  provider: 'browser',
  log: [],
})

async function invoke(channel: string, args: unknown): Promise<unknown> {
  switch (channel) {
    case 'analytics:bootstrap':
      return { installationId: 'web-browser', apiUrl: window.location.origin, appVersion: 'web' }
    case 'workspace:getRoot':
      return { root: 'browser-local-storage' }
    case 'workspace:exists': {
      const path = normalizePath((args as { path: string }).path)
      return { exists: readFile(path) !== null || hasDirectory(path) }
    }
    case 'workspace:stat': {
      const path = normalizePath((args as { path: string }).path)
      const data = readFile(path)
      return data === null ? stat('', 'dir') : stat(data)
    }
    case 'workspace:readdir': {
      const request = args as { path: string; opts?: { recursive?: boolean } }
      return readdir(request.path, request.opts?.recursive)
    }
    case 'workspace:readFile': {
      const request = args as { path: string; encoding?: 'utf8' | 'base64' | 'binary' }
      const data = readFile(request.path) ?? ''
      return {
        path: normalizePath(request.path),
        encoding: request.encoding ?? 'utf8',
        data,
        stat: stat(data),
        etag: String(data.length),
      }
    }
    case 'workspace:writeFile': {
      const request = args as { path: string; data: string }
      writeFile(request.path, request.data)
      return { path: normalizePath(request.path), stat: stat(request.data), etag: String(request.data.length) }
    }
    case 'workspace:mkdir': {
      const request = args as { path: string }
      window.localStorage.setItem(dirKey(request.path), '1')
      emit('workspace:didChange', { type: 'created', path: normalizePath(request.path), kind: 'dir' })
      return { ok: true }
    }
    case 'workspace:rename': {
      const request = args as { from: string; to: string }
      const data = readFile(request.from)
      if (data !== null) {
        window.localStorage.removeItem(fileKey(request.from))
        writeFile(request.to, data)
      }
      return { ok: true }
    }
    case 'workspace:remove': {
      const request = args as { path: string }
      window.localStorage.removeItem(fileKey(request.path))
      window.localStorage.removeItem(dirKey(request.path))
      emit('workspace:didChange', { type: 'deleted', path: normalizePath(request.path) })
      return { ok: true }
    }
    case 'runs:create':
      return createRun((args as { agentId?: string })?.agentId)
    case 'runs:list':
      return { runs: [], nextCursor: null }
    case 'runs:fetch':
      return createRun('copilot')
    case 'gmail:getImportant':
    case 'gmail:getEverythingElse':
      return { threads: [], nextCursor: null }
    case 'oauth:getState':
    case 'oauth:list-providers':
      return { providers: [] }
    case 'models:list':
      return { providers: [], defaults: {} }
    case 'bg-task:list':
      return { items: [], tasks: [], nextCursor: null }
    case 'bg-task:listRunIds':
      return { runIds: [] }
    case 'bg-task:get':
      return { task: null }
    case 'bg-task:create':
    case 'bg-task:patch':
    case 'bg-task:run':
    case 'bg-task:stop':
    case 'bg-task:delete':
      return { ok: true }
    case 'agent-schedule:getConfig':
      return { agents: [] }
    case 'agent-schedule:getState':
      return { entries: [] }
    case 'browser:getState':
      return { tabs: [], activeTabId: null }
    case 'onboarding:getStatus':
      return { completed: true }
    case 'voice:getConfig':
      return { enabled: false }
    case 'meeting:checkScreenPermission':
      return { granted: false }
    case 'knowledge:history':
      return { commits: [] }
    case 'app:consumePendingDeepLink':
      return { url: null }
    case 'migration:check-composio-google':
      return { needed: false }
    default:
      console.info(`[web-ipc] ${channel} is using an empty browser fallback.`)
      return { ok: true }
  }
}

function send(channel: string, event: unknown) {
  emit(channel, event)
}

function on(channel: string, handler: IpcHandler) {
  const channelListeners = listeners.get(channel) ?? new Set<IpcHandler>()
  channelListeners.add(handler)
  listeners.set(channel, channelListeners)
  return () => {
    channelListeners.delete(handler)
  }
}

if (!window.ipc) {
  window.ipc = { invoke, send, on } as typeof window.ipc
}

if (!window.electronUtils) {
  window.electronUtils = {
    getPathForFile: (file: File) => file.name,
    getZoomFactor: () => 1,
  }
}

window.electronPlatform = window.electronPlatform ?? 'win32'
