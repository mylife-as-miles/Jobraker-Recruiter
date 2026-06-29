export const normalizePath = (path = '') =>
  path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')

export const stat = (row?: { data?: string | null; kind?: string | null; byte_size?: number | null; updated_at?: string | null; created_at?: string | null }) => {
  const now = Date.now()
  const updatedAt = row?.updated_at ? Date.parse(row.updated_at) : now
  const createdAt = row?.created_at ? Date.parse(row.created_at) : updatedAt
  return {
    kind: row?.kind === 'dir' ? 'dir' : 'file',
    size: row?.byte_size ?? new TextEncoder().encode(row?.data ?? '').length,
    mtimeMs: Number.isFinite(updatedAt) ? updatedAt : now,
    ctimeMs: Number.isFinite(createdAt) ? createdAt : now,
  }
}
