"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell,
} from "recharts"
import { DEMO_WORKOUTS } from "@/lib/demoData"

type ActivityPoint = { day: string; dateNum: number; dateStr: string; count: number; isToday: boolean }

function computeWeekData(workouts: typeof DEMO_WORKOUTS): ActivityPoint[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const dayOfWeek = (now.getDay() + 6) % 7 // 0=Lun, 6=Dim
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = workouts.filter(w => w.date.slice(0, 10) === dateStr).length
    const day = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").slice(0, 3)
    return { day: day.charAt(0).toUpperCase() + day.slice(1), dateNum: d.getDate(), dateStr, count, isToday: dateStr === todayStr }
  })
}

function computeMonthDays(workouts: typeof DEMO_WORKOUTS, offset = 0): (ActivityPoint | null)[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = target.getFullYear()
  const month = target.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (ActivityPoint | null)[] = Array(firstDayOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dateStr = date.toISOString().slice(0, 10)
    const count = workouts.filter(w => w.date.slice(0, 10) === dateStr).length
    const day = date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").slice(0, 3)
    cells.push({ day: day.charAt(0).toUpperCase() + day.slice(1), dateNum: d, dateStr, count, isToday: dateStr === todayStr })
  }
  return cells
}


function SessionDots({ count, small }: { count: number; small?: boolean }) {
  const dot = small ? "w-1.5 h-1.5" : "w-2 h-2"
  const bigDot = small ? "w-2 h-2" : "w-3.5 h-3.5"
  const gap = small ? "gap-0.5" : "gap-1"
  if (count === 0) return null
  if (count === 1) return <div className={`${bigDot} rounded-full bg-violet-500`} />
  if (count === 2) return (
    <div className={`flex ${gap}`}>
      <div className={`${dot} rounded-full bg-violet-500`} />
      <div className={`${dot} rounded-full bg-violet-500`} />
    </div>
  )
  if (count === 3) return (
    <div className={`flex flex-col ${gap} items-center`}>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-violet-500`} />
        <div className={`${dot} rounded-full bg-violet-500`} />
      </div>
      <div className={`${dot} rounded-full bg-violet-500`} />
    </div>
  )
  return (
    <div className={`flex flex-col ${gap} items-center`}>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-violet-500`} />
        <div className={`${dot} rounded-full bg-violet-500`} />
      </div>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-violet-500`} />
        <div className={`${dot} rounded-full bg-violet-400/60`} />
      </div>
    </div>
  )
}

function DayCircle({ pt, small, showDay }: { pt: ActivityPoint; small?: boolean; showDay?: boolean }) {
  const size = small ? "w-9 h-9" : "w-11 h-11"
  return (
    <div className="flex flex-col items-center gap-1">
      {showDay && (
        <span className={`text-[10px] font-bold leading-tight ${pt.isToday ? "text-violet-400" : "text-gray-500"}`}>
          {pt.day}
        </span>
      )}
      <div className={`${size} rounded-full flex items-center justify-center ${
        pt.count > 0 ? "border border-violet-500/50 bg-violet-500/15" :
        pt.isToday ? "border border-violet-500/30" : "border border-white/10"
      }`}>
        <SessionDots count={pt.count} small={small} />
      </div>
      <span className={`text-[10px] font-semibold leading-tight ${pt.isToday ? "text-violet-300" : "text-gray-600"}`}>
        {pt.dateNum}
      </span>
    </div>
  )
}

const CHART_COLORS = ["#7c3aed", "#059669", "#d97706", "#e11d48", "#0ea5e9", "#f59e0b"]

type ExerciseOption = { key: string; label: string; data: { date: string; weight: number }[]; color: string; sessions?: number }

function computeProgressionByExercise(workouts: typeof DEMO_WORKOUTS): ExerciseOption[] {
  // For each exercise, build average weight per workout date
  const map: Record<string, { date: string; weight: number; sessions: number }[]> = {}
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))

  for (const workout of sorted) {
    const dateStr = workout.date.slice(0, 10)
    const label = new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })

    for (const ex of workout.exercises) {
      const setsWithWeight = ex.sets.filter(s => (s.weight ?? 0) > 0)
      if (setsWithWeight.length === 0) continue
      const avg = Math.round(setsWithWeight.reduce((sum, s) => sum + (s.weight ?? 0), 0) / setsWithWeight.length * 10) / 10

      if (!map[ex.name]) map[ex.name] = []
      const existing = map[ex.name].find(p => p.date === label)
      if (existing) {
        // Average across multiple sessions same day
        existing.weight = Math.round(((existing.weight * existing.sessions) + avg) / (existing.sessions + 1) * 10) / 10
        existing.sessions++
      } else {
        map[ex.name].push({ date: label, weight: avg, sessions: 1 })
      }
    }
  }

  // Sort by frequency (most sessions), expose all exercises with data
  return Object.entries(map)
    .sort((a, b) => b[1].reduce((s, d) => s + d.sessions, 0) - a[1].reduce((s, d) => s + d.sessions, 0))
    .map(([name, data], i) => ({
      key: name,
      label: name,
      data: data.map(({ date, weight }) => ({ date, weight })),
      color: CHART_COLORS[i % CHART_COLORS.length],
      sessions: data.reduce((s, d) => s + d.sessions, 0),
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
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null)
  const [prs, setPrs] = useState<PRData[]>([])
  const [volumeByEx, setVolumeByEx] = useState<{ name: string; volume: number }[]>([])
  const [expanded, setExpanded] = useState(false)
  const [showExPicker, setShowExPicker] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return { activity: true, progression: true, volume: true, prs: true }
    try {
      const saved = localStorage.getItem("progress-sections")
      return saved ? JSON.parse(saved) : { activity: true, progression: true, volume: true, prs: true }
    } catch { return { activity: true, progression: true, volume: true, prs: true } }
  })

  function toggleSection(key: string) {
    setVisible((prev: Record<string, boolean>) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem("progress-sections", JSON.stringify(next))
      return next
    })
  }
  const [monthOffset, setMonthOffset] = useState(0)
  const [rawWorkouts, setRawWorkouts] = useState<typeof DEMO_WORKOUTS>([])
  const dragStartY = useRef(0)
  const weekPanelRef = useRef<HTMLDivElement>(null)
  const monthPanelRef = useRef<HTMLDivElement>(null)
  const [panelH, setPanelH] = useState({ week: 0, month: 0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setRawWorkouts(DEMO_WORKOUTS)
        setExerciseOptions([])
        setSelectedExercise(null)
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
          setRawWorkouts(workouts)
          const options = hasData ? computeProgressionByExercise(workouts) : []
          setExerciseOptions(options)
          setSelectedExercise(options[0] ?? null)
          setPrs(hasData ? computePRs(workouts) : [])
          setVolumeByEx(hasData ? computeVolumeByExercise(workouts) : [])
          setReady(true)
        })
        .catch(() => {
          setExerciseOptions([])
          setSelectedExercise(null)
          setReady(true)
        })
    })
  }, [])

  // Measure panel heights whenever content changes
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      const w = weekPanelRef.current?.offsetHeight ?? 0
      const m = monthPanelRef.current?.offsetHeight ?? 0
      if (w > 0 && m > 0) setPanelH({ week: w, month: m })
    }, 30)
    return () => clearTimeout(t)
  }, [ready, monthOffset, rawWorkouts])

  if (!ready) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
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
        <div className="mb-6 md:mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Analyse</p>
            <h1 className="text-2xl font-extrabold text-white">Mes progrès</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowEditor(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors mt-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>

            <div
              className="absolute right-0 top-full mt-2 z-50 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-3 w-56 pointer-events-none"
              style={{
                opacity: showEditor ? 1 : 0,
                transform: showEditor ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.96)",
                transition: "opacity 0.18s ease, transform 0.18s ease",
                pointerEvents: showEditor ? "auto" : "none",
              }}
            >
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Sections affichées</p>
              {[
                { key: "activity", label: "Activité" },
                { key: "progression", label: "Progression" },
                { key: "volume", label: "Volume par exercice" },
                { key: "prs", label: "Personal Records" },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => toggleSection(s.key)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    visible[s.key] ? "bg-violet-600 border-violet-600" : "border-white/20"
                  }`}>
                    {visible[s.key] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-white text-left">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {showEditor && <div className="fixed inset-0 z-40" onClick={() => setShowEditor(false)} />}

        {/* Activity chart */}
        {visible.activity && ((() => {
          const weekData = computeWeekData(rawWorkouts)
          const monthData = computeMonthDays(rawWorkouts, monthOffset)
          const weekTotal = weekData.reduce((s, d) => s + d.count, 0)
          const monthTotal = monthData.reduce((s, d) => s + (d?.count ?? 0), 0)
          const targetDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
          const monthName = targetDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"]
          const canGoNext = monthOffset < 0
          const slideY = expanded && panelH.week > 0 ? -panelH.week : 0
          const containerH = panelH.week === 0 ? "auto" : expanded ? panelH.month : panelH.week

          return (
            <div className="bg-white/5 border border-white/10 rounded-3xl mb-3 md:mb-4">

              {/* Sliding panels */}
              <div
                className="overflow-hidden"
                style={{ height: containerH, transition: "height 0.38s cubic-bezier(0.4,0,0.2,1)" }}
              >
                <div style={{ transform: `translateY(${slideY}px)`, transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1)" }}>

                  {/* Week panel */}
                  <div ref={weekPanelRef} className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Activité</p>
                        <p className="text-sm font-extrabold text-white">Séances réalisées</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">{weekTotal}</p>
                        <p className="text-[10px] text-gray-500 font-medium">cette semaine</p>
                      </div>
                    </div>
                    <div className="flex justify-between px-1">
                      {weekData.map((pt, i) => (
                        <DayCircle key={i} pt={pt} />
                      ))}
                    </div>
                  </div>

                  {/* Month panel */}
                  <div ref={monthPanelRef} className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setMonthOffset(o => o - 1)}
                        className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-white capitalize">{monthName}</p>
                        <p className="text-[10px] text-gray-500">{monthTotal} séance{monthTotal > 1 ? "s" : ""}</p>
                      </div>
                      {canGoNext ? (
                        <button
                          onClick={() => setMonthOffset(o => o + 1)}
                          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_HEADERS.map((h, i) => (
                        <p key={i} className="text-[10px] font-bold text-gray-600 text-center">{h}</p>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 pb-2">
                      {monthData.map((pt, i) =>
                        pt ? (
                          <div key={i} className="flex justify-center">
                            <DayCircle pt={pt} small />
                          </div>
                        ) : <div key={i} />
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Handle */}
              <div
                className="flex items-center justify-center py-2.5 border-t border-white/5 cursor-pointer select-none"
                onTouchStart={e => { dragStartY.current = e.touches[0].clientY }}
                onTouchEnd={e => {
                  const dy = e.changedTouches[0].clientY - dragStartY.current
                  if (dy > 30 && !expanded) setExpanded(true)
                  else if (dy < -30 && expanded) { setExpanded(false); setMonthOffset(0) }
                }}
                onClick={() => { setExpanded(v => { if (v) setMonthOffset(0); return !v }) }}
              >
                <svg
                  className="w-3.5 h-3.5 text-gray-600 transition-transform duration-300"
                  style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )
        })())}

        {/* Progression chart */}
        {visible.progression && <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 mb-3 md:mb-4">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Progression</p>
              <p className="text-sm font-extrabold text-white">Charge moyenne par séance</p>
            </div>
            {selectedExercise && exerciseOptions.length > 0 && (
              <button
                onClick={() => setShowExPicker(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
                style={{ borderLeft: `3px solid ${selectedExercise.color}` }}
              >
                <span className="text-xs font-bold text-white max-w-[120px] truncate">{selectedExercise.label}</span>
                <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          {!selectedExercise || selectedExercise.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-gray-500 text-sm font-medium">Loggez des séances avec des poids pour voir votre progression</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={selectedExercise.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 600 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.replace(/\s+\d{4}$/, "")}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 600 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}kg`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", fontSize: "12px", color: "#fff" }}
                  formatter={(v: unknown) => [`${v} kg`, "Moy."]}
                />
                <Line
                  type="monotone" dataKey="weight"
                  stroke={selectedExercise.color} strokeWidth={2.5}
                  dot={{ fill: selectedExercise.color, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>}

        {/* Exercise picker modal */}
        {showExPicker && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowExPicker(false)}>
            <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-4 pt-2 pb-1 shrink-0">
                <p className="text-sm font-extrabold text-white">Choisir un exercice</p>
              </div>
              <div className="overflow-y-auto px-4 pb-6 flex flex-col gap-2 mt-3">
                  {exerciseOptions.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSelectedExercise(opt); setShowExPicker(false) }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                        selectedExercise?.key === opt.key ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{opt.label}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{opt.sessions} séance{(opt.sessions ?? 0) > 1 ? "s" : ""} · {opt.data.length} point{opt.data.length > 1 ? "s" : ""} de données</p>
                      </div>
                      {selectedExercise?.key === opt.key && (
                        <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom grid */}
        {(visible.volume || visible.prs) && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

          {/* Volume by exercise */}
          {visible.volume && <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6">
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
                    formatter={(v: unknown) => [`${(Number(v) / 1000).toFixed(1)}t`, "Volume"]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar dataKey="volume" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>}

          {/* PRs table */}
          {visible.prs && <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6">
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
          </div>}

        </div>}
      </div>
    </div>
  )
}
