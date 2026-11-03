import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import type { Backend } from '../../backends/store'
import { Pencil } from '../icons'
import { AddBackendDialog } from './AddBackendDialog'
import { BackendSwitcher } from './BackendSwitcher'
import './shell.css'

interface Props {
  backend: Backend
  /** The session list, rendered under the sidebar's controls. */
  sidebar?: ReactNode
  /** Main column plus an optional side panel. */
  children: ReactNode
}

export function AppShell({ backend, sidebar, children }: Props) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="app">
      <aside className="side">
        <BackendSwitcher current={backend} onAdd={() => setAdding(true)} />
        <div className="side-actions">
          <Link href={`/b/${backend.id}`} className="btn">
            <Pencil />
            New session
          </Link>
        </div>
        {sidebar}
        <div className="side-foot">reigner-ui</div>
      </aside>
      {children}
      <AddBackendDialog open={adding} onClose={() => setAdding(false)} initialUrl="" />
    </div>
  )
}
