const DAY = 24 * 60 * 60 * 1000

/** 9500 → "9.5k", 21400 → "21.4k", 812 → "812". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}k`
}

/** 2140 → "2.1s", 65000 → "1m 5s". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", then a date. */
export function formatRelative(iso: string, now = new Date()): string {
  const ms = now.getTime() - Date.parse(iso)
  if (ms < 60_000) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(ms / DAY)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(iso)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export type DateGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'

export const DATE_GROUPS: DateGroup[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older']

export function dateGroup(iso: string, now = new Date()): DateGroup {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  return 'Older'
}

/** Display any JSON value compactly: strings as-is, numbers grouped. */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toLocaleString()
  return JSON.stringify(value)
}
