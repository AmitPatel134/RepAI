import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant qui analyse des descriptions d'activités sportives en français et extrait des données structurées en JSON.

Types cardio valides : running, cycling, swimming, walking, hiking, rowing, elliptical, other
Types musculation valides : fullbody, push, pull, legs, upper, lower, cardio, hiit, mobility, crossfit, force, dos, bras, epaules, abdos

RÈGLES IMPORTANTES :
1. Si l'utilisateur décrit des exercices avec séries/répétitions/charges → kind: "workout"
2. Si l'utilisateur décrit une activité cardio (course, vélo, natation, marche…) → kind: "cardio"
3. Si ambigu → kind: "ambiguous"

RÈGLES POUR LES SÉRIES (CRITIQUE) :
- Chaque exercice distinct est un objet séparé dans le tableau "exercises"
- "3 séries de 10 à 80kg" → tableau sets avec 3 objets identiques : [{"reps":10,"weight":80},{"reps":10,"weight":80},{"reps":10,"weight":80}]
- "3 séries de 10 à 80kg puis 2 à 60kg" → 5 objets : 3×{reps:10,weight:80} puis 2×{reps:10,weight:60}
- Ne JAMAIS regrouper les séries : chaque série = un objet dans sets
- Si le poids n'est pas mentionné : weight: null
- Si les reps ne sont pas mentionnées : reps: null

STRUCTURE JSON OBLIGATOIRE (retourne uniquement ce JSON, sans markdown) :
{
  "kind": "workout",
  "possibleCardioTypes": [],
  "workout": {
    "name": "Push Poitrine Biceps",
    "type": "push",
    "notes": null,
    "exercises": [
      {
        "name": "Développé couché",
        "sets": [
          { "reps": 10, "weight": 80 },
          { "reps": 10, "weight": 80 },
          { "reps": 10, "weight": 80 }
        ]
      },
      {
        "name": "Curl biceps",
        "sets": [
          { "reps": 12, "weight": 15 },
          { "reps": 12, "weight": 15 },
          { "reps": 12, "weight": 15 },
          { "reps": 12, "weight": 15 }
        ]
      }
    ]
  },
  "activity": {
    "type": "running",
    "durationSec": null,
    "distanceM": null,
    "elevationM": null,
    "avgHeartRate": null,
    "calories": null,
    "notes": null
  }
}`

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { transcript } = await request.json()
    if (!transcript?.trim()) return Response.json({ error: "Transcript required" }, { status: 400 })

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Description vocale : "${transcript.trim()}"` },
      ],
      temperature: 0.1,
      max_tokens: 1200,
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
