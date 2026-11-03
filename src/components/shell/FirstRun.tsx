import { useState } from 'react'
import { serveCommand } from '../../backends/display'
import { Crown, Plus } from '../icons'
import { AddBackendDialog } from './AddBackendDialog'
import './shell.css'

/** Shown when this browser has no saved backends yet. */
export function FirstRun() {
  const [adding, setAdding] = useState(false)

  return (
    <main className="first-run">
      <div>
        <Crown size={52} className="crown" />
        <h1>Connect to a Reigner server</h1>
        <p>In your Reigner project, run:</p>
        <code className="command">{serveCommand('http://localhost:8000')}</code>
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Plus />
          Add backend
        </button>
      </div>
      <AddBackendDialog open={adding} onClose={() => setAdding(false)} />
    </main>
  )
}
