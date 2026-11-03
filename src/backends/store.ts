// Saved backends: the Reigner servers this browser knows about. Kept in
// localStorage because one server is one agent and the UI has no server of
// its own to remember them.

import { useSyncExternalStore } from 'react'
import { onExternalChange, readJson, writeJson } from '../lib/storage'

export interface Backend {
  /** Short id used in URLs: /b/:id */
  id: string
  /** Normalized base URL, e.g. http://localhost:8000 */
  url: string
  /** Optional label. Falls back to the agent name from /health. */
  name?: string
  addedAt: string
  /** Last successful /health, for "last seen" on unreachable backends. */
  lastSeenAt?: string
}

const KEY = 'backends'
const LAST_USED_KEY = 'last-backend'
const listeners = new Set<() => void>()
let backends: Backend[] = readJson<Backend[]>(KEY, [])

function commit(next: Backend[]) {
  backends = next
  writeJson(KEY, next)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const unsubscribe = onExternalChange(KEY, () => {
    backends = readJson<Backend[]>(KEY, [])
    listener()
  })
  return () => {
    listeners.delete(listener)
    unsubscribe()
  }
}

export function useBackends(): Backend[] {
  return useSyncExternalStore(subscribe, () => backends)
}

export function getBackends(): Backend[] {
  return backends
}

export function addBackend(url: string, name?: string): Backend {
  const existing = backends.find((b) => b.url === url)
  if (existing) return existing
  const backend: Backend = { id: newId(), url, name: name?.trim() || undefined, addedAt: new Date().toISOString() }
  commit([...backends, backend])
  return backend
}

export function updateBackend(id: string, patch: Partial<Omit<Backend, 'id'>>) {
  commit(backends.map((b) => (b.id === id ? { ...b, ...patch } : b)))
}

export function removeBackend(id: string) {
  commit(backends.filter((b) => b.id !== id))
}

export function getLastUsedBackendId(): string | null {
  return readJson<string | null>(LAST_USED_KEY, null)
}

export function setLastUsedBackendId(id: string) {
  writeJson(LAST_USED_KEY, id)
}

function newId(): string {
  // Not crypto.randomUUID: it's missing on plain-http LAN addresses.
  let id: string
  do id = Math.random().toString(36).slice(2, 8)
  while (backends.some((b) => b.id === id))
  return id
}
