/**
 * Client-side in-memory cache for instant page transitions.
 * Implements stale-while-revalidate (SWR):
 *
 *   FRESH   (< 60s)  → served instantly, no background fetch
 *   STALE   (1–5min) → served instantly AND refreshed in background
 *   EXPIRED (> 5min) → cache miss, caller must fetch fresh
 *
 * Data is module-level and shared across all components in the same tab session.
 */

const FRESH_TTL  = 60_000        // 1 min  — no refresh needed
const EXPIRE_TTL = 5 * 60_000   // 5 min  — hard expiry

type Entry = { data: unknown; ts: number; refreshing?: boolean }
const cache = new Map<string, Entry>()

// ── Core primitives ──────────────────────────────────────────────────────────

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > EXPIRE_TTL) { cache.delete(key); return null }
  return entry.data as T
}

export function setCached(key: string, data: unknown) {
  const entry = cache.get(key)
  // Preserve refreshing flag if an in-flight refresh set this
  cache.set(key, { data, ts: Date.now(), refreshing: entry?.refreshing })
}

export function invalidateCache(key: string) {
  cache.delete(key)
}

export function invalidateAll() {
  cache.clear()
}

// ── Stale-while-revalidate ───────────────────────────────────────────────────

function age(key: string): number {
  const entry = cache.get(key)
  return entry ? Date.now() - entry.ts : Infinity
}

function isStale(key: string): boolean {
  const a = age(key)
  return a > FRESH_TTL && a <= EXPIRE_TTL
}

/**
 * Returns cached data immediately (fresh or stale).
 * When stale, triggers a deduplicated background refresh without blocking.
 * Returns null only when the entry is expired or missing.
 */
export function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T | null>
): T | null {
  const data = getCached<T>(key)

  if (data !== null && isStale(key)) {
    const entry = cache.get(key)!
    if (!entry.refreshing) {
      entry.refreshing = true
      fetcher()
        .then(fresh => { if (fresh !== null) setCached(key, fresh) })
        .catch(() => {})
        .finally(() => {
          const e = cache.get(key)
          if (e) delete e.refreshing
        })
    }
  }

  return data
}

// ── Prefetch specs ───────────────────────────────────────────────────────────

type FetchSpec = {
  key: string
  url: string
  transform?: (raw: unknown) => unknown
}

const PREFETCH_SPECS: FetchSpec[] = [
  {
    key: "/api/workouts",
    url: "/api/workouts?limit=20",
    transform: (d: unknown) => (d as { items?: unknown[] })?.items ?? [],
  },
  {
    key: "/api/activities",
    url: "/api/activities?limit=20",
    transform: (d: unknown) => (d as { items?: unknown[] })?.items ?? [],
  },
  {
    key: "/api/nutrition",
    url: "/api/nutrition?limit=20",
    transform: (d: unknown) => (d as { items?: unknown[] })?.items ?? [],
  },
  { key: "/api/plan",     url: "/api/plan" },
  { key: "/api/weight",   url: "/api/weight" },
  { key: "/api/profile",  url: "/api/profile" },
  { key: "/api/users",    url: "/api/users" },
]

async function fetchOne(
  spec: FetchSpec,
  authFetch: (url: string) => Promise<Response>
): Promise<void> {
  try {
    const res = await authFetch(spec.url)
    if (!res.ok) return
    const raw = await res.json()
    const data = spec.transform ? spec.transform(raw) : raw
    if (data !== null && data !== undefined) setCached(spec.key, data)
  } catch { /* ignore network errors */ }
}

// ── Public API ───────────────────────────────────────────────────────────────

let prefetchInFlight: Promise<void> | null = null

/**
 * Prefetch all main-page data in parallel.
 * Skips keys that are already FRESH to avoid redundant network requests.
 * Deduped — safe to call multiple times; concurrent calls share one promise.
 */
export async function prefetchAll(): Promise<void> {
  if (prefetchInFlight) return prefetchInFlight

  const { authFetch } = await import("@/lib/authFetch")

  // Only fetch what is expired or missing — skip fresh/stale (already served)
  const toFetch = PREFETCH_SPECS.filter(s => age(s.key) > FRESH_TTL)
  if (toFetch.length === 0) return

  prefetchInFlight = Promise.allSettled(
    toFetch.map(spec => fetchOne(spec, authFetch))
  ).then(() => { prefetchInFlight = null })

  return prefetchInFlight
}

/**
 * Refresh only stale or missing entries in the background.
 * Call this on tab focus (visibilitychange) to silently update data
 * the user may not have seen for a while.
 */
export async function refreshStale(): Promise<void> {
  const { authFetch } = await import("@/lib/authFetch")
  const toRefresh = PREFETCH_SPECS.filter(s => isStale(s.key) || !cache.has(s.key))
  if (toRefresh.length === 0) return
  await Promise.allSettled(toRefresh.map(spec => fetchOne(spec, authFetch)))
}
