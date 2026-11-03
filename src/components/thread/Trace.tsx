import { useState } from 'react'
import { roundDuration, summarizeArgs, summarizeResult, visibleSteps, type Notice, type Round, type Step } from '../../reigner'
import { formatDuration, formatTokens } from '../../lib/format'
import { ChevronRight } from '../icons'

interface Props {
  round: Round
  selectedCallId?: string
  onSelectStep: (callId: string) => void
}

type Item = { kind: 'step'; step: Step } | { kind: 'notice'; notice: Notice }

/** The agent's retrieval steps, collapsed to one line by default. */
export function Trace({ round, selectedCallId, onSelectStep }: Props) {
  const [open, setOpen] = useState(false)
  const running = round.status === 'running'
  const steps = visibleSteps(round)
  const items: Item[] = [
    ...steps.map((step) => ({ kind: 'step' as const, step, seq: step.seq })),
    ...round.notices.map((notice) => ({ kind: 'notice' as const, notice, seq: notice.seq })),
  ].sort((a, b) => a.seq - b.seq)

  if (items.length === 0 && !running) return null

  const escalations = round.notices.filter((n) => n.type === 'oracle').length
  const duration = roundDuration(round)
  let label = running ? 'Searching' : `${steps.length} retrieval ${steps.length === 1 ? 'step' : 'steps'}`
  if (escalations) label += `, escalated ${escalations === 1 ? 'once' : `${escalations} times`}`

  return (
    <div className="trace" data-open={open}>
      <button className="trace-h" aria-expanded={open} onClick={() => setOpen(!open)}>
        {running ? <span className="spinner" /> : <ChevronRight className="caret" size={12} />}
        {label}
        {duration !== undefined && <span className="t-right">{formatDuration(duration)}</span>}
      </button>
      {open && (
        <div className="steps">
          {items.map((item) =>
            item.kind === 'step' ? (
              <StepRow
                key={item.step.callId}
                step={item.step}
                roundRunning={running}
                selected={item.step.callId === selectedCallId}
                onSelect={() => onSelectStep(item.step.callId)}
              />
            ) : (
              <NoticeRow key={`n${item.notice.seq}`} notice={item.notice} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function StepRow({
  step,
  roundRunning,
  selected,
  onSelect,
}: {
  step: Step
  roundRunning: boolean
  selected: boolean
  onSelect: () => void
}) {
  const done = step.finishedAt !== undefined
  const failed = done && typeof (step.result as { error?: unknown } | null)?.error === 'string'
  return (
    <button className={`step ${failed ? 'failed' : ''}`} aria-pressed={selected} onClick={onSelect}>
      <span className="icon">{done ? (failed ? '!' : '✓') : roundRunning ? <span className="spinner" /> : '–'}</span>
      <span className="what">
        <span className="tool">{step.name}</span> <span className="arg">{summarizeArgs(step.args)}</span>
      </span>
      <span className="res">
        {done ? summarizeResult(step.result, step.truncated) : roundRunning ? '' : 'no result'}
        {step.cached && <span className="badge">cached</span>}
      </span>
    </button>
  )
}

function NoticeRow({ notice }: { notice: Notice }) {
  switch (notice.type) {
    case 'oracle':
      return (
        <div className="notice oracle">
          <span className="icon">⤴</span>
          <span>
            Escalated to <span className="tool">{notice.to_model}</span>: {notice.reason}
          </span>
        </div>
      )
    case 'compaction':
      return (
        <div className="notice">
          <span className="icon">≡</span>
          <span>Compacted history, freed {formatTokens(notice.tokens_freed)} tokens</span>
        </div>
      )
    case 'steering':
      return (
        <div className="notice">
          <span className="icon">↳</span>
          <span>You: {notice.message}</span>
        </div>
      )
    case 'status':
      return (
        <div className="notice">
          <span className="icon">·</span>
          <span>{notice.message}</span>
        </div>
      )
  }
}
