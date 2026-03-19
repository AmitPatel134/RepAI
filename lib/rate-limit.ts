import { LRUCache } from "lru-cache"

type RateLimitOptions = {
  maxRequests: number
  windowMs: number
}

export function createRateLimiter({ maxRequests, windowMs }: RateLimitOptions) {
  const cache = new LRUCache<string, number[]>({ max: 500 })

  return function rateLimit(request: Request): Response | null {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    const now = Date.now()
    const windowStart = now - windowMs
    const timestamps = (cache.get(ip) ?? []).filter(t => t > windowStart)

    if (timestamps.length >= maxRequests) {
      return Response.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429 }
      )
    }

    cache.set(ip, [...timestamps, now])
    return null
  }
}
