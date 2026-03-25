import { prisma } from "@/lib/prisma"
import { isPro, isPremiumPlus } from "@/lib/plans"
import { getAuthUser } from "@/lib/authServer"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) {
    return Response.json({
      plan: "free",
      usage: { sessionsThisMonth: 0, mealsThisMonth: 0, coachQuestionsThisWeek: 0 },
      limits: {
        sessionsPerMonth: 5,
        mealsPerMonth: 5,
        coachQuestionsPerWeek: 1,
        historyDays: 7,
        macros: false,
        advancedAI: false,
      },
    })
  }

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)

  const [sessionEvents, mealEvents, actualWorkouts, actualActivities, actualMeals, coachQuestionsThisWeek] = await Promise.all([
    prisma.usageEvent.count({ where: { userId: user.id, type: "session_created", createdAt: { gte: firstOfMonth } } }).catch(() => 0),
    prisma.usageEvent.count({ where: { userId: user.id, type: "meal_analyzed", createdAt: { gte: firstOfMonth } } }).catch(() => 0),
    prisma.workout.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.activity.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.meal.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.coachSession.count({ where: { userId: user.id, createdAt: { gte: startOfWeek } } }),
  ])

  // Use the higher of the two: permanent events counter OR actual saved records
  // — Events count deletions as consumed; records catch legacy data before events existed
  const sessionsThisMonth = Math.max(sessionEvents, actualWorkouts + actualActivities)
  const mealsThisMonth = Math.max(mealEvents, actualMeals)
  const plan = user.plan ?? "free"
  const pro = isPro(plan)
  const plus = isPremiumPlus(plan)

  return Response.json({
    plan,
    usage: { sessionsThisMonth, mealsThisMonth, coachQuestionsThisWeek },
    limits: {
      sessionsPerMonth: pro ? null : 5,
      mealsPerMonth: pro ? null : 5,
      coachQuestionsPerWeek: pro ? null : 1,
      historyDays: pro ? null : 7,
      macros: pro,
      advancedAI: plus,
      exercisesPerWorkout: pro ? null : 3,
    },
  })
}
