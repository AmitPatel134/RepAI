/**
 * Module-level data cache for instant page transitions.
 * Data is shared across all page components within the same browser session.
 * TTL: 90 seconds — after that, fresh data is fetched.
 */

const CACHE_TTL = 5 * 60_000 // 5 minutes

type Entry = { data: unknown; ts: number }
const cache = new Map<string, Entry>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data as T
}

export function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

export function invalidateCache(key: string) {
  cache.delete(key)
}

/** Kick off parallel prefetch for all main pages. Called once from the app layout. */
export async function prefetchAll() {
  const { authFetch } = await import("@/lib/authFetch")
  // Paginated endpoints: cache only the first page's items array
  const paginatedKeys = ["/api/workouts", "/api/activities", "/api/nutrition"]
  const plainKeys = ["/api/plan", "/api/weight"]
  await Promise.allSettled([
    ...paginatedKeys.map(key =>
      authFetch(`${key}?limit=20`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data !== null) setCached(key, Array.isArray(data) ? data : (data?.items ?? [])) })
        .catch(() => {})
    ),
    ...plainKeys.map(key =>
      authFetch(key)
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data !== null) setCached(key, data) })
        .catch(() => {})
    ),
  ])
}
