import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })

  let customerId = user?.stripeCustomerId ?? null

  // If no customer ID stored, search Stripe by email
  if (!customerId) {
    const customers = await getStripe().customers.list({ email: authUser.email, limit: 1 })
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
      // Save it for next time
      await prisma.user.update({
        where: { email: authUser.email },
        data: { stripeCustomerId: customerId },
      })
    }
  }

  if (!customerId) {
    return Response.json({ error: "No Stripe customer found" }, { status: 404 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  })

  return Response.json({ url: session.url })
}
