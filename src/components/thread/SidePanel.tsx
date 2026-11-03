import { formatLocator, summarizeResult, type Thread } from '../../reigner'
import { formatDuration, formatValue } from '../../lib/format'
import { Close } from '../icons'
import type { Selection } from './Round'

interface Props {
  thread: Thread
  selection: Selection
  onClose: () => void
}

/** Details for the selected source or step: the value, where it came from, the raw JSON. */
export function SidePanel({ thread, selection, onClose }: Props) {
  const round = thread.rounds[selection.round]
  if (!round) return null

  if (selection.kind === 'source') {
    const citation = round.citations[selection.index]
    if (!citation) return null
    const value = formatValue(citation.value)
    return (
      <Panel title={`Source ${selection.index + 1}`} onClose={onClose}>
        <div className={value.length > 40 ? 'quote' : 'big'}>{value}</div>
        <dl>
          <dt>Artifact</dt>
          <dd className="mono">{citation.source}</dd>
          <dt>Locator</dt>
          <dd className="mono">{formatLocator(citation.locator) || '–'}</dd>
          <dt>Cited in</dt>
          <dd>Round {selection.round + 1}</dd>
        </dl>
        <pre className="json">
          {JSON.stringify({ source: citation.source, locator: citation.locator, value: citation.value }, null, 2)}
        </pre>
      </Panel>
    )
  }

  const step = round.steps.find((s) => s.callId === selection.callId)
  if (!step) return null
  const done = step.finishedAt !== undefined
  const flags = [step.cached && 'cached', step.truncated && 'truncated'].filter(Boolean).join(', ')
  return (
    <Panel title={step.name} onClose={onClose}>
      <dl>
        <dt>Result</dt>
        <dd>{done ? summarizeResult(step.result, step.truncated) : 'No result'}</dd>
        {done && (
          <>
            <dt>Took</dt>
            <dd>{formatDuration(Date.parse(step.finishedAt!) - Date.parse(step.startedAt))}</dd>
          </>
        )}
        {flags && (
          <>
            <dt>Flags</dt>
            <dd>{flags}</dd>
          </>
        )}
      </dl>
      <h3>Arguments</h3>
      <pre className="json">{JSON.stringify(step.args, null, 2)}</pre>
      {done && (
        <>
          <h3>Result</h3>
          <pre className="json">{JSON.stringify(step.result, null, 2)}</pre>
        </>
      )}
    </Panel>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="panel" aria-label={title}>
      <div className="panel-h">
        <span>{title}</span>
        <button className="icon-btn" aria-label="Close panel" onClick={onClose}>
          <Close />
        </button>
      </div>
      <div className="panel-b">{children}</div>
    </aside>
  )
}
