import { createClient } from '@/lib/client'

type IpcHandler = (event: unknown) => void

const listeners = new Map<string, Set<IpcHandler>>()

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')

const emit = (channel: string, event: unknown) => {
  listeners.get(channel)?.forEach((handler) => handler(event))
}

const isWorkspaceMutation = (channel: string) =>
  channel === 'workspace:writeFile' ||
  channel === 'workspace:mkdir' ||
  channel === 'workspace:rename' ||
  channel === 'workspace:copy' ||
  channel === 'workspace:remove'

const changedPathFor = (channel: string, args: unknown) => {
  const payload = (args ?? {}) as { path?: string; from?: string; to?: string }
  if (channel === 'workspace:rename' || channel === 'workspace:copy') {
    return normalizePath(payload.to ?? payload.from ?? '')
  }
  return normalizePath(payload.path ?? '')
}

const functionForChannel = (channel: string) => {
  if (channel.startsWith('workspace:')) return 'workspace-files'
  if (channel.startsWith('runs:')) return 'chat-runs'
  if (channel.startsWith('bg-task:')) return 'background-tasks'
  if (channel.startsWith('recruiter:')) return 'recruiter-ai'
  if (channel.startsWith('search:')) return 'workspace-search'
  return 'app-status'
}

async function invoke(channel: string, args: unknown): Promise<unknown> {
  const supabase = createClient()
  const functionName = functionForChannel(channel)
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { channel, args },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (isWorkspaceMutation(channel)) {
    emit('workspace:didChange', {
      type: channel === 'workspace:remove' ? 'deleted' : 'changed',
      path: changedPathFor(channel, args),
    })
  }

  return data
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
