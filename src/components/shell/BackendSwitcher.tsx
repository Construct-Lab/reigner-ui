import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { backendName, hostOf } from '../../backends/display'
import { useHealthMap } from '../../backends/health'
import { removeBackend, useBackends, type Backend } from '../../backends/store'
import { formatRelative } from '../../lib/format'
import { Check, ChevronUpDown, Crown, Plus, Trash } from '../icons'

interface Props {
  current: Backend
  onAdd: () => void
}

export function BackendSwitcher({ current, onAdd }: Props) {
  const backends = useBackends()
  const health = useHealthMap()
  const [open, setOpen] = useState(false)
  const [, navigate] = useLocation()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const currentHealth = health[current.id]

  function remove(backend: Backend) {
    removeBackend(backend.id)
    if (backend.id === current.id) navigate('/')
  }

  return (
    <div className="switcher" ref={root}>
      <button className="backend" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Crown className="crown" />
        <span className="who">
          <span className="name">
            <span className={`dot ${currentHealth?.status ?? ''}`} />
            {backendName(current, currentHealth)}
          </span>
          <span className="url">{hostOf(current.url)}</span>
        </span>
        <ChevronUpDown className="chev" size={14} />
      </button>

      {open && (
        <div className="pop" role="menu">
          <div className="pop-h">Backends</div>
          {backends.map((backend) => {
            const h = health[backend.id]
            const offline = h?.status === 'offline'
            return (
              <div key={backend.id} className={`be ${offline ? 'off' : ''}`}>
                <button
                  className="be-main"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    navigate(`/b/${backend.id}`)
                  }}
                >
                  <span className={`dot ${h?.status ?? ''}`} />
                  <span className="n">{backendName(backend, h)}</span>
                  {backend.id === current.id ? <Check className="check" /> : <span />}
                  <span className="u">
                    {hostOf(backend.url)}
                    {offline
                      ? ` · ${backend.lastSeenAt ? `last seen ${formatRelative(backend.lastSeenAt)}` : 'never reached'}`
                      : h?.health
                        ? ` · ${h.health.model}`
                        : ''}
                  </span>
                </button>
                {offline && <span className="tag">Unreachable</span>}
                <button
                  className="icon-btn remove"
                  aria-label={`Remove ${backendName(backend, h)}`}
                  title="Remove from this browser"
                  onClick={() => remove(backend)}
                >
                  <Trash size={14} />
                </button>
              </div>
            )
          })}
          <hr />
          <button
            className="add"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onAdd()
            }}
          >
            <Plus />
            Add backend
          </button>
        </div>
      )}
    </div>
  )
}
