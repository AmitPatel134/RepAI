import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const dynamic = "force-dynamic"

const GOAL_LABELS: Record<string, string> = {
  prise_de_masse:      "prise de masse musculaire",
  perte_de_poids:      "perte de poids / sèche",
  performance_cardio:  "amélioration des performances cardio",
  sante_cardiaque:     "santé cardiaque et prévention",
  endurance:           "développement de l'endurance",
  force_max:           "développement de la force maximale",
  flexibilite:         "souplesse et mobilité",
  maintien:            "maintien du poids et de la condition physique",
  bien_etre:           "bien-être général et santé",
  competition:         "préparation à la compétition sportive",
  reeducation:         "rééducation et remise en forme",
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire:  "sédentaire (peu ou pas d'exercice)",
  leger:       "légèrement actif (1–3 jours/semaine)",
  modere:      "modérément actif (3–5 jours/semaine)",
  actif:       "très actif (6–7 jours/semaine)",
  tres_actif:  "extrêmement actif (sport intensif + travail physique)",
}

function isPremium(plan: string) {
  return plan === "pro" || plan === "premium" || plan === "premium_plus"
}

// GET — return stored reco (or locked status)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ locked: false, reco: null })

    if (!isPremium(user.plan)) return Response.json({ locked: true })

    return Response.json({
      locked: false,
      reco: user.nutritionReco ?? null,
      generatedAt: user.nutritionRecoAt ?? null,
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

// POST — generate (or regenerate) via AI
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })
    if (!isPremium(user.plan)) return Response.json({ error: "Premium required" }, { status: 403 })

    // ── 1. Deterministic calculation ────────────────────────────────────────
    function calcAge(bd: Date) {
      const today = new Date(); let a = today.getFullYear() - bd.getFullYear()
      const m = today.getMonth() - bd.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) a--
      return a
    }
    const weight = user.weightKg ?? 75
    const height = user.heightCm ?? 170
    const age    = user.birthDate ? calcAge(new Date(user.birthDate)) : 30
    const sex    = user.sex ?? "homme"
    const goal   = user.goal ?? "maintien"
    const level  = user.activityLevel ?? "modere"

    // BMR — Mifflin-St Jeor
    const bmr = sex === "femme"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5

    // TDEE — activity multiplier
    const ACTIVITY_MULT: Record<string, number> = {
      sedentaire: 1.2,
      leger:      1.375,
      modere:     1.55,
      actif:      1.725,
      tres_actif: 1.9,
    }
    const tdee = bmr * (ACTIVITY_MULT[level] ?? 1.55)

    // Calorie target — adjust per goal
    const CALORIE_DELTA: Record<string, number> = {
      prise_de_masse:     350,
      force_max:          200,
      perte_de_poids:    -450,
      bien_etre:         -150,
      maintien:             0,
      performance_cardio:   0,
      endurance:            0,
      sante_cardiaque:      0,
      flexibilite:          0,
      competition:        300,
      reeducation:          0,
    }
    const calories = Math.round(tdee + (CALORIE_DELTA[goal] ?? 0))

    // Macro ratios — % of calories, by goal
    // proteins (4 kcal/g), carbs (4 kcal/g), fats (9 kcal/g)
    const MACRO_RATIOS: Record<string, [number, number, number]> = {
      // goal              [protein%, carb%, fat%]
      prise_de_masse:     [0.30, 0.45, 0.25],
      force_max:          [0.35, 0.40, 0.25],
      perte_de_poids:     [0.40, 0.35, 0.25],
      performance_cardio: [0.20, 0.55, 0.25],
      endurance:          [0.20, 0.55, 0.25],
      competition:        [0.30, 0.45, 0.25],
      sante_cardiaque:    [0.25, 0.45, 0.30],
      bien_etre:          [0.25, 0.45, 0.30],
      maintien:           [0.25, 0.45, 0.30],
      flexibilite:        [0.25, 0.45, 0.30],
      reeducation:        [0.30, 0.40, 0.30],
    }
    const [pPct, cPct, fPct] = MACRO_RATIOS[goal] ?? [0.25, 0.45, 0.30]
    const proteins = Math.round((calories * pPct) / 4)
    const carbs    = Math.round((calories * cPct) / 4)
    const fats     = Math.round((calories * fPct) / 9)
    const fiber    = Math.round(calories / 1000 * 14)   // ~14g per 1000 kcal

    // ── 2. AI for summary only ───────────────────────────────────────────────
    const summaryPrompt = `En 1-2 phrases courtes en français, explique pourquoi ces valeurs nutritionnelles correspondent à ce profil :
- Objectif : ${GOAL_LABELS[goal] ?? goal}
- Niveau d'activité : ${ACTIVITY_LABELS[level] ?? level}
- Calories : ${calories} kcal/jour, Protéines : ${proteins}g, Glucides : ${carbs}g, Lipides : ${fats}g
Réponds avec uniquement les 1-2 phrases, sans titre ni ponctuation superflue.`

    let summary = `Calculé sur la base de ton objectif "${GOAL_LABELS[goal] ?? goal}" et de ton niveau d'activité.`
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: summaryPrompt }],
        max_tokens: 120,
        temperature: 0,
      })
      const raw = completion.choices[0]?.message?.content?.trim()
      if (raw) summary = raw
    } catch (e) {
      console.error("[nutrition-reco POST] groq summary error", e)
      // non-fatal — use default summary
    }

    const reco = { calories, proteins, carbs, fats, fiber, summary }

    try {
      const now = new Date()
      await prisma.user.update({
        where: { email: authUser.email },
        data: { nutritionReco: reco, nutritionRecoAt: now },
      })
      return Response.json({ locked: false, reco, generatedAt: now })
    } catch (e) {
      console.error("[nutrition-reco POST] prisma error", e)
      return Response.json({ error: "DB error", detail: String(e) }, { status: 500 })
    }
  } catch (e) {
    console.error("[nutrition-reco POST]", e)
    return Response.json({ error: "Server error", detail: String(e) }, { status: 500 })
  }
}
