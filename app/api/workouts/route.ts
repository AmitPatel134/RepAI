import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { isPro } from "@/lib/plans"
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

    // Check free plan limit
    try {
      if (!isPro(user.plan ?? "free")) {
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const created = await prisma.usageEvent.count({
          where: { userId: user.id, type: "session_created", createdAt: { gte: firstOfMonth } },
        })
        if (created >= 5) {
          return Response.json({ error: "Limite de 5 séances par mois atteinte. Passez Pro pour continuer." }, { status: 429 })
        }
      }
    } catch { /* usageEvent table may not exist yet — allow the request */ }

    const body = await request.json()
    const { name, type, notes, date, exercises } = body

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name,
        type: type || "fullbody",
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
      },
    })

    // Create exercises + sets if provided (e.g. from voice)
    if (Array.isArray(exercises) && exercises.length > 0) {
      for (const [i, ex] of exercises.entries()) {
        const exercise = await prisma.exercise.create({
          data: { workoutId: workout.id, name: ex.name, category: "strength", order: i },
        })
        if (Array.isArray(ex.sets)) {
          for (const [j, s] of ex.sets.entries()) {
            await prisma.set.create({
              data: { exerciseId: exercise.id, reps: s.reps ?? null, weight: s.weight ?? null, order: j },
            })
          }
        }
      }
    }

    const full = await prisma.workout.findUnique({
      where: { id: workout.id },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    })

    // Record usage event
    await prisma.usageEvent.create({ data: { userId: user.id, type: "session_created" } }).catch(() => {})

    return Response.json(full, { status: 201 })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
