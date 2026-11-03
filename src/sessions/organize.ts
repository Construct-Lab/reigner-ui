import { DATE_GROUPS, dateGroup, type DateGroup } from '../lib/format'
import type { SessionMeta } from '../reigner'

export interface SessionRow {
  session: SessionMeta
  /** 0 for a root session, 1+ for forks nested under their parent. */
  depth: number
}

export interface SessionGroup {
  label: DateGroup
  rows: SessionRow[]
}

/**
 * Sidebar order: newest first, grouped by date. Forks sit under their parent
 * and take the parent's group, so a fork tree never splits across groups.
 * A fork whose parent isn't in the list is shown as a root.
 */
export function organizeSessions(sessions: SessionMeta[], now = new Date()): SessionGroup[] {
  const byNewest = [...sessions].sort((a, b) => b.last_updated.localeCompare(a.last_updated))
  const ids = new Set(sessions.map((s) => s.session_id))
  const children = new Map<string, SessionMeta[]>()
  for (const session of byNewest) {
    if (session.parent_id && ids.has(session.parent_id)) {
      const list = children.get(session.parent_id) ?? []
      list.push(session)
      children.set(session.parent_id, list)
    }
  }

  const groups = new Map<DateGroup, SessionRow[]>()
  const addTree = (session: SessionMeta, depth: number, rows: SessionRow[]) => {
    rows.push({ session, depth })
    for (const child of children.get(session.session_id) ?? []) addTree(child, depth + 1, rows)
  }
  for (const root of byNewest.filter((s) => !s.parent_id || !ids.has(s.parent_id))) {
    const label = dateGroup(root.last_updated, now)
    const rows = groups.get(label) ?? []
    addTree(root, 0, rows)
    groups.set(label, rows)
  }

  return DATE_GROUPS.filter((label) => groups.has(label)).map((label) => ({ label, rows: groups.get(label)! }))
}
