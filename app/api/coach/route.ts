import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

export const dynamic = "force-dynamic"

const GOAL_LABELS: Record<string, string> = {
  prise_de_masse: "prise de masse musculaire",
  perte_de_poids: "perte de poids / sèche",
  performance_cardio: "amélioration des performances cardio",
  sante_cardiaque: "santé cardiaque et prévention",
  endurance: "développement de l'endurance",
  force_max: "développement de la force maximale",
  flexibilite: "souplesse et mobilité",
  maintien: "maintien du poids et de la condition physique",
  bien_etre: "bien-être général et santé",
  competition: "préparation à la compétition sportive",
  reeducation: "rééducation et remise en forme",
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire: "sédentaire (peu ou pas d'exercice)",
  leger: "légèrement actif (1–3 jours/semaine)",
  modere: "modérément actif (3–5 jours/semaine)",
  actif: "très actif (6–7 jours/semaine)",
  tres_actif: "extrêmement actif (sport intensif + travail physique)",
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json([])

    const sessions = await prisma.coachSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return Response.json(sessions)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { question, workoutContext, activityContext, nutritionContext } = await request.json()
    if (!question?.trim()) return Response.json({ error: "Question required" }, { status: 400 })

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

    const { isPro, isPremiumPlus } = await import("@/lib/plans")
    const plan = user.plan ?? "free"
    const pro = isPro(plan)
    const plus = isPremiumPlus(plan)

    // Enforce weekly question limit for free plan
    if (!pro) {
      const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
      const startOfWeek = new Date()
      startOfWeek.setDate(new Date().getDate() - dayOfWeek)
      startOfWeek.setHours(0, 0, 0, 0)
      const questionsThisWeek = await prisma.coachSession.count({
        where: { userId: user.id, createdAt: { gte: startOfWeek } },
      })
      if (questionsThisWeek >= 1) {
        return Response.json({ error: "weekly_limit_reached" }, { status: 429 })
      }
    }

    // Build profile context
    const profileLines: string[] = []
    if (user.sex) profileLines.push(`Sexe : ${user.sex}`)
    if (user.age) profileLines.push(`Âge : ${user.age} ans`)
    if (user.heightCm) profileLines.push(`Taille : ${user.heightCm} cm`)
    if (user.weightKg) {
      profileLines.push(`Poids : ${user.weightKg} kg`)
      if (user.heightCm) {
        const bmi = (user.weightKg / Math.pow(user.heightCm / 100, 2)).toFixed(1)
        profileLines.push(`IMC : ${bmi}`)
      }
    }
    if (user.goal) profileLines.push(`Objectif : ${GOAL_LABELS[user.goal] ?? user.goal}`)
    if (user.activityLevel) profileLines.push(`Niveau : ${ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}`)
    if (user.restingHR) profileLines.push(`FC repos : ${user.restingHR} bpm`)
    if (user.dailySteps) profileLines.push(`Pas/jour : ${user.dailySteps.toLocaleString("fr-FR")}`)

    const profileContext = profileLines.length > 0
      ? `--- Profil ---\n${profileLines.join("\n")}`
      : ""

    // System prompt varies by plan tier
    let systemPrompt: string
    let maxTokens: number
    let temperature: number

    if (!pro) {
      // FREE — generic, short, encouraging
      systemPrompt = `Tu es un assistant sportif bienveillant. Donne une réponse simple, courte et encourageante en 2-3 phrases maximum. Reste positif et générique. Ne fais pas d'analyse approfondie. Réponds en français.`
      maxTokens = 120
      temperature = 0.7
    } else if (!plus) {
      // PREMIUM — useful tips, concrete advice
      systemPrompt = `Tu es un coach sportif et nutritionnel. Analyse les données récentes de l'utilisateur et donne des conseils concrets et actionnables.
Règles :
- Réponds en français, max 200 mots.
- Utilise le markdown (gras, listes courtes).
- Personnalise selon le profil.
- Donne des recommandations pratiques directes.
- Si une donnée manque, indique-le brièvement.`
      maxTokens = 350
      temperature = 0.5
    } else {
      // PREMIUM+ — deep analysis, patterns, predictions
      systemPrompt = `Tu es un coach sportif et nutritionniste expert d'élite. Tu analyses l'historique complet pour détecter des patterns, corréler sport/nutrition/récupération, anticiper la fatigue ou la stagnation, et fournir des recommandations ultra-personnalisées.

RÈGLES STRICTES :
- Réponds en français, de façon concise et directe (max 220 mots).
- Utilise le markdown (gras, listes) pour structurer.
- Détecte les patterns et corrélations entre les données (nutrition ↔ performance ↔ récupération).
- Donne des prédictions ou anticipations quand les données le permettent.
- Calcule des valeurs concrètes (calories cibles, fréquences, charges recommandées).
- Personnalise TOUJOURS selon le profil (âge, poids, objectif, niveau).
- N'invente jamais de données. Sois direct et honnête.`
      maxTokens = 600
      temperature = 0.5
    }

    // Context depth varies by plan
    const contextParts: string[] = []
    if (pro && profileContext) contextParts.push(profileContext)
    if (workoutContext) contextParts.push(`--- Séances musculation ---\n${workoutContext}`)
    if (pro && activityContext) contextParts.push(`--- Activités cardio ---\n${activityContext}`)
    if (pro && nutritionContext) contextParts.push(`--- Alimentation ---\n${nutritionContext}`)
    const fullContext = contextParts.join("\n\n")

    const userPrompt = fullContext
      ? `Voici mes données :\n\n${fullContext}\n\nMa question : ${question}`
      : question

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    })

    const response = completion.choices[0].message.content ?? ""

    const session = await prisma.coachSession.create({
      data: { userId: user.id, question: question.trim(), response },
    })

    return Response.json(session)
  } catch {
    return Response.json({ error: "AI error" }, { status: 500 })
  }
}
