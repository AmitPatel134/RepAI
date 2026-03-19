import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json([])

    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    })

    return Response.json(meals)
  } catch {
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
    const { name, date, calories, proteins, carbs, fats, fiber, notes } = body

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
      },
    })

    return Response.json(meal, { status: 201 })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
