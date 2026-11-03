// The Reigner event layer: plain TypeScript, no React. Copy this folder to
// talk to a `reigner serve --http` server from any frontend.

export * from './events'
export * from './client'
export * from './rounds'
export { readEvents, parseEventData } from './sse'
export { formatLocator, isPseudoTool, summarizeArgs, summarizeResult } from './toolSummary'
