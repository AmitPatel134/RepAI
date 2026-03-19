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

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  // Find the Stripe customer by email
  const customers = await stripe.customers.list({ email: authUser.email, limit: 1 })
  if (customers.data.length === 0) {
    return Response.json({ error: "No subscription found." }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app`,
  })

  return Response.json({ url: session.url })
}
