"use client"
import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import UpgradeModal from "@/components/UpgradeModal"

// ─── Types ────────────────────────────────────────────────────────────────────

type Workout = {
  id: string; name: string; type: string; date: string
  exercises: { id: string; name: string; sets: { reps: number | null; weight: number | null }[] }[]
}

type Activity = {
  id: string; type: string; name: string; date: string
  durationSec: number | null; distanceM: number | null; elevationM: number | null
  avgHeartRate: number | null; calories: number | null
  avgSpeedKmh: number | null; avgPaceSecKm: number | null; notes: string | null
}

type UnifiedItem = { kind: "workout"; data: Workout } | { kind: "activity"; data: Activity }

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
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
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
function getItemKey(item: UnifiedItem) {
  return item.kind === "workout" ? `w:${item.data.id}` : `a:${item.data.id}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DumbbellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
    </svg>
  )
}

function CardioIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = size
  if (type === "running") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 4a1 1 0 100-2 1 1 0 000 2zM7 8l3 2-2 5h5l2-5 2.5 1M6 20l2.5-5M15 20l-1.5-5" />
    </svg>
  )
  if (type === "cycling") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17l-2-5 3-2 2 4h4M14 5a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>
  )
  if (type === "swimming") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
      <circle cx="12" cy="6" r="2"/><path strokeLinecap="round" d="M12 8v4"/>
    </svg>
  )
  return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)

  // Long press detection
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpFired = useRef(false)
  const lpMoved = useRef(false)
  const lpStartX = useRef(0)
  const lpStartY = useRef(0)

  // Bottom sheet drag-to-dismiss
  const sheetDragY = useRef<number | null>(null)

  // Modals
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showCardioForm, setShowCardioForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

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
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        setOpenMonths(new Set([label]))
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
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        setOpenMonths(new Set([label]))
      }).finally(() => setLoading(false))
    })
  }, [])

  // ─── Unified list ─────────────────────────────────────────────────────────

  const unified: UnifiedItem[] = [
    ...workouts.map(w => ({ kind: "workout" as const, data: w })),
    ...activities.map(a => ({ kind: "activity" as const, data: a })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  const currentYear = String(new Date().getFullYear())
  type MonthGroup = { label: string; items: UnifiedItem[] }
  type YearGroup = { year: string; months: MonthGroup[] }
  const yearGroups: YearGroup[] = []
  for (const item of unified) {
    const year = String(new Date(item.data.date).getFullYear())
    const label = new Date(item.data.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    let yg = yearGroups.find(g => g.year === year)
    if (!yg) { yg = { year, months: [] }; yearGroups.push(yg) }
    const last = yg.months[yg.months.length - 1]
    if (last?.label === label) last.items.push(item)
    else yg.months.push({ label, items: [item] })
  }

  function toggleMonth(label: string) {
    setOpenMonths(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })
  }
  function toggleYear(year: string) {
    setOpenYears(prev => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n })
  }

  // ─── Edit mode ────────────────────────────────────────────────────────────

  function enterEditMode(key: string) {
    setEditMode(true)
    setSelectedIds(new Set([key]))
  }

  function exitEditMode() {
    setEditMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelect(key: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      if (n.size === 0) setEditMode(false)
      return n
    })
  }

  // Long press handlers
  function onItemTouchStart(e: React.TouchEvent, key: string) {
    if (editMode) return
    lpFired.current = false
    lpMoved.current = false
    lpStartX.current = e.touches[0].clientX
    lpStartY.current = e.touches[0].clientY
    lpTimer.current = setTimeout(() => {
      lpFired.current = true
      enterEditMode(key)
    }, 500)
  }

  function onItemTouchMove(e: React.TouchEvent) {
    if (editMode) return
    const dx = Math.abs(e.touches[0].clientX - lpStartX.current)
    const dy = Math.abs(e.touches[0].clientY - lpStartY.current)
    if (dx > 8 || dy > 8) {
      lpMoved.current = true
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
    }
  }

  function onItemTouchEnd() {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
  }

  function onItemClick(key: string, defaultAction: () => void) {
    if (lpFired.current) { lpFired.current = false; return }
    if (editMode) { toggleSelect(key); return }
    defaultAction()
  }

  // ─── Edit actions ─────────────────────────────────────────────────────────

  function handleEditSelected() {
    const key = [...selectedIds][0]
    if (!key) return
    exitEditMode()
    if (key.startsWith("w:")) {
      router.push(`/app/workouts/${key.slice(2)}`)
    } else {
      const act = activities.find(a => a.id === key.slice(2))
      if (act) openEditActivity(act)
    }
  }

  async function handleDeleteSelected() {
    setDeletingSelected(true)
    for (const key of selectedIds) {
      if (key.startsWith("w:")) {
        const id = key.slice(2)
        await authFetch(`/api/workouts/${id}`, { method: "DELETE" })
        setWorkouts(prev => prev.filter(w => w.id !== id))
      } else {
        const id = key.slice(2)
        await authFetch(`/api/activities/${id}`, { method: "DELETE" })
        setActivities(prev => prev.filter(a => a.id !== id))
      }
    }
    setDeletingSelected(false)
    exitEditMode()
  }

  // ─── Sheet drag-to-dismiss ────────────────────────────────────────────────

  function onSheetHandleTouchStart(e: React.TouchEvent) {
    sheetDragY.current = e.touches[0].clientY
  }

  function onSheetHandleTouchEnd(e: React.TouchEvent, close: () => void) {
    if (sheetDragY.current !== null) {
      if (e.changedTouches[0].clientY - sheetDragY.current > 60) close()
      sheetDragY.current = null
    }
  }

  // ─── Add / forms ──────────────────────────────────────────────────────────

  function handleAdd() {
    if (isDemo) { setUpgradeMsg("Crée un compte pour ajouter des activités."); return }
    setShowTypeSelector(true)
  }

  async function handleCreateWorkout() {
    if (!wName.trim()) return
    if (plan === "free") {
      const now = new Date()
      const monthCount = workouts.filter(w => {
        const d = new Date(w.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
      if (monthCount >= 5) {
        setShowWorkoutForm(false)
        setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit.")
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

  function openEditActivity(act: Activity) {
    setEditingActivity(act)
    setCType(act.type)
    setCName(act.name)
    setCDate(act.date.slice(0, 10))
    const h = act.durationSec ? Math.floor(act.durationSec / 3600) : 0
    const m = act.durationSec ? Math.floor((act.durationSec % 3600) / 60) : 0
    setCDurH(h > 0 ? String(h) : "")
    setCDurM(m > 0 ? String(m) : "")
    setCDist(act.distanceM ? String((act.distanceM / 1000).toFixed(2)).replace(/\.?0+$/, "") : "")
    setCElev(act.elevationM ? String(act.elevationM) : "")
    setCHR(act.avgHeartRate ? String(act.avgHeartRate) : "")
    setCCal(act.calories ? String(act.calories) : "")
    setCNotes(act.notes ?? "")
    setShowCardioForm(true)
  }

  function closeCardioForm() {
    setShowCardioForm(false)
    setEditingActivity(null)
    resetCardioForm()
  }

  async function handleSaveActivity() {
    if (!cName.trim()) return
    setCSaving(true)
    const durationSec = cDurH || cDurM ? parseInt(cDurH || "0") * 3600 + parseInt(cDurM || "0") * 60 : null
    const distanceM = cDist ? parseFloat(cDist) * 1000 : null
    const body = {
      type: cType, name: cName.trim(), date: cDate, durationSec, distanceM,
      elevationM: cElev ? parseFloat(cElev) : null,
      avgHeartRate: cHR ? parseInt(cHR) : null,
      calories: cCal ? parseInt(cCal) : null,
      notes: cNotes || null,
    }

    if (editingActivity) {
      const r = await authFetch(`/api/activities/${editingActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        const updated = await r.json()
        setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
        closeCardioForm()
      }
    } else {
      const r = await authFetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        const act = await r.json()
        setActivities(prev => [act, ...prev])
        closeCardioForm()
        const label = new Date(act.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        setOpenMonths(prev => new Set([...prev, label]))
      }
    }
    setCSaving(false)
  }

  function resetCardioForm() {
    setCType("running"); setCName(""); setCDate(new Date().toISOString().slice(0, 10))
    setCDurH(""); setCDurM(""); setCDist(""); setCElev(""); setCHR(""); setCCal(""); setCNotes("")
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full">Se connecter</a>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                {editMode ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : "Journal"}
              </p>
              <h1 className="text-2xl font-extrabold text-white">{editMode ? "Modifier" : "Activités"}</h1>
            </div>
            {editMode ? (
              <button
                onClick={exitEditMode}
                className="text-sm font-bold text-gray-400 hover:text-white transition-colors px-3 py-2"
              >
                Annuler
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nouvelle activité</span>
              </button>
            )}
          </div>

          {/* Free plan usage */}
          {!isDemo && !editMode && plan === "free" && (() => {
            const now = new Date()
            const used = workouts.filter(w => {
              const d = new Date(w.date)
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length
            return (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-4 h-1.5 rounded-full ${i < used ? "bg-violet-500" : "bg-white/10"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{used}/5 séances ce mois</span>
                </div>
                <a href="/pricing" className="text-[10px] font-bold text-violet-400 hover:text-violet-300">Passer Pro →</a>
              </div>
            )
          })()}
        </div>
      </div>

      {/* List */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        {unified.length === 0 ? (
          <div className="text-center py-20 px-4">
            <p className="text-4xl mb-4">🏋️</p>
            <p className="text-gray-400 font-semibold mb-2">Aucune activité enregistrée</p>
            <p className="text-gray-600 text-sm mb-6">Ajoutez votre première séance ou activité cardio</p>
            <button onClick={handleAdd} className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors">
              Ajouter une activité
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {yearGroups.map(yg => {
              const isCurrentYear = yg.year === currentYear
              const isYearOpen = openYears.has(yg.year)
              const totalInYear = yg.months.reduce((s, m) => s + m.items.length, 0)

              const monthBlocks = yg.months.map(group => {
                const isOpen = openMonths.has(group.label)
                return (
                  <div key={group.label} className="border-b border-white/10">
                    <button
                      onClick={() => !editMode && toggleMonth(group.label)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] border-t border-white/10 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <p className="text-sm font-extrabold text-white capitalize">{group.label}</p>
                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                          {group.items.length} activité{group.items.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      {!editMode && (
                        <svg className="w-4 h-4 text-gray-500 transition-transform duration-300"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    <div style={{ display: "grid", gridTemplateRows: (isOpen || editMode) ? "1fr" : "0fr", transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                      <div style={{ overflow: "hidden" }}>
                        <div className="divide-y divide-white/[0.07]">
                          {group.items.map(item => {
                            const key = getItemKey(item)
                            const isSelected = selectedIds.has(key)

                            if (item.kind === "workout") {
                              const w = item.data
                              const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
                              const typeLabel = WORKOUT_TYPES.find(t => t.value === w.type)?.label ?? w.type
                              return (
                                <div
                                  key={`w-${w.id}`}
                                  className={`flex items-center gap-3 py-3 px-4 md:px-6 cursor-pointer transition-colors select-none ${
                                    isSelected ? "bg-violet-500/10" : "hover:bg-white/[0.03]"
                                  } ${editMode && !isSelected ? "opacity-50" : ""}`}
                                  onTouchStart={e => onItemTouchStart(e, key)}
                                  onTouchMove={onItemTouchMove}
                                  onTouchEnd={onItemTouchEnd}
                                  onClick={() => onItemClick(key, () => !isDemo && router.push(`/app/workouts/${w.id}`))}
                                >
                                  {editMode && (
                                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                      isSelected ? "bg-violet-600 border-violet-600" : "border-gray-600"
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 text-violet-400">
                                    <DumbbellIcon />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{w.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[11px] font-bold text-violet-400">{typeLabel}</span>
                                      {w.exercises.length > 0 && (
                                        <span className="text-[11px] text-gray-500">{w.exercises.length} exo{w.exercises.length > 1 ? "s" : ""} · {totalSets} série{totalSets > 1 ? "s" : ""}</span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 shrink-0">{fmtDate(w.date)}</p>
                                </div>
                              )
                            } else {
                              const a = item.data
                              const info = getCardioInfo(a.type)
                              return (
                                <div
                                  key={`a-${a.id}`}
                                  className={`flex items-center gap-3 py-3 px-4 md:px-6 cursor-pointer transition-colors select-none ${
                                    isSelected ? "bg-violet-500/10" : "hover:bg-white/[0.03]"
                                  } ${editMode && !isSelected ? "opacity-50" : ""}`}
                                  onTouchStart={e => onItemTouchStart(e, key)}
                                  onTouchMove={onItemTouchMove}
                                  onTouchEnd={onItemTouchEnd}
                                  onClick={() => onItemClick(key, () => {})}
                                >
                                  {editMode && (
                                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                      isSelected ? "bg-violet-600 border-violet-600" : "border-gray-600"
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: info.color + "22" }}>
                                    <span style={{ color: info.color }}><CardioIcon type={a.type} /></span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{a.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <span className="text-[11px] font-bold" style={{ color: info.color }}>{info.label}</span>
                                      {a.distanceM && <span className="text-[11px] text-gray-500">{fmtDist(a.distanceM)}</span>}
                                      {a.durationSec && <span className="text-[11px] text-gray-500">{fmtDuration(a.durationSec)}</span>}
                                      {a.avgPaceSecKm && <span className="text-[11px] text-gray-500">{fmtPace(a.avgPaceSecKm)}</span>}
                                      {!a.avgPaceSecKm && a.avgSpeedKmh && <span className="text-[11px] text-gray-500">{a.avgSpeedKmh.toFixed(1)} km/h</span>}
                                      {a.avgHeartRate && <span className="text-[11px] text-red-400">{a.avgHeartRate} bpm</span>}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 shrink-0">{fmtDate(a.date)}</p>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })

              if (isCurrentYear) {
                return <React.Fragment key={yg.year}>{monthBlocks}</React.Fragment>
              }

              return (
                <div key={yg.year}>
                  <button
                    onClick={() => toggleYear(yg.year)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.06] border-t border-white/10 hover:bg-white/[0.09] transition-colors"
                  >
                    <p className="text-base font-black text-white">{yg.year}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">{totalInYear} activité{totalInYear > 1 ? "s" : ""}</span>
                      <svg className="w-4 h-4 text-gray-500 transition-transform duration-300"
                        style={{ transform: isYearOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  <div style={{ display: "grid", gridTemplateRows: isYearOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={{ overflow: "hidden" }}>{monthBlocks}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Floating edit action bar ── */}
      {editMode && selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
        >
          <div className="w-full max-w-sm bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-3 flex items-center gap-2">
            {selectedIds.size === 1 ? (
              <>
                <button
                  onClick={exitEditMode}
                  className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditSelected}
                  className="flex-1 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-bold text-white hover:bg-white/20 transition-colors"
                >
                  Éditer
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deletingSelected}
                  className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletingSelected ? "..." : "Supprimer"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={exitEditMode}
                  className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deletingSelected}
                  className="flex-[2] py-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletingSelected ? "..." : `Supprimer (${selectedIds.size})`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Type Selector (bottom sheet, swipe-to-dismiss) ── */}
      {showTypeSelector && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={() => setShowTypeSelector(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg"
            onClick={e => e.stopPropagation()}
            onTouchStart={onSheetHandleTouchStart}
            onTouchEnd={e => onSheetHandleTouchEnd(e, () => setShowTypeSelector(false))}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-8 pt-2">
              <h3 className="text-base font-black text-white mb-5">Quel type d&apos;activité ?</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTypeSelector(false); setWName(""); setWType("fullbody"); setWCustomType(""); setWDate(new Date().toISOString().slice(0, 10)); setWNotes(""); setShowWorkoutForm(true) }}
                  className="flex items-center gap-4 p-4 bg-violet-600/10 border border-violet-500/30 rounded-2xl text-left hover:border-violet-500/60 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
                    <DumbbellIcon size={22} />
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
                    <CardioIcon type="running" size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">Activité cardio</p>
                    <p className="text-xs text-gray-400 mt-0.5">Course, vélo, natation, randonnée…</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Workout Form (bottom sheet, swipe-to-dismiss) ── */}
      {showWorkoutForm && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={() => setShowWorkoutForm(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={onSheetHandleTouchStart}
              onTouchEnd={e => onSheetHandleTouchEnd(e, () => setShowWorkoutForm(false))}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
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
              <button onClick={handleCreateWorkout} disabled={wSaving || !wName.trim()} className="w-full mt-5 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50">
                {wSaving ? "..." : "Créer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cardio Form (bottom sheet, swipe-to-dismiss) ── */}
      {showCardioForm && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={closeCardioForm}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={onSheetHandleTouchStart}
              onTouchEnd={e => onSheetHandleTouchEnd(e, closeCardioForm)}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-6 pt-2">
              <h3 className="text-base font-black text-white mb-4">
                {editingActivity ? "Modifier l'activité" : "Nouvelle activité cardio"}
              </h3>
              <div className="overflow-x-auto mb-4">
                <div className="flex gap-2 w-max pb-1">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.key} onClick={() => { setCType(t.key); if (!editingActivity) setCName(t.label) }}
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
              <button onClick={handleSaveActivity} disabled={cSaving || !cName.trim()} className="w-full mt-5 py-3 bg-orange-500 rounded-xl text-sm font-bold text-white hover:bg-orange-400 transition-colors disabled:opacity-50">
                {cSaving ? "..." : editingActivity ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}
    </div>
  )
}
