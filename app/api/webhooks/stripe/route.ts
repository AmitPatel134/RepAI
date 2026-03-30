import { getStripe, PRICE_TO_PLAN } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import Stripe from "stripe"

export const dynamic = "force-dynamic"

// Must read raw body for Stripe signature verification
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) return Response.json({ error: "No signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error("[stripe webhook] Invalid signature:", err)
    return Response.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── New subscription created via Checkout ──────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const email = session.metadata?.userEmail ?? session.customer_email
        if (!email) break

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        if (!customerId || !subscriptionId) break

        // Get the plan from the subscription's price
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] ?? "premium"

        await prisma.user.upsert({
          where: { email },
          update: {
            plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planExpiresAt: null,
          },
          create: {
            email,
            plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          },
        })
        console.log(`[stripe] checkout.session.completed → ${email} → ${plan}`)
        break
      }

      // ── Subscription changed (upgrade / downgrade / renewal) ────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const email = await emailFromCustomer(sub.customer)
        if (!email) break

        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] ?? "premium"

        if (sub.status === "active" || sub.status === "trialing") {
          await prisma.user.update({
            where: { email },
            data: {
              plan,
              stripeSubscriptionId: sub.id,
              planExpiresAt: null,
            },
          })
          console.log(`[stripe] subscription.updated → ${email} → ${plan} (${sub.status})`)
        } else if (["canceled", "unpaid", "paused"].includes(sub.status)) {
          await clearSubscription(email)
          console.log(`[stripe] subscription.updated → ${email} → free (${sub.status})`)
        }
        break
      }

      // ── Subscription cancelled / expired ────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const email = await emailFromCustomer(sub.customer)
        if (!email) break

        await clearSubscription(email)
        console.log(`[stripe] subscription.deleted → ${email} → free`)
        break
      }

    }
  } catch (err) {
    console.error("[stripe webhook] Handler error:", err)
    return Response.json({ error: "Handler error" }, { status: 500 })
  }

  return Response.json({ received: true })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function emailFromCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  if (!customer) return null
  const customerId = typeof customer === "string" ? customer : customer.id

  // Look up in our DB first (fastest)
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
  if (user?.email) return user.email

  // Fallback: fetch from Stripe
  const c = await getStripe().customers.retrieve(customerId)
  if (c.deleted) return null
  return (c as Stripe.Customer).email ?? null
}

async function clearSubscription(email: string) {
  await prisma.user.update({
    where: { email },
    data: {
      plan: "free",
      stripeSubscriptionId: null,
      planExpiresAt: null,
    },
  })
}
