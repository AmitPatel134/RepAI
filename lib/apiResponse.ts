/**
 * Helpers for API route responses.
 *
 * cachedJson — adds Cache-Control: private, stale-while-revalidate
 * to authenticated GET responses so the browser can serve stale data
 * instantly while fetching fresh data in the background.
 *
 * Default: fresh for 30s, serve stale up to 5 minutes.
 */
export function cachedJson(
  data: unknown,
  { maxAge = 30, swr = 270 }: { maxAge?: number; swr?: number } = {}
): Response {
  return Response.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    },
  })
}
