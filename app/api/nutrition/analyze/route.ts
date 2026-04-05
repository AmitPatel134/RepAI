import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { isPro } from "@/lib/plans"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request)
    if (limited) return limited

    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    // Check free plan limit before running AI
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    try {
      if (user && !isPro(user.plan ?? "free")) {
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const analyzed = await prisma.usageEvent.count({
          where: { userId: user.id, type: "meal_analyzed", createdAt: { gte: firstOfMonth } },
        })
        if (analyzed >= 5) {
          return Response.json({ error: "Limite de 5 analyses par mois atteinte. Passez Pro pour continuer." }, { status: 429 })
        }
      }
    } catch { /* usageEvent table may not exist yet — allow the request */ }

    const { composition, name } = await request.json()
    if (!composition || typeof composition !== "string" || !composition.trim()) {
      return Response.json({ error: "Composition required" }, { status: 400 })
    }
    // Prevent prompt injection and token exhaustion
    if (composition.length > 5_000) {
      return Response.json({ error: "Composition trop longue (max 5 000 caractères)" }, { status: 400 })
    }

    const prompt = `You are an expert nutritionist. Your task is to calculate the TOTAL nutritional values for the following list of ingredients.

INGREDIENTS:
${composition}

INSTRUCTIONS:
1. Calculate the nutritional values for EACH ingredient based on its weight
2. Sum all values to get the total for the meal
3. Use USDA/CIQUAL reference values
4. Account for cooking methods (grilled/steamed = minimal fat unless stated)

OUTPUT: Return ONLY a JSON object with these exact keys. Do NOT include "name", "composition", or any other keys.
Required output format:
{"calories":247,"proteins":18.5,"carbs":12.3,"fats":14.2,"fiber":3.1,"notes":"optional brief note"}

IMPORTANT: You must compute and return numeric values for calories, proteins, carbs, and fats. These are not optional.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: prompt },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_object" } as any,
      temperature: 0.1,
      max_tokens: 300,
    })

    const text = completion.choices[0].message.content ?? "{}"

    let raw
    try {
      raw = JSON.parse(text)
    } catch {
      // Fallback: try to extract JSON with regex
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return Response.json({ error: `Réponse IA invalide. Réessayez.` }, { status: 500 })
      try {
        raw = JSON.parse(jsonMatch[0])
      } catch {
        return Response.json({ error: `Réponse IA invalide. Réessayez.` }, { status: 500 })
      }
    }

    // Validate the model returned nutritional data, not the describe format
    if (!raw.calories && !raw.proteins && !raw.carbs && !raw.fats && (raw.composition || raw.name)) {
      console.warn("Nutrition analyze: model returned describe format instead of nutrition:", text.slice(0, 200))
      return Response.json({ error: "Le modèle n'a pas calculé les valeurs nutritionnelles. Réessayez." }, { status: 500 })
    }

    // Normalize alternative field names the model might use
    const result = {
      name:     name ?? raw.name ?? "Repas",
      calories: raw.calories ?? raw.kcal ?? raw.energy ?? null,
      proteins: raw.proteins ?? raw.protein ?? raw.proteines ?? raw.protéines ?? null,
      carbs:    raw.carbs ?? raw.carbohydrates ?? raw.carbohydrate ?? raw.glucides ?? null,
      fats:     raw.fats ?? raw.fat ?? raw.lipids ?? raw.lipides ?? null,
      fiber:    raw.fiber ?? raw.fibre ?? raw.fibres ?? raw.dietary_fiber ?? raw.fibres_alimentaires ?? null,
      notes:    raw.notes ?? raw.note ?? null,
    }

    // Log raw response to help debug if values are still missing
    if (!result.proteins && !result.carbs && !result.fats) {
      console.warn("Nutrition analyze: macros missing. Raw model output:", text.slice(0, 500))
    }

    // Record usage event (counts toward limit regardless of whether meal is saved)
    if (user) prisma.usageEvent.create({ data: { userId: user.id, type: "meal_analyzed" } }).catch(() => {})

    return Response.json(result)
  } catch (e) {
    console.error("Nutrition analyze error:", e)
    return Response.json({ error: "Analyse impossible. Réessayez." }, { status: 500 })
  }
}
