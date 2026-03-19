import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

function mapStravaType(sport: string): string {
  const map: Record<string, string> = {
    Run: "running", VirtualRun: "running",
    Ride: "cycling", VirtualRide: "cycling", EBikeRide: "cycling",
    Swim: "swimming", Walk: "walking", Hike: "hiking",
    Rowing: "rowing", Kayaking: "rowing", Elliptical: "elliptical",
  }
  return map[sport] ?? "other"
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    let token = await prisma.stravaToken.findUnique({ where: { userId: user.id } })
    if (!token) return Response.json({ error: "Strava not connected" }, { status: 400 })

    // Refresh token if expired
    if (token.expiresAt < new Date()) {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken,
        }),
      })
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        token = await prisma.stravaToken.update({
          where: { userId: user.id },
          data: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(data.expires_at * 1000) },
        })
      }
    }

    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${after}`,
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    )

    if (!activitiesRes.ok) return Response.json({ error: "Strava API error" }, { status: 500 })

    const stravaActivities = await activitiesRes.json()
    let synced = 0

    for (const a of stravaActivities) {
      try {
        const avgSpeedKmh = a.average_speed ? a.average_speed * 3.6 : null
        const type = mapStravaType(a.sport_type ?? a.type)
        const avgPaceSecKm = (type === "running" || type === "walking" || type === "hiking") && a.average_speed
          ? Math.round(1000 / a.average_speed)
          : null

        await prisma.activity.upsert({
          where: { stravaId: a.id.toString() },
          update: {},
          create: {
            userId: user.id,
            type,
            name: a.name,
            date: new Date(a.start_date),
            durationSec: a.elapsed_time ?? null,
            distanceM: a.distance ?? null,
            elevationM: a.total_elevation_gain ?? null,
            avgHeartRate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
            maxHeartRate: a.max_heartrate ? Math.round(a.max_heartrate) : null,
            calories: a.calories ?? null,
            avgSpeedKmh,
            avgPaceSecKm,
            source: "strava",
            stravaId: a.id.toString(),
          },
        })
        synced++
      } catch {}
    }

    return Response.json({ synced })
  } catch {
    return Response.json({ error: "Sync error" }, { status: 500 })
  }
}
