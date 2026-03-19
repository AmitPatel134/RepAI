import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await request.json()
  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ error: "sessionId is required" }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid") {
    return Response.json({ error: "Payment not confirmed" }, { status: 400 })
  }

  const email = session.customer_email ?? session.customer_details?.email
  if (!email) return Response.json({ error: "Email not found" }, { status: 400 })

  if (email !== authUser.email) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.user.upsert({
    where: { email },
    update: { plan: "pro" },
    create: { email, plan: "pro" },
  })

  return Response.json({ success: true, plan: "pro" })
}
