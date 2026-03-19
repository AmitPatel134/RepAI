import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<string, string> = {
  fullbody: "Full Body", push: "Push", pull: "Pull", legs: "Legs",
  upper: "Upper Body", lower: "Lower Body", cardio: "Cardio", hiit: "HIIT",
  mobility: "Mobilité", crossfit: "CrossFit", force: "Force", dos: "Dos",
  bras: "Bras", epaules: "Épaules", abdos: "Abdominaux",
}

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
    const pastWorkouts = workouts.filter(w => new Date(w.date) < monday)

    // Detect habitual types (done in ≥50% of past weeks)
    const weekMap: Record<string, Set<string>> = {}
    for (const w of pastWorkouts) {
      const d = new Date(w.date)
      const dow = (d.getDay() + 6) % 7
      const mon = new Date(d)
      mon.setDate(d.getDate() - dow)
      const key = mon.toISOString().slice(0, 10)
      if (!weekMap[key]) weekMap[key] = new Set()
      weekMap[key].add(w.type)
    }

    const numWeeks = Object.keys(weekMap).length || 1
    const typeWeekCount: Record<string, number> = {}
    for (const types of Object.values(weekMap)) {
      for (const t of types) {
        typeWeekCount[t] = (typeWeekCount[t] ?? 0) + 1
      }
    }

    const habitualTypes = Object.entries(typeWeekCount)
      .filter(([, c]) => c / numWeeks >= 0.5)
      .map(([t]) => t)

    const thisWeekTypes = thisWeekWorkouts.map(w => w.type)
    const missingHabitual = habitualTypes.filter(t => !thisWeekTypes.includes(t))
    const lastWorkout = workouts[0]

    // Build prompt
    const habitLines = Object.entries(typeWeekCount)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `- ${TYPE_LABELS[t] ?? t} : ${(c / numWeeks).toFixed(1)}x/semaine`)
      .join("\n")

    const prompt = `Tu es un coach sportif. Donne un conseil très court (2 phrases max) sur la prochaine séance à faire.

Habitudes (${numWeeks} semaine(s)) :
${habitLines || "- Pas assez de données"}

Cette semaine : ${thisWeekTypes.map(t => TYPE_LABELS[t] ?? t).join(", ") || "aucune séance"}
Manquants habituels : ${missingHabitual.map(t => TYPE_LABELS[t] ?? t).join(", ") || "aucun"}
Dernière séance : ${TYPE_LABELS[lastWorkout.type] ?? lastWorkout.type} le ${new Date(lastWorkout.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}

Règle absolue : ne suggère que des types déjà dans ses habitudes. Sois direct, 1-2 phrases, sans markdown.`

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
      lastWorkout: { name: lastWorkout.name, type: lastWorkout.type, date: lastWorkout.date },
      thisWeek: thisWeekWorkouts.length,
      habitualTypes,
      missingHabitual,
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
