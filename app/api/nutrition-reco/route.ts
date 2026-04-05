import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 })

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
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })
    if (!isPremium(user.plan)) return Response.json({ error: "Premium required" }, { status: 403 })

    function calcAge(bd: Date) {
      const today = new Date(); let a = today.getFullYear() - bd.getFullYear()
      const m = today.getMonth() - bd.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) a--
      return a
    }

    const weight = user.weightKg ?? null
    const height = user.heightCm ?? null
    const age    = user.birthDate ? calcAge(new Date(user.birthDate)) : null
    const sex    = user.sex ?? null
    const goal   = user.goal ?? "maintien"
    const level  = user.activityLevel ?? "modere"

    const profileLines: string[] = []
    if (sex)    profileLines.push(`Sexe : ${sex}`)
    if (age)    profileLines.push(`Âge : ${age} ans`)
    if (weight) profileLines.push(`Poids : ${weight} kg`)
    if (height) profileLines.push(`Taille : ${height} cm`)
    if (weight && height) {
      const bmi = (weight / Math.pow(height / 100, 2)).toFixed(1)
      profileLines.push(`IMC : ${bmi}`)
    }
    profileLines.push(`Objectif : ${GOAL_LABELS[goal] ?? goal}`)
    profileLines.push(`Niveau d'activité : ${ACTIVITY_LABELS[level] ?? level}`)
    if (user.restingHR)  profileLines.push(`Fréquence cardiaque au repos : ${user.restingHR} bpm`)
    if (user.dailySteps) profileLines.push(`Pas par jour : ${user.dailySteps}`)

    const prompt = `Tu es un nutritionniste expert du sport. Calcule les besoins nutritionnels journaliers exacts pour ce profil :

${profileLines.join("\n")}

Réponds UNIQUEMENT avec un objet JSON valide sur une seule ligne, sans texte avant ni après, sans markdown, sans explication :
{"calories":0,"proteins":0,"carbs":0,"fats":0,"fiber":0,"summary":"..."}

Règles de calcul :
- Calories : BMR (Mifflin-St Jeor) × coefficient d'activité, ajusté selon l'objectif
- Protéines : basées sur le poids corporel en g/kg selon l'objectif (jamais plus de 2.4g/kg)
- Lipides : basés sur le poids corporel en g/kg (minimum 0.8g/kg)
- Glucides : calories restantes après protéines et lipides
- Fibres : environ 14g par 1000 kcal
- summary : 1 phrase en français expliquant les valeurs, sans citer les chiffres`

    type RecoPayload = { calories: number; proteins: number; carbs: number; fats: number; fiber: number; summary: string }

    let reco: RecoPayload | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Tu es un calculateur nutritionnel précis. Tu réponds uniquement avec du JSON valide, rien d'autre." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0,
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? ""
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) continue

      let parsed: Partial<RecoPayload>
      try { parsed = JSON.parse(match[0]) } catch { continue }

      const { calories, proteins, carbs, fats, fiber, summary } = parsed
      if (!calories || !proteins || !carbs || !fats) continue

      reco = {
        calories: Math.round(calories),
        proteins: Math.round(proteins),
        carbs:    Math.round(carbs),
        fats:     Math.round(fats),
        fiber:    Math.round(fiber ?? Math.round((calories / 1000) * 14)),
        summary:  summary ?? "",
      }
      break
    }

    if (!reco) return Response.json({ error: "incomplete_reco" }, { status: 500 })

    const now = new Date()
    await prisma.user.update({
      where: { email: authUser.email },
      data: { nutritionReco: reco, nutritionRecoAt: now },
    })

    return Response.json({ locked: false, reco, generatedAt: now })
  } catch (e) {
    console.error("[nutrition-reco POST]", e)
    return Response.json({ error: "Server error", detail: String(e) }, { status: 500 })
  }
}
