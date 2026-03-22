import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json(null)

    return Response.json({
      age: user.age,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      sex: user.sex,
      goal: user.goal,
      activityLevel: user.activityLevel,
      restingHR: user.restingHR,
      dailySteps: user.dailySteps,
      profileComplete: user.profileComplete,
    })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { age, heightCm, weightKg, sex, goal, activityLevel, restingHR, dailySteps } = body

    const profileComplete = !!(age && heightCm && weightKg && goal)

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {
        age: age ? Number(age) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        sex: sex || null,
        goal: goal || null,
        activityLevel: activityLevel || null,
        restingHR: restingHR ? Number(restingHR) : null,
        dailySteps: dailySteps ? Number(dailySteps) : null,
        profileComplete,
      },
      create: {
        email: authUser.email,
        age: age ? Number(age) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        sex: sex || null,
        goal: goal || null,
        activityLevel: activityLevel || null,
        restingHR: restingHR ? Number(restingHR) : null,
        dailySteps: dailySteps ? Number(dailySteps) : null,
        profileComplete,
      },
    })

    return Response.json({ ok: true, profileComplete: user.profileComplete })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
