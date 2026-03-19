import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

export const dynamic = "force-dynamic"

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

    const { question, workoutContext } = await request.json()
    if (!question?.trim()) return Response.json({ error: "Question required" }, { status: 400 })

    const systemPrompt = `Tu es un coach sportif expert en musculation et fitness.
Tu analyses les données d'entraînement des utilisateurs (exercices, séries, répétitions, charges, RPE) pour leur donner des conseils personnalisés et scientifiquement fondés.
Réponds en français, de manière concise mais complète.
Utilise le markdown pour structurer tes réponses (titres, listes, gras).
Base-toi toujours sur les données fournies pour personnaliser tes conseils.
Sois encourageant mais honnête.`

    const userPrompt = workoutContext
      ? `Voici mes données d'entraînement récentes :\n\n${workoutContext}\n\nMa question : ${question}`
      : question

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content ?? ""

    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

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
