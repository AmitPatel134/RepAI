export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

// Only downgrade to free is allowed via this endpoint.
// Upgrades must go through Stripe checkout (/api/checkout) to ensure payment.
const VALID_PLANS = ["free"]

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()

    if (body.email && body.email !== authUser.email) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!body.plan || !VALID_PLANS.includes(body.plan)) {
      return Response.json({ error: "Invalid plan" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { email: authUser.email },
      data: { plan: body.plan },
    })

    return Response.json(user)
  } catch {
    return Response.json({ error: "Error" }, { status: 500 })
  }
}
