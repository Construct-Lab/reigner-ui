// Reigner's event protocol, schema version 2.
// Source of truth: reigner/harness/events.py in https://github.com/Construct-Lab/reigner

/** Fields every event carries. */
export interface EventEnvelope {
  /** Monotonic per session. -1 on errors the server synthesizes. */
  seq: number
  session_id: string
  /** Loop iteration within the current round. Resets each round. */
  turn: number
  /** ISO-8601, UTC. */
  ts: string
}

export interface UserQueryEvent extends EventEnvelope {
  type: 'user_query'
  query: string
}

export interface StatusEvent extends EventEnvelope {
  type: 'status'
  message: string
}

export interface ToolCallEvent extends EventEnvelope {
  type: 'tool_call'
  name: string
  args: Record<string, unknown>
  call_id: string
}

export interface ToolResultEvent extends EventEnvelope {
  type: 'tool_result'
  call_id: string
  result: unknown
  truncated: boolean
  cached: boolean
}

export interface CitationEvent extends EventEnvelope {
  type: 'citation'
  /** Artifact path, e.g. `AAPL/2024/metadata.json`. */
  source: string
  /** Free-form: `{field}`, `{line}`, `{section}`, ... */
  locator: Record<string, unknown>
  value: unknown
}

export interface ClarificationEvent extends EventEnvelope {
  type: 'clarification'
  question: string
  candidates: unknown[]
}

export interface Usage {
  prompt?: number
  completion?: number
  cached?: number
  cache_read?: number
  cache_write?: number
  total?: number
}

/** Open object: plugins can add keys. */
export interface FinalAnswerMetadata {
  usage?: Usage
  stop_reason?: string
  /** The model ended with no text and no calls. */
  no_progress?: boolean
  /** The model ended via the `stop` tool. */
  stop?: boolean
  [key: string]: unknown
}

export interface FinalAnswerEvent extends EventEnvelope {
  type: 'final_answer'
  /** Markdown. */
  text: string
  metadata: FinalAnswerMetadata
}

export interface ErrorEvent extends EventEnvelope {
  type: 'error'
  error: string
  recoverable: boolean
}

export interface CompactionEvent extends EventEnvelope {
  type: 'compaction'
  level: number
  tokens_freed: number
}

export interface OracleEvent extends EventEnvelope {
  type: 'oracle'
  reason: string
  from_model: string
  /** May be `"(unconfigured)"`. */
  to_model: string
}

/** Only in sessions created by the CLI. */
export interface SteeringEvent extends EventEnvelope {
  type: 'steering'
  message: string
  mode: string
}

export type ReignerEvent =
  | UserQueryEvent
  | StatusEvent
  | ToolCallEvent
  | ToolResultEvent
  | CitationEvent
  | ClarificationEvent
  | FinalAnswerEvent
  | ErrorEvent
  | CompactionEvent
  | OracleEvent
  | SteeringEvent

export const EVENT_TYPES: ReadonlySet<string> = new Set<ReignerEvent['type']>([
  'user_query',
  'status',
  'tool_call',
  'tool_result',
  'citation',
  'clarification',
  'final_answer',
  'error',
  'compaction',
  'oracle',
  'steering',
])

/**
 * True for events this client understands. The protocol grows over time, so
 * anything else should be skipped, not treated as an error.
 */
export function isKnownEvent(value: unknown): value is ReignerEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    EVENT_TYPES.has((value as { type?: unknown }).type as string)
  )
}

// HTTP payloads

export type Profile = 'full' | 'read_only' | 'eval'

export interface HealthResponse {
  status: string
  name: string
  /** `provider/model`, e.g. `openai/gpt-5.5`. */
  model: string
}

export interface SessionMeta {
  session_id: string
  /** Set when the session was forked from another. */
  parent_id: string | null
  /** Usually null: only the CLI sets it. */
  title: string | null
  created: string
  last_updated: string
  event_count: number
  schema_version: number
}

export interface SessionEventsResponse {
  session_id: string
  total: number
  /** True when `limit` cut off the start, so the first round may be partial. */
  truncated: boolean
  events: unknown[]
}
