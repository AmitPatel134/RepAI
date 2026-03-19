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
    const { name, notes, date, exercises } = body

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name,
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
        exercises: {
          create: exercises.map((ex: { name: string; category?: string; sets: { reps?: number; weight?: number; rpe?: number; notes?: string }[] }, ei: number) => ({
            name: ex.name,
            category: ex.category ?? "strength",
            order: ei,
            sets: {
              create: ex.sets.map((s: { reps?: number; weight?: number; rpe?: number; notes?: string }, si: number) => ({
                reps: s.reps || null,
                weight: s.weight || null,
                rpe: s.rpe || null,
                notes: s.notes || null,
                order: si,
              })),
            },
          })),
        },
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
