import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.NEXT_PUBLIC_PREMIUM_PRICE_ID!]:      "premium",
  [process.env.NEXT_PUBLIC_PREMIUM_PLUS_PRICE_ID!]: "premium_plus",
}

async function getEmailFromCustomer(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return (customer as Stripe.Customer).email
}

async function setUserPlan(email: string, plan: string) {
  await prisma.user.updateMany({ where: { email }, data: { plan } })
}

async function clearSubscription(email: string) {
  await prisma.user.updateMany({ where: { email }, data: { plan: "free", planExpiresAt: null } })
}

// Derive plan tier from subscription line items
function planFromSubscription(sub: Stripe.Subscription): string {
  const priceId = sub.items.data[0]?.price?.id
  return (priceId && PRICE_TO_PLAN[priceId]) ?? "premium"
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) return Response.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {

    // Initial checkout succeeded → set correct plan from metadata or priceId
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const email =
        session.customer_email ??
        (session.customer ? await getEmailFromCustomer(session.customer as string) : null)
      if (!email) break
      // Use metadata set at session creation; fall back to "premium"
      const plan = session.metadata?.plan ?? "premium"
      await setUserPlan(email, plan)
      break
    }

    // Subscription renewal succeeded → keep correct plan tier
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.customer || invoice.billing_reason === "manual") break
      const email = await getEmailFromCustomer(invoice.customer as string)
      if (!email) break
      // Retrieve subscription to know the exact plan tier
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id
      if (!subId) break
      const sub = await stripe.subscriptions.retrieve(subId)
      await setUserPlan(email, planFromSubscription(sub))
      break
    }

    // Subscription status changed (active ↔ past_due / canceled / paused)
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const email = await getEmailFromCustomer(sub.customer as string)
      if (!email) break
      if (["active", "trialing"].includes(sub.status)) {
        await setUserPlan(email, planFromSubscription(sub))
      } else if (["canceled", "unpaid", "past_due", "paused"].includes(sub.status)) {
        await clearSubscription(email)
      }
      break
    }

    // Subscription deleted (after cancel_at_period_end)
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const email = await getEmailFromCustomer(sub.customer as string)
      if (email) await clearSubscription(email)
      break
    }

  }

  return Response.json({ received: true })
}
