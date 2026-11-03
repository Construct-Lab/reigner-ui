// localStorage can be missing or throw (private windows, blocked site data).
// The app must still work, just without remembering anything.

const PREFIX = 'reigner-ui:'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota or access error: keep the in-memory value only.
  }
}

/** Call `listener` when another tab changes `key`. Returns an unsubscribe. */
export function onExternalChange(key: string, listener: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === PREFIX + key) listener()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
