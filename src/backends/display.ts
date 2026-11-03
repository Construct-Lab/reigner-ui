import type { BackendHealth } from './health'
import type { Backend } from './store'

/** The name to show: the user's label, else the agent name, else the host. */
export function backendName(backend: Backend, health?: BackendHealth): string {
  return backend.name ?? health?.health?.name ?? hostOf(backend.url)
}

/** "localhost:8000" from "http://localhost:8000". */
export function hostOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.host + parsed.pathname.replace(/\/$/, '')
  } catch {
    return url
  }
}

/** The command that starts a server this page is allowed to call. */
export function serveCommand(url: string): string {
  let port = ''
  try {
    port = new URL(url).port
  } catch {
    // Leave the port out.
  }
  const portFlag = port && port !== '8000' ? ` --port ${port}` : ''
  return `reigner serve --http${portFlag} --cors-origin ${window.location.origin}`
}
