/**
 * Module-level data cache for instant page transitions.
 * Data is shared across all page components within the same browser session.
 * TTL: 90 seconds — after that, fresh data is fetched.
 */

const CACHE_TTL = 90_000

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
  const keys = [
    "/api/plan",
    "/api/workouts",
    "/api/activities",
    "/api/nutrition",
    "/api/weight",
  ]
  await Promise.allSettled(
    keys.map(key =>
      authFetch(key)
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data !== null) setCached(key, data) })
        .catch(() => {})
    )
  )
}
