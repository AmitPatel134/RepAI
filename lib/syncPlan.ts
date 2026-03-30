import { getStripe, getPriceToPlan } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

/**
 * Sync the user's plan from Stripe.
 * - Finds active RepAI subscriptions by email
 * - Updates plan, stripeCustomerId, stripeSubscriptionId in DB
 * - Falls back to "free" if no active subscription found
 */
export async function syncPlanFromStripe(email: string, force = false): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } })

  // Skip sync if plan is manually overridden (gifted accounts)
  if (user?.planOverride) return

  const repaiPriceIds = new Set(Object.keys(getPriceToPlan()).filter(Boolean))
  if (repaiPriceIds.size === 0) return // env vars not set, skip

  let foundPlan: string | null = null
  let foundCustomerId: string | null = null
  let foundSubscriptionId: string | null = null

  // Search by existing customer ID first (fast path)
  if (user?.stripeCustomerId) {
    const result = await findActiveRepaiSub(user.stripeCustomerId, repaiPriceIds)
    if (result) {
      foundPlan = result.plan
      foundCustomerId = user.stripeCustomerId
      foundSubscriptionId = result.subscriptionId
    }
  }

  // Fallback: search all customers with this email
  if (!foundPlan) {
    const customers = await getStripe().customers.list({ email, limit: 10 })
    for (const customer of customers.data) {
      if (customer.id === user?.stripeCustomerId) continue // already checked
      const result = await findActiveRepaiSub(customer.id, repaiPriceIds)
      if (result) {
        foundPlan = result.plan
        foundCustomerId = customer.id
        foundSubscriptionId = result.subscriptionId
        break
      }
    }
  }

  // Determine correct plan
  const correctPlan = foundPlan ?? "free"

  await prisma.user.upsert({
    where: { email },
    update: {
      plan: correctPlan,
      stripeCustomerId: foundCustomerId ?? user?.stripeCustomerId ?? null,
      stripeSubscriptionId: foundSubscriptionId,
      planSyncedAt: new Date(),
    },
    create: {
      email,
      plan: correctPlan,
      stripeCustomerId: foundCustomerId,
      stripeSubscriptionId: foundSubscriptionId,
      planSyncedAt: new Date(),
    },
  })
}

async function findActiveRepaiSub(
  customerId: string,
  repaiPriceIds: Set<string>
): Promise<{ plan: string; subscriptionId: string } | null> {
  const priceToPlan = getPriceToPlan()
  const subs = await getStripe().subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 10,
  })

  for (const sub of subs.data) {
    for (const item of sub.items.data) {
      if (repaiPriceIds.has(item.price.id)) {
        return { plan: priceToPlan[item.price.id], subscriptionId: sub.id }
      }
    }
  }

  // Also check "past_due" — Stripe retries for ~7 days, keep access
  const pastDueSubs = await getStripe().subscriptions.list({
    customer: customerId,
    status: "past_due",
    limit: 5,
  })

  for (const sub of pastDueSubs.data) {
    for (const item of sub.items.data) {
      if (repaiPriceIds.has(item.price.id)) {
        return { plan: priceToPlan[item.price.id], subscriptionId: sub.id }
      }
    }
  }

  return null
}
