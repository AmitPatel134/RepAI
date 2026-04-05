import { NextRequest, NextResponse } from "next/server"

/**
 * Global API rate limiter (Edge-compatible, in-memory sliding window).
 *
 * Layers:
 *  1. This middleware applies a per-route-group limit to ALL /api/* paths.
 *  2. Individual AI routes keep their own tighter per-route limiters.
 *
 * In production (Vercel Edge), each instance has its own in-memory store —
 * the limit is per-instance, not global. This is intentional and consistent
 * with the existing per-route limiters.
 */

type Window = { count: number; resetAt: number }
const store = new Map<string, Window>()

// Route prefix → { maxRequests per windowMs }
// More specific prefixes must come first (they're matched longest-first).
const ROUTE_LIMITS: [string, number, number][] = [
  // [prefix, maxRequests, windowMs]
  ["/api/checkout",           5,   60_000],
  ["/api/billing-portal",     5,   60_000],
  ["/api/support",            5,   60_000],
  ["/api/coach",              15,  60_000],  // own limiter is 10, middleware adds outer 15
  ["/api/generate",           15,  60_000],
  ["/api/voice",              30,  60_000],
  ["/api/nutrition/analyze",  15,  60_000],
  ["/api/nutrition/describe", 15,  60_000],
  ["/api/nutrition-reco",     10,  60_000],
  ["/api/import",             10,  60_000],
  ["/api/export",             10,  60_000],
  ["/api/workouts/import",    10,  60_000],
  ["/api/workouts/export",    10,  60_000],
  ["/api/workouts",           60,  60_000],
  ["/api/nutrition",          60,  60_000],
  ["/api/activities",         60,  60_000],
  ["/api/weight",             30,  60_000],
  ["/api/profile",            30,  60_000],
  ["/api/users",              30,  60_000],
  ["/api/plan",               30,  60_000],
  ["/api/",                  120,  60_000],  // catch-all
]

function getLimit(pathname: string): [number, number] {
  for (const [prefix, max, window] of ROUTE_LIMITS) {
    if (pathname.startsWith(prefix)) return [max, window]
  }
  return [120, 60_000]
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

// Cleanup stale entries every 5 minutes to prevent unbounded memory growth
let lastCleanup = Date.now()
function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 5 * 60_000) return
  lastCleanup = now
  for (const [key, w] of store.entries()) {
    if (now > w.resetAt) store.delete(key)
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/api/")) return NextResponse.next()

  maybeCleanup()

  const ip = getIp(request)
  const [maxRequests, windowMs] = getLimit(pathname)

  // Key combines IP + path so limits are per-endpoint (not shared across routes)
  const key = `${ip}|${pathname}`
  const now = Date.now()

  let w = store.get(key)
  if (!w || now > w.resetAt) {
    w = { count: 1, resetAt: now + windowMs }
    store.set(key, w)
    return NextResponse.next()
  }

  const remaining = Math.max(0, maxRequests - w.count)
  const resetSec  = Math.ceil(w.resetAt / 1000)

  if (w.count >= maxRequests) {
    const retryAfter = Math.ceil((w.resetAt - now) / 1000)
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
      {
        status: 429,
        headers: {
          "Content-Type":        "application/json",
          "Retry-After":         String(retryAfter),
          "X-RateLimit-Limit":   String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":   String(resetSec),
        },
      }
    )
  }

  w.count++

  // Attach rate-limit info headers to all passing responses
  const res = NextResponse.next()
  res.headers.set("X-RateLimit-Limit",     String(maxRequests))
  res.headers.set("X-RateLimit-Remaining", String(remaining - 1))
  res.headers.set("X-RateLimit-Reset",     String(resetSec))
  return res
}

export const config = {
  matcher: ["/api/:path*"],
}
