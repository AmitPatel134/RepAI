import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 20, windowMs: 60_000 })

const SYSTEM_PROMPT = `Tu es un assistant qui analyse des descriptions d'activités sportives en français et extrait TOUTES les activités mentionnées.

Types cardio valides : running, cycling, swimming, walking, hiking, rowing, elliptical, other

RÈGLES :
1. Extrais TOUTES les activités mentionnées, même si plusieurs sont citées dans la même phrase
2. Chaque exercice de musculation = un objet séparé dans "exercises"
3. Chaque activité cardio = un objet séparé dans "items"
4. Une séance muscu ET une activité cardio → deux items distincts dans "items"
5. Le champ "name" d'une séance muscu doit être un titre descriptif court basé sur les exercices mentionnés (ex: "Push Poitrine", "Séance dos", "Full Body", "Jambes"). C'est le titre principal de la séance.

RÈGLES POUR LES SÉRIES (CRITIQUE) :
- "3 séries de 10 à 80kg" → 3 objets dans sets : [{"reps":10,"weight":80},{"reps":10,"weight":80},{"reps":10,"weight":80}]
- Chaque série = un objet individuel dans sets, ne jamais regrouper
- weight: null si le poids n'est pas mentionné

STRUCTURE JSON OBLIGATOIRE (retourne uniquement ce JSON, sans markdown) :
{
  "items": [
    {
      "kind": "workout",
      "workout": {
        "name": "Push Poitrine",
        "notes": null,
        "exercises": [
          {
            "name": "Développé couché",
            "sets": [
              { "reps": 10, "weight": 80 },
              { "reps": 10, "weight": 80 },
              { "reps": 10, "weight": 80 }
            ]
          }
        ]
      }
    },
    {
      "kind": "cardio",
      "activity": {
        "type": "running",
        "durationSec": 3600,
        "distanceM": 10000,
        "elevationM": null,
        "avgHeartRate": null,
        "calories": null,
        "notes": null
      }
    }
  ]
}`

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { transcript, today } = await request.json()
    if (!transcript?.trim()) return Response.json({ error: "Transcript required" }, { status: 400 })

    const dateContext = today
      ? `Aujourd'hui nous sommes le ${today} (format YYYY-MM-DD). Utilise cette date pour résoudre les références temporelles :
- "aujourd'hui" → ${today}
- "hier" → calcule la date d'hier
- "avant-hier" → calcule la date d'avant-hier
- "lundi dernier", "mardi", etc. → calcule la date correspondante
Si aucune date n'est mentionnée, utilise aujourd'hui (${today}).
Le champ "date" de chaque item doit être au format YYYY-MM-DD.`
      : "Si aucune date n'est mentionnée, n'inclus pas le champ date (il sera mis à aujourd'hui)."

    const systemWithDate = SYSTEM_PROMPT + `\n\nCONTEXTE DATE :\n${dateContext}\n\nAjoute un champ "date" (YYYY-MM-DD) à chaque item si une date est mentionnée ou déduite.`

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemWithDate },
        { role: "user", content: `Description vocale : "${transcript.trim()}"` },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const text = completion.choices[0].message.content ?? "{}"
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: "Parse error" }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return Response.json(result)
  } catch (e) {
    console.error("Voice parse error:", e)
    return Response.json({ error: "AI error" }, { status: 500 })
  }
}
