import { useCallback, useEffect, useState } from 'react'
import { useBackendHealth } from '../backends/health'
import type { Backend } from '../backends/store'
import { createClient, type SessionMeta } from '../reigner'

export type SessionsState =
  | { status: 'loading'; sessions?: SessionMeta[] }
  | { status: 'ready'; sessions: SessionMeta[] }
  | { status: 'error'; message: string; sessions?: SessionMeta[] }

/**
 * The backend's sessions. Refetches when the backend comes back online.
 * Callers key this by backend, so switching backends starts in 'loading'.
 */
export function useSessions(backend: Backend) {
  const online = useBackendHealth(backend.id).status === 'online'
  const [state, setState] = useState<SessionsState>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => {
    setState((prev) => ({ status: 'loading', sessions: prev.sessions }))
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    createClient(backend.url)
      .listSessions(controller.signal)
      .then((sessions) => setState({ status: 'ready', sessions }))
      .catch((error: Error) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ status: 'error', message: error.message, sessions: prev.sessions }))
      })
    return () => controller.abort()
  }, [backend.url, online, version])

  return { state, refresh }
}
