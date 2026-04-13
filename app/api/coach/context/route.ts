import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { isPro, isPremiumPlus } from "@/lib/plans"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

function calcAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

// Returns the upcoming Monday ISO date string (used to display quota reset date)
function nextMonday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0 … Sun=6
  const daysUntilMonday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ plan: "free", usage: { coachQuestionsThisWeek: 0 }, weekResetDate: nextMonday() })

    const plan = user.plan ?? "free"
    const pro = isPro(plan)
    const plus = isPremiumPlus(plan)

    // Quota check windows
    const now = new Date()
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const [workouts, activities, meals, coachSessions, coachQuestionsThisWeek, coachQuestionsToday] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 5,
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { sets: { orderBy: { order: "asc" } } },
          },
        },
      }),
      prisma.activity.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 5,
        select: { type: true, name: true, date: true, distanceM: true, durationSec: true, avgHeartRate: true, avgPaceSecKm: true },
      }),
      prisma.meal.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 10,
        select: { name: true, date: true, calories: true, proteins: true, carbs: true, fats: true },
      }),
      prisma.coachSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
      prisma.coachSession.count({ where: { userId: user.id, createdAt: { gte: startOfWeek } } }),
      prisma.coachSession.count({ where: { userId: user.id, createdAt: { gte: startOfDay } } }),
    ])

    // Build workout context string
    const workoutContext = workouts.map(w =>
      `Séance: ${w.name} (${w.date.toISOString().slice(0, 10)}) — ${
        w.exercises.map(e => `${e.name}: ${e.sets.map(s => `${s.reps}×${s.weight}kg`).join(", ")}`).join(" | ")
      }`
    ).join("\n")

    // Build activity context string
    const activityContext = activities.map(a => {
      const parts = [
        a.distanceM ? `${(a.distanceM / 1000).toFixed(1)}km` : null,
        a.durationSec ? `${Math.floor(a.durationSec / 60)}min` : null,
        a.avgHeartRate ? `FC ${a.avgHeartRate}bpm` : null,
        a.avgPaceSecKm ? `allure ${Math.floor(a.avgPaceSecKm / 60)}'${(a.avgPaceSecKm % 60).toString().padStart(2, "0")}"/km` : null,
      ].filter(Boolean).join(", ")
      return `${a.type} "${a.name}" (${a.date.toISOString().slice(0, 10)})${parts ? ` : ${parts}` : ""}`
    }).join("\n")

    // Build nutrition context string
    const today = now.toISOString().slice(0, 10)
    const todayCal = meals.filter(m => m.date.toISOString().slice(0, 10) === today).reduce((s, m) => s + (m.calories ?? 0), 0)
    const nutritionContext = (todayCal > 0 ? `Calories aujourd'hui : ${todayCal} kcal\n` : "") +
      meals.map(m => {
        const parts = [
          m.calories ? `${m.calories} kcal` : null,
          m.proteins ? `P: ${Math.round(m.proteins)}g` : null,
          m.carbs ? `G: ${Math.round(m.carbs)}g` : null,
          m.fats ? `L: ${Math.round(m.fats)}g` : null,
        ].filter(Boolean).join(", ")
        return `${m.name} (${m.date.toISOString().slice(0, 10)})${parts ? ` — ${parts}` : ""}`
      }).join("\n")

    // Profile info for premium+ context
    const age = user.birthDate ? calcAge(new Date(user.birthDate)) : null

    // Tomorrow midnight for daily reset display
    const tomorrow = new Date(startOfDay)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return Response.json({
      plan,
      usage: { coachQuestionsThisWeek, coachQuestionsToday },
      weekResetDate: nextMonday(),
      dayResetDate: tomorrow.toISOString().slice(0, 10),
      // Premium: workouts only. Premium+: full cross-analysis context.
      workoutContext: pro ? workoutContext : workouts.slice(0, 3).map(w => `Séance: ${w.name} (${w.date.toISOString().slice(0, 10)})`).join("\n"),
      activityContext: plus ? activityContext : "",
      nutritionContext: plus ? nutritionContext : "",
      lastSession: coachSessions[0] ?? null,
      profile: pro ? {
        sex: user.sex, age, heightCm: user.heightCm, weightKg: user.weightKg,
        goal: user.goal, activityLevel: user.activityLevel,
        restingHR: user.restingHR, dailySteps: user.dailySteps,
      } : null,
    })
  } catch (e) {
    console.error("[coach/context GET]", e)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
