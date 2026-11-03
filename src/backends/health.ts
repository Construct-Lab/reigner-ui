// Polls GET /health on every saved backend so the switcher can show which
// are online, and so the header can show the agent's name and model.

import { useEffect, useSyncExternalStore } from 'react'
import { createClient, type HealthResponse } from '../reigner'
import { getBackends, updateBackend, type Backend } from './store'

export type HealthStatus = 'checking' | 'online' | 'offline'

export interface BackendHealth {
  status: HealthStatus
  health?: HealthResponse
}

const POLL_MS = 10_000
const TIMEOUT_MS = 4_000
// Write lastSeenAt at most this often, to avoid churning localStorage.
const LAST_SEEN_WRITE_MS = 60_000

const listeners = new Set<() => void>()
let snapshot: Record<string, BackendHealth> = {}

function set(id: string, value: BackendHealth) {
  snapshot = { ...snapshot, [id]: value }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHealthMap(): Record<string, BackendHealth> {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function useBackendHealth(id: string | undefined): BackendHealth {
  const map = useHealthMap()
  return (id && map[id]) || { status: 'checking' }
}

/** One /health request with a timeout. Never throws. */
export async function probe(url: string): Promise<HealthResponse | null> {
  try {
    return await createClient(url).health(AbortSignal.timeout(TIMEOUT_MS))
  } catch {
    return null
  }
}

export async function checkBackend(backend: Backend): Promise<void> {
  const previous = snapshot[backend.id]
  if (!previous) set(backend.id, { status: 'checking' })
  const health = await probe(backend.url)
  if (health) {
    set(backend.id, { status: 'online', health })
    const lastSeen = backend.lastSeenAt ? Date.parse(backend.lastSeenAt) : 0
    if (Date.now() - lastSeen > LAST_SEEN_WRITE_MS) {
      updateBackend(backend.id, { lastSeenAt: new Date().toISOString() })
    }
  } else {
    // Keep the last known name and model so the header doesn't go blank.
    set(backend.id, { status: 'offline', health: previous?.health })
  }
}

function checkAll() {
  return Promise.all(getBackends().map(checkBackend))
}

/** Mount once at the app root. Pauses while the tab is hidden. */
export function useHealthPolling(backendIds: string) {
  useEffect(() => {
    let timer: number | undefined
    const tick = () => {
      window.clearTimeout(timer)
      if (document.hidden) return
      void checkAll().finally(() => {
        timer = window.setTimeout(tick, POLL_MS)
      })
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
    }
    // Restart when the set of backends changes.
  }, [backendIds])
}
