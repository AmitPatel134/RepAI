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

    const workouts = await prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: {
            sets: { orderBy: { order: "asc" } },
          },
        },
      },
    })

    return Response.json(workouts)
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
    const { name, type, notes, date } = body

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name,
        type: type || "fullbody",
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    })

    return Response.json(workout, { status: 201 })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
