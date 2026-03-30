import { getStripe, getPriceToPlan } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })

  let customerId = user?.stripeCustomerId ?? null

  // If no customer ID stored, search Stripe by email — but only pick the customer
  // that has a subscription tied to a RepAI price ID (avoids cross-app confusion)
  if (!customerId) {
    const repaiPriceIds = new Set(Object.keys(getPriceToPlan()).filter(Boolean))
    const customers = await getStripe().customers.list({ email: authUser.email, limit: 10 })

    for (const customer of customers.data) {
      const subs = await getStripe().subscriptions.list({ customer: customer.id, limit: 5 })
      const hasRepaiSub = subs.data.some(sub =>
        sub.items.data.some(item => repaiPriceIds.has(item.price.id))
      )
      if (hasRepaiSub) {
        customerId = customer.id
        await prisma.user.update({
          where: { email: authUser.email },
          data: { stripeCustomerId: customerId },
        })
        break
      }
    }
  }

  if (!customerId) {
    return Response.json({ error: "No Stripe customer found for RepAI" }, { status: 404 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  })

  return Response.json({ url: session.url })
}
