import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const activity = await prisma.activity.findFirst({ where: { id, userId: user.id } })
    if (!activity) return Response.json({ error: "Not found" }, { status: 404 })

    return Response.json(activity)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const body = await request.json()
    const { type, name, date, durationSec, distanceM, elevationM, avgHeartRate, calories, notes } = body

    // Validation — same rules as POST
    const VALID_TYPES = new Set(["running","cycling","swimming","walking","hiking","rowing","elliptical","strength","other"])
    if (type   !== undefined && !VALID_TYPES.has(type))                                              return Response.json({ error: "Type invalide" },           { status: 400 })
    if (name   !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.length > 200)) return Response.json({ error: "name invalide" },    { status: 400 })
    if (notes  !== undefined && typeof notes === "string" && notes.length > 2_000)                   return Response.json({ error: "notes trop longues" },       { status: 400 })
    if (durationSec  != null && (typeof durationSec  !== "number" || durationSec  <= 0 || durationSec  > 7 * 86_400)) return Response.json({ error: "durationSec invalide" },  { status: 400 })
    if (distanceM    != null && (typeof distanceM    !== "number" || distanceM    <  0 || distanceM    > 1_000_000))   return Response.json({ error: "distanceM invalide" },    { status: 400 })
    if (elevationM   != null && (typeof elevationM   !== "number" || elevationM   < -500 || elevationM > 10_000))      return Response.json({ error: "elevationM invalide" },   { status: 400 })
    if (avgHeartRate != null && (typeof avgHeartRate !== "number" || avgHeartRate <  20 || avgHeartRate > 300))        return Response.json({ error: "avgHeartRate invalide" }, { status: 400 })
    if (calories     != null && (typeof calories     !== "number" || calories     <  0  || calories    > 30_000))      return Response.json({ error: "calories invalide" },     { status: 400 })

    const avgSpeedKmh = distanceM && durationSec ? (distanceM / 1000) / (durationSec / 3600) : null
    const avgPaceSecKm = (type === "running" || type === "walking" || type === "hiking") && distanceM && durationSec
      ? Math.round(durationSec / (distanceM / 1000))
      : null

    const activity = await prisma.activity.update({
      where: { id, userId: user.id },
      data: {
        type, name,
        date: date ? new Date(date) : undefined,
        durationSec: durationSec ?? null,
        distanceM: distanceM ?? null,
        elevationM: elevationM ?? null,
        avgHeartRate: avgHeartRate ?? null,
        calories: calories ?? null,
        avgSpeedKmh,
        avgPaceSecKm,
        notes: notes ?? null,
      },
    })

    return Response.json(activity)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const activity = await prisma.activity.findFirst({ where: { id, userId: user.id } })
    if (!activity) return Response.json({ error: "Not found" }, { status: 404 })

    await prisma.activity.delete({ where: { id } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
