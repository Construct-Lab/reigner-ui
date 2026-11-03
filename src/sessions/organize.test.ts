import { describe, expect, it } from 'vitest'
import type { SessionMeta } from '../reigner'
import { organizeSessions } from './organize'

const now = new Date('2026-11-03T15:00:00')

function session(id: string, lastUpdated: string, parentId: string | null = null): SessionMeta {
  return {
    session_id: id,
    parent_id: parentId,
    title: null,
    created: lastUpdated,
    last_updated: lastUpdated,
    event_count: 1,
    schema_version: 2,
  }
}

const flat = (groups: ReturnType<typeof organizeSessions>) =>
  groups.map((g) => [g.label, g.rows.map((r) => `${'>'.repeat(r.depth)}${r.session.session_id}`)])

describe('organizeSessions', () => {
  it('groups by date, newest first', () => {
    const groups = organizeSessions(
      [
        session('old', '2026-09-01T10:00:00'),
        session('today-early', '2026-11-03T09:00:00'),
        session('yesterday', '2026-11-02T20:00:00'),
        session('today-late', '2026-11-03T14:00:00'),
        session('week', '2026-10-30T12:00:00'),
      ],
      now,
    )
    expect(flat(groups)).toEqual([
      ['Today', ['today-late', 'today-early']],
      ['Yesterday', ['yesterday']],
      ['Previous 7 days', ['week']],
      ['Older', ['old']],
    ])
  })

  it('nests forks under their parent, in the parent group', () => {
    const groups = organizeSessions(
      [
        session('parent', '2026-10-01T10:00:00'),
        session('fork', '2026-11-03T10:00:00', 'parent'),
        session('fork-of-fork', '2026-11-03T11:00:00', 'fork'),
        session('orphan', '2026-11-03T12:00:00', 'missing'),
      ],
      now,
    )
    expect(flat(groups)).toEqual([
      ['Today', ['orphan']],
      ['Older', ['parent', '>fork', '>>fork-of-fork']],
    ])
  })
})
