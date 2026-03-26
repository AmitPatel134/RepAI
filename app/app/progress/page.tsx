"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { DEMO_WORKOUTS } from "@/lib/demoData"

type ActivityPoint = { day: string; dateNum: number; dateStr: string; count: number; isToday: boolean }

function computeWeekData(items: { date: string }[]): ActivityPoint[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const dayOfWeek = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = items.filter(w => w.date.slice(0, 10) === dateStr).length
    const day = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").slice(0, 3)
    return { day: day.charAt(0).toUpperCase() + day.slice(1), dateNum: d.getDate(), dateStr, count, isToday: dateStr === todayStr }
  })
}

function computeMonthDays(items: { date: string }[], offset = 0): (ActivityPoint | null)[] {
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
    const count = items.filter(w => w.date.slice(0, 10) === dateStr).length
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
  if (count === 1) return <div className={`${bigDot} rounded-full bg-red-500`} />
  if (count === 2) return (
    <div className={`flex ${gap}`}>
      <div className={`${dot} rounded-full bg-red-500`} />
      <div className={`${dot} rounded-full bg-red-500`} />
    </div>
  )
  if (count === 3) return (
    <div className={`flex flex-col ${gap} items-center`}>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-red-500`} />
        <div className={`${dot} rounded-full bg-red-500`} />
      </div>
      <div className={`${dot} rounded-full bg-red-500`} />
    </div>
  )
  return (
    <div className={`flex flex-col ${gap} items-center`}>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-red-500`} />
        <div className={`${dot} rounded-full bg-red-500`} />
      </div>
      <div className={`flex ${gap}`}>
        <div className={`${dot} rounded-full bg-red-500`} />
        <div className={`${dot} rounded-full bg-red-400/60`} />
      </div>
    </div>
  )
}

function DayCircle({ pt, small, showDay }: { pt: ActivityPoint; small?: boolean; showDay?: boolean }) {
  const size = small ? "w-9 h-9" : "w-11 h-11"
  return (
    <div className="flex flex-col items-center gap-1">
      {showDay && (
        <span className={`text-[10px] font-bold leading-tight ${pt.isToday ? "text-red-500" : "text-gray-400"}`}>
          {pt.day}
        </span>
      )}
      <div className={`${size} rounded-full flex items-center justify-center ${
        pt.count > 0 ? "border border-red-400 bg-red-50" :
        pt.isToday ? "border border-red-300" : "border border-gray-200"
      }`}>
        <SessionDots count={pt.count} small={small} />
      </div>
      <span className={`text-[10px] font-semibold leading-tight ${pt.isToday ? "text-red-500" : "text-gray-400"}`}>
        {pt.dateNum}
      </span>
    </div>
  )
}

const CHART_COLORS = ["#dc2626", "#059669", "#d97706", "#7c3aed", "#0ea5e9", "#f59e0b"]

type ExerciseOption = { key: string; label: string; data: { date: string; weight: number }[]; color: string; sessions?: number }

function computeProgressionByExercise(workouts: typeof DEMO_WORKOUTS): ExerciseOption[] {
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
        existing.weight = Math.round(((existing.weight * existing.sessions) + avg) / (existing.sessions + 1) * 10) / 10
        existing.sessions++
      } else {
        map[ex.name].push({ date: label, weight: avg, sessions: 1 })
      }
    }
  }
  return Object.entries(map)
    .sort((a, b) => b[1].reduce((s, d) => s + d.sessions, 0) - a[1].reduce((s, d) => s + d.sessions, 0))
    .map(([name, data], i) => ({
      key: name, label: name,
      data: data.map(({ date, weight }) => ({ date, weight })),
      color: CHART_COLORS[i % CHART_COLORS.length],
      sessions: data.reduce((s, d) => s + d.sessions, 0),
    }))
}

function calcEstimated1RM(weight: number, reps: number): number {
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
          prMap[key] = { exercise: ex.name, weight: s.weight, reps: s.reps, date: workout.date, estimated1rm: e1rm }
        }
      }
    }
  }
  return Object.values(prMap).sort((a, b) => b.estimated1rm - a.estimated1rm)
}

type WeightPoint = { id: string; weightKg: number; recordedAt: string }

export default function ProgressPage() {
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null)
  const [prs, setPrs] = useState<PRData[]>([])
  const [weightEntries, setWeightEntries] = useState<WeightPoint[]>([])
  const [showWeightInput, setShowWeightInput] = useState(false)
  const [weightInput, setWeightInput] = useState("")
  const [savingWeight, setSavingWeight] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showExPicker, setShowExPicker] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return { activity: true, weight: true, progression: true, prs: true }
    try {
      const saved = localStorage.getItem("progress-sections")
      const parsed = saved ? JSON.parse(saved) : {}
      return { activity: true, weight: true, progression: true, prs: true, ...parsed, volume: undefined }
    } catch { return { activity: true, weight: true, progression: true, prs: true } }
  })

  function toggleSection(key: string) {
    setVisible((prev: Record<string, boolean>) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem("progress-sections", JSON.stringify(next))
      return next
    })
  }

  async function handleAddWeight() {
    const kg = parseFloat(weightInput.replace(",", "."))
    if (!kg || isNaN(kg)) return
    setSavingWeight(true)
    const res = await authFetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: kg }),
    })
    if (res.ok) {
      const entry = await res.json()
      setWeightEntries(prev => [...prev, entry].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)))
      setWeightInput("")
      setShowWeightInput(false)
    }
    setSavingWeight(false)
  }

  const [monthOffset, setMonthOffset] = useState(0)
  const [rawWorkouts, setRawWorkouts] = useState<typeof DEMO_WORKOUTS>([])
  const [rawActivities, setRawActivities] = useState<{ date: string }[]>([])
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
        setReady(true)
        return
      }
      // Instant display from cache
      const cW = getCached<typeof DEMO_WORKOUTS>("/api/workouts")
      const cA = getCached<{ date: string }[]>("/api/activities")
      const cWt = getCached<WeightPoint[]>("/api/weight")
      const cP = getCached<{ plan: string }>("/api/plan")
      if (cP) setPlan(cP.plan ?? "free")
      if (cW) {
        const hasData = cW.length > 0
        setRawWorkouts(cW)
        const options = hasData ? computeProgressionByExercise(cW) : []
        setExerciseOptions(options)
        setSelectedExercise(options[0] ?? null)
        setPrs(hasData ? computePRs(cW) : [])
      }
      if (cA) setRawActivities(cA)
      if (cWt) setWeightEntries(cWt)
      if (cW && cA && cWt && cP) setReady(true)

      // Refresh in background
      Promise.all([
        authFetch("/api/workouts").then(r => r.json()).catch(() => []),
        authFetch("/api/weight").then(r => r.json()).catch(() => []),
        authFetch("/api/activities").then(r => r.json()).catch(() => []),
        authFetch("/api/plan").then(r => r.json()).catch(() => ({ plan: "free" })),
      ]).then(([d, weights, acts, p]) => {
          const hasData = Array.isArray(d) && d.length > 0
          const workouts: typeof DEMO_WORKOUTS = hasData ? d : []
          setRawWorkouts(workouts); setCached("/api/workouts", workouts)
          if (Array.isArray(acts)) { setRawActivities(acts); setCached("/api/activities", acts) }
          const options = hasData ? computeProgressionByExercise(workouts) : []
          setExerciseOptions(options)
          setSelectedExercise(options[0] ?? null)
          setPrs(hasData ? computePRs(workouts) : [])
          if (Array.isArray(weights)) { setWeightEntries(weights); setCached("/api/weight", weights) }
          setPlan(p?.plan ?? "free"); setCached("/api/plan", p)
          setReady(true)
        })
        .catch(() => { setExerciseOptions([]); setSelectedExercise(null); setReady(true) })
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      const w = weekPanelRef.current?.offsetHeight ?? 0
      const m = monthPanelRef.current?.offsetHeight ?? 0
      if (w > 0 && m > 0) setPanelH({ week: w, month: m })
    }, 30)
    return () => clearTimeout(t)
  }, [ready, monthOffset, rawWorkouts])

  if (!ready) return <LoadingScreen color="#dc2626" />

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      {isDemo && (
        <div className="bg-red-700 px-6 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-red-100">
            Mode démo — <a href="/login" className="underline text-white">Connectez-vous</a> pour vos vraies progressions.
          </p>
          <a href="/login" className="text-xs font-bold text-red-600 bg-white px-3 py-1 rounded-full hover:bg-red-50 transition-colors">
            Se connecter
          </a>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-3 z-30 px-3 md:px-4 pt-3">
        <div className="max-w-5xl mx-auto bg-red-600/85 backdrop-blur-xl rounded-2xl shadow-lg shadow-red-900/20 px-4 md:px-5 pt-4 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/60 mb-1">Ton évolution physique</p>
            <h1 className="text-3xl font-bold text-white tracking-tight font-[family-name:var(--font-barlow-condensed)]">Mes progrès</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowEditor(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>

            <div
              className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-56 pointer-events-none"
              style={{
                opacity: showEditor ? 1 : 0,
                transform: showEditor ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.96)",
                transition: "opacity 0.18s ease, transform 0.18s ease",
                pointerEvents: showEditor ? "auto" : "none",
              }}
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Sections affichées</p>
              {[
                { key: "activity", label: "Activité" },
                { key: "weight", label: "Suivi du poids" },
                { key: "progression", label: "Progression" },
                { key: "prs", label: "Personal Records" },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => toggleSection(s.key)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    visible[s.key] ? "bg-red-600 border-red-600" : "border-gray-300"
                  }`}>
                    {visible[s.key] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 text-left">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
        {showEditor && <div className="fixed inset-0 z-40" onClick={() => setShowEditor(false)} />}

        {/* Activity chart */}
        {visible.activity && ((() => {
          const historyLimitDate = plan === "free" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : null
          const visibleWorkouts = historyLimitDate
            ? rawWorkouts.filter(w => new Date(w.date) >= historyLimitDate)
            : rawWorkouts
          const visibleActivities = historyLimitDate
            ? rawActivities.filter(a => new Date(a.date) >= historyLimitDate)
            : rawActivities
          const allItems = [...visibleWorkouts, ...visibleActivities]
          const weekData = computeWeekData(allItems)
          const monthData = computeMonthDays(allItems, monthOffset)
          const weekTotal = weekData.reduce((s, d) => s + d.count, 0)
          const monthTotal = monthData.reduce((s, d) => s + (d?.count ?? 0), 0)
          const targetDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
          const monthName = targetDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"]
          const canGoNext = monthOffset < 0
          const slideY = expanded && panelH.week > 0 ? -panelH.week : 0
          const containerH = panelH.week === 0 ? "auto" : expanded ? panelH.month : panelH.week

          return (
            <div className="bg-white border border-gray-200 rounded-3xl mb-3 md:mb-4 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-rose-400" />
              <div className="overflow-hidden" style={{ height: containerH, transition: "height 0.38s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ transform: `translateY(${slideY}px)`, transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1)" }}>
                  <div ref={weekPanelRef} className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Activité</p>
                        <p className="text-sm font-extrabold text-gray-900">Séances réalisées</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-gray-900">{weekTotal}</p>
                        <p className="text-[10px] text-gray-400 font-medium">cette semaine</p>
                      </div>
                    </div>
                    <div className="flex justify-between px-1">
                      {weekData.map((pt, i) => <DayCircle key={i} pt={pt} />)}
                    </div>
                  </div>

                  <div ref={monthPanelRef} className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setMonthOffset(o => o - 1)}
                        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-gray-900 capitalize">{monthName}</p>
                        <p className="text-[10px] text-gray-400">{monthTotal} séance{monthTotal > 1 ? "s" : ""}</p>
                      </div>
                      {canGoNext ? (
                        <button
                          onClick={() => setMonthOffset(o => o + 1)}
                          className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : <div className="w-8 h-8" />}
                    </div>
                    <div className="grid grid-cols-7 mb-1">
                      {["L","M","M","J","V","S","D"].map((h, i) => (
                        <p key={i} className="text-[10px] font-bold text-gray-400 text-center">{h}</p>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 pb-2">
                      {monthData.map((pt, i) =>
                        pt ? <div key={i} className="flex justify-center"><DayCircle pt={pt} small /></div> : <div key={i} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex items-center justify-center py-2.5 border-t border-gray-200 cursor-pointer select-none"
                onTouchStart={e => { dragStartY.current = e.touches[0].clientY }}
                onTouchEnd={e => {
                  const dy = e.changedTouches[0].clientY - dragStartY.current
                  if (dy > 30 && !expanded) setExpanded(true)
                  else if (dy < -30 && expanded) { setExpanded(false); setMonthOffset(0) }
                }}
                onClick={() => { setExpanded(v => { if (v) setMonthOffset(0); return !v }) }}
              >
                <svg
                  className="w-3.5 h-3.5 text-gray-400 transition-transform duration-300"
                  style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )
        })())}

        {plan === "free" && !isDemo && (
          <div className="mx-3 md:mx-4 mb-4 rounded-2xl border-2 border-dashed border-gray-200 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-700 mb-1">Historique complet</p>
              <p className="text-xs text-gray-400 font-medium">Accédez à tout votre historique au-delà de 7 jours avec Premium.</p>
            </div>
            <a href="/pricing" className="shrink-0 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors">
              Premium →
            </a>
          </div>
        )}

        {/* Progression chart */}
        {visible.progression && (
          <div className="bg-white border border-gray-200 rounded-3xl mb-3 md:mb-4 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-rose-400" />
            <div className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Progression</p>
                <p className="text-sm font-extrabold text-gray-900">Charge moyenne par séance</p>
              </div>
              {selectedExercise && exerciseOptions.length > 0 && (
                <button
                  onClick={() => setShowExPicker(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: `3px solid ${selectedExercise.color}` }}
                >
                  <span className="text-xs font-bold text-gray-900 max-w-[120px] truncate">{selectedExercise.label}</span>
                  <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
            {!selectedExercise || selectedExercise.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <p className="text-gray-400 text-sm font-medium">Loggez des séances avec des poids pour voir votre progression</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={selectedExercise.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.replace(/\s+\d{4}$/, "")}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}kg`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", fontSize: "12px", color: "#111827" }}
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
            </div>
          </div>
        )}

        {/* Exercise picker */}
        {showExPicker && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowExPicker(false)}>
            <div className="bg-white border border-gray-200 rounded-t-3xl w-full max-w-lg flex flex-col shadow-xl" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="px-4 pt-2 pb-1 shrink-0">
                <p className="text-sm font-extrabold text-gray-900">Choisir un exercice</p>
              </div>
              <div className="overflow-y-auto px-4 pb-6 flex flex-col gap-2 mt-3">
                {exerciseOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSelectedExercise(opt); setShowExPicker(false) }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                      selectedExercise?.key === opt.key ? "bg-gray-100" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{opt.label}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{opt.sessions} séance{(opt.sessions ?? 0) > 1 ? "s" : ""} · {opt.data.length} point{opt.data.length > 1 ? "s" : ""} de données</p>
                    </div>
                    {selectedExercise?.key === opt.key && (
                      <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weight tracking */}
        {visible.weight && !isDemo && (() => {
          const chartData = weightEntries.map(e => ({
            date: new Date(e.recordedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
            weight: e.weightKg,
            id: e.id,
          }))
          const latest = weightEntries[weightEntries.length - 1]
          return (
            <div className="bg-white border border-gray-200 rounded-3xl mb-3 md:mb-4 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-violet-600 via-violet-500 to-purple-400" />
              <div className="p-4 md:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Poids</p>
                  <p className="text-sm font-extrabold text-gray-900">Suivi du poids</p>
                  {latest && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Dernier : <span className="font-bold text-gray-700">{latest.weightKg} kg</span>
                      {" · "}{new Date(latest.recordedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowWeightInput(v => !v)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-bold text-gray-700"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Ajouter
                </button>
              </div>

              {showWeightInput && (
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="number" step="0.1" min="30" max="300"
                    value={weightInput} onChange={e => setWeightInput(e.target.value)}
                    placeholder="ex: 74.5"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleAddWeight() }}
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
                  />
                  <span className="text-sm text-gray-400 font-medium shrink-0">kg</span>
                  <button
                    onClick={handleAddWeight} disabled={savingWeight || !weightInput}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40"
                  >
                    {savingWeight ? "…" : "OK"}
                  </button>
                  <button onClick={() => { setShowWeightInput(false); setWeightInput("") }} className="p-2 text-gray-400 hover:text-gray-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {chartData.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-36 text-center">
                  <p className="text-gray-400 text-sm font-medium">Ajoutez au moins 2 pesées pour voir la courbe</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `${v}kg`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", fontSize: "12px", color: "#111827" }}
                      formatter={(v: unknown) => [`${v} kg`, "Poids"]}
                    />
                    <Line
                      type="monotone" dataKey="weight"
                      stroke="#7c3aed" strokeWidth={2.5}
                      dot={{ fill: "#7c3aed", r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              </div>
            </div>
          )
        })()}

        {/* Personal Records */}
        {visible.prs && (
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-400" />
            <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Records</p>
              <p className="text-sm font-extrabold text-gray-900">Personal Records (1RM estimé)</p>
            </div>
            <div className="flex flex-col gap-2">
              {prs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-200">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <p className="text-gray-400 text-sm font-medium">Vos records apparaîtront ici</p>
                </div>
              )}
              {prs.slice(0, 6).map((pr, i) => (
                <div key={pr.exercise} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-500" :
                    i === 1 ? "bg-gray-100 text-gray-400" :
                    i === 2 ? "bg-orange-100 text-orange-500" :
                    "bg-gray-50 text-gray-400"
                  }`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{pr.exercise}</p>
                    <p className="text-xs text-gray-400">{pr.reps} × {pr.weight}kg</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-red-500">{pr.estimated1rm}kg</p>
                    <p className="text-xs text-gray-400">1RM est.</p>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
