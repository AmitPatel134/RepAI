import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) {
      return Response.json({
        workouts: [],
        volumeChart: [],
        stats: { totalWorkouts: 0, workoutsThisWeek: 0, totalVolume: 0, volumeThisWeek: 0, prsThisMonth: 0, currentStreak: 0 },
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const [recentWorkouts, weekWorkouts, monthWorkouts, allWorkouts] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 6,
        include: {
          exercises: {
            include: { sets: true },
          },
        },
      }),
      prisma.workout.count({ where: { userId: user.id, date: { gte: startOfWeek } } }),
      prisma.workout.count({ where: { userId: user.id, date: { gte: startOfMonth } } }),
      prisma.workout.findMany({
        where: { userId: user.id, date: { gte: sevenDaysAgo } },
        include: {
          exercises: { include: { sets: true } },
        },
      }),
    ])

    // Calculate total volume
    function calcVolume(workouts: typeof allWorkouts) {
      return workouts.reduce((total, w) =>
        total + w.exercises.reduce((et, ex) =>
          et + ex.sets.reduce((st, s) => st + (s.reps ?? 0) * (s.weight ?? 0), 0), 0), 0)
    }

    const volumeThisWeek = calcVolume(allWorkouts.filter(w => w.date >= startOfWeek))

    // Build 7-day volume chart
    const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
    const volumeChart = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)
      const dayWorkouts = allWorkouts.filter(w => w.date >= d && w.date < nextDay)
      const volume = calcVolume(dayWorkouts)
      return { date: DAY_LABELS[d.getDay()], volume }
    })

    return Response.json({
      workouts: recentWorkouts,
      volumeChart,
      stats: {
        totalWorkouts: monthWorkouts,
        workoutsThisWeek: weekWorkouts,
        totalVolume: calcVolume(allWorkouts),
        volumeThisWeek,
        prsThisMonth: 0,
        currentStreak: weekWorkouts,
      },
    })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
