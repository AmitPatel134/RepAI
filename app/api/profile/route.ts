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

    const age = user.birthDate ? calcAge(new Date(user.birthDate)) : null

    return Response.json({
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      age, // computed on-the-fly from birthDate
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

const VALID_SEX    = new Set(["homme", "femme", "autre"])
const VALID_GOAL   = new Set(["prise_de_masse","perte_de_poids","performance_cardio","sante_cardiaque","endurance","force_max","flexibilite","maintien","bien_etre","competition","reeducation"])
const VALID_LEVELS = new Set(["sedentaire","leger","modere","actif","tres_actif"])

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { birthDate, heightCm, weightKg, sex, goal, activityLevel, restingHR, dailySteps } = body

    // Validate enum fields
    if (sex && !VALID_SEX.has(sex))           return Response.json({ error: "Invalid sex" }, { status: 400 })
    if (goal && !VALID_GOAL.has(goal))         return Response.json({ error: "Invalid goal" }, { status: 400 })
    if (activityLevel && !VALID_LEVELS.has(activityLevel)) return Response.json({ error: "Invalid activityLevel" }, { status: 400 })

    // Validate numeric ranges
    const h = heightCm ? Number(heightCm) : null
    const w = weightKg ? Number(weightKg) : null
    const hr = restingHR ? Number(restingHR) : null
    const steps = dailySteps ? Number(dailySteps) : null
    if (h !== null && (isNaN(h) || h < 50 || h > 300))         return Response.json({ error: "Invalid heightCm" }, { status: 400 })
    if (w !== null && (isNaN(w) || w < 20 || w > 500))          return Response.json({ error: "Invalid weightKg" }, { status: 400 })
    if (hr !== null && (isNaN(hr) || hr < 20 || hr > 250))      return Response.json({ error: "Invalid restingHR" }, { status: 400 })
    if (steps !== null && (isNaN(steps) || steps < 0 || steps > 100000)) return Response.json({ error: "Invalid dailySteps" }, { status: 400 })

    const birthDateParsed = birthDate ? new Date(birthDate) : null
    if (birthDateParsed && isNaN(birthDateParsed.getTime())) return Response.json({ error: "Invalid birthDate" }, { status: 400 })

    const profileComplete = !!(birthDate && heightCm && weightKg && goal)

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {
        birthDate: birthDateParsed,
        heightCm: h,
        weightKg: w,
        sex: sex || null,
        goal: goal || null,
        activityLevel: activityLevel || null,
        restingHR: hr,
        dailySteps: steps,
        profileComplete,
      },
      create: {
        email: authUser.email,
        birthDate: birthDateParsed,
        heightCm: h,
        weightKg: w,
        sex: sex || null,
        goal: goal || null,
        activityLevel: activityLevel || null,
        restingHR: hr,
        dailySteps: steps,
        profileComplete,
      },
    })

    return Response.json({ ok: true, profileComplete: user.profileComplete })
  } catch (e) {
    console.error("[profile PUT]", e)
    return Response.json({ error: "Database error", detail: String(e) }, { status: 500 })
  }
}
