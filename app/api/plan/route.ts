import { prisma } from "@/lib/prisma"
import { PLANS, isPro } from "@/lib/plans"
import { getAuthUser } from "@/lib/authServer"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) {
    return Response.json({
      plan: "free",
      limits: PLANS.free,
      usage: { items: 0, generationsThisMonth: 0 },
    })
  }

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const [itemsCount, generationsCount] = await Promise.all([
    prisma.item.count({ where: { userId: user.id } }),
    prisma.generation.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
  ])

  const plan = user.plan ?? "free"
  const limits = isPro(plan) ? PLANS.pro : PLANS.free

  return Response.json({
    plan,
    limits: {
      items: limits.items === Infinity ? null : limits.items,
      generationsPerMonth: limits.generationsPerMonth === Infinity ? null : limits.generationsPerMonth,
    },
    usage: {
      items: itemsCount,
      generationsThisMonth: generationsCount,
    },
  })
}
