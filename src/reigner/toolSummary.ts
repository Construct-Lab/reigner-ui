// One-line summaries of tool calls and results.
// Ported from reigner/cli/_tool_summary.py so the UI reads like `reigner chat`.

/**
 * Bookkeeping tools the agent calls to talk to the harness, not to read
 * documents. The CLI hides them from the activity trace; so does this client
 * unless verbose mode is on. `load_skill` is a real step and stays visible.
 */
export const PSEUDO_TOOLS: ReadonlySet<string> = new Set([
  'register_citation',
  'request_clarification',
  'escalate_to_oracle',
  'save_note',
  'stop',
])

export function isPseudoTool(name: string): boolean {
  return PSEUDO_TOOLS.has(name)
}

// Result keys whose value is a list of returned items, rendered as "N label",
// with the singular label for one item.
const COUNT_KEYS: Record<string, string> = {
  hits: 'hit',
  matches: 'match',
  rows: 'row',
  entities: 'entity',
  entries: 'entry',
  paths: 'path',
}

// Result keys carrying a byte or character size.
const SIZE_KEYS = ['bytes', 'total_size', 'size']

// Args shown bare (in quotes) as the subject of a call, in order of preference.
const PRIMARY_ARG_KEYS = ['query', 'pattern', 'q', 'text', 'artifact_id', 'section', 'path', 'file_path']

// Defaults that are noise in a one-liner. Dropped whole.
const NOISE_DEFAULTS: Record<string, unknown> = { offset: 0 }

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Summarize a tool result, e.g. "5 hits", "4.0 KB · truncated". Never throws:
 * unknown shapes fall back to "ok".
 */
export function summarizeResult(result: unknown, truncated: boolean): string {
  const parts: string[] = []
  if (isRecord(result)) {
    // Not in the CLI: tools report failures as {"error": "..."}.
    if (typeof result.error === 'string') parts.push('error')
    for (const [plural, singular] of Object.entries(COUNT_KEYS)) {
      const items = result[plural]
      if (Array.isArray(items)) parts.push(`${items.length} ${items.length === 1 ? singular : plural}`)
    }
    const size = SIZE_KEYS.map((key) => result[key]).find((v) => typeof v === 'number')
    if (typeof size === 'number') {
      parts.push(humanBytes(Math.trunc(size)))
    } else if (typeof result.content === 'string') {
      parts.push(humanBytes(byteLength(result.content)))
    }
    if (result.has_more) parts.push('more available')
  } else if (typeof result === 'string') {
    parts.push(humanBytes(byteLength(result)))
  }

  if (truncated) {
    const keys = isRecord(result) ? result.available_keys : undefined
    const hasKeys = Array.isArray(keys) ? keys.length > 0 : Boolean(keys)
    parts.push(hasKeys ? `truncated · +${JSON.stringify(keys)}` : 'truncated')
  }

  return parts.join(' · ') || 'ok'
}

function clip(text: string, limit: number): string {
  const flat = text.replace(/\n/g, ' ').trim()
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`
}

function formatScalar(value: unknown): string {
  return typeof value === 'string' ? clip(value, 24) : JSON.stringify(value)
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return isRecord(value) && Object.keys(value).length === 0
}

/**
 * Render call args as a compact line: the main subject in quotes, then
 * `key=value` pairs, with empty values and noisy defaults dropped.
 */
export function summarizeArgs(args: Record<string, unknown>, maxLength = 64): string {
  const parts: string[] = []
  const primaryKey = PRIMARY_ARG_KEYS.find((key) => {
    const value = args[key]
    return typeof value === 'string' && value.trim() !== ''
  })
  if (primaryKey) parts.push(`"${clip(args[primaryKey] as string, 40)}"`)

  for (const [key, value] of Object.entries(args)) {
    if (key === primaryKey || isEmpty(value)) continue
    if (key in NOISE_DEFAULTS && NOISE_DEFAULTS[key] === value) continue
    parts.push(`${key}=${formatScalar(value)}`)
  }

  const joined = parts.join(' · ')
  return joined.length > maxLength ? `${joined.slice(0, maxLength - 1).trimEnd()}…` : joined
}

/**
 * Citation locators as `k=v` pairs, keys sorted, empty values dropped.
 * Unlike the CLI, values aren't clipped: a locator is how you find the source.
 */
export function formatLocator(locator: Record<string, unknown>): string {
  return Object.keys(locator)
    .sort()
    .filter((key) => !isEmpty(locator[key]))
    .map((key) => {
      const value = locator[key]
      return `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`
    })
    .join(' ')
}
