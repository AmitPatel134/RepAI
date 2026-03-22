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

    // Fetch user profile for personalization
    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

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
    if (user.goal) profileLines.push(`Objectif principal : ${GOAL_LABELS[user.goal] ?? user.goal}`)
    if (user.activityLevel) profileLines.push(`Niveau d'activité : ${ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}`)
    if (user.restingHR) profileLines.push(`Fréquence cardiaque au repos : ${user.restingHR} bpm`)
    if (user.dailySteps) profileLines.push(`Nombre de pas quotidiens moyen : ${user.dailySteps.toLocaleString("fr-FR")} pas/jour`)

    const profileContext = profileLines.length > 0
      ? `--- Profil de l'utilisateur ---\n${profileLines.join("\n")}`
      : ""

    const systemPrompt = `Tu es un coach sportif et nutritionniste expert. Tu analyses les données réelles de l'utilisateur pour donner des conseils ultra-personnalisés.

RÈGLES STRICTES :
- Réponds en français, de façon courte et directe (max 150-200 mots par réponse).
- Utilise le markdown (gras, listes) pour structurer.
- Personnalise TOUJOURS en fonction du profil fourni (âge, poids, objectif, niveau d'activité).
- Base-toi sur les données concrètes fournies (séances, activités, repas). Si une donnée manque pour répondre précisément, dis-le explicitement : "Je n'ai pas tes données de [X] pour répondre précisément."
- N'invente jamais de données. Ne donne pas de conseils génériques quand tu peux être précis.
- Sois direct et honnête, même si la réponse n'est pas celle attendue.
- Calcule des valeurs concrètes quand c'est possible (calories cibles, fréquences cardiaques cibles, charges recommandées, etc.).`

    const contextParts: string[] = []
    if (profileContext) contextParts.push(profileContext)
    if (workoutContext) contextParts.push(`--- Séances de musculation (récentes) ---\n${workoutContext}`)
    if (activityContext) contextParts.push(`--- Activités cardio (récentes) ---\n${activityContext}`)
    if (nutritionContext) contextParts.push(`--- Alimentation (récente) ---\n${nutritionContext}`)
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
      temperature: 0.5,
      max_tokens: 600,
    })

    const response = completion.choices[0].message.content ?? ""

    const session = await prisma.coachSession.create({
      data: {
        userId: user.id,
        question: question.trim(),
        response,
      },
    })

    return Response.json(session)
  } catch {
    return Response.json({ error: "AI error" }, { status: 500 })
  }
}
