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

    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) },
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { sets: { orderBy: { order: "asc" } } },
          },
        },
      }),
      prisma.workout.count({ where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) } }),
    ])

    return cachedJson({ items: workouts, total, limit, offset })
  } catch (e) {
    console.error("[workouts GET]", e)
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
    const { name, notes, date, exercises } = body

    // Input length limits — prevent DB bloat and oversized payloads
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "name requis" }, { status: 400 })
    }
    if (name.length > 200) return Response.json({ error: "name trop long (max 200)" }, { status: 400 })
    if (notes && typeof notes === "string" && notes.length > 2_000) {
      return Response.json({ error: "notes trop longues (max 2 000)" }, { status: 400 })
    }
    if (Array.isArray(exercises)) {
      if (exercises.length > 50) {
        return Response.json({ error: "Trop d'exercices (max 50 par séance)" }, { status: 400 })
      }
      for (const ex of exercises) {
        if (typeof ex.name === "string" && ex.name.length > 200) {
          return Response.json({ error: "Nom d'exercice trop long (max 200)" }, { status: 400 })
        }
        if (Array.isArray(ex.sets) && ex.sets.length > 200) {
          return Response.json({ error: "Trop de séries par exercice (max 200)" }, { status: 400 })
        }
      }
    }

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name,
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
  } catch (e) {
    console.error("[workouts POST]", e)
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
