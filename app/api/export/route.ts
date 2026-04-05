import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

function esc(v: unknown): string {
  if (v == null) return ""
  let s = String(v)
  // Prevent CSV formula injection: Excel/Sheets execute cells starting with =, +, -, @, |
  // Prefix with a tab so the value is treated as text, not a formula.
  if (/^[=+\-@|]/.test(s)) s = "\t" + s
  // Quote cells that contain commas, quotes, newlines, or the injected leading tab
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\t")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(...cells: unknown[]): string {
  return cells.map(esc).join(",")
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toISOString().slice(0, 10)
}

function fmtDuration(sec: number | null): string {
  if (!sec) return ""
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`
  return s > 0 ? `${m}min${s}s` : `${m}min`
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return new Response("Unauthorized", { status: 401 })

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      include: {
        workouts: {
          orderBy: { date: "asc" },
          include: {
            exercises: {
              orderBy: { order: "asc" },
              include: { sets: { orderBy: { order: "asc" } } },
            },
          },
        },
        activities: { orderBy: { date: "asc" } },
        meals: { orderBy: { date: "asc" } },
        weightEntries: { orderBy: { recordedAt: "asc" } },
      },
    })

    if (!user) return new Response("Not found", { status: 404 })

    const lines: string[] = ["\uFEFF"] // BOM for Excel

    // ── PROFIL ──────────────────────────────────────────────────────────────
    lines.push("# PROFIL")
    lines.push(row("Email", "Date de naissance", "Taille (cm)", "Poids (kg)", "Sexe", "Objectif", "Niveau d'activité", "FC repos (bpm)"))
    lines.push(row(
      user.email,
      fmtDate(user.birthDate),
      user.heightCm,
      user.weightKg,
      user.sex,
      user.goal,
      user.activityLevel,
      user.restingHR,
    ))
    lines.push("")

    // ── SÉANCES MUSCU ────────────────────────────────────────────────────────
    lines.push("# SÉANCES DE MUSCULATION")
    lines.push(row("Date", "Séance", "Type", "Exercice", "Note exercice", "Unilatéral", "Série", "Reps", "Poids (kg)", "Reps droite", "Poids droite (kg)", "RPE", "Note séance"))
    for (const w of user.workouts) {
      if (w.exercises.length === 0) {
        lines.push(row(fmtDate(w.date), w.name, w.type, "", "", "", "", "", "", "", "", "", w.notes))
        continue
      }
      for (const ex of w.exercises) {
        if (ex.sets.length === 0) {
          lines.push(row(fmtDate(w.date), w.name, w.type, ex.name, (ex as { notes?: string }).notes, (ex as { isUnilateral?: boolean }).isUnilateral ? "oui" : "non", "", "", "", "", "", "", w.notes))
          continue
        }
        for (const s of ex.sets) {
          lines.push(row(
            fmtDate(w.date), w.name, w.type, ex.name,
            (ex as { notes?: string }).notes,
            (ex as { isUnilateral?: boolean }).isUnilateral ? "oui" : "non",
            s.order + 1, s.reps, s.weight,
            (s as { repsRight?: number }).repsRight,
            (s as { weightRight?: number }).weightRight,
            s.rpe, w.notes,
          ))
        }
      }
    }
    lines.push("")

    // ── ACTIVITÉS CARDIO ─────────────────────────────────────────────────────
    lines.push("# ACTIVITÉS CARDIO & AUTRES")
    lines.push(row("Date", "Type", "Nom", "Durée", "Distance (m)", "FC moyenne (bpm)", "Calories (kcal)", "Allure (min/km)", "Vitesse (km/h)", "Dénivelé (m)", "Notes"))
    for (const a of user.activities) {
      const pace = a.avgPaceSecKm ? `${Math.floor(a.avgPaceSecKm / 60)}'${String(a.avgPaceSecKm % 60).padStart(2, "0")}"` : ""
      lines.push(row(
        fmtDate(a.date), a.type, a.name,
        fmtDuration(a.durationSec),
        a.distanceM, a.avgHeartRate, a.calories,
        pace, a.avgSpeedKmh, a.elevationM, a.notes,
      ))
    }
    lines.push("")

    // ── NUTRITION ────────────────────────────────────────────────────────────
    lines.push("# NUTRITION")
    lines.push(row("Date", "Aliment", "Calories (kcal)", "Protéines (g)", "Glucides (g)", "Lipides (g)", "Fibres (g)", "Notes"))
    for (const m of user.meals) {
      lines.push(row(fmtDate(m.date), m.name, m.calories, m.proteins, m.carbs, m.fats, m.fiber, m.notes))
    }
    lines.push("")

    // ── POIDS ────────────────────────────────────────────────────────────────
    lines.push("# SUIVI DU POIDS")
    lines.push(row("Date", "Poids (kg)"))
    for (const w of user.weightEntries) {
      lines.push(row(fmtDate(w.recordedAt), w.weightKg))
    }

    const csv = lines.join("\n")
    const filename = `repai-export-${new Date().toISOString().slice(0, 10)}.csv`

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error(e)
    return new Response("Server error", { status: 500 })
  }
}
