import { describe, expect, it } from 'vitest'
import type { ReignerEvent } from './events'
import { applyEvent, emptyThread, replay, visibleSteps } from './rounds'
import loadSkill from './fixtures/load-skill.jsonl?raw'
import singleRound from './fixtures/single-round.jsonl?raw'
import stopTool from './fixtures/stop-tool.jsonl?raw'
import twoRounds from './fixtures/two-rounds.jsonl?raw'

const parse = (jsonl: string): ReignerEvent[] =>
  jsonl
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))

const envelope = { session_id: 's1', turn: 0, ts: '2026-11-03T10:00:00+00:00' }
let seq = 0
const ev = <T extends ReignerEvent['type']>(
  type: T,
  fields: Omit<Extract<ReignerEvent, { type: T }>, 'type' | 'seq' | 'session_id' | 'turn' | 'ts'> & { ts?: string },
) => ({ ...envelope, seq: seq++, type, ...fields }) as Extract<ReignerEvent, { type: T }>

describe('replay of real indialaw sessions', () => {
  it.each([
    ['single-round', singleRound, 1],
    ['two-rounds', twoRounds, 2],
    ['stop-tool', stopTool, 1],
    ['load-skill', loadSkill, 1],
  ])('%s: every round is answered', (_name, jsonl, roundCount) => {
    const thread = replay(parse(jsonl))
    expect(thread.rounds).toHaveLength(roundCount)
    for (const round of thread.rounds) {
      expect(round.status).toBe('answered')
      expect(round.query).toBeTruthy()
      expect(round.answer?.text).toBeTruthy()
      expect(round.citations.length).toBeGreaterThan(0)
      // Every real read gets its result back.
      expect(visibleSteps(round).every((step) => step.finishedAt)).toBe(true)
    }
  })

  it('pairs each tool result with its call', () => {
    const [round] = replay(parse(singleRound)).rounds
    expect(round.steps).toHaveLength(5)
    expect(round.steps.map((s) => s.name)).toEqual([
      'bm25_search',
      'grep_artifact',
      'grep_artifact',
      'grep_artifact',
      'register_citation',
    ])
    expect(visibleSteps(round)).toHaveLength(4)
    expect(visibleSteps(round, true)).toHaveLength(5)
  })

  it('keeps a stop call with no result, and hides it', () => {
    const [round] = replay(parse(stopTool)).rounds
    const stop = round.steps.find((s) => s.name === 'stop')
    expect(stop?.pseudo).toBe(true)
    expect(stop?.finishedAt).toBeUndefined()
    expect(round.answer?.metadata.stop).toBe(true)
  })

  it('shows load_skill as a real step', () => {
    const [round] = replay(parse(loadSkill)).rounds
    expect(visibleSteps(round).some((s) => s.name === 'load_skill')).toBe(true)
  })

  it('records usage on the answer', () => {
    const [round] = replay(parse(singleRound)).rounds
    expect(round.answer?.metadata.usage?.total).toBeGreaterThan(0)
    expect(round.endedAt).toBeDefined()
  })
})

describe('applyEvent edge cases', () => {
  it('matches parallel results by call_id, not order', () => {
    const thread = replay([
      ev('user_query', { query: 'q' }),
      ev('tool_call', { name: 'bm25_search', args: { query: 'a' }, call_id: 'A' }),
      ev('tool_call', { name: 'get_section', args: { section: 'b' }, call_id: 'B' }),
      ev('tool_result', { call_id: 'B', result: { content: 'bb' }, truncated: true, cached: false }),
      ev('tool_result', { call_id: 'A', result: { hits: [1, 2] }, truncated: false, cached: true }),
      ev('final_answer', { text: 'done', metadata: {} }),
    ])
    const [a, b] = thread.rounds[0].steps
    expect(a).toMatchObject({ callId: 'A', result: { hits: [1, 2] }, cached: true, truncated: false })
    expect(b).toMatchObject({ callId: 'B', result: { content: 'bb' }, cached: false, truncated: true })
  })

  it('dedupes citations by source and locator, regardless of key order', () => {
    const thread = replay([
      ev('user_query', { query: 'q' }),
      ev('citation', { source: 'doc', locator: { line: 1, section: 's' }, value: 'x' }),
      ev('citation', { source: 'doc', locator: { section: 's', line: 1 }, value: 'x' }),
      ev('citation', { source: 'doc', locator: { line: 2 }, value: 'y' }),
      ev('final_answer', { text: 'a', metadata: {} }),
    ])
    expect(thread.rounds[0].citations.map((c) => c.value)).toEqual(['x', 'y'])
  })

  it('marks a round with no terminal event as interrupted on replay', () => {
    const thread = replay([
      ev('user_query', { query: 'q' }),
      ev('tool_call', { name: 'bm25_search', args: {}, call_id: 'A', ts: '2026-11-03T10:00:02+00:00' }),
    ])
    expect(thread.rounds[0].status).toBe('interrupted')
    expect(thread.rounds[0].endedAt).toBe('2026-11-03T10:00:02+00:00')
  })

  it('keeps a live round running until its terminal event', () => {
    let thread = applyEvent(emptyThread, ev('user_query', { query: 'q' }))
    thread = applyEvent(thread, ev('tool_call', { name: 'bm25_search', args: {}, call_id: 'A' }))
    expect(thread.rounds[0].status).toBe('running')
    expect(thread.sessionId).toBe('s1')
  })

  it('interrupts an open round when the next question starts', () => {
    const thread = replay([ev('user_query', { query: 'first' }), ev('user_query', { query: 'second' })])
    expect(thread.rounds.map((r) => r.status)).toEqual(['interrupted', 'interrupted'])
  })

  it('ends a round on clarification and on error', () => {
    const thread = replay([
      ev('user_query', { query: 'q1' }),
      ev('clarification', { question: 'Which year?', candidates: ['2023', '2024'] }),
      ev('user_query', { query: 'q2' }),
      ev('error', { error: 'RuntimeError: boom', recoverable: false, seq: -1, turn: -1 } as never),
    ])
    expect(thread.rounds[0]).toMatchObject({
      status: 'clarifying',
      clarification: { question: 'Which year?', candidates: ['2023', '2024'] },
    })
    expect(thread.rounds[1]).toMatchObject({ status: 'failed', error: { message: 'RuntimeError: boom' } })
  })

  it('collects oracle and compaction notices', () => {
    const thread = replay([
      ev('user_query', { query: 'q' }),
      ev('oracle', { reason: 'conflicting figures', from_model: 'a', to_model: 'b' }),
      ev('compaction', { level: 1, tokens_freed: 1200 }),
      ev('final_answer', { text: 'a', metadata: {} }),
    ])
    expect(thread.rounds[0].notices.map((n) => n.type)).toEqual(['oracle', 'compaction'])
  })

  it('starts a partial round when a suffix begins mid-round', () => {
    const thread = replay([
      ev('tool_result', { call_id: 'gone', result: {}, truncated: false, cached: false }),
      ev('final_answer', { text: 'tail', metadata: {} }),
    ])
    expect(thread.rounds).toHaveLength(1)
    expect(thread.rounds[0]).toMatchObject({ query: null, status: 'answered' })
  })
})
