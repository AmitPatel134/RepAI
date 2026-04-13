import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 })

export const dynamic = "force-dynamic"

const GOAL_LABELS: Record<string, string> = {
  prise_de_masse:     "prise de masse musculaire",
  perte_de_poids:     "perte de poids / sèche",
  performance_cardio: "amélioration des performances cardio",
  sante_cardiaque:    "santé cardiaque",
  endurance:          "développement de l'endurance",
  force_max:          "développement de la force maximale",
  flexibilite:        "souplesse et mobilité",
  maintien:           "maintien",
  bien_etre:          "bien-être général",
  competition:        "préparation à la compétition",
  reeducation:        "rééducation",
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire: "sédentaire",
  leger:      "légèrement actif (1–3j/semaine)",
  modere:     "modérément actif (3–5j/semaine)",
  actif:      "très actif (6–7j/semaine)",
  tres_actif: "extrêmement actif",
}

function calcBMR(weight: number, height: number, age: number, sex: string): number {
  // Mifflin-St Jeor
  if (sex === "femme") return 10 * weight + 6.25 * height - 5 * age - 161
  return 10 * weight + 6.25 * height - 5 * age + 5
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725, tres_actif: 1.9,
}

const GOAL_ADJUSTMENTS: Record<string, number> = {
  prise_de_masse: 300, perte_de_poids: -400, maintien: 0,
  performance_cardio: 100, endurance: 100, force_max: 200,
  sante_cardiaque: 0, flexibilite: 0, bien_etre: 0,
  competition: 200, reeducation: 0,
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ plan: null, generatedAt: null })

    return Response.json({
      plan: user.mealPlan ?? null,
      generatedAt: user.mealPlanAt ?? null,
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    // Free plan: block AI meal plan generation
    const { isPro, isPremiumPlus } = await import("@/lib/plans")
    const userPlan = user.plan ?? "free"
    if (!isPro(userPlan)) {
      return Response.json({ error: "pro_required" }, { status: 403 })
    }

    // Premium (not Premium+): 7-day cooldown between regenerations
    if (!isPremiumPlus(userPlan) && user.mealPlanAt) {
      const daysSince = (Date.now() - new Date(user.mealPlanAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) {
        const availableAt = new Date(new Date(user.mealPlanAt).getTime() + 7 * 24 * 60 * 60 * 1000)
        return Response.json({ error: "cooldown_active", availableAt }, { status: 403 })
      }
    }

    // Compute calorie/protein targets
    function calcAge(bd: Date) {
      const today = new Date(); let a = today.getFullYear() - bd.getFullYear()
      const m = today.getMonth() - bd.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) a--
      return a
    }

    const weight = user.weightKg ?? 75
    const height = user.heightCm ?? 175
    const age    = user.birthDate ? calcAge(new Date(user.birthDate)) : 30
    const sex    = user.sex ?? "homme"
    const goal   = user.goal ?? "maintien"
    const level  = user.activityLevel ?? "modere"

    // Use stored reco if available, otherwise compute
    let kcalTarget: number
    let proteinsTarget: number

    const stored = user.nutritionReco as { calories?: number; proteins?: number } | null
    if (stored?.calories && stored?.proteins) {
      kcalTarget = stored.calories
      proteinsTarget = stored.proteins
    } else {
      const bmr = calcBMR(weight, height, age, sex)
      const tdee = bmr * (ACTIVITY_MULTIPLIERS[level] ?? 1.55)
      kcalTarget = Math.round(tdee + (GOAL_ADJUSTMENTS[goal] ?? 0))
      const proteinPerKg = goal === "prise_de_masse" || goal === "force_max" ? 2.0
        : goal === "perte_de_poids" ? 2.2
        : 1.6
      proteinsTarget = Math.round(weight * proteinPerKg)
    }

    // Build profile context
    const profileLines: string[] = []
    if (sex) profileLines.push(`Sexe : ${sex}`)
    profileLines.push(`Poids : ${weight} kg`)
    if (user.goal) profileLines.push(`Objectif : ${GOAL_LABELS[user.goal] ?? user.goal}`)
    if (user.activityLevel) profileLines.push(`Niveau : ${ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}`)

    // Calorie split per meal
    const kcalBreakfast = Math.round(kcalTarget * 0.25)
    const kcalLunch     = Math.round(kcalTarget * 0.35)
    const kcalSnack     = Math.round(kcalTarget * 0.10)
    const kcalDinner    = kcalTarget - kcalBreakfast - kcalLunch - kcalSnack

    const optionsCount = isPremiumPlus(userPlan) ? 3 : 2

    // Build meal template for prompt
    const mealTpl = (type: string, kcal: number) =>
      `{"type":"${type}","options":[${Array.from({ length: optionsCount }, () => `{"name":"...","kcal":${kcal},"proteins":0,"description":"..."}`).join(",")}]}`

    const prompt = `Tu es un nutritionniste expert du sport. Génère ${optionsCount} alternatives de repas différentes pour chaque moment de la journée.

Profil :
${profileLines.join("\n")}
Objectif calorique TOTAL : ${kcalTarget} kcal/jour
Protéines cibles TOTAL : ${proteinsTarget}g/jour

Répartition calorique OBLIGATOIRE (respecte ces valeurs exactes) :
- Petit-déjeuner : ${kcalBreakfast} kcal (chaque option)
- Déjeuner : ${kcalLunch} kcal (chaque option)
- Collation : ${kcalSnack} kcal (chaque option)
- Dîner : ${kcalDinner} kcal (chaque option)

RÈGLES :
- Chaque option d'un même type doit avoir des plats DIFFÉRENTS (noms et ingrédients variés).
- Chaque option doit respecter les kcal indiquées pour ce type de repas.
- Si l'objectif est élevé (>2500 kcal), utilise des quantités généreuses.
- Si l'objectif est de prise de masse, ajoute un shaker protéiné dans le champ "shaker".
- Repas simples, courants en France, faciles à préparer.
- description : ingrédients principaux avec quantités précises (ex: "200g poulet, 150g riz cuit, 2 cs huile d'olive").

Réponds UNIQUEMENT avec du JSON valide (structure exacte) :
{"kcalTarget":${kcalTarget},"proteinsTarget":${proteinsTarget},"meals":[${mealTpl("Petit-déjeuner", kcalBreakfast)},${mealTpl("Déjeuner", kcalLunch)},${mealTpl("Collation", kcalSnack)},${mealTpl("Dîner", kcalDinner)}],"shaker":{"name":"...","kcal":0,"proteins":0,"description":"..."}}`

    type MealOption = { name: string; kcal: number; proteins: number; description: string }
    type MealPlanPayload = {
      kcalTarget: number
      proteinsTarget: number
      meals: Array<{ type: string; options: MealOption[] }>
      shaker?: { name: string; kcal: number; proteins: number; description: string } | null
    }

    let resultPlan: MealPlanPayload | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Tu es un nutritionniste expert du sport. Tu réponds uniquement avec du JSON valide, sans texte avant ni après. Tu respectes TOUJOURS les totaux caloriques demandés." },
          { role: "user", content: prompt },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response_format: { type: "json_object" } as any,
        max_tokens: 2000,
        temperature: 0.5,
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? ""
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) continue
      try {
        const parsed = JSON.parse(match[0]) as Partial<MealPlanPayload>
        if (!parsed.meals || parsed.meals.length === 0) continue

        // Validate: each meal must have at least 1 option
        if (parsed.meals.some(m => !m.options || m.options.length === 0)) continue

        // Validate calorie total of first options — must be within 15% of target
        const total = parsed.meals.reduce((s, m) => s + (m.options[0]?.kcal ?? 0), 0)
        if (Math.abs(total - kcalTarget) > kcalTarget * 0.15) continue

        resultPlan = parsed as MealPlanPayload
        break
      } catch { continue }
    }

    if (!resultPlan) return Response.json({ error: "generation_failed" }, { status: 500 })

    const now = new Date()
    await prisma.user.update({
      where: { email: authUser.email },
      data: { mealPlan: resultPlan, mealPlanAt: now },
    })

    return Response.json({ plan: resultPlan, generatedAt: now })
  } catch (e) {
    console.error("[meal-plan POST]", e)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
