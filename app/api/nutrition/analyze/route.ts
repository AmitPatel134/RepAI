import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
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

    const { composition, name } = await request.json()
    if (!composition || typeof composition !== "string" || !composition.trim()) {
      return Response.json({ error: "Composition required" }, { status: 400 })
    }

    const prompt = `You are an expert nutritionist. Calculate the complete nutritional values for this meal using the exact quantities listed:

${composition}

Rules:
- Calculate each ingredient separately then sum up
- Use standard nutritional reference values (USDA/CIQUAL)
- Account for cooking method (grilled/steamed = no added fat unless stated)
- ALL 5 numeric fields are REQUIRED — never omit or use null

Respond with ONLY this exact JSON structure, no markdown, no text before or after:
{"calories":247,"proteins":18.5,"carbs":12.3,"fats":14.2,"fiber":3.1,"notes":"short optional note"}`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const text = completion.choices[0].message.content ?? "{}"
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: `JSON introuvable dans la réponse du modèle. Réponse brute : "${text.slice(0, 200)}"` }, { status: 500 })

    const sanitized = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, m =>
      m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    )

    let raw
    try {
      raw = JSON.parse(sanitized)
    } catch (parseErr) {
      return Response.json({ error: `Échec du parsing JSON : ${(parseErr as Error).message}. Extrait : "${sanitized.slice(0, 200)}"` }, { status: 500 })
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

    return Response.json(result)
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    console.error("Nutrition analyze error:", e)
    return Response.json({ error: `Erreur Groq/analyze : ${msg}` }, { status: 500 })
  }
}
