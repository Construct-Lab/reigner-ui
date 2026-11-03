// Groups a session's events into rounds: one user question and everything the
// agent did to answer it. Live streams and replayed transcripts both go
// through `applyEvent`, so a round renders the same either way.

import type {
  CompactionEvent,
  FinalAnswerMetadata,
  OracleEvent,
  ReignerEvent,
  StatusEvent,
  SteeringEvent,
  ToolCallEvent,
  ToolResultEvent,
} from './events'
import { isPseudoTool } from './toolSummary'

export type RoundStatus =
  | 'running'
  /** Ended with `final_answer`. */
  | 'answered'
  /** Ended with `clarification`: the user's reply is the next question. */
  | 'clarifying'
  /** Ended with `error`. */
  | 'failed'
  /** No terminal event: the run was stopped or the connection dropped. */
  | 'interrupted'

/** One tool call, completed by the `tool_result` with the same `call_id`. */
export interface Step {
  callId: string
  name: string
  args: Record<string, unknown>
  /** Bookkeeping tools such as `register_citation`, hidden by default. */
  pseudo: boolean
  startedAt: string
  /** Set once the result arrives. Some calls never get one (`stop`). */
  finishedAt?: string
  result?: unknown
  truncated: boolean
  cached: boolean
  seq: number
}

export interface Citation {
  source: string
  locator: Record<string, unknown>
  value: unknown
  seq: number
}

export type Notice = OracleEvent | CompactionEvent | SteeringEvent | StatusEvent

export interface Round {
  /** Position in the thread, stable across live updates. Use as a React key. */
  index: number
  /** Null when a `?limit=` suffix starts partway through a round. */
  query: string | null
  startedAt: string
  /** Time of the latest event, used as the end time of an interrupted round. */
  lastEventAt: string
  endedAt?: string
  steps: Step[]
  /** Numbered in order of first appearance, deduped by source and locator. */
  citations: Citation[]
  notices: Notice[]
  answer?: { text: string; metadata: FinalAnswerMetadata }
  clarification?: { question: string; candidates: unknown[] }
  error?: { message: string; recoverable: boolean }
  status: RoundStatus
}

export interface Thread {
  sessionId: string | null
  rounds: Round[]
}

export const emptyThread: Thread = { sessionId: null, rounds: [] }

export function applyEvent(thread: Thread, event: ReignerEvent): Thread {
  const sessionId = thread.sessionId ?? event.session_id

  if (event.type === 'user_query') {
    const rounds = interruptLast(thread.rounds)
    return { sessionId, rounds: [...rounds, newRound(rounds.length, event.query, event.ts)] }
  }

  const last = thread.rounds.at(-1)
  // A suffix fetched with ?limit= can start mid-round, with no user_query.
  const round = last ?? newRound(0, null, event.ts)
  const updated = updateRound(round, event)
  if (updated === round) return thread
  return { sessionId, rounds: [...thread.rounds.slice(0, round.index), { ...updated, lastEventAt: event.ts }] }
}

function updateRound(round: Round, event: ReignerEvent): Round {
  switch (event.type) {
    case 'tool_call':
      return { ...round, steps: [...round.steps, newStep(event)] }
    case 'tool_result':
      // Parallel reads can finish in any order: match by id, never by position.
      return {
        ...round,
        steps: round.steps.map((step) => (step.callId === event.call_id ? complete(step, event) : step)),
      }
    case 'citation': {
      const key = citationKey(event.source, event.locator)
      if (round.citations.some((c) => citationKey(c.source, c.locator) === key)) return round
      const citation = { source: event.source, locator: event.locator, value: event.value, seq: event.seq }
      return { ...round, citations: [...round.citations, citation] }
    }
    case 'final_answer':
      return end(round, event.ts, 'answered', { answer: { text: event.text, metadata: event.metadata } })
    case 'clarification':
      return end(round, event.ts, 'clarifying', {
        clarification: { question: event.question, candidates: event.candidates },
      })
    case 'error':
      return end(round, event.ts, 'failed', { error: { message: event.error, recoverable: event.recoverable } })
    case 'oracle':
    case 'compaction':
    case 'steering':
    case 'status':
      return { ...round, notices: [...round.notices, event] }
    default:
      return round
  }
}

/**
 * Build a thread from a stored transcript. The run is over, so a last round
 * with no terminal event was interrupted, not still running.
 */
export function replay(events: Iterable<ReignerEvent>): Thread {
  let thread = emptyThread
  for (const event of events) thread = applyEvent(thread, event)
  return interruptRunning(thread)
}

/** Mark a still-running last round as interrupted, e.g. after Stop. */
export function interruptRunning(thread: Thread): Thread {
  const rounds = interruptLast(thread.rounds)
  return rounds === thread.rounds ? thread : { ...thread, rounds }
}

/** Stable identity for a citation: source plus locator with sorted keys. */
export function citationKey(source: string, locator: Record<string, unknown>): string {
  const sorted = Object.fromEntries(Object.entries(locator).sort(([a], [b]) => a.localeCompare(b)))
  return `${source}\u0000${JSON.stringify(sorted)}`
}

/** Steps worth showing: real reads always, bookkeeping only when verbose. */
export function visibleSteps(round: Round, verbose = false): Step[] {
  return verbose ? round.steps : round.steps.filter((step) => !step.pseudo)
}

/** Wall-clock duration in ms, or undefined while running. */
export function roundDuration(round: Round): number | undefined {
  return round.endedAt ? Date.parse(round.endedAt) - Date.parse(round.startedAt) : undefined
}

function newRound(index: number, query: string | null, ts: string): Round {
  return { index, query, startedAt: ts, lastEventAt: ts, steps: [], citations: [], notices: [], status: 'running' }
}

function newStep(event: ToolCallEvent): Step {
  return {
    callId: event.call_id,
    name: event.name,
    args: event.args,
    pseudo: isPseudoTool(event.name),
    startedAt: event.ts,
    truncated: false,
    cached: false,
    seq: event.seq,
  }
}

function complete(step: Step, event: ToolResultEvent): Step {
  return { ...step, result: event.result, truncated: event.truncated, cached: event.cached, finishedAt: event.ts }
}

function end(round: Round, ts: string, status: RoundStatus, fields: Partial<Round>): Round {
  return { ...round, ...fields, status, endedAt: ts }
}

function interruptLast(rounds: Round[]): Round[] {
  const last = rounds.at(-1)
  if (last?.status !== 'running') return rounds
  return [...rounds.slice(0, -1), { ...last, status: 'interrupted', endedAt: last.lastEventAt }]
}
