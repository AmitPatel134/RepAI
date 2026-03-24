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
      usage: { workoutsThisMonth: 0 },
      limits: { workoutsPerMonth: 5 },
    })
  }

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const [workoutsThisMonth, activitiesThisMonth] = await Promise.all([
    prisma.workout.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
    prisma.activity.count({ where: { userId: user.id, createdAt: { gte: firstOfMonth } } }),
  ])
  const sessionsThisMonth = workoutsThisMonth + activitiesThisMonth

  const plan = user.plan ?? "free"
  const pro = isPro(plan)

  return Response.json({
    plan,
    usage: { workoutsThisMonth: sessionsThisMonth },
    limits: {
      workoutsPerMonth: pro ? null : 5,
      exercisesPerWorkout: pro ? null : 3,
    },
  })
}
