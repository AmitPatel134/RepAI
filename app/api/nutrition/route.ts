import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { isPro } from "@/lib/plans"
import { cachedJson } from "@/lib/apiResponse"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json([])

    // Free plan: only last 7 days of history
    const dateFilter = !isPro(user.plan ?? "free")
      ? { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      : undefined

    const url = new URL(request.url)
    const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "20"), 100)
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"),  0)

    const [meals, total] = await Promise.all([
      prisma.meal.findMany({
        where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) },
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true, name: true, date: true,
          calories: true, proteins: true, carbs: true, fats: true, fiber: true,
          notes: true, imageThumb: true,
        },
      }),
      prisma.meal.count({ where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) } }),
    ])

    return cachedJson({ items: meals, total, limit, offset })
  } catch (e) {
    console.error("[nutrition GET]", e)
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

    const body = await request.json()
    const { name, date, calories, proteins, carbs, fats, fiber, notes, imageThumb, imageUrl } = body

    if (!name) return Response.json({ error: "name required" }, { status: 400 })

    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
        name,
        date: date ? new Date(date) : new Date(),
        calories: calories ?? null,
        proteins: proteins ?? null,
        carbs: carbs ?? null,
        fats: fats ?? null,
        fiber: fiber ?? null,
        notes: notes ?? null,
        imageThumb: imageThumb ?? null,
        imageUrl: imageUrl ?? null,
      },
    })

    return Response.json(meal, { status: 201 })
  } catch (e) {
    console.error("POST /api/nutrition error:", e)
    return Response.json({ error: "Database error", detail: (e as Error)?.message }, { status: 500 })
  }
}
