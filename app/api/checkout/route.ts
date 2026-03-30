import { getStripe, PRICE_TO_PLAN } from "@/lib/stripe"
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

  const body = await request.json()
  const { priceId } = body

  if (!priceId || typeof priceId !== "string") {
    return Response.json({ error: "priceId is required" }, { status: 400 })
  }

  if (!PRICE_TO_PLAN[priceId]) {
    return Response.json({ error: "Invalid price" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })

  // If user already has an active Stripe subscription, send to billing portal instead
  if (user?.stripeSubscriptionId) {
    return Response.json({ redirectToBillingPortal: true })
  }

  // Reuse existing Stripe customer if available
  const customer = user?.stripeCustomerId
    ? { customer: user.stripeCustomerId }
    : { customer_email: authUser.email }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    ...customer,
    metadata: { userEmail: authUser.email },
    subscription_data: { metadata: { userEmail: authUser.email } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
  })

  return Response.json({ url: session.url })
}
