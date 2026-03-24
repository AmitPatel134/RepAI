import { prisma } from "@/lib/prisma"
import { isPro } from "@/lib/plans"
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
      limits: { sessionsPerMonth: 5, mealsPerMonth: 5, coachQuestionsPerWeek: 1 },
    })
  }

  const now = new Date()

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Start of current week (Monday)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon, 6=Sun
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)

  const [workoutsThisMonth, activitiesThisMonth, mealsThisMonth, coachQuestionsThisWeek] = await Promise.all([
    prisma.workout.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.activity.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.meal.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.coachSession.count({ where: { userId: user.id, createdAt: { gte: startOfWeek } } }),
  ])

  const sessionsThisMonth = workoutsThisMonth + activitiesThisMonth
  const plan = user.plan ?? "free"
  const pro = isPro(plan)

  return Response.json({
    plan,
    usage: { sessionsThisMonth, mealsThisMonth, coachQuestionsThisWeek },
    limits: {
      sessionsPerMonth: pro ? null : 5,
      mealsPerMonth: pro ? null : 5,
      coachQuestionsPerWeek: pro ? null : 1,
      exercisesPerWorkout: pro ? null : 3,
    },
  })
}
