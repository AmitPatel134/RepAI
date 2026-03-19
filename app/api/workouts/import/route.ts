import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const dynamic = "force-dynamic"

const VALID_TYPES = ["fullbody", "push", "pull", "legs", "upper", "lower", "cardio", "hiit", "mobility", "crossfit", "force", "dos", "bras", "epaules", "abdos"]

export type PreviewWorkout = {
  date: string
  name: string
  type: string
  notes: string
  exercises: { name: string; setCount: number }[]
}

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n")
  return lines.map(line => {
    const result: string[] = []
    let inQuotes = false
    let current = ""
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  })
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function parseNum(val: string): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? null : n
}

async function parseWorkoutMap(rows: string[][], mapping: Record<string, number | null>) {
  const workoutMap = new Map<string, {
    date: string
    name: string
    type: string
    notes: string
    exercises: Map<string, { name: string; sets: Array<{ reps: number | null; weight: number | null; rpe: number | null; order: number }> }>
  }>()

  const dataRows = rows.slice(1)

  for (const row of dataRows) {
    if (row.every(c => c === "")) continue

    const get = (field: string) => {
      const idx = mapping[field]
      if (idx == null || idx < 0 || idx >= row.length) return ""
      return row[idx]?.trim() ?? ""
    }

    const rawDate = get("date")
    const date = parseDate(rawDate)
    if (!date) continue

    const workoutName = get("workout_name") || "Séance"
    const workoutKey = `${date}__${workoutName}`

    if (!workoutMap.has(workoutKey)) {
      const rawType = get("workout_type").toLowerCase()
      const type = VALID_TYPES.find(t => rawType.includes(t)) ?? "fullbody"
      workoutMap.set(workoutKey, {
        date,
        name: workoutName,
        type,
        notes: get("notes"),
        exercises: new Map(),
      })
    }

    const wk = workoutMap.get(workoutKey)!
    const exName = get("exercise_name")
    if (!exName) continue

    if (!wk.exercises.has(exName)) {
      wk.exercises.set(exName, { name: exName, sets: [] })
    }

    const ex = wk.exercises.get(exName)!
    ex.sets.push({
      reps: parseNum(get("reps")),
      weight: parseNum(get("weight_kg")),
      rpe: parseNum(get("rpe")),
      order: ex.sets.length,
    })
  }

  return workoutMap
}

async function getMapping(rows: string[][]): Promise<Record<string, number | null>> {
  const headers = rows[0]
  const sampleRows = rows.slice(1, Math.min(6, rows.length))
  const sampleText = [headers.join(","), ...sampleRows.map(r => r.join(","))].join("\n")

  const mappingPrompt = `Voici un extrait CSV d'entraînement :

${sampleText}

Identifie les colonnes correspondant aux champs suivants (retourne UNIQUEMENT un JSON valide, sans markdown) :
{
  "date": <index de la colonne date (format YYYY-MM-DD ou similaire), ou null>,
  "workout_name": <index du nom de séance, ou null>,
  "workout_type": <index du type de séance (push/pull/legs/fullbody/etc.), ou null>,
  "notes": <index des notes de séance, ou null>,
  "exercise_name": <index du nom de l'exercice, ou null>,
  "set_number": <index du numéro de série, ou null>,
  "reps": <index des répétitions, ou null>,
  "weight_kg": <index du poids en kg, ou null>,
  "rpe": <index du RPE (intensité 1-10), ou null>
}

Les colonnes disponibles sont : ${headers.map((h, i) => `${i}="${h}"`).join(", ")}
Réponds UNIQUEMENT avec le JSON, rien d'autre.`

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Tu es un expert en parsing de données CSV. Tu réponds uniquement avec du JSON valide, sans markdown ni explication." },
      { role: "user", content: mappingPrompt },
    ],
    temperature: 0,
    max_tokens: 300,
  })

  const content = completion.choices[0].message.content?.trim() ?? "{}"
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(cleaned)
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const preview = new URL(request.url).searchParams.get("preview") === "true"

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length < 2) return Response.json({ error: "File is empty or has no data rows" }, { status: 400 })

    let mapping: Record<string, number | null>
    try {
      mapping = await getMapping(rows)
    } catch {
      return Response.json({ error: "AI could not parse CSV structure" }, { status: 422 })
    }

    const workoutMap = await parseWorkoutMap(rows, mapping)

    if (preview) {
      const workouts: PreviewWorkout[] = Array.from(workoutMap.values()).map(wk => ({
        date: wk.date,
        name: wk.name,
        type: wk.type,
        notes: wk.notes,
        exercises: Array.from(wk.exercises.values()).map(ex => ({
          name: ex.name,
          setCount: ex.sets.length,
        })),
      }))
      return Response.json({ workouts })
    }

    // Insert into database
    const user = await prisma.user.upsert({
      where: { email: authUser.email },
      update: {},
      create: { email: authUser.email },
    })

    let importedWorkouts = 0
    let importedExercises = 0
    let importedSets = 0

    for (const [, wk] of workoutMap) {
      await prisma.workout.create({
        data: {
          userId: user.id,
          name: wk.name,
          type: wk.type,
          notes: wk.notes || null,
          date: new Date(wk.date),
          exercises: {
            create: Array.from(wk.exercises.values()).map((ex, exOrder) => ({
              name: ex.name,
              order: exOrder,
              sets: {
                create: ex.sets.map(s => ({
                  reps: s.reps,
                  weight: s.weight,
                  rpe: s.rpe,
                  order: s.order,
                })),
              },
            })),
          },
        },
      })

      importedWorkouts++
      importedExercises += wk.exercises.size
      for (const ex of wk.exercises.values()) importedSets += ex.sets.length
    }

    return Response.json({
      success: true,
      imported: { workouts: importedWorkouts, exercises: importedExercises, sets: importedSets },
    })
  } catch (err) {
    console.error("Import error:", err)
    return Response.json({ error: "Import failed" }, { status: 500 })
  }
}
