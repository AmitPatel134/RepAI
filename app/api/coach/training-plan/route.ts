import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 })

export const dynamic = "force-dynamic"

const GOAL_LABELS: Record<string, string> = {
  prise_de_masse:     "prise de masse musculaire",
  perte_de_poids:     "perte de poids / sèche",
  performance_cardio: "amélioration des performances cardio",
  sante_cardiaque:    "santé cardiaque",
  endurance:          "développement de l'endurance",
  force_max:          "développement de la force maximale",
  flexibilite:        "souplesse et mobilité",
  maintien:           "maintien",
  bien_etre:          "bien-être général",
  competition:        "préparation à la compétition",
  reeducation:        "rééducation",
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentaire: "sédentaire",
  leger:      "légèrement actif (1–3j/semaine)",
  modere:     "modérément actif (3–5j/semaine)",
  actif:      "très actif (6–7j/semaine)",
  tres_actif: "extrêmement actif",
}

const CARDIO_LABELS: Record<string, string> = {
  running:   "course à pied",
  cycling:   "vélo",
  swimming:  "natation",
  rowing:    "aviron",
  hiking:    "randonnée",
  walking:   "marche",
  elliptical:"elliptique",
  yoga:      "yoga",
  crossfit:  "CrossFit",
  custom:    "activité personnalisée",
}

// ─── Detect training split from workout names & exercises ──────────────────

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

type WorkoutForAnalysis = {
  name: string
  exercises: { name: string; sets: { weight: number | null; reps: number | null }[] }[]
}

function detectSplit(workouts: WorkoutForAnalysis[]): {
  splitType: string
  sessionLabels: string[]
  advice: string
} {
  const names = workouts.map(w => normalize(w.name))

  // PPL
  const pushCount = names.filter(n => n.includes("push") || n.includes("pouss") || n.includes("pec") || n.includes("chest")).length
  const pullCount = names.filter(n => n.includes("pull") || n.includes("tir") || n.includes("dos") || n.includes("back")).length
  const legsCount = names.filter(n => n.includes("leg") || n.includes("jamb") || n.includes("squat") || n.includes("quad")).length
  if (pushCount >= 1 && pullCount >= 1 && legsCount >= 1) {
    return {
      splitType: "PPL (Push / Pull / Legs)",
      sessionLabels: ["Push – Pectoraux, Épaules, Triceps", "Pull – Dos, Biceps, Ischio-jambiers", "Legs – Quadriceps, Ischio-jambiers, Mollets, Fessiers"],
      advice: "Continue le PPL. Assure-toi d'avoir au moins 48h de récupération entre deux séances du même groupe musculaire.",
    }
  }

  // Upper / Lower
  const upperCount = names.filter(n => n.includes("upper") || n.includes("haut") || n.includes("upper body")).length
  const lowerCount = names.filter(n => n.includes("lower") || n.includes("bas") || n.includes("lower body")).length
  if (upperCount >= 1 && lowerCount >= 1) {
    return {
      splitType: "Upper / Lower",
      sessionLabels: ["Upper A – Pectoraux, Dos lourd, Épaules", "Lower A – Squat, Leg Press, Ischio, Mollets", "Upper B – Variante (incliné, tirage neutre, isolation)", "Lower B – Soulevé de terre, Fentes, Leg Curl"],
      advice: "Le split Upper/Lower est idéal pour 4 jours/semaine. Alterne Upper A/B et Lower A/B pour plus de variété.",
    }
  }

  // Full Body
  const fbCount = names.filter(n => n.includes("full") || n.includes("corps entier") || n.includes("full body") || n.includes("fb")).length
  if (fbCount >= 2) {
    return {
      splitType: "Full Body",
      sessionLabels: ["Full Body A – Force (5×5)", "Full Body B – Hypertrophie (4×8-12)", "Full Body C – Gainage & Mobilité"],
      advice: "En Full Body, laisse au minimum 1 jour de repos entre chaque séance. Varie les mouvements principaux (squat/deadlift/bench) entre séances A et B.",
    }
  }

  // Detect by exercise muscle groups if no named split
  const allExercises = workouts.flatMap(w => w.exercises.map(e => normalize(e.name)))
  const hasHeavyCompounds = allExercises.some(e => e.includes("squat") || e.includes("soulevé") || e.includes("deadlift") || e.includes("développé couché"))
  const hasIsolation = allExercises.some(e => e.includes("curl") || e.includes("extension") || e.includes("élévation"))
  const hasCardioExercises = allExercises.some(e => e.includes("tapis") || e.includes("rowing") || e.includes("velo") || e.includes("cardio"))

  if (hasHeavyCompounds && hasIsolation) {
    return {
      splitType: "Programme mixte (composés + isolation)",
      sessionLabels: ["Séance A – Haut du corps (Push focus)", "Séance B – Bas du corps (Squat focus)", "Séance C – Haut du corps (Pull focus)"],
      advice: "Tu mélanges polyarticulaires et isolation — c'est bien. Pour progresser, structure tes séances : commence toujours par les mouvements lourds (squat, bench, deadlift) avant les isolations.",
    }
  }
  if (hasCardioExercises) {
    return {
      splitType: "Renforcement musculaire + cardio",
      sessionLabels: ["Séance Renforcement – Corps entier", "Séance Cardio – Endurance"],
      advice: "Intègre le cardio après la musculation ou sur des jours séparés pour ne pas compromettre la performance en force.",
    }
  }

  // Default: no history or unrecognized
  return {
    splitType: "Indéterminé — programme suggéré basé sur le profil",
    sessionLabels: [],
    advice: "Peu de données disponibles. Un programme PPL 3 jours/semaine est recommandé pour débuter.",
  }
}

// ─── Detect dominant cardio sport ─────────────────────────────────────────

type ActivityForAnalysis = {
  type: string
  durationSec: number | null
  distanceM: number | null
  avgPaceSecKm: number | null
}

function analyzeCardio(activities: ActivityForAnalysis[]): string | null {
  if (activities.length === 0) return null

  const counts: Record<string, number> = {}
  const totalDuration: Record<string, number> = {}
  for (const a of activities) {
    counts[a.type] = (counts[a.type] ?? 0) + 1
    totalDuration[a.type] = (totalDuration[a.type] ?? 0) + (a.durationSec ?? 0)
  }

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (dominant.length === 0) return null

  const lines: string[] = []
  for (const [type, count] of dominant.slice(0, 3)) {
    const label = CARDIO_LABELS[type] ?? type
    const avgDurMin = totalDuration[type] ? Math.round(totalDuration[type] / count / 60) : null
    const runSessions = activities.filter(a => a.type === type && a.avgPaceSecKm)
    const avgPace = runSessions.length > 0
      ? Math.round(runSessions.reduce((s, a) => s + (a.avgPaceSecKm ?? 0), 0) / runSessions.length)
      : null

    let line = `${label} : ${count} séance${count > 1 ? "s" : ""} sur les 30 derniers jours`
    if (avgDurMin) line += `, durée moy. ${avgDurMin} min`
    if (avgPace && type === "running") {
      const paceMin = Math.floor(avgPace / 60)
      const paceSec = avgPace % 60
      line += `, allure moy. ${paceMin}:${String(paceSec).padStart(2, "0")}/km`
    }
    lines.push(`  • ${line}`)
  }

  return lines.join("\n")
}

// ─── Weight progression ───────────────────────────────────────────────────

function suggestIncrement(currentKg: number): number {
  if (currentKg <= 10)  return 0.5
  if (currentKg <= 20)  return 1
  if (currentKg <= 40)  return 1.25
  if (currentKg <= 60)  return 2.5
  if (currentKg <= 100) return 2.5
  if (currentKg <= 140) return 5
  return 5
}

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ plan: null, generatedAt: null })

    return Response.json({
      plan: user.trainingPlan ?? null,
      generatedAt: user.trainingPlanAt ?? null,
    })
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    // Free plan: block AI programme generation
    const { isPro, isPremiumPlus } = await import("@/lib/plans")
    const userPlan = user.plan ?? "free"
    if (!isPro(userPlan)) {
      return Response.json({ error: "pro_required" }, { status: 403 })
    }

    // Premium (not Premium+): 7-day cooldown between regenerations
    if (!isPremiumPlus(userPlan) && user.trainingPlanAt) {
      const daysSince = (Date.now() - new Date(user.trainingPlanAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) {
        const availableAt = new Date(new Date(user.trainingPlanAt).getTime() + 7 * 24 * 60 * 60 * 1000)
        return Response.json({ error: "cooldown_active", availableAt }, { status: 403 })
      }
    }

    // Fetch last 16 workouts + last 20 cardio activities
    const [workouts, activities] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 16,
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { sets: { orderBy: { order: "asc" } } },
          },
        },
      }),
      prisma.activity.findMany({
        where: {
          userId: user.id,
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { date: "desc" },
        take: 20,
        select: { type: true, durationSec: true, distanceM: true, avgPaceSecKm: true },
      }),
    ])

    // ── Profile ──
    const profileLines: string[] = []
    if (user.sex)           profileLines.push(`Sexe : ${user.sex}`)
    if (user.weightKg)      profileLines.push(`Poids corporel : ${user.weightKg} kg`)
    if (user.heightCm)      profileLines.push(`Taille : ${user.heightCm} cm`)
    if (user.goal)          profileLines.push(`Objectif : ${GOAL_LABELS[user.goal] ?? user.goal}`)
    if (user.activityLevel) profileLines.push(`Niveau d'activité : ${ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}`)

    // ── Detect training split ──
    const splitInfo = detectSplit(workouts)

    // ── Workout frequency ──
    const freqMap: Record<string, number> = {}
    for (const w of workouts) {
      const week = w.date.toISOString().slice(0, 7)
      freqMap[week] = (freqMap[week] ?? 0) + 1
    }
    const weeklyFreq = Object.values(freqMap)
    const avgFreq = weeklyFreq.length > 0
      ? (weeklyFreq.reduce((a, b) => a + b, 0) / weeklyFreq.length).toFixed(1)
      : "0"

    // ── Cardio analysis ──
    const cardioCtx = analyzeCardio(activities)

    // ── Per-exercise progression history ──
    type ExHistory = { date: string; sets: number; maxWeight: number; avgReps: number }
    const exerciseHistory: Record<string, ExHistory[]> = {}

    for (const w of [...workouts].reverse()) {
      const dateStr = w.date.toISOString().slice(0, 10)
      for (const e of w.exercises) {
        const key = e.name.toLowerCase().trim()
        if (!exerciseHistory[key]) exerciseHistory[key] = []
        const weights = e.sets.map(s => s.weight ?? 0).filter(v => v > 0)
        const reps    = e.sets.map(s => s.reps   ?? 0).filter(v => v > 0)
        if (weights.length === 0) continue
        exerciseHistory[key].push({
          date:      dateStr,
          sets:      e.sets.length,
          maxWeight: Math.max(...weights),
          avgReps:   reps.length > 0 ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : 0,
        })
      }
    }

    const historyLines: string[] = []
    for (const [name, history] of Object.entries(exerciseHistory)) {
      if (history.length === 0) continue
      const last   = history[history.length - 1]
      const prev   = history.length >= 2 ? history[history.length - 2] : null
      const trend  = prev ? (last.maxWeight > prev.maxWeight ? "↑ progression" : last.maxWeight < prev.maxWeight ? "↓ régression" : "= plateau") : "première donnée"
      const inc    = suggestIncrement(last.maxWeight)
      const target = last.maxWeight + inc
      const sessions = history.slice(-3).map(h => `${h.date}: ${h.sets}×${h.avgReps}@${h.maxWeight}kg`).join(" → ")
      // Compute stagnation: same weight for 3+ sessions
      const stagnant = history.length >= 3 && history.slice(-3).every(h => h.maxWeight === last.maxWeight)
      const action = stagnant
        ? `PLATEAU DÉTECTÉ — suggère technique/volume avant d'augmenter`
        : `suggère ${target}kg (+${inc}kg)`
      historyLines.push(`  • ${name} [${sessions}] | ${trend} | ${action}`)
    }

    const workoutCtx = historyLines.length > 0
      ? historyLines.join("\n")
      : "Aucune séance muscu enregistrée."

    // ── Recent workout names to understand structure ──
    const recentWorkoutNames = workouts.slice(0, 8)
      .map(w => `${w.date.toISOString().slice(0, 10)} "${w.name}" (${w.exercises.length} exos)`)
      .join("\n  ")

    // ── Goal-specific volume rules ──
    const goal = user.goal ?? "maintien"
    const volumeRules = goal === "force_max"
      ? "Force maximale : 5×3-5 reps sur les polyarticulaires, 70-85% 1RM. Augmenter dès que toutes les reps sont réalisées proprement."
      : goal === "prise_de_masse"
      ? "Hypertrophie : 4×8-12 reps, temps sous tension, 60-75% 1RM. RPE 8/10 sur les dernières reps."
      : goal === "perte_de_poids"
      ? "Sèche : 3-4×12-15 reps, récup. courte (60s), circuits possibles. Maintenir les charges pour préserver le muscle."
      : goal === "performance_cardio" || goal === "endurance"
      ? "Cardio/Endurance : renforcement musculaire fonctionnel, 3×15-20 reps léger, priorité à la technique et la mobilité."
      : "Maintien/Bien-être : 3-4×10-12 reps, charges modérées, équilibre entre groupes musculaires."

    const prompt = `Tu es un coach sportif expert en programmation d'entraînement personnalisée. Analyse les données et génère un programme complet pour la semaine prochaine.

═══ PROFIL ═══
${profileLines.length > 0 ? profileLines.join("\n") : "Non renseigné"}

═══ ANALYSE DU PROFIL D'ENTRAÎNEMENT ═══
Fréquence moyenne : ${avgFreq} séances/semaine
Split détecté : ${splitInfo.splitType}
Conseil split : ${splitInfo.advice}
Dernières séances :
  ${recentWorkoutNames || "Aucune"}

${cardioCtx ? `═══ ACTIVITÉS CARDIO (30 derniers jours) ═══\n${cardioCtx}\n` : ""}
═══ HISTORIQUE PAR EXERCICE ═══
${workoutCtx}

═══ RÈGLE DE PROGRESSION ═══
La suggestion de charge est calculée mathématiquement. UTILISE-LA directement dans le JSON.
Si plateau détecté → note "plateau – focus technique" et maintiens la charge.
Si aucune donnée → propose une charge de départ adaptée au profil.

═══ RÈGLES DE VOLUME ═══
${volumeRules}
Polyarticulaires (squat, bench, deadlift, row, pull-up) : 4-5 séries — TOUJOURS en début de séance
Isolations (curl, extension, élévation, leg curl) : 3-4 séries — en fin de séance
CHAQUE SÉANCE DOIT AVOIR 6 À 9 EXERCICES MINIMUM.

═══ INSTRUCTIONS CRITIQUES ═══
1. ADAPTE le programme au split détecté. Si PPL → génère Push/Pull/Legs. Si Full Body → Full Body A/B. Si running dominant → inclus des séances running avec objectifs de distance/allure.
2. Si l'utilisateur fait du cardio (running, natation, vélo) → intègre des conseils spécifiques (allure cible, distance, intervalles) dans les exercices de ces séances.
3. Pour chaque séance muscu : commence par 1-2 mouvements polyarticulaires lourds, puis composés secondaires, puis isolations. MINIMUM 6 exercices par séance.
4. weekGoal doit être un conseil personnalisé de 1-2 phrases basé sur l'analyse (progression détectée, plateau à corriger, point fort/faible).
5. Pour les exercices cardio (running, natation, vélo), utilise weightKg:null et reps comme "5 km" ou "30 min".

═══ RÈGLE ABSOLUE — GROUPES MUSCULAIRES PAR SÉANCE ═══
PUSH → UNIQUEMENT : pectoraux, épaules (deltoïdes), triceps. Exercices autorisés : développé couché/incliné/décliné, écarté, dips, développé militaire, élévations latérales/frontales, extension triceps, pushdown, overhead press.
PULL → UNIQUEMENT : dos (grand dorsal, trapèzes, rhomboïdes), biceps, arrière des épaules. Exercices autorisés : tractions, tirage vertical/horizontal, rowing, curl barre/haltères/poulie, face pull, shrug.
LEGS → UNIQUEMENT : quadriceps, ischio-jambiers, fessiers, mollets, abdominaux. Exercices autorisés : squat, leg press, fentes, leg extension, leg curl, hip thrust, soulevé de terre roumain, extension mollet, gainage, crunch.
FULL BODY → peut mélanger, mais 1 composé par grand groupe (squat OU leg press, bench OU dips, row OU traction).
UPPER → pectoraux + dos + épaules + bras. LOWER → jambes + fessiers + mollets + abdos.
INTERDICTION ABSOLUE : ne jamais mettre un exercice de pec/épaule/triceps dans une séance Legs, ni un squat/leg press dans une séance Push ou Pull.

FORMAT JSON :
{"weekGoal":"Conseil personnalisé basé sur l'analyse","sessions":[{"name":"Push – Pec, Épaules, Triceps","exercises":[{"name":"Développé couché barre","sets":4,"reps":"6-8","weightKg":82.5},{"name":"Développé incliné haltères","sets":4,"reps":"8-10","weightKg":28},{"name":"Élévations latérales","sets":3,"reps":"12-15","weightKg":12},{"name":"Développé militaire","sets":4,"reps":"8-10","weightKg":50},{"name":"Dips","sets":3,"reps":"10-12","weightKg":null},{"name":"Extension triceps poulie","sets":3,"reps":"12-15","weightKg":20}]}]}`

    type PlanPayload = {
      weekGoal: string
      sessions: Array<{
        name: string
        exercises: Array<{ name: string; sets: number; reps: string; weightKg: number | null }>
      }>
    }

    let resultPlan: PlanPayload | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Tu es un coach sportif expert. Tu génères des programmes d'entraînement complets et personnalisés. Tu réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après. Chaque séance doit contenir MINIMUM 6 exercices.",
          },
          { role: "user", content: prompt },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response_format: { type: "json_object" } as any,
        max_tokens: 3000,
        temperature: 0.3,
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? ""
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) continue
      try {
        const parsed = JSON.parse(match[0]) as Partial<PlanPayload>
        if (!parsed.sessions || !parsed.weekGoal) continue
        // Validate: at least one session with meaningful exercises
        if (!parsed.sessions.some(s => s.exercises && s.exercises.length >= 4)) continue

        // Validate: no upper-body exercises in Legs sessions (all comparisons use normalize())
        const LEGS_KEYWORDS = ["legs", "jambe", "leg", "cuisses", "fessiers", "mollets", "squat", "quad"]
        const PUSH_KEYWORDS = ["push", "pouss", "pec", "chest"]
        const PULL_KEYWORDS = ["pull", "tir", "dos", "back"]
        const UPPER_CONTAM  = ["developpe", "bench", "curl", "elevation", "triceps", "ecarte", "dips", "shoulder", "epaule", "overhead", "pec"]
        const LOWER_CONTAM  = ["squat", "leg press", "fentes", "hip thrust", "leg extension", "leg curl"]

        let contaminated = false
        for (const session of parsed.sessions) {
          const sName = normalize(session.name)
          const isLegs = LEGS_KEYWORDS.some(k => sName.includes(k))
          const isPush = PUSH_KEYWORDS.some(k => sName.includes(k))
          const isPull = PULL_KEYWORDS.some(k => sName.includes(k))

          for (const ex of session.exercises) {
            const eName = normalize(ex.name)
            // "leg curl" et "nordic curl" sont autorisés dans Legs malgré le mot "curl"
            const isLegCurl = eName.includes("leg curl") || eName.includes("nordic") || eName.includes("ischio")
            if (isLegs && !isLegCurl && UPPER_CONTAM.some(k => eName.includes(k))) { contaminated = true; break }
            if ((isPush || isPull) && LOWER_CONTAM.some(k => eName.includes(k))) { contaminated = true; break }
          }
          if (contaminated) break
        }
        if (contaminated) continue

        resultPlan = parsed as PlanPayload
        break
      } catch { continue }
    }

    if (!resultPlan) return Response.json({ error: "generation_failed" }, { status: 500 })

    const now = new Date()
    await prisma.user.update({
      where: { email: authUser.email },
      data: { trainingPlan: resultPlan, trainingPlanAt: now },
    })

    return Response.json({ plan: resultPlan, generatedAt: now })
  } catch (e) {
    console.error("[training-plan POST]", e)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
