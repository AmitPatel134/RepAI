import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const rateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 })

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const customers = await stripe.customers.list({ email: authUser.email, limit: 1 })
  if (customers.data.length === 0) {
    return Response.json({ error: "No subscription found" }, { status: 404 })
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customers.data[0].id,
    status: "active",
    limit: 1,
  })
  if (subscriptions.data.length === 0) {
    return Response.json({ error: "No active subscription found" }, { status: 404 })
  }

  const sub = await stripe.subscriptions.update(subscriptions.data[0].id, {
    cancel_at_period_end: true,
  })

  const periodEnd = sub.items.data[0]?.current_period_end
  if (!periodEnd) return Response.json({ error: "Could not retrieve end date" }, { status: 500 })
  const expiresAt = new Date(periodEnd * 1000)

  await prisma.user.update({
    where: { email: authUser.email },
    data: { planExpiresAt: expiresAt },
  })

  return Response.json({ success: true, expiresAt })
}
