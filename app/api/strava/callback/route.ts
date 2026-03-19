import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

function mapStravaType(sport: string): string {
  const map: Record<string, string> = {
    Run: "running", VirtualRun: "running",
    Ride: "cycling", VirtualRide: "cycling", EBikeRide: "cycling",
    Swim: "swimming",
    Walk: "walking",
    Hike: "hiking",
    Rowing: "rowing", Kayaking: "rowing",
    Elliptical: "elliptical",
  }
  return map[sport] ?? "other"
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://repai.fr"

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/app/activities?strava_error=1`)
  }

  let email: string
  try {
    email = Buffer.from(state, "base64").toString("utf-8")
  } catch {
    return Response.redirect(`${appUrl}/app/activities?strava_error=1`)
  }

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    return Response.redirect(`${appUrl}/app/activities?strava_error=1`)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_at, athlete } = tokenData

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })

  await prisma.stravaToken.upsert({
    where: { userId: user.id },
    update: { accessToken: access_token, refreshToken: refresh_token, expiresAt: new Date(expires_at * 1000), stravaAthleteId: athlete.id },
    create: { userId: user.id, accessToken: access_token, refreshToken: refresh_token, expiresAt: new Date(expires_at * 1000), stravaAthleteId: athlete.id },
  })

  // Import last 90 days of activities
  const after = Math.floor(Date.now() / 1000) - 90 * 24 * 3600
  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )

  let synced = 0
  if (activitiesRes.ok) {
    const stravaActivities = await activitiesRes.json()
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
  }

  return Response.redirect(`${appUrl}/app/activities?strava_connected=1&synced=${synced}`)
}
