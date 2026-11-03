import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatLocator, type Round as RoundData } from '../../reigner'
import { formatTokens, formatValue } from '../../lib/format'
import { Trace } from './Trace'

export type Selection =
  | { kind: 'source'; round: number; index: number }
  | { kind: 'step'; round: number; callId: string }

interface Props {
  round: RoundData
  selection: Selection | null
  onSelect: (selection: Selection) => void
  /** Answers a clarification. Absent while asking isn't available. */
  onReply?: (text: string) => void
}

export function Round({ round, selection, onSelect, onReply }: Props) {
  const mine = selection?.round === round.index ? selection : null
  const usage = round.answer?.metadata.usage
  const noAnswer = round.answer && (round.answer.metadata.no_progress || !round.answer.text.trim())

  return (
    <section className="round">
      <h2 className={`q ${round.query === null ? 'missing' : ''}`}>{round.query ?? 'Earlier question not loaded'}</h2>

      <Trace
        round={round}
        selectedCallId={mine?.kind === 'step' ? mine.callId : undefined}
        onSelectStep={(callId) => onSelect({ kind: 'step', round: round.index, callId })}
      />

      {round.answer &&
        (noAnswer ? (
          <p className="callout">The agent ended without an answer.</p>
        ) : (
          <div className="answer">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
            >
              {round.answer.text}
            </Markdown>
          </div>
        ))}

      {round.clarification && (
        <div className="clar">
          <p>{round.clarification.question}</p>
          {round.clarification.candidates.length > 0 && (
            <div className="chips">
              {round.clarification.candidates.map((candidate, i) => {
                const text = formatValue(candidate)
                return (
                  <button key={i} className="chip" disabled={!onReply} onClick={() => onReply?.(text)}>
                    {text}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {round.error && (
        <p className="callout error" role="alert">
          The run failed: {round.error.message}
        </p>
      )}

      {round.status === 'interrupted' && <p className="callout">Stopped before an answer.</p>}

      {round.citations.length > 0 && (
        <div className="sources">
          {round.citations.map((citation, i) => (
            <button
              key={i}
              className="src"
              aria-pressed={mine?.kind === 'source' && mine.index === i}
              onClick={() => onSelect({ kind: 'source', round: round.index, index: i })}
            >
              <span className="num">{i + 1}</span>
              <span className="body">
                <span className="path">{citation.source}</span>
                <span className="loc">{formatLocator(citation.locator)}</span>
                <span className="val">{formatValue(citation.value)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {usage?.total !== undefined && (
        <div className="foot">
          <span>{formatTokens(usage.total)} tokens</span>
          {round.answer?.metadata.stop_reason && <span>{round.answer.metadata.stop_reason}</span>}
        </div>
      )}
    </section>
  )
}
