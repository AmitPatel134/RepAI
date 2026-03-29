import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ recommendation: null, lastWorkout: null, thisWeek: 0 })

    // Fetch last 60 days of workouts
    const since = new Date()
    since.setDate(since.getDate() - 60)

    const workouts = await prisma.workout.findMany({
      where: { userId: user.id, date: { gte: since } },
      include: { exercises: { include: { sets: true } } },
      orderBy: { date: "desc" },
    })

    if (workouts.length === 0) {
      return Response.json({ recommendation: null, lastWorkout: null, thisWeek: 0 })
    }

    // Current week (Mon → today)
    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek)
    monday.setHours(0, 0, 0, 0)

    const thisWeekWorkouts = workouts.filter(w => new Date(w.date) >= monday)
    const lastWorkout = workouts[0]

    // Also fetch the most recent activity (cardio/other)
    const lastActivity = await prisma.activity.findFirst({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    })

    // Pick whichever is more recent — workout or activity
    const lastWorkoutDate = new Date(lastWorkout.date).getTime()
    const lastActivityDate = lastActivity ? new Date(lastActivity.date).getTime() : 0
    const totalSets = lastWorkout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)

    const lastSession = lastActivityDate > lastWorkoutDate && lastActivity
      ? {
          kind: "activity" as const,
          id: lastActivity.id,
          name: lastActivity.name,
          type: lastActivity.type,
          date: lastActivity.date,
          durationSec: lastActivity.durationSec ?? null,
          distanceM: lastActivity.distanceM ?? null,
          calories: lastActivity.calories ?? null,
          avgHeartRate: lastActivity.avgHeartRate ?? null,
        }
      : {
          kind: "workout" as const,
          id: lastWorkout.id,
          name: lastWorkout.name,
          type: lastWorkout.type,
          date: lastWorkout.date,
          exerciseCount: lastWorkout.exercises.length,
          totalSets,
        }

    // Build prompt — frequency-based, no types
    const recentNames = workouts.slice(0, 5).map(w => `- ${w.name} (${new Date(w.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })})`).join("\n")
    const prompt = `Tu es un coach sportif. Donne un conseil très court (1-2 phrases max) de motivation ou sur la prochaine séance.

Séances récentes :
${recentNames || "- Aucune"}
Cette semaine : ${thisWeekWorkouts.length} séance${thisWeekWorkouts.length > 1 ? "s" : ""}

Sois direct et motivant, sans markdown.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Coach sportif concis. Réponds en français, 1-2 phrases max, sans formatage." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 120,
    })

    const recommendation = completion.choices[0].message.content?.trim() ?? null

    return Response.json({
      recommendation,
      lastSession,
      thisWeek: thisWeekWorkouts.length,
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
