import { useEffect, useState } from 'react'
import type { Backend } from '../../backends/store'
import { formatTokens } from '../../lib/format'
import { useThread } from '../../sessions/useThread'
import { Topbar } from '../shell/Topbar'
import { Round, type Selection } from './Round'
import { SidePanel } from './SidePanel'
import './thread.css'

interface Props {
  backend: Backend
  sessionId: string
  title?: string
}

export function ThreadView({ backend, sessionId, title }: Props) {
  const { state, retry } = useThread(backend, sessionId)
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selection])

  const thread = state.status === 'ready' ? state.thread : null
  const tokens = thread?.rounds.reduce((sum, r) => sum + (r.answer?.metadata.usage?.total ?? 0), 0) ?? 0
  const rounds = thread?.rounds.length ?? 0

  return (
    <>
      <main className="main">
        <Topbar
          backend={backend}
          title={title ?? thread?.rounds[0]?.query ?? 'Session'}
          meta={
            thread && (
              <span className="pill">
                {rounds} {rounds === 1 ? 'round' : 'rounds'}
                {tokens > 0 && ` · ${formatTokens(tokens)} tokens`}
              </span>
            )
          }
        />
        <div className="scroll">
          {state.status === 'loading' && (
            <div className="empty">
              <span className="spinner" aria-label="Loading session" />
            </div>
          )}
          {state.status === 'missing' && (
            <div className="empty">
              <div>
                <h2>Session not found</h2>
                <p>This backend has no session with this id.</p>
              </div>
            </div>
          )}
          {state.status === 'error' && (
            <div className="empty">
              <div>
                <h2>Couldn't load this session</h2>
                <p>{state.message}</p>
                <button className="btn" onClick={retry}>
                  Try again
                </button>
              </div>
            </div>
          )}
          {thread && (
            <div className="thread">
              {thread.rounds.map((round) => (
                <Round key={round.index} round={round} selection={selection} onSelect={setSelection} />
              ))}
            </div>
          )}
        </div>
      </main>
      {thread && selection && <SidePanel thread={thread} selection={selection} onClose={() => setSelection(null)} />}
    </>
  )
}
