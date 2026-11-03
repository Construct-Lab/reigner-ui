import { EventSourceParserStream } from 'eventsource-parser/stream'
import { isKnownEvent, type ReignerEvent } from './events'

/**
 * Parse one SSE `data:` payload. Returns null for malformed JSON and for event
 * types this client doesn't know, so new server events never break the UI.
 */
export function parseEventData(data: string): ReignerEvent | null {
  try {
    const value: unknown = JSON.parse(data)
    return isKnownEvent(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Turn a `POST /run` response body into Reigner events.
 *
 * `EventSource` only does GET, so the stream is read from `fetch` and split
 * into frames by `eventsource-parser`. Dispatch is on `data.type`, not the
 * `event:` line. Stopping early (break, return, abort) cancels the body, and
 * the server stops the run when the client goes away.
 */
export async function* readEvents(
  body: ReadableStream<BufferSource>,
): AsyncGenerator<ReignerEvent> {
  const reader = body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      const event = parseEventData(value.data)
      if (event) yield event
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}
