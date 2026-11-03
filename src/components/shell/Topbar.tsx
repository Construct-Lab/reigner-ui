import type { ReactNode } from 'react'
import { serveCommand } from '../../backends/display'
import { useBackendHealth } from '../../backends/health'
import type { Backend } from '../../backends/store'

interface Props {
  backend: Backend
  title: string
  /** Extra pills after the model, e.g. rounds and tokens. */
  meta?: ReactNode
}

/** The main column's header, plus a bar when the backend can't be reached. */
export function Topbar({ backend, title, meta }: Props) {
  const health = useBackendHealth(backend.id)

  return (
    <>
      <header className="topbar">
        <h1>{title}</h1>
        <div className="meta">
          {health.health && <span className="pill">{health.health.model}</span>}
          {meta}
        </div>
      </header>
      {health.status === 'offline' && (
        <div className="offline-bar" role="status">
          <span className="dot offline" />
          <span>
            Can't reach {backend.url}. Check that the server is running: <code>{serveCommand(backend.url)}</code>
          </span>
        </div>
      )}
    </>
  )
}
