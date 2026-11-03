import { useEffect } from 'react'
import { Link, Redirect, Route, Switch } from 'wouter'
import { backendName } from './backends/display'
import { useBackendHealth, useHealthPolling } from './backends/health'
import { getLastUsedBackendId, setLastUsedBackendId, useBackends, type Backend } from './backends/store'
import { AppShell } from './components/shell/AppShell'
import { FirstRun } from './components/shell/FirstRun'
import { Topbar } from './components/shell/Topbar'
import { SessionList } from './components/sidebar/SessionList'
import { ThreadView } from './components/thread/ThreadView'
import { Crown } from './components/icons'
import { useSessions } from './sessions/useSessions'

function App() {
  const backends = useBackends()
  useHealthPolling(backends.map((b) => b.id).join())

  return (
    <Switch>
      <Route path="/b/:backendId/s/:sessionId">
        {({ backendId, sessionId }) => <BackendRoute backendId={backendId} sessionId={sessionId} />}
      </Route>
      <Route path="/b/:backendId">{({ backendId }) => <BackendRoute backendId={backendId} />}</Route>
      <Route>
        <Home />
      </Route>
    </Switch>
  )
}

/** "/" goes to the backend used last, else the first saved one. */
function Home() {
  const backends = useBackends()
  if (backends.length === 0) return <FirstRun />
  const lastUsed = getLastUsedBackendId()
  const target = backends.find((b) => b.id === lastUsed) ?? backends[0]
  return <Redirect to={`/b/${target.id}`} replace />
}

function BackendRoute({ backendId, sessionId }: { backendId: string; sessionId?: string }) {
  const backend = useBackends().find((b) => b.id === backendId)

  useEffect(() => {
    if (backend) setLastUsedBackendId(backend.id)
  }, [backend])

  if (!backend) {
    return (
      <main className="empty">
        <div>
          <h2>This backend isn't saved in this browser</h2>
          <Link href="/" className="btn">
            Go to your backends
          </Link>
        </div>
      </main>
    )
  }

  return <BackendView key={backend.id} backend={backend} sessionId={sessionId} />
}

function BackendView({ backend, sessionId }: { backend: Backend; sessionId?: string }) {
  const { state, refresh } = useSessions(backend)
  const serverTitle = state.sessions?.find((s) => s.session_id === sessionId)?.title ?? undefined

  return (
    <AppShell
      backend={backend}
      sidebar={<SessionList backend={backend} state={state} activeSessionId={sessionId} onRetry={refresh} />}
    >
      {sessionId ? (
        <ThreadView key={sessionId} backend={backend} sessionId={sessionId} title={serverTitle} />
      ) : (
        <NewSession backend={backend} />
      )}
    </AppShell>
  )
}

function NewSession({ backend }: { backend: Backend }) {
  const health = useBackendHealth(backend.id)
  return (
    <main className="main">
      <Topbar backend={backend} title="New session" />
      <div className="scroll">
        <div className="empty">
          <div>
            <Crown size={44} />
            <h2>Ask {backendName(backend, health)}</h2>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
