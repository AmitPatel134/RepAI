import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

const PROMPT = `Tu es un expert en reconnaissance alimentaire. Analyse cette photo de repas.

OBJECTIF : lister chaque aliment visible avec sa quantité estimée en grammes (ou cl pour les liquides).

RÈGLES IMPÉRATIVES :
1. Chaque ligne doit commencer par "- " suivi de la quantité en grammes puis le nom de l'aliment
2. Estime visuellement chaque portion (taille de l'assiette = référence ~26cm de diamètre)
3. Précise le mode de cuisson si visible (grillé, frit, vapeur, cru, sauté, etc.)
4. Inclus les sauces, huiles, condiments même en petite quantité
5. MINIMUM 2 lignes, MAXIMUM 10 lignes

EXEMPLES de format attendu :
"- 160g de poulet grillé\n- 120g de riz basmati cuit\n- ~60g de petits pois\n- ~30g d'oignons rouges crus\n- 10g d'huile d'olive (cuisson)"

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans texte avant ni après) :
{"name":"Nom court du plat en français","composition":"- Xg d'aliment1 (mode)\n- Xg d'aliment2\n..."}`

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request)
    if (limited) return limited

    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { image } = await request.json()
    if (!image || typeof image !== "string") {
      return Response.json({ error: "Image required" }, { status: 400 })
    }
    if (!image.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image format" }, { status: 400 })
    }
    if (image.length > 4 * 1024 * 1024) {
      return Response.json({ error: "Image too large" }, { status: 413 })
    }

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ] as any,
      temperature: 0.1,
      max_tokens: 1200,
    })

    let text = completion.choices[0].message.content ?? "{}"

    // If response was truncated (no closing }), attempt to close the JSON manually
    if (!text.includes("}")) {
      // Close any open string then close the object
      const openQuotes = (text.match(/"/g) ?? []).length
      if (openQuotes % 2 !== 0) text += '"'
      text += "}"
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: `JSON introuvable dans la réponse du modèle. Réponse brute : "${text.slice(0, 200)}"` }, { status: 500 })

    // Escape literal newlines/tabs inside JSON string values (model sometimes outputs raw \n inside strings)
    const sanitized = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, m =>
      m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    )

    let result
    try {
      result = JSON.parse(sanitized)
    } catch (parseErr) {
      return Response.json({ error: `Échec du parsing JSON : ${(parseErr as Error).message}. Extrait : "${sanitized.slice(0, 200)}"` }, { status: 500 })
    }
    return Response.json(result)
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    console.error("Nutrition describe error:", e)
    return Response.json({ error: `Erreur Groq/describe : ${msg}` }, { status: 500 })
  }
}
