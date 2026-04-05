import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseDuration(s: string): number | null {
  if (!s) return null
  const h = s.match(/^(\d+)h(\d+)m(\d+)s$/)
  if (h) return +h[1] * 3600 + +h[2] * 60 + +h[3]
  const ms = s.match(/^(\d+)min(\d+)s$/)
  if (ms) return +ms[1] * 60 + +ms[2]
  const m = s.match(/^(\d+)min$/)
  if (m) return +m[1] * 60
  return null
}

function parsePace(s: string): number | null {
  if (!s) return null
  const m = s.match(/^(\d+)'(\d+)"$/)
  if (m) return +m[1] * 60 + +m[2]
  return null
}

function n(v: string): number | null {
  if (!v || v.trim() === "") return null
  const x = Number(v)
  return isNaN(x) ? null : x
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    if (!file) return Response.json({ error: "No file" }, { status: 400 })

    const text = await file.text()
    const lines = text.replace(/^\uFEFF/, "").split("\n").map(l => l.trim()).filter(Boolean)

    // Parse into sections, skipping header rows
    let currentSection = ""
    const headerSeen = new Set<string>()
    const sections: Record<string, string[][]> = {}

    for (const line of lines) {
      if (line.startsWith("# ")) {
        currentSection = line.slice(2)
        sections[currentSection] = []
        continue
      }
      if (!currentSection) continue
      if (!headerSeen.has(currentSection)) {
        headerSeen.add(currentSection)
        continue // skip header row
      }
      sections[currentSection].push(parseCSVLine(line))
    }

    let workoutsCreated = 0, activitiesCreated = 0, mealsCreated = 0, weightEntriesCreated = 0

    // ── SÉANCES DE MUSCULATION ────────────────────────────────────────────────
    const muscuRows = (sections["SÉANCES DE MUSCULATION"] ?? []).filter(r => r[0])
    type ExData = { exNotes: string; isUnilateral: boolean; sets: { order: number; reps: number | null; weight: number | null; rpe: number | null; repsRight: number | null; weightRight: number | null }[] }
    type WData = { date: string; name: string; type: string; notes: string; exercises: Map<string, ExData> }
    const workoutMap = new Map<string, WData>()

    for (const row of muscuRows) {
      const [date, name, type, exName, exNotes, isUnilateral, setOrder, reps, weight, repsRight, weightRight, rpe, notes] = row
      if (!date || !name) continue
      const key = `${date}||${name}`
      if (!workoutMap.has(key)) workoutMap.set(key, { date, name, type: type || "fullbody", notes: notes || "", exercises: new Map() })
      const w = workoutMap.get(key)!
      if (!w.notes && notes) w.notes = notes
      if (!exName) continue
      if (!w.exercises.has(exName)) w.exercises.set(exName, { exNotes: exNotes || "", isUnilateral: isUnilateral === "oui", sets: [] })
      const ex = w.exercises.get(exName)!
      if (setOrder) {
        ex.sets.push({
          order: +setOrder - 1,
          reps: n(reps), weight: n(weight), rpe: n(rpe),
          repsRight: n(repsRight), weightRight: n(weightRight),
        })
      }
    }

    const actRows     = (sections["ACTIVITÉS CARDIO & AUTRES"] ?? []).filter(r => r[0])
    const nutritionRows = (sections["NUTRITION"] ?? []).filter(r => r[0])
    const weightRows  = (sections["SUIVI DU POIDS"] ?? []).filter(r => r[0] && r[1])

    // ── All inserts in a single transaction — all-or-nothing on failure ────────
    await prisma.$transaction(async (tx) => {

      // Workouts + exercises + sets
      for (const [, w] of workoutMap) {
        const exEntries = Array.from(w.exercises.entries())
        await tx.workout.create({
          data: {
            userId: user.id,
            date: new Date(w.date),
            name: w.name,
            type: w.type,
            notes: w.notes || null,
            exercises: {
              create: exEntries.map(([exName, ex], exIdx) => ({
                name: exName,
                category: "strength",
                isUnilateral: ex.isUnilateral,
                notes: ex.exNotes || null,
                order: exIdx,
                sets: { create: ex.sets },
              })),
            },
          },
        })
        workoutsCreated++
      }

      // Activities
      for (const row of actRows) {
        const [date, type, name, duration, distanceM, avgHR, calories, pace, avgSpeedKmh, elevationM, notes] = row
        if (!date || !type) continue
        await tx.activity.create({
          data: {
            userId: user.id,
            date: new Date(date),
            type, name: name || type,
            durationSec: parseDuration(duration),
            distanceM: n(distanceM),
            avgHeartRate: n(avgHR) ? Math.round(n(avgHR)!) : null,
            calories: n(calories) ? Math.round(n(calories)!) : null,
            avgPaceSecKm: parsePace(pace),
            avgSpeedKmh: n(avgSpeedKmh),
            elevationM: n(elevationM),
            notes: notes || null,
          },
        })
        activitiesCreated++
      }

      // Nutrition
      for (const row of nutritionRows) {
        const [date, name, calories, proteins, carbs, fats, fiber, notes] = row
        if (!date || !name) continue
        await tx.meal.create({
          data: {
            userId: user.id,
            date: new Date(date),
            name,
            calories: n(calories) ? Math.round(n(calories)!) : null,
            proteins: n(proteins),
            carbs: n(carbs),
            fats: n(fats),
            fiber: n(fiber),
            notes: notes || null,
          },
        })
        mealsCreated++
      }

      // Weight entries
      for (const row of weightRows) {
        const [date, weightKg] = row
        if (!date || !weightKg) continue
        await tx.weightEntry.create({
          data: { userId: user.id, recordedAt: new Date(date), weightKg: Number(weightKg) },
        })
        weightEntriesCreated++
      }

    }, { timeout: 30_000 })

    return Response.json({ ok: true, workoutsCreated, activitiesCreated, mealsCreated, weightEntriesCreated })
  } catch (e) {
    console.error("[import POST]", e)
    return Response.json({ error: "Import error", detail: String(e) }, { status: 500 })
  }
}
