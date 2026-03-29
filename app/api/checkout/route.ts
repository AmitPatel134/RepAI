import { stripe } from "@/lib/stripe"
import { createRateLimiter } from "@/lib/rate-limit"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const rateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 })

// Maps each allowed priceId to the plan it grants
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.NEXT_PUBLIC_PREMIUM_PRICE_ID!]:      "premium",
  [process.env.NEXT_PUBLIC_PREMIUM_PLUS_PRICE_ID!]: "premium_plus",
}

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

  const planTier = PRICE_TO_PLAN[priceId]
  if (!planTier) {
    return Response.json({ error: "Invalid price" }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: authUser.email,
    metadata: { plan: planTier },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  })

  return Response.json({ url: session.url })
}
