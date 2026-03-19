"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import UpgradeModal from "@/components/UpgradeModal"

// ─── Types ───────────────────────────────────────────────────────────────────

type Workout = {
  id: string
  name: string
  type: string
  date: string
  exercises: { id: string; name: string; sets: { reps: number | null; weight: number | null }[] }[]
}

type Activity = {
  id: string
  type: string
  name: string
  date: string
  durationSec: number | null
  distanceM: number | null
  elevationM: number | null
  avgHeartRate: number | null
  calories: number | null
  avgSpeedKmh: number | null
  avgPaceSecKm: number | null
  notes: string | null
}

type UnifiedItem =
  | { kind: "workout"; data: Workout }
  | { kind: "activity"; data: Activity }

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  { value: "fullbody", label: "Full Body" }, { value: "push", label: "Push" },
  { value: "pull", label: "Pull" }, { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper Body" }, { value: "lower", label: "Lower Body" },
  { value: "cardio", label: "Cardio" }, { value: "hiit", label: "HIIT" },
  { value: "mobility", label: "Mobilité" }, { value: "crossfit", label: "CrossFit" },
  { value: "force", label: "Force" }, { value: "dos", label: "Dos" },
  { value: "bras", label: "Bras" }, { value: "epaules", label: "Épaules" },
  { value: "abdos", label: "Abdos" },
]

const CARDIO_TYPES = [
  { key: "running",    label: "Course",     color: "#f97316" },
  { key: "cycling",    label: "Vélo",       color: "#3b82f6" },
  { key: "swimming",   label: "Natation",   color: "#06b6d4" },
  { key: "walking",    label: "Marche",     color: "#22c55e" },
  { key: "hiking",     label: "Randonnée",  color: "#a3a3a3" },
  { key: "rowing",     label: "Aviron",     color: "#8b5cf6" },
  { key: "elliptical", label: "Elliptique", color: "#ec4899" },
  { key: "other",      label: "Autre",      color: "#6b7280" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}
function fmtDuration(sec: number | null) {
  if (!sec) return null
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}
function fmtDist(m: number | null) {
  if (!m) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtPace(s: number | null) {
  if (!s) return null
  return `${Math.floor(s / 60)}'${(s % 60).toString().padStart(2, "0")}"/km`
}
function getCardioInfo(type: string) {
  return CARDIO_TYPES.find(t => t.key === type) ?? CARDIO_TYPES[CARDIO_TYPES.length - 1]
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function DumbbellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
    </svg>
  )
}

function CardioIcon({ type }: { type: string }) {
  if (type === "running") return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 4a1 1 0 100-2 1 1 0 000 2zM7 8l3 2-2 5h5l2-5 2.5 1M6 20l2.5-5M15 20l-1.5-5" />
    </svg>
  )
  if (type === "cycling") return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17l-2-5 3-2 2 4h4M14 5a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>
  )
  if (type === "swimming") return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
      <circle cx="12" cy="6" r="2"/><path strokeLinecap="round" d="M12 8v4"/>
    </svg>
  )
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  // UI state
  const [filter, setFilter] = useState<"all" | "workout" | "activity">("all")
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showCardioForm, setShowCardioForm] = useState(false)

  // Workout form
  const [wName, setWName] = useState("")
  const [wType, setWType] = useState("fullbody")
  const [wCustomType, setWCustomType] = useState("")
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wNotes, setWNotes] = useState("")
  const [wSaving, setWSaving] = useState(false)

  // Cardio form
  const [cType, setCType] = useState("running")
  const [cName, setCName] = useState("")
  const [cDate, setCDate] = useState(new Date().toISOString().slice(0, 10))
  const [cDurH, setCDurH] = useState("")
  const [cDurM, setCDurM] = useState("")
  const [cDist, setCDist] = useState("")
  const [cElev, setCElev] = useState("")
  const [cHR, setCHR] = useState("")
  const [cCal, setCCal] = useState("")
  const [cNotes, setCNotes] = useState("")
  const [cSaving, setCSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setWorkouts(DEMO_WORKOUTS as unknown as Workout[])
        setLoading(false)
        return
      }
      const email = session.user.email ?? ""
      Promise.all([
        authFetch("/api/workouts").then(r => r.json()).catch(() => []),
        authFetch("/api/activities").then(r => r.json()).catch(() => []),
        fetch(`/api/plan?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ plan: "free" })),
      ]).then(([w, a, p]) => {
        setWorkouts(Array.isArray(w) ? w : [])
        setActivities(Array.isArray(a) ? a : [])
        setPlan(p?.plan ?? "free")
      }).finally(() => setLoading(false))
    })
  }, [])

  // Merged + sorted list
  const unified: UnifiedItem[] = [
    ...workouts.map(w => ({ kind: "workout" as const, data: w })),
    ...activities.map(a => ({ kind: "activity" as const, data: a })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  const filtered = unified.filter(item => filter === "all" || item.kind === filter)

  // Stats this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeekWorkouts = workouts.filter(w => new Date(w.date) >= weekAgo).length
  const thisWeekActivities = activities.filter(a => new Date(a.date) >= weekAgo)
  const totalKm = thisWeekActivities.reduce((s, a) => s + (a.distanceM ?? 0) / 1000, 0)

  function handleAdd() {
    if (isDemo) { setUpgradeMsg("Crée un compte pour ajouter des activités."); return }
    setShowTypeSelector(true)
  }

  async function handleCreateWorkout() {
    if (!wName.trim()) return
    // Free plan: 5 workouts/month
    if (plan === "free") {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthCount = workouts.filter(w => new Date(w.date) >= firstOfMonth).length
      if (monthCount >= 5) {
        setShowWorkoutForm(false)
        setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit. Passez Pro pour un accès illimité.")
        return
      }
    }
    setWSaving(true)
    const finalType = wType === "custom" ? (wCustomType.trim() || "autre") : wType
    const r = await authFetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wName.trim(), type: finalType, notes: wNotes, date: wDate }),
    })
    if (r.ok) {
      const workout = await r.json()
      setShowWorkoutForm(false)
      router.push(`/app/workouts/${workout.id}`)
    }
    setWSaving(false)
  }

  async function handleCreateActivity() {
    if (!cName.trim()) return
    setCSaving(true)
    const durationSec = cDurH || cDurM ? parseInt(cDurH || "0") * 3600 + parseInt(cDurM || "0") * 60 : null
    const distanceM = cDist ? parseFloat(cDist) * 1000 : null
    const r = await authFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: cType, name: cName.trim(), date: cDate, durationSec, distanceM,
        elevationM: cElev ? parseFloat(cElev) : null,
        avgHeartRate: cHR ? parseInt(cHR) : null,
        calories: cCal ? parseInt(cCal) : null,
        notes: cNotes || null,
      }),
    })
    if (r.ok) {
      const act = await r.json()
      setActivities(prev => [act, ...prev])
      setShowCardioForm(false)
      resetCardioForm()
    }
    setCSaving(false)
  }

  function resetCardioForm() {
    setCType("running"); setCName(""); setCDate(new Date().toISOString().slice(0, 10))
    setCDurH(""); setCDurM(""); setCDist(""); setCElev(""); setCHR(""); setCCal(""); setCNotes("")
  }

  async function handleDeleteWorkout(id: string) {
    await authFetch(`/api/workouts/${id}`, { method: "DELETE" })
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function handleDeleteActivity(id: string) {
    await authFetch(`/api/activities/${id}`, { method: "DELETE" })
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">

      {/* Header */}
      <div className="px-4 pt-8 pb-4 md:pt-10 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Activités</h1>
          <p className="text-sm text-gray-500 mt-0.5">{unified.length} au total</p>
        </div>
        <button
          onClick={handleAdd}
          className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/40"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </button>
      </div>

      {/* Stats */}
      {unified.length > 0 && (
        <div className="px-4 mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Séances / semaine", value: `${thisWeekWorkouts}` },
            { label: "Km / semaine", value: totalKm > 0 ? `${totalKm.toFixed(1)}` : "—" },
            { label: "Total", value: `${unified.length}` },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {unified.length > 0 && (
        <div className="px-4 mb-4 flex gap-2">
          {[
            { key: "all", label: `Tout (${unified.length})` },
            { key: "workout", label: `Séances (${workouts.length})` },
            { key: "activity", label: `Cardio (${activities.length})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                filter === f.key ? "bg-white text-gray-900" : "bg-white/[0.06] text-gray-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="px-4 flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-gray-400 font-bold text-sm">Aucune activité</p>
            <p className="text-gray-600 text-xs mt-1">Ajoute ta première séance ou activité</p>
            <button onClick={handleAdd} className="mt-4 text-violet-400 text-sm font-bold">+ Ajouter</button>
          </div>
        )}

        {filtered.map(item => {
          if (item.kind === "workout") {
            const w = item.data
            const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
            return (
              <div
                key={`w-${w.id}`}
                className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-3 cursor-pointer hover:border-white/20 transition-colors"
                onClick={() => router.push(`/app/workouts/${w.id}`)}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 text-violet-400">
                  <DumbbellIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{w.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDate(w.date)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteWorkout(w.id) }}
                      className="text-gray-700 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400">
                      {WORKOUT_TYPES.find(t => t.value === w.type)?.label ?? w.type}
                    </span>
                    {w.exercises.length > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-400">
                        {w.exercises.length} exo{w.exercises.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {totalSets > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-400">
                        {totalSets} série{totalSets > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          } else {
            const a = item.data
            const info = getCardioInfo(a.type)
            return (
              <div key={`a-${a.id}`} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: info.color + "22" }}>
                  <span style={{ color: info.color }}><CardioIcon type={a.type} /></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{a.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDate(a.date)}</p>
                    </div>
                    <button onClick={() => handleDeleteActivity(a.id)} className="text-gray-700 hover:text-red-400 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: info.color + "20", color: info.color }}>{info.label}</span>
                    {a.distanceM && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{fmtDist(a.distanceM)}</span>}
                    {a.durationSec && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{fmtDuration(a.durationSec)}</span>}
                    {a.avgPaceSecKm && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{fmtPace(a.avgPaceSecKm)}</span>}
                    {!a.avgPaceSecKm && a.avgSpeedKmh && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{a.avgSpeedKmh.toFixed(1)} km/h</span>}
                    {a.elevationM && a.elevationM > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">↑{Math.round(a.elevationM)}m</span>}
                    {a.avgHeartRate && <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">{a.avgHeartRate} bpm</span>}
                  </div>
                </div>
              </div>
            )
          }
        })}
      </div>

      {/* ── Type Selector Modal ── */}
      {showTypeSelector && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="px-5 pb-8 pt-2">
              <h3 className="text-base font-black text-white mb-5">Quel type d&apos;activité ?</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTypeSelector(false); setWName(""); setWType("fullbody"); setWCustomType(""); setWDate(new Date().toISOString().slice(0, 10)); setWNotes(""); setShowWorkoutForm(true) }}
                  className="flex items-center gap-4 p-4 bg-violet-600/10 border border-violet-500/30 rounded-2xl text-left hover:border-violet-500/60 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
                    <DumbbellIcon />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">Séance de sport</p>
                    <p className="text-xs text-gray-400 mt-0.5">Exercices avec séries, répétitions et charges</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowTypeSelector(false); resetCardioForm(); setShowCardioForm(true) }}
                  className="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-left hover:border-orange-500/60 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                    <CardioIcon type="running" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">Activité cardio</p>
                    <p className="text-xs text-gray-400 mt-0.5">Course, vélo, natation, randonnée…</p>
                  </div>
                </button>
              </div>
              <button onClick={() => setShowTypeSelector(false)} className="w-full mt-4 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workout Form Modal ── */}
      {showWorkoutForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="px-5 pb-6 pt-2">
              <h3 className="text-base font-black text-white mb-4">Nouvelle séance</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Nom de la séance</label>
                  <input value={wName} onChange={e => setWName(e.target.value)} placeholder="ex: Push Day A" autoFocus
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {WORKOUT_TYPES.map(t => (
                      <button key={t.value} onClick={() => setWType(t.value)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${wType === t.value ? "bg-violet-600/20 border-violet-500 text-violet-300" : "bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20"}`}>
                        {t.label}
                      </button>
                    ))}
                    <button onClick={() => setWType("custom")}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${wType === "custom" ? "bg-violet-600/20 border-violet-500 text-violet-300" : "bg-white/[0.04] border-white/10 text-gray-400 hover:border-white/20"}`}>
                      Perso
                    </button>
                  </div>
                  {wType === "custom" && (
                    <input value={wCustomType} onChange={e => setWCustomType(e.target.value)} placeholder="ex: Yoga, Escalade..."
                      className="mt-2 w-full bg-white/[0.06] border border-violet-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"/>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Notes <span className="text-gray-600 font-normal">(optionnel)</span></label>
                  <textarea value={wNotes} onChange={e => setWNotes(e.target.value)} placeholder="Ressenti, objectifs..." rows={2}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowWorkoutForm(false)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuler</button>
                <button onClick={handleCreateWorkout} disabled={wSaving || !wName.trim()} className="flex-1 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50">
                  {wSaving ? "..." : "Créer →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cardio Form Modal ── */}
      {showCardioForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="px-5 pb-6 pt-2">
              <h3 className="text-base font-black text-white mb-4">Nouvelle activité cardio</h3>
              {/* Type selector */}
              <div className="overflow-x-auto mb-4">
                <div className="flex gap-2 w-max pb-1">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.key} onClick={() => { setCType(t.key); setCName(t.label) }}
                      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all"
                      style={cType === t.key
                        ? { backgroundColor: t.color + "22", borderColor: t.color + "66", color: t.color }
                        : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "#6b7280" }}>
                      <CardioIcon type={t.key} />
                      <span className="text-[10px] font-bold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Nom de l'activité"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500/50"/>
                <input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"/>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Distance (km)</label>
                    <input type="number" min="0" step="0.1" value={cDist} onChange={e => setCDist(e.target.value)} placeholder="ex: 5.2"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none"/>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Durée</label>
                    <div className="flex gap-1 mt-1">
                      <input type="number" min="0" value={cDurH} onChange={e => setCDurH(e.target.value)} placeholder="0h"
                        className="w-1/2 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                      <input type="number" min="0" max="59" value={cDurM} onChange={e => setCDurM(e.target.value)} placeholder="min"
                        className="w-1/2 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(cType === "running" || cType === "cycling" || cType === "hiking") && (
                    <div>
                      <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Dénivelé (m)</label>
                      <input type="number" min="0" value={cElev} onChange={e => setCElev(e.target.value)} placeholder="—"
                        className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">FC moy</label>
                    <input type="number" min="0" value={cHR} onChange={e => setCHR(e.target.value)} placeholder="bpm"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Calories</label>
                    <input type="number" min="0" value={cCal} onChange={e => setCCal(e.target.value)} placeholder="kcal"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                  </div>
                </div>
                <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Notes (optionnel)" rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none resize-none"/>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowCardioForm(false)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">Annuler</button>
                <button onClick={handleCreateActivity} disabled={cSaving || !cName.trim()} className="flex-1 py-3 bg-orange-500 rounded-xl text-sm font-bold text-white hover:bg-orange-400 transition-colors disabled:opacity-50">
                  {cSaving ? "..." : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}
    </div>
  )
}
