import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { serveCommand } from '../../backends/display'
import { checkBackend, probe } from '../../backends/health'
import { addBackend } from '../../backends/store'
import { normalizeBaseUrl } from '../../reigner'

interface Props {
  open: boolean
  onClose: () => void
  initialUrl?: string
}

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'unreachable'; url: string } | { state: 'invalid' }

/** Mounted only while open, so every opening starts with fresh fields. */
export function AddBackendDialog({ open, ...props }: Props) {
  return open ? <DialogBody {...props} /> : null
}

function DialogBody({ onClose, initialUrl = 'http://localhost:8000' }: Omit<Props, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const urlInput = useRef<HTMLInputElement>(null)
  const [, navigate] = useLocation()
  const [url, setUrl] = useState(initialUrl)
  const [name, setName] = useState('')
  const [check, setCheck] = useState<Check>({ state: 'idle' })

  useEffect(() => {
    dialog.current?.showModal()
    // showModal() focuses the dialog itself; React's autoFocus runs too early.
    urlInput.current?.select()
  }, [])

  function save(baseUrl: string, label?: string) {
    const backend = addBackend(baseUrl, label)
    void checkBackend(backend)
    onClose()
    navigate(`/b/${backend.id}`)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    let baseUrl: string
    try {
      baseUrl = normalizeBaseUrl(url)
    } catch {
      setCheck({ state: 'invalid' })
      return
    }
    setCheck({ state: 'checking' })
    const health = await probe(baseUrl)
    if (health) {
      save(baseUrl, name || health.name)
    } else {
      setCheck({ state: 'unreachable', url: baseUrl })
    }
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose} aria-labelledby="add-backend-title">
      <form onSubmit={submit}>
        <h2 id="add-backend-title">Add backend</h2>
        <p className="sub">
          Connect to a running <code>reigner serve --http</code> server.
        </p>

        <label className="field">
          <span>Server URL</span>
          <input
            ref={urlInput}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setCheck({ state: 'idle' })
            }}
            placeholder="http://localhost:8000"
            required
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>
            Name <span className="optional">(optional)</span>
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name from the server" />
        </label>

        {check.state === 'invalid' && (
          <div className="probe" role="alert">
            <span className="dot offline" />
            <div>Enter a URL like http://localhost:8000.</div>
          </div>
        )}
        {check.state === 'unreachable' && (
          <div className="probe" role="alert">
            <span className="dot offline" />
            <div>
              No response from {check.url}. If the server is running, it needs to allow this page's origin:
              <code>{serveCommand(check.url)}</code>
            </div>
          </div>
        )}

        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          {check.state === 'unreachable' && (
            <button type="button" className="btn" onClick={() => save(check.url, name)}>
              Save anyway
            </button>
          )}
          <button type="submit" className="btn primary" disabled={check.state === 'checking'}>
            {check.state === 'checking' ? 'Connecting…' : check.state === 'unreachable' ? 'Check again' : 'Connect'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
