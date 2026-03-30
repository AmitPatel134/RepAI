import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "Not found" }, { status: 404 })

    const workout = await prisma.workout.findFirst({
      where: { id, userId: user.id },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    })

    if (!workout) return Response.json({ error: "Not found" }, { status: 404 })
    return Response.json(workout)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "Not found" }, { status: 404 })

    const existing = await prisma.workout.findFirst({ where: { id, userId: user.id } })
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 })

    const body = await request.json()
    const { name, notes, date, exercises } = body

    // If exercises provided, replace them all
    if (exercises !== undefined) {
      await prisma.exercise.deleteMany({ where: { workoutId: id } })
    }

    const workout = await prisma.workout.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(exercises !== undefined && {
          exercises: {
            create: exercises.map((ex: { name: string; category?: string; isUnilateral?: boolean; notes?: string; sets: { reps?: number; weight?: number; rpe?: number; repsRight?: number; weightRight?: number }[] }, ei: number) => ({
              name: ex.name,
              category: ex.category ?? "strength",
              isUnilateral: ex.isUnilateral ?? false,
              notes: ex.notes || null,
              order: ei,
              sets: {
                create: ex.sets.map((s: { reps?: number; weight?: number; rpe?: number; repsRight?: number; weightRight?: number; isDropSet?: boolean; weightMin?: number }, si: number) => ({
                  reps: s.reps || null,
                  weight: s.weight || null,
                  rpe: s.rpe || null,
                  repsRight: s.repsRight || null,
                  weightRight: s.weightRight || null,
                  isDropSet: s.isDropSet ?? false,
                  weightMin: s.weightMin || null,
                  order: si,
                })),
              },
            })),
          },
        }),
      },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    })

    return Response.json(workout)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "Not found" }, { status: 404 })

    const existing = await prisma.workout.findFirst({ where: { id, userId: user.id } })
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 })

    await prisma.workout.delete({ where: { id } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
