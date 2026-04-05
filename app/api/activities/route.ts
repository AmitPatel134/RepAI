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

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) },
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.activity.count({ where: { userId: user.id, ...(dateFilter ? { date: dateFilter } : {}) } }),
    ])

    return cachedJson({ items: activities, total, limit, offset })
  } catch (e) {
    console.error("[activities GET]", e)
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
    const {
      type, name, date, durationSec, distanceM, elevationM,
      avgHeartRate, maxHeartRate, calories, laps, poolLengthM, notes,
    } = body

    if (!type || !name) return Response.json({ error: "type and name required" }, { status: 400 })

    // Numeric range validation — reject impossible/malicious values
    const VALID_TYPES = new Set(["running","cycling","swimming","walking","hiking","rowing","elliptical","strength","other"])
    if (!VALID_TYPES.has(type)) return Response.json({ error: "Type d'activité invalide" }, { status: 400 })
    if (durationSec   != null && (typeof durationSec   !== "number" || durationSec   <= 0  || durationSec   > 7 * 86_400)) return Response.json({ error: "durationSec invalide" },   { status: 400 })
    if (distanceM     != null && (typeof distanceM     !== "number" || distanceM     <  0  || distanceM     > 1_000_000))  return Response.json({ error: "distanceM invalide" },     { status: 400 })
    if (elevationM    != null && (typeof elevationM    !== "number" || elevationM    < -500 || elevationM   > 10_000))     return Response.json({ error: "elevationM invalide" },    { status: 400 })
    if (avgHeartRate  != null && (typeof avgHeartRate  !== "number" || avgHeartRate  <  20  || avgHeartRate  > 300))       return Response.json({ error: "avgHeartRate invalide" },  { status: 400 })
    if (maxHeartRate  != null && (typeof maxHeartRate  !== "number" || maxHeartRate  <  20  || maxHeartRate  > 300))       return Response.json({ error: "maxHeartRate invalide" },  { status: 400 })
    if (calories      != null && (typeof calories      !== "number" || calories      <  0   || calories      > 30_000))    return Response.json({ error: "calories invalide" },      { status: 400 })

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

    // Record usage event
    await prisma.usageEvent.create({ data: { userId: user.id, type: "session_created" } }).catch(() => {})

    return Response.json(activity, { status: 201 })
  } catch (e) {
    console.error("[activities POST]", e)
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
