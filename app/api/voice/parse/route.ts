import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant qui analyse des descriptions d'activités sportives en français et extrait des données structurées.

Types d'activités cardio valides : running, cycling, swimming, walking, hiking, rowing, elliptical, other
Types de séances musculation valides : fullbody, push, pull, legs, upper, lower, cardio, hiit, mobility, crossfit, force, dos, bras, epaules, abdos

Règles :
- Si l'utilisateur décrit des exercices avec séries/répétitions/charges → kind: "workout"
- Si l'utilisateur décrit une activité cardio (course, vélo, natation, marche, etc.) → kind: "cardio"
- Si ambigu ou les deux → kind: "ambiguous" avec possibleCardioTypes listant les types cardio possibles (peut être vide si vraiment ambigu)
- Pour les sets : extraire toutes les variations (ex: "3 séries de 10 à 80kg puis 2 à 60kg" → 3 sets reps:10 weight:80, 2 sets reps:5 weight:60)
- Convertir toutes les durées en secondes
- Convertir toutes les distances en mètres
- Si plusieurs exercices mentionnés, tous les inclure
- name du workout : générer un nom court et descriptif en français

Retourne UNIQUEMENT un objet JSON valide, sans markdown ni texte autour :
{
  "kind": "workout" | "cardio" | "ambiguous",
  "possibleCardioTypes": [],
  "workout": {
    "name": "...",
    "type": "push",
    "exercises": [
      {
        "name": "Développé couché",
        "sets": [
          { "reps": 10, "weight": 80 },
          { "reps": 10, "weight": 80 }
        ]
      }
    ],
    "notes": null
  },
  "activity": {
    "type": "running",
    "durationSec": 3600,
    "distanceM": 10000,
    "elevationM": null,
    "avgHeartRate": 150,
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
