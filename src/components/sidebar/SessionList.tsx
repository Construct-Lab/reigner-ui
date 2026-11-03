import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import type { Backend } from '../../backends/store'
import { formatDate } from '../../lib/format'
import { organizeSessions } from '../../sessions/organize'
import { sessionTitle, useTitles } from '../../sessions/titles'
import type { SessionsState } from '../../sessions/useSessions'
import { Search } from '../icons'
import './sidebar.css'

interface Props {
  backend: Backend
  state: SessionsState
  activeSessionId?: string
  onRetry: () => void
}

export function SessionList({ backend, state, activeSessionId, onRetry }: Props) {
  const [query, setQuery] = useState('')
  const titles = useTitles(backend, state.sessions)
  const groups = useMemo(() => organizeSessions(state.sessions ?? []), [state.sessions])
  const needle = query.trim().toLowerCase()

  const filtered = needle
    ? groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter(({ session }) =>
            (sessionTitle(session, titles) ?? '').toLowerCase().includes(needle),
          ),
        }))
        .filter((group) => group.rows.length > 0)
    : groups

  return (
    <>
      <label className="search">
        <Search size={15} />
        <span className="visually-hidden">Search sessions</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions" />
      </label>

      <nav className="sessions" aria-label="Sessions">
        {state.status === 'error' && (
          <div className="sessions-note" role="alert">
            Couldn't load sessions: {state.message}
            <button className="link" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {state.status === 'loading' && !state.sessions && (
          <div className="sessions-skeleton" aria-label="Loading sessions">
            <span />
            <span />
            <span />
          </div>
        )}
        {state.status === 'ready' && state.sessions.length === 0 && <div className="sessions-note">No sessions yet</div>}
        {needle && filtered.length === 0 && <div className="sessions-note">No matches</div>}

        {filtered.map((group) => (
          <section key={group.label}>
            <h2 className="group">{group.label}</h2>
            {group.rows.map(({ session, depth }) => {
              const title = sessionTitle(session, titles)
              return (
                <Link
                  key={session.session_id}
                  href={`/b/${backend.id}/s/${session.session_id}`}
                  className={`sess ${depth ? 'fork' : ''} ${title ? '' : 'untitled'}`}
                  style={depth > 1 ? { paddingLeft: 12 + depth * 14 } : undefined}
                  aria-current={session.session_id === activeSessionId ? 'page' : undefined}
                  title={title}
                >
                  {title ?? formatDate(session.created)}
                </Link>
              )
            })}
          </section>
        ))}
      </nav>
    </>
  )
}
