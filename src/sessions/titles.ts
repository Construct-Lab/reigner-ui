// /sessions has no titles (only the CLI sets one), so the sidebar titles each
// session by its first question. That needs the session's events, so titles
// are fetched lazily, a few at a time, and cached per backend for good: a
// session's first question never changes.

import { useEffect, useSyncExternalStore } from 'react'
import type { Backend } from '../backends/store'
import { readJson, writeJson } from '../lib/storage'
import { createClient, type SessionMeta } from '../reigner'

/** Title by session id. An empty string means "no question found". */
type Titles = Record<string, string>

const CONCURRENCY = 3
const MAX_LENGTH = 80

const cache = new Map<string, Titles>()
const inFlight = new Set<string>()
const listeners = new Set<() => void>()

function load(backendId: string): Titles {
  let titles = cache.get(backendId)
  if (!titles) {
    titles = readJson<Titles>(`titles:${backendId}`, {})
    cache.set(backendId, titles)
  }
  return titles
}

function save(backendId: string, sessionId: string, title: string) {
  const titles = { ...load(backendId), [sessionId]: title }
  cache.set(backendId, titles)
  writeJson(`titles:${backendId}`, titles)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function titleFromQuery(query: string): string {
  const flat = query.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_LENGTH ? `${flat.slice(0, MAX_LENGTH - 1).trimEnd()}…` : flat
}

/** Remember a title learned elsewhere, e.g. from an opened thread. */
export function rememberTitle(backendId: string, sessionId: string, query: string) {
  if (!load(backendId)[sessionId]) save(backendId, sessionId, titleFromQuery(query))
}

/** Titles for `sessions`, fetching any that aren't cached yet. */
export function useTitles(backend: Backend, sessions: SessionMeta[] | undefined): Titles {
  const titles = useSyncExternalStore(subscribe, () => load(backend.id))

  useEffect(() => {
    if (!sessions) return
    const client = createClient(backend.url)
    const known = load(backend.id)
    const queue = sessions
      .filter((s) => !s.title && known[s.session_id] === undefined)
      .map((s) => s.session_id)
      .filter((id) => !inFlight.has(`${backend.id}/${id}`))
    let cancelled = false

    async function worker() {
      for (let id = queue.shift(); id && !cancelled; id = queue.shift()) {
        const key = `${backend.id}/${id}`
        inFlight.add(key)
        try {
          const { events } = await client.getEvents(id)
          const first = events.find((e) => e.type === 'user_query')
          save(backend.id, id, first ? titleFromQuery(first.query) : '')
        } catch {
          // Leave it uncached; the next load retries.
        } finally {
          inFlight.delete(key)
        }
      }
    }

    void Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return () => {
      cancelled = true
    }
  }, [backend.id, backend.url, sessions])

  return titles
}

/** The server's title, else the cached first question, else undefined. */
export function sessionTitle(session: SessionMeta, titles: Titles): string | undefined {
  return session.title || titles[session.session_id] || undefined
}
