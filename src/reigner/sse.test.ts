import { describe, expect, it } from 'vitest'
import { replay } from './rounds'
import { parseEventData, readEvents } from './sse'
import runSse from './fixtures/run.sse?raw'

/** A byte stream cut into fixed-size chunks, to split frames mid-line. */
function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close()
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}

describe('readEvents', () => {
  it.each([7, 64, 100_000])('parses a captured /run stream in %i-byte chunks', async (chunkSize) => {
    const events = await collect(readEvents(streamOf(runSse, chunkSize)))
    expect(events.map((e) => e.type)).toEqual([
      'user_query',
      'tool_call',
      'tool_result',
      'tool_call',
      'tool_result',
      'final_answer',
    ])
    const [round] = replay(events).rounds
    expect(round.status).toBe('answered')
    expect(round.query).toBe('In one sentence, what documents do you have?')
  })

  it('skips unknown event types and malformed frames', async () => {
    const text =
      'event: future_thing\ndata: {"type":"future_thing","seq":0}\n\n' +
      'data: not json\n\n' +
      'event: status\ndata: {"type":"status","seq":1,"session_id":"s","turn":0,"ts":"t","message":"hi"}\n\n'
    const events = await collect(readEvents(streamOf(text, 5)))
    expect(events).toEqual([{ type: 'status', seq: 1, session_id: 's', turn: 0, ts: 't', message: 'hi' }])
  })

  it('cancels the body when the consumer stops early', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(runSse))
      },
      cancel() {
        cancelled = true
      },
    })
    for await (const event of readEvents(body)) {
      expect(event.type).toBe('user_query')
      break
    }
    expect(cancelled).toBe(true)
  })
})

describe('parseEventData', () => {
  it('returns null for non-objects', () => {
    expect(parseEventData('42')).toBeNull()
    expect(parseEventData('null')).toBeNull()
  })
})
