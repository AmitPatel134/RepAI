import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

function calcAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json(null)

    const age = user.birthDate ? calcAge(new Date(user.birthDate)) : user.age

    return Response.json({
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      age,
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
    const { birthDate, heightCm, weightKg, sex, goal, activityLevel, restingHR, dailySteps } = body

    const birthDateParsed = birthDate ? new Date(birthDate) : null
    const age = birthDateParsed ? calcAge(birthDateParsed) : null

    const profileComplete = !!(birthDate && heightCm && weightKg && goal)

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {
        birthDate: birthDateParsed,
        age,
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
        birthDate: birthDateParsed,
        age,
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
  } catch (e) {
    console.error("[profile PUT]", e)
    return Response.json({ error: "Database error", detail: String(e) }, { status: 500 })
  }
}
