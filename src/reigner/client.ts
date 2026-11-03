import {
  isKnownEvent,
  type HealthResponse,
  type Profile,
  type ReignerEvent,
  type SessionMeta,
  type SessionEventsResponse,
} from './events'
import { readEvents } from './sse'

/** The server answered with a non-2xx status before any streaming started. */
export class ReignerHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ReignerHttpError'
    this.status = status
  }
}

/**
 * The request never got an answer: the server is down, the URL is wrong, or
 * the browser blocked it for CORS. Browsers don't say which.
 */
export class ReignerNetworkError extends Error {
  constructor(url: string) {
    super(`No response from ${url}`)
    this.name = 'ReignerNetworkError'
  }
}

export interface RunRequest {
  query: string
  /** Omit or null to start a new session. */
  sessionId?: string | null
  /** Only applies to new sessions. */
  profile?: Profile
  state?: Record<string, unknown>
}

export interface SessionEvents {
  sessionId: string
  total: number
  truncated: boolean
  events: ReignerEvent[]
}

export interface ReignerClient {
  readonly baseUrl: string
  health(signal?: AbortSignal): Promise<HealthResponse>
  listSessions(signal?: AbortSignal): Promise<SessionMeta[]>
  getEvents(
    sessionId: string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<SessionEvents>
  /**
   * Run one query and yield its events as they stream. Abort `signal` to stop
   * the run. Don't start two runs on the same session at once: the server
   * doesn't lock sessions.
   */
  run(request: RunRequest, signal?: AbortSignal): AsyncGenerator<ReignerEvent>
}

/**
 * Accepts what people type ("localhost:8000", "http://host/") and returns a
 * base URL with a scheme and no trailing slash. Throws on anything else.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim()
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  const url = new URL(withScheme)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`Unsupported protocol: ${url.protocol}`)
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

export function createClient(baseUrl: string): ReignerClient {
  const base = normalizeBaseUrl(baseUrl)

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${base}${path}`
    let response: Response
    try {
      response = await fetch(url, init)
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new ReignerNetworkError(url)
    }
    if (!response.ok) throw await toHttpError(response)
    return response
  }

  return {
    baseUrl: base,

    async health(signal) {
      return (await request('/health', { signal })).json()
    },

    async listSessions(signal) {
      const body: { sessions: SessionMeta[] } = await (await request('/sessions', { signal })).json()
      return body.sessions
    },

    async getEvents(sessionId, { limit, signal } = {}) {
      const query = limit ? `?limit=${limit}` : ''
      const path = `/sessions/${encodeURIComponent(sessionId)}/events${query}`
      const body: SessionEventsResponse = await (await request(path, { signal })).json()
      return {
        sessionId: body.session_id,
        total: body.total,
        truncated: body.truncated,
        events: body.events.filter(isKnownEvent),
      }
    },

    async *run({ query, sessionId = null, profile = 'full', state = {} }, signal) {
      // No cookies or Authorization: the server's CORS setup doesn't allow credentials.
      const response = await request('/run', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, session_id: sessionId, profile, state }),
      })
      if (!response.body) throw new ReignerHttpError(response.status, 'Empty response body')
      yield* readEvents(response.body)
    },
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** FastAPI errors look like `{"detail": "..."}` or, for 422, a list of issues. */
async function toHttpError(response: Response): Promise<ReignerHttpError> {
  let message = `${response.status} ${response.statusText}`.trim()
  try {
    const body: { detail?: unknown } = await response.json()
    if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail)) {
      message = body.detail
        .map((issue: { msg?: string }) => issue.msg)
        .filter(Boolean)
        .join('; ')
    }
  } catch {
    // Not JSON: keep the status line.
  }
  return new ReignerHttpError(response.status, message)
}
