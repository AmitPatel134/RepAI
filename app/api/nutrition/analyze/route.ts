import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { image } = await request.json()
    if (!image || typeof image !== "string") {
      return Response.json({ error: "Image required" }, { status: 400 })
    }

    const prompt = `Tu es un nutritionniste expert. Analyse cette photo de nourriture et estime les informations nutritionnelles pour la portion visible.
Réponds UNIQUEMENT avec un objet JSON valide (sans bloc markdown, sans texte avant ni après) :
{"name":"nom du plat ou aliment","calories":450,"proteins":35.2,"carbs":42.5,"fats":12.3,"fiber":4.2,"notes":"description courte des ingrédients principaux"}
Estime les portions visuellement. Si tu ne peux pas identifier de nourriture, mets null pour les valeurs numériques et "Aliment non identifié" pour le nom.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: prompt },
          ],
        },
      ] as any,
      temperature: 0.2,
      max_tokens: 400,
    })

    const text = completion.choices[0].message.content ?? "{}"
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return Response.json({ error: "Impossible d'analyser l'image" }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return Response.json(result)
  } catch (e) {
    console.error("Nutrition analyze error:", e)
    return Response.json({ error: "Erreur d'analyse IA" }, { status: 500 })
  }
}
