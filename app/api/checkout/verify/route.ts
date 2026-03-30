import { getStripe, getPriceToPlan } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await request.json()
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 })

  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return Response.json({ error: "Payment not completed" }, { status: 400 })
  }

  // Make sure this session belongs to this user
  const sessionEmail = session.metadata?.userEmail ?? session.customer_email
  if (sessionEmail !== authUser.email) {
    return Response.json({ error: "Session mismatch" }, { status: 403 })
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
  if (!customerId || !subscriptionId) {
    return Response.json({ error: "Missing customer or subscription" }, { status: 400 })
  }

  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  const priceId = sub.items.data[0]?.price.id
  const plan = getPriceToPlan()[priceId] ?? "premium"

  await prisma.user.upsert({
    where: { email: authUser.email },
    update: { plan, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, planExpiresAt: null },
    create: { email: authUser.email, plan, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId },
  })

  return Response.json({ ok: true, plan })
}
