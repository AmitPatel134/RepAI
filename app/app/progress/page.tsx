"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar,
} from "recharts"
import {
  DEMO_BENCH_PROGRESS, DEMO_SQUAT_PROGRESS, DEMO_DEADLIFT_PROGRESS, DEMO_WORKOUTS,
} from "@/lib/demoData"

const DEMO_EXERCISE_OPTIONS = [
  { key: "bench", label: "Développé couché", data: DEMO_BENCH_PROGRESS, color: "#7c3aed" },
  { key: "squat", label: "Squat", data: DEMO_SQUAT_PROGRESS, color: "#059669" },
  { key: "deadlift", label: "Soulevé de terre", data: DEMO_DEADLIFT_PROGRESS, color: "#d97706" },
]

const CHART_COLORS = ["#7c3aed", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#f59e0b"]

type ExerciseOption = { key: string; label: string; data: { date: string; weight: number }[]; color: string }

function computeProgressionByExercise(workouts: typeof DEMO_WORKOUTS): ExerciseOption[] {
  // For each exercise, build max weight per workout date
  const map: Record<string, { date: string; weight: number }[]> = {}

  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))

  for (const workout of sorted) {
    const dateStr = workout.date.slice(0, 10)
    const d = new Date(dateStr)
    const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

    for (const ex of workout.exercises) {
      const maxWeight = ex.sets.reduce((max, s) => {
        const w = s.weight ?? 0
        return w > max ? w : max
      }, 0)
      if (maxWeight === 0) continue

      if (!map[ex.name]) map[ex.name] = []
      // Keep only max weight per date
      const existing = map[ex.name].find(p => p.date === label)
      if (existing) {
        if (maxWeight > existing.weight) existing.weight = maxWeight
      } else {
        map[ex.name].push({ date: label, weight: maxWeight })
      }
    }
  }

  // Sort exercises by frequency (most logged first), take top 5
  return Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([name, data], i) => ({
      key: name,
      label: name,
      data,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
}

function calcEstimated1RM(weight: number, reps: number): number {
  // Brzycki formula
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10
}

type PRData = { exercise: string; weight: number; reps: number; date: string; estimated1rm: number }

function computePRs(workouts: typeof DEMO_WORKOUTS): PRData[] {
  const prMap: Record<string, PRData> = {}
  for (const workout of workouts) {
    for (const ex of workout.exercises) {
      for (const s of ex.sets) {
        if (!s.reps || !s.weight) continue
        const e1rm = calcEstimated1RM(s.weight, s.reps)
        const key = ex.name.toLowerCase()
        if (!prMap[key] || e1rm > prMap[key].estimated1rm) {
          prMap[key] = {
            exercise: ex.name,
            weight: s.weight,
            reps: s.reps,
            date: workout.date,
            estimated1rm: e1rm,
          }
        }
      }
    }
  }
  return Object.values(prMap).sort((a, b) => b.estimated1rm - a.estimated1rm)
}

function computeVolumeByExercise(workouts: typeof DEMO_WORKOUTS) {
  const map: Record<string, number> = {}
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const vol = ex.sets.reduce((acc, s) => acc + (s.reps ?? 0) * (s.weight ?? 0), 0)
      map[ex.name] = (map[ex.name] ?? 0) + vol
    }
  }
  return Object.entries(map)
    .map(([name, volume]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6)
}

export default function ProgressPage() {
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>(DEMO_EXERCISE_OPTIONS)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption>(DEMO_EXERCISE_OPTIONS[0])
  const [prs, setPrs] = useState<PRData[]>([])
  const [volumeByEx, setVolumeByEx] = useState<{ name: string; volume: number }[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setExerciseOptions(DEMO_EXERCISE_OPTIONS)
        setSelectedExercise(DEMO_EXERCISE_OPTIONS[0])
        setPrs(computePRs(DEMO_WORKOUTS))
        setVolumeByEx(computeVolumeByExercise(DEMO_WORKOUTS))
        setReady(true)
        return
      }
      authFetch("/api/workouts")
        .then(r => r.json())
        .then(d => {
          const hasData = Array.isArray(d) && d.length > 0
          const workouts: typeof DEMO_WORKOUTS = hasData ? d : []
          const options = hasData ? computeProgressionByExercise(workouts) : []
          const opts = options.length > 0 ? options : DEMO_EXERCISE_OPTIONS
          setExerciseOptions(opts)
          setSelectedExercise(opts[0])
          setPrs(hasData ? computePRs(workouts) : [])
          setVolumeByEx(hasData ? computeVolumeByExercise(workouts) : [])
          setReady(true)
        })
        .catch(() => {
          setExerciseOptions(DEMO_EXERCISE_OPTIONS)
          setSelectedExercise(DEMO_EXERCISE_OPTIONS[0])
          setReady(true)
        })
    })
  }, [])

  if (!ready) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-6 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline hover:text-white">Connectez-vous</a> pour vos vraies progressions.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full hover:bg-violet-500 transition-colors">
            Se connecter
          </a>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Analyse</p>
          <h1 className="text-2xl font-extrabold text-white">Mes progrès</h1>
        </div>

        {/* Progression chart */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 mb-3 md:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Progression</p>
              <p className="text-sm font-extrabold text-white">Charge maximale par séance</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {exerciseOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedExercise(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedExercise.key === opt.key
                      ? "text-white"
                      : "bg-white/10 text-gray-400 hover:text-white"
                  }`}
                  style={selectedExercise.key === opt.key ? { backgroundColor: opt.color } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {selectedExercise.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-3xl mb-3">📈</p>
              <p className="text-gray-500 text-sm font-medium">Loggez vos premières séances pour voir votre progression</p>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={selectedExercise.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}kg`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", fontSize: "12px", color: "#fff" }}
                formatter={(v: number) => [`${v} kg`, "Charge"]}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={selectedExercise.color}
                strokeWidth={2.5}
                dot={{ fill: selectedExercise.color, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

          {/* Volume by exercise */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6">
            <div className="mb-4 md:mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Distribution</p>
              <p className="text-sm font-extrabold text-white">Volume total par exercice</p>
            </div>
            {volumeByEx.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <p className="text-3xl mb-3">📊</p>
                <p className="text-gray-500 text-sm font-medium">Loggez des séances pour voir la distribution</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeByEx} layout="vertical" barSize={14}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", fontSize: "12px", color: "#fff" }}
                    formatter={(v: number) => [`${(v / 1000).toFixed(1)}t`, "Volume"]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar dataKey="volume" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* PRs table */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6">
            <div className="mb-4 md:mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Records</p>
              <p className="text-sm font-extrabold text-white">Personal Records (1RM estimé)</p>
            </div>
            <div className="flex flex-col gap-2">
              {prs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-3xl mb-3">🏆</p>
                  <p className="text-gray-500 text-sm font-medium">Vos records apparaîtront ici</p>
                </div>
              )}
              {prs.slice(0, 6).map((pr, i) => (
                <div key={pr.exercise} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    i === 0 ? "bg-amber-500/20 text-amber-400" :
                    i === 1 ? "bg-gray-400/20 text-gray-300" :
                    i === 2 ? "bg-orange-700/20 text-orange-600" :
                    "bg-white/5 text-gray-500"
                  }`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{pr.exercise}</p>
                    <p className="text-xs text-gray-500">{pr.reps} × {pr.weight}kg</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-violet-400">{pr.estimated1rm}kg</p>
                    <p className="text-xs text-gray-600">1RM est.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
