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

    const activities = await prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    })

    return Response.json(activities)
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
    const {
      type, name, date, durationSec, distanceM, elevationM,
      avgHeartRate, maxHeartRate, calories, laps, poolLengthM, notes,
    } = body

    if (!type || !name) return Response.json({ error: "type and name required" }, { status: 400 })

    const avgSpeedKmh = distanceM && durationSec ? (distanceM / 1000) / (durationSec / 3600) : null
    const avgPaceSecKm = (type === "running" || type === "walking" || type === "hiking") && distanceM && durationSec
      ? Math.round(durationSec / (distanceM / 1000))
      : null

    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        type,
        name,
        date: date ? new Date(date) : new Date(),
        durationSec: durationSec ?? null,
        distanceM: distanceM ?? null,
        elevationM: elevationM ?? null,
        avgHeartRate: avgHeartRate ?? null,
        maxHeartRate: maxHeartRate ?? null,
        calories: calories ?? null,
        avgSpeedKmh,
        avgPaceSecKm,
        laps: laps ?? null,
        poolLengthM: poolLengthM ?? null,
        notes: notes ?? null,
      },
    })

    return Response.json(activity, { status: 201 })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
