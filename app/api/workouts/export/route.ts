import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return new Response("date,workout_name,notes,exercise_name,set_number,reps,weight_kg,rpe\n", {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=repai_workouts.csv" },
    })

    const workouts = await prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    })

    const rows: string[] = ["date,workout_name,notes,exercise_name,set_number,reps,weight_kg,rpe"]

    for (const w of workouts) {
      const date = w.date.toISOString().slice(0, 10)
      const name = csvEscape(w.name)
      const notes = csvEscape(w.notes ?? "")

      if (w.exercises.length === 0) {
        rows.push(`${date},${name},${notes},,,,`)
        continue
      }

      for (const ex of w.exercises) {
        const exName = csvEscape(ex.name)
        if (ex.sets.length === 0) {
          rows.push(`${date},${name},${notes},${exName},,,`)
          continue
        }
        ex.sets.forEach((s, i) => {
          rows.push(`${date},${name},${notes},${exName},${i + 1},${s.reps ?? ""},${s.weight ?? ""},${s.rpe ?? ""}`)
        })
      }
    }

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=repai_workouts.csv",
      },
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

function csvEscape(val: string): string {
  // Prevent CSV formula injection (=, +, -, @, | trigger execution in Excel/Sheets)
  let s = val
  if (/^[=+\-@|]/.test(s)) s = "\t" + s
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\t")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
