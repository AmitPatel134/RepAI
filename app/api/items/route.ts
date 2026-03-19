import { prisma } from "@/lib/prisma"
import { getLimit, isPro } from "@/lib/plans"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const rateLimit = createRateLimiter({ maxRequests: 30, windowMs: 60_000 })

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json([])

  const items = await prisma.item.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })
  return Response.json(items)
}

export async function POST(request: Request) {
  const limited = rateLimit(request)
  if (limited) return limited

  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, description, status } = body

  if (!name) return Response.json({ error: "name is required" }, { status: 400 })

  const user = await prisma.user.upsert({
    where: { email: authUser.email },
    update: {},
    create: { email: authUser.email },
  })

  if (!isPro(user.plan)) {
    const count = await prisma.item.count({ where: { userId: user.id } })
    const limit = getLimit(user.plan, "items")
    if (count >= limit) {
      return Response.json({ error: "LIMIT_REACHED", limit }, { status: 403 })
    }
  }

  try {
    const item = await prisma.item.create({
      data: {
        userId: user.id,
        name,
        description: description ?? null,
        status: status ?? "active",
      },
    })
    return Response.json(item, { status: 201 })
  } catch (e) {
    console.error("item create error", e)
    return Response.json({ error: "Error creating item" }, { status: 500 })
  }
}
