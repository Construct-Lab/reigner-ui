import { describe, expect, it } from 'vitest'
import { formatLocator, humanBytes, summarizeArgs, summarizeResult } from './toolSummary'

describe('summarizeResult', () => {
  it('counts list results', () => {
    expect(summarizeResult({ hits: [1, 2, 3], has_more: true }, false)).toBe('3 hits · more available')
    expect(summarizeResult({ matches: [] }, false)).toBe('0 matches')
  })

  it('reports sizes from size keys or content', () => {
    expect(summarizeResult({ size: 4096 }, false)).toBe('4.0 KB')
    expect(summarizeResult({ content: 'abc' }, false)).toBe('3 B')
    expect(summarizeResult('é', false)).toBe('2 B')
  })

  it('flags truncation with the keys still available', () => {
    expect(summarizeResult({ matches: [1], available_keys: ['offset'] }, true)).toBe(
      '1 matches · truncated · +["offset"]',
    )
    expect(summarizeResult({}, true)).toBe('truncated')
  })

  it('flags tool errors', () => {
    expect(summarizeResult({ error: 'no such section' }, false)).toBe('error')
  })

  it('falls back to ok', () => {
    expect(summarizeResult({ ok: true }, false)).toBe('ok')
    expect(summarizeResult(null, false)).toBe('ok')
  })
})

describe('summarizeArgs', () => {
  it('puts the subject first and drops empty values and noisy defaults', () => {
    expect(summarizeArgs({ top_k: 5, query: 'rule of law', offset: 0, filter: null, tags: [] })).toBe(
      '"rule of law" · top_k=5',
    )
  })

  it('clips long lines', () => {
    const line = summarizeArgs({ query: 'x'.repeat(100), extra: 'y'.repeat(50) }, 30)
    expect(line).toHaveLength(30)
    expect(line.endsWith('…')).toBe(true)
  })
})

describe('formatLocator', () => {
  it('sorts keys and drops empty values', () => {
    expect(formatLocator({ section: 'constitution/rights', line: 4, note: '' })).toBe(
      'line=4 section=constitution/rights',
    )
  })
})

describe('humanBytes', () => {
  it('formats B, KB and MB', () => {
    expect([humanBytes(812), humanBytes(1843), humanBytes(2.2 * 1024 * 1024)]).toEqual(['812 B', '1.8 KB', '2.2 MB'])
  })
})
