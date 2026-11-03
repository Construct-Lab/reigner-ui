import { useCallback, useEffect, useState } from 'react'
import type { Backend } from '../backends/store'
import { createClient, ReignerHttpError, replay, type Thread } from '../reigner'
import { rememberTitle } from './titles'

export type ThreadState =
  | { status: 'loading' }
  | { status: 'ready'; thread: Thread }
  | { status: 'missing' }
  | { status: 'error'; message: string }

/** Load a stored session and rebuild its rounds. */
export function useThread(backend: Backend, sessionId: string) {
  const [state, setState] = useState<ThreadState>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setVersion((v) => v + 1)
  }, [])

  // Callers key this by session, so a new session starts in 'loading'.
  useEffect(() => {
    const controller = new AbortController()
    createClient(backend.url)
      .getEvents(sessionId, { signal: controller.signal })
      .then(({ events }) => {
        const thread = replay(events)
        const first = thread.rounds[0]?.query
        if (first) rememberTitle(backend.id, sessionId, first)
        setState({ status: 'ready', thread })
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return
        // The server answers 404 for unknown and malformed ids alike.
        if (error instanceof ReignerHttpError && error.status === 404) setState({ status: 'missing' })
        else setState({ status: 'error', message: error.message })
      })
    return () => controller.abort()
  }, [backend.id, backend.url, sessionId, version])

  return { state, retry }
}
