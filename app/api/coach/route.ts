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

    // Enforce input length limits — prevents prompt injection and token exhaustion
    const MAX_QUESTION = 2_000
    const MAX_CONTEXT  = 20_000
    if (question.trim().length > MAX_QUESTION) {
      return Response.json({ error: "Question trop longue (max 2 000 caractères)" }, { status: 400 })
    }
    if (
      (workoutContext?.length  ?? 0) > MAX_CONTEXT ||
      (activityContext?.length ?? 0) > MAX_CONTEXT ||
      (nutritionContext?.length ?? 0) > MAX_CONTEXT
    ) {
      return Response.json({ error: "Contexte trop volumineux" }, { status: 400 })
    }

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

    const { isPro, isPremiumPlus } = await import("@/lib/plans")
    const plan = user.plan ?? "free"
    const pro = isPro(plan)
    const plus = isPremiumPlus(plan)

    // Enforce question limits per plan tier
    if (!pro) {
      // Free: 1/week
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
    } else if (!plus) {
      // Premium: 1/day
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const questionsToday = await prisma.coachSession.count({
        where: { userId: user.id, createdAt: { gte: startOfDay } },
      })
      if (questionsToday >= 1) {
        return Response.json({ error: "daily_limit_reached" }, { status: 429 })
      }
    }
    // Premium+: unlimited

    // Build profile context
    function calcAge(bd: Date) {
      const today = new Date(); let a = today.getFullYear() - bd.getFullYear()
      const m = today.getMonth() - bd.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) a--
      return a
    }
    const age = user.birthDate ? calcAge(new Date(user.birthDate)) : null

    const profileLines: string[] = []
    if (user.sex) profileLines.push(`Sexe : ${user.sex}`)
    if (age) profileLines.push(`Âge : ${age} ans`)
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

    const baseRules = `
🚫 HORS-SUJET : Si la question ne porte pas sur le sport, l'entraînement, la nutrition, la santé physique ou la récupération, réponds UNIQUEMENT avec cette phrase, sans titre ni section markdown : "Je suis spécialisé en sport et nutrition — pose-moi une question dans ces domaines et je ferai de mon mieux pour t'aider ! 💪"

⛔ INTERDIT ABSOLU SUR LA NUTRITION :
L'utilisateur ne logue PAS tous ses repas — les repas enregistrés sont des exemples, pas un journal complet.
Il est STRICTEMENT INTERDIT de :
- Calculer ou citer une consommation calorique totale ("963 kcal", "votre apport actuel", etc.)
- Dire que la consommation est insuffisante ou excessive en se basant sur les repas enregistrés
- Traiter les repas enregistrés comme représentatifs de toute l'alimentation
À la place : analyse UNIQUEMENT la qualité des plats enregistrés (composition, pertinence par rapport à l'objectif, fréquence). Ex : "Ce plat à 200 kcal est léger — si tu le manges souvent, pense à l'enrichir en protéines pour ta prise de masse."

RÈGLES ABSOLUES :
- Ne mentionne JAMAIS les données manquantes, ce que tu analyses, ou tes sources.
- Ne commence jamais par "D'après tes données", "Je vois que", "Basé sur" ou similaire.
- Va directement au conseil utile et actionnable.
- Réponds en français. Utilise le gras et les listes courtes avec des tirets (-), jamais des astérisques (*) pour les listes.
- TOUJOURS calculer des valeurs concrètes avec le profil disponible. Si l'utilisateur pèse 80 kg, ne jamais écrire "1,6–2,2g/kg" — écrire directement "128–176g de protéines par jour". Applique les formules toi-même avec les données du profil.`

    const questionPriority = `
⚠️ PRIORITÉ ABSOLUE : Lis attentivement la question posée et réponds-y directement et précisément. Si on te demande des calories, réponds avec des calories. Si on te demande des protéines, réponds avec des protéines. Ne réponds JAMAIS à côté de la question.
Les titres de tes sections doivent refléter le contenu de ta réponse à CETTE question spécifique — ne réutilise pas des titres génériques.`

    const subtitleRule = `
FORMAT OBLIGATOIRE pour chaque section :
## Titre de la section
> true | Phrase clé de 8 à 10 mots, concrète et directement liée à la question.
Corps du texte...

OU si résumer en 10 mots n'apporte rien d'utile (ex: section introductive, explication pure sans chiffre clé) :
## Titre de la section
> false
Corps du texte...

RÈGLES :
- La ligne > est OBLIGATOIRE après chaque ## titre, toujours au format "> true | phrase" ou "> false".
- "true" uniquement si la phrase apporte une info concrète et utile (chiffre, action, recommandation clé).
- "false" si la section est trop nuancée ou introductive pour se résumer en 10 mots.
- Ne jamais mettre de données hors-sujet dans la phrase (ex: pas de macros si la question porte sur l'entraînement).`

    if (!pro) {
      // FREE — 2 sections, titles free
      systemPrompt = `Tu es un coach sportif expert. Réponds avec exactement 2 sections markdown (## Titre) dont les titres sont adaptés à la question.
Max 80 mots au total. Sois direct et encourageant.${subtitleRule}${questionPriority}${baseRules}`
      maxTokens = 180
      temperature = 0.7
    } else if (!plus) {
      // PREMIUM — 2-3 sections, titles free
      systemPrompt = `Tu es un coach sportif et nutritionnel expert. Réponds avec 2 à 3 sections markdown (## Titre) dont les titres sont choisis librement selon la question.
Max 200 mots au total.${subtitleRule}${questionPriority}${baseRules}`
      maxTokens = 420
      temperature = 0.5
    } else {
      // PREMIUM+ — 2-3 sections, highly personalized, titles free
      systemPrompt = `Tu es un coach sportif et nutritionniste expert d'élite. Réponds avec 2 à 3 sections markdown (## Titre) dont les titres sont choisis librement selon la question, avec des valeurs concrètes calculées.
Max 250 mots. Calcule des valeurs concrètes (charges, fréquences, calories) quand c'est possible.${subtitleRule}${questionPriority}${baseRules}`
      maxTokens = 650
      temperature = 0.5
    }

    // Context depth varies by plan: premium+ gets full cross-analysis, premium gets workouts only
    const contextParts: string[] = []
    if (pro && profileContext) contextParts.push(profileContext)
    if (workoutContext) contextParts.push(`--- Séances musculation ---\n${workoutContext}`)
    if (plus && activityContext) contextParts.push(`--- Activités cardio ---\n${activityContext}`)
    if (plus && nutritionContext) contextParts.push(`--- Alimentation ---\n${nutritionContext}`)
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
  } catch (e) {
    console.error("[coach POST]", e)
    return Response.json({ error: "AI error" }, { status: 500 })
  }
}
