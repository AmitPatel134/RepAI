import { getStripe, getPriceToPlan } from "@/lib/stripe"
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

  const newPlan = getPriceToPlan()[priceId]
  if (!newPlan) {
    return Response.json({ error: "Invalid price" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })

  // ── User already has an active subscription → upgrade/downgrade directly ──
  if (user?.stripeSubscriptionId) {
    const sub = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId)
    const currentItemId = sub.items.data[0]?.id

    if (!currentItemId) {
      return Response.json({ error: "Subscription item not found" }, { status: 500 })
    }

    // Same plan → nothing to do
    if (sub.items.data[0]?.price.id === priceId) {
      return Response.json({ alreadyCurrent: true, plan: newPlan })
    }

    // Update the subscription price immediately (Stripe handles proration)
    await getStripe().subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: currentItemId, price: priceId }],
      proration_behavior: "always_invoice",
    })

    // Update DB immediately
    await prisma.user.update({
      where: { email: authUser.email },
      data: { plan: newPlan },
    })

    return Response.json({ upgraded: true, plan: newPlan })
  }

  // ── New subscriber → Stripe Checkout ──────────────────────────────────────
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
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
  })

  return Response.json({ url: session.url })
}
