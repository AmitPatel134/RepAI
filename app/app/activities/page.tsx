"use client"
import React, { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached, invalidateCache } from "@/lib/appCache"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import UpgradeModal from "@/components/UpgradeModal"
import LoadingScreen from "@/components/LoadingScreen"
import { Dumbbell, ChevronDown, Trash2, Bookmark, BookmarkCheck } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Workout = {
  id: string; name: string; date: string
  exercises: { id: string; name: string; sets: { reps: number | null; weight: number | null }[] }[]
}

type Activity = {
  id: string; type: string; name: string; date: string
  durationSec: number | null; distanceM: number | null; elevationM: number | null
  avgHeartRate: number | null; calories: number | null
  avgSpeedKmh: number | null; avgPaceSecKm: number | null; notes: string | null
}

type UnifiedItem = { kind: "workout"; data: Workout } | { kind: "activity"; data: Activity }

type VoiceSet = { reps: number | null; weight: number | null }
type VoiceExercise = { name: string; sets: VoiceSet[]; ambiguous?: boolean; options?: string[] }
type VoiceActivityData = {
  type: string; durationSec?: number | null; distanceM?: number | null
  elevationM?: number | null; avgHeartRate?: number | null; calories?: number | null; notes?: string | null
}
type VoiceWorkoutData = { name: string; exercises: VoiceExercise[]; notes?: string | null }
type VoiceItem =
  | { kind: "workout"; workout: VoiceWorkoutData; date?: string }
  | { kind: "cardio"; activity: VoiceActivityData; date?: string }
type VoiceResult = { items: VoiceItem[] }

// ─── Exercise disambiguation ──────────────────────────────────────────────────

const EXERCISE_DISAMBIG: Record<string, string[]> = {
  "tractions":    ["Tractions pronation", "Tractions supination"],
  "développé":    ["Développé couché barre", "Développé couché haltères", "Développé couché machine", "Développé incliné barre", "Développé incliné haltères", "Développé incliné machine", "Développé décliné barre", "Développé décliné machine", "Développé militaire"],
  "curl":         ["Curl barre", "Curl haltères", "Curl marteau", "Curl poulie basse", "Curl incliné"],
  "squat":        ["Squat barre", "Squat haltères", "Squat bulgare"],
  "soulevé":      ["Soulevé de terre", "Soulevé de terre roumain"],
  "élévations":   ["Élévations latérales", "Élévations latérales poulie"],
  "extension":    ["Extension triceps poulie", "Extension triceps haltère"],
  "gainage":      ["Gainage", "Gainage latéral"],
  "tirage":       ["Tirage vertical", "Tirage poulie haute", "Tirage horizontal poulie"],
  "rowing":       ["Rowing barre", "Rowing haltère"],
  "écarté":       ["Écarté haltères", "Écarté poulie basse"],
  "dips":         ["Dips", "Dips banc"],
  "fentes":       ["Fentes", "Fentes bulgares"],
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function findDisambigOptions(name: string): string[] | null {
  const normName = normalize(name)
  const words = normName.split(" ")
  const firstWord = words[0]
  for (const [key, options] of Object.entries(EXERCISE_DISAMBIG)) {
    if (firstWord !== normalize(key)) continue
    const exactMatch = options.some(o => normalize(o) === normName)
    if (exactMatch) return null
    // Filter options by additional qualifier words (e.g. "incliné" narrows to incliné variants only)
    const extraWords = words.slice(1).filter(w => w.length > 2)
    if (extraWords.length > 0) {
      const filtered = options.filter(opt => extraWords.every(w => normalize(opt).includes(w)))
      if (filtered.length > 0 && filtered.length < options.length) return filtered
    }
    return options
  }
  return null
}

function postProcessVoiceItems(items: VoiceItem[]): VoiceItem[] {
  return items.map(item => {
    if (item.kind !== "workout") return item
    const exercises = item.workout.exercises.map(ex => {
      const options = findDisambigOptions(ex.name)
      return options ? { ...ex, ambiguous: true, options } : ex
    })
    return { ...item, workout: { ...item.workout, exercises } }
  })
}

// ─── Constants ────────────────────────────────────────────────────────────────


const CARDIO_COLOR = "#f97316"
const CUSTOM_COLOR  = "#16a34a"

const CARDIO_TYPES = [
  { key: "running",    label: "Course",     color: CARDIO_COLOR },
  { key: "cycling",    label: "Vélo",       color: CARDIO_COLOR },
  { key: "swimming",   label: "Natation",   color: CARDIO_COLOR },
  { key: "walking",    label: "Marche",     color: CARDIO_COLOR },
  { key: "hiking",     label: "Randonnée",  color: CARDIO_COLOR },
  { key: "rowing",     label: "Aviron",     color: CARDIO_COLOR },
  { key: "elliptical", label: "Elliptique", color: CARDIO_COLOR },
  { key: "other",      label: "Autre",      color: CARDIO_COLOR },
]

// ─── Preset workouts ─────────────────────────────────────────────────────────

type PresetWorkout = { key: string; label: string; tag: string; exercises: { name: string; sets: number }[]; sourceWorkoutId?: string }

const PRESET_WORKOUTS: PresetWorkout[] = [
  {
    key: "push_a", label: "Push", tag: "Pec · Épaules · Triceps",
    exercises: [
      { name: "Développé couché barre",    sets: 4 },
      { name: "Développé incliné haltères", sets: 3 },
      { name: "Développé militaire",       sets: 3 },
      { name: "Élévations latérales",      sets: 3 },
      { name: "Extension triceps poulie",  sets: 3 },
      { name: "Dips",                      sets: 3 },
    ],
  },
  {
    key: "pull_a", label: "Pull", tag: "Dos · Biceps",
    exercises: [
      { name: "Tractions pronation",      sets: 4 },
      { name: "Tirage vertical",          sets: 3 },
      { name: "Rowing barre",             sets: 3 },
      { name: "Tirage horizontal poulie", sets: 3 },
      { name: "Curl barre",               sets: 3 },
      { name: "Curl marteau",             sets: 3 },
    ],
  },
  {
    key: "legs_a", label: "Legs", tag: "Quadriceps · Ischio · Mollets",
    exercises: [
      { name: "Squat barre",               sets: 4 },
      { name: "Soulevé de terre roumain",  sets: 3 },
      { name: "Fentes",                    sets: 3 },
      { name: "Leg Press",                 sets: 3 },
      { name: "Leg Curl",                  sets: 3 },
      { name: "Mollets debout",            sets: 4 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}
function fmtDuration(sec: number | null) {
  if (!sec) return null
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h > 0) return s > 0 ? `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s` : `${h}h${m.toString().padStart(2, "0")}`
  return s > 0 ? `${m}min${s}s` : `${m}min`
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
  if (type === "custom") return { key: "custom", label: "Autre", color: CUSTOM_COLOR }
  return CARDIO_TYPES.find(t => t.key === type) ?? CARDIO_TYPES[CARDIO_TYPES.length - 1]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DumbbellIcon({ size = 18 }: { size?: number }) {
  return <Dumbbell size={size} />
}

function CardioIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = size
  // Running figure — Tabler Icons "run" (MIT)
  if (type === "running") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M4 17l5 1l.75 -1.5" />
      <path d="M15 21l0 -4l-4 -3l1 -6" />
      <path d="M7 12l0 -3l5 -1l3 3l3 1" />
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
  if (type === "custom") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
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
  const pathname = usePathname()
  const prevPathnameRef   = useRef(pathname)
  const workoutModalRef   = useRef<HTMLDivElement>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)
  const [hasMoreWorkouts, setHasMoreWorkouts] = useState(false)
  const [hasMoreActivities, setHasMoreActivities] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)

  // Modals
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showCardioForm, setShowCardioForm] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

  // Long-press delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const longPressTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  // Custom activity form
  const [custName, setCustName] = useState("")
  const [custDate, setCustDate] = useState(new Date().toISOString().slice(0, 10))
  const [custDurH, setCustDurH] = useState("")
  const [custDurM, setCustDurM] = useState("")
  const [custDurS, setCustDurS] = useState("")
  const [custNotes, setCustNotes] = useState("")
  const [custSaving, setCustSaving] = useState(false)

  // Voice
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceParsing, setVoiceParsing] = useState(false)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [voiceSuccess, setVoiceSuccess] = useState(0)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Workout form
  const [selectedPreset, setSelectedPreset]   = useState<string | null>(null)
  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [customPresets, setCustomPresets] = useState<PresetWorkout[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem("custom-presets") ?? "[]") } catch { return [] }
  })
  const [deletedBuiltinKeys, setDeletedBuiltinKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem("deleted-builtin-presets") ?? "[]") } catch { return [] }
  })
  const [showPresetList, setShowPresetList] = useState(false)
  const [presetSavedToast, setPresetSavedToast] = useState<string | null>(null)
  const [wName, setWName] = useState("")
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wNotes, setWNotes] = useState("")
  const [wSaving, setWSaving] = useState(false)
  const [wExercises, setWExercises] = useState<VoiceExercise[]>([])

  // Voice preview
  const [voicePreview, setVoicePreview] = useState<VoiceItem[] | null>(null)

  // Programme IA
  type TrainingExercise = { name: string; sets: number; reps: string; weightKg: number | null }
  type TrainingSession  = { name: string; exercises: TrainingExercise[] }
  type TrainingPlan     = { weekGoal: string; sessions: TrainingSession[] }
  const [progPlan, setProgPlan]             = useState<TrainingPlan | null>(null)
  const [progPlanAt, setProgPlanAt]         = useState<string | null>(null)
  const [progLoading, setProgLoading]       = useState(false)
  const [progGenerating, setProgGenerating] = useState(false)
  const [progError, setProgError]           = useState<string | null>(null)
  const [progCooldownUntil, setProgCooldownUntil] = useState<string | null>(null)
  const [actTab, setActTab]                 = useState<"journal"|"programme">("journal")

  // Cardio form
  const [cType, setCType] = useState("running")
  const [cDate, setCDate] = useState(new Date().toISOString().slice(0, 10))
  const [cDurH, setCDurH] = useState("")
  const [cDurM, setCDurM] = useState("")
  const [cDurS, setCDurS] = useState("")
  const [cDist, setCDist] = useState("")
  const [cElev, setCElev] = useState("")
  const [cHR, setCHR] = useState("")
  const [cCal, setCCal] = useState("")
  const [cNotes, setCNotes] = useState("")
  const [cSaving, setCSaving] = useState(false)

  const loadData = useCallback((forceLoading = false) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setWorkouts(DEMO_WORKOUTS as unknown as Workout[])
        setLoading(false)
        return
      }

      if (forceLoading) {
        // Invalidate stale keys but keep showing current data — refresh happens below in background
        invalidateCache("/api/workouts")
        invalidateCache("/api/activities")
      } else {
        const cW = getCached<Workout[]>("/api/workouts")
        const cA = getCached<Activity[]>("/api/activities")
        const cP = getCached<{ plan: string; usage?: { sessionsThisMonth?: number } }>("/api/plan")
        if (cW) setWorkouts(cW)
        if (cA) setActivities(cA)
        if (cP) { setPlan(cP.plan ?? "free"); setSessionsThisMonth(cP.usage?.sessionsThisMonth ?? 0) }
        if (cW && cA && cP) setLoading(false)
      }

      // Always refresh from network
      Promise.all([
        authFetch("/api/workouts?limit=20").then(r => r.json()).catch(() => ({ items: [] })),
        authFetch("/api/activities?limit=20").then(r => r.json()).catch(() => ({ items: [] })),
        authFetch("/api/plan").then(r => r.json()).catch(() => ({ plan: "free" })),
      ]).then(([w, a, p]) => {
        const wItems: Workout[] = Array.isArray(w) ? w : (w?.items ?? [])
        const aItems: Activity[] = Array.isArray(a) ? a : (a?.items ?? [])
        setWorkouts(wItems); setCached("/api/workouts", wItems)
        setActivities(aItems); setCached("/api/activities", aItems)
        setHasMoreWorkouts((w?.total ?? wItems.length) > wItems.length)
        setHasMoreActivities((a?.total ?? aItems.length) > aItems.length)
        setPlan(p?.plan ?? "free")
        setSessionsThisMonth(p?.usage?.sessionsThisMonth ?? 0)
        setCached("/api/plan", p)
      }).catch(e => console.error("[activities loadData]", e)).finally(() => setLoading(false))
    })
  }, [])

  // Initial load
  useEffect(() => { loadData() }, [loadData])

  // Silent refresh when returning from a detail page (no loading screen)
  useEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname
    const comingBackFromDetail =
      pathname === "/app/activities" &&
      (prev.startsWith("/app/activities/") || prev.startsWith("/app/workouts/"))
    if (comingBackFromDetail) loadData(true)
  }, [pathname, loadData])

  // Lock background scroll when the preset list modal is open
  useEffect(() => {
    if (!showPresetList) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    const prevent = (e: TouchEvent) => { e.preventDefault() }
    document.addEventListener("touchmove", prevent, { passive: false })
    return () => {
      document.body.style.overflow = prev
      document.documentElement.style.overflow = ""
      document.removeEventListener("touchmove", prevent)
    }
  }, [showPresetList])

  // Focus the modal container (not the input) when the workout form opens
  useEffect(() => {
    if (showWorkoutForm) workoutModalRef.current?.focus()
  }, [showWorkoutForm])

  // Load Programme IA on mount
  useEffect(() => {
    setProgLoading(true)
    const cached = getCached<{ plan: TrainingPlan | null; generatedAt: string | null }>("/api/coach/training-plan")
    if (cached) { setProgPlan(cached.plan); setProgPlanAt(cached.generatedAt); setProgLoading(false) }
    authFetch("/api/coach/training-plan").then(r => r.json()).then(data => {
      setProgPlan(data.plan ?? null); setProgPlanAt(data.generatedAt ?? null)
      setCached("/api/coach/training-plan", data)
    }).catch(() => {}).finally(() => setProgLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateProgPlan() {
    setProgGenerating(true); setProgError(null)
    try {
      const r = await authFetch("/api/coach/training-plan", { method: "POST" })
      const data = await r.json()
      if (r.status === 403 && data.error === "cooldown_active") {
        setProgCooldownUntil(data.availableAt)
        return
      }
      if (!r.ok || data.error) { setProgError("Erreur lors de la génération."); return }
      if (data.plan) {
        setProgPlan(data.plan)
        setProgPlanAt(data.generatedAt ?? new Date().toISOString())
        setProgCooldownUntil(null)
        setCached("/api/coach/training-plan", data)
      }
    } catch { setProgError("Erreur réseau.") } finally { setProgGenerating(false) }
  }

  // ─── Unified list ─────────────────────────────────────────────────────────

  const unified: UnifiedItem[] = [
    ...workouts.map(w => ({ kind: "workout" as const, data: w })),
    ...activities.map(a => ({ kind: "activity" as const, data: a })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  type DayGroup   = { dayKey: string; dayLabel: string; items: UnifiedItem[] }
  type MonthGroup = { label: string; days: DayGroup[] }

  // Build items indexed by month/day
  const _dataMonths = new Map<string, DayGroup[]>()
  for (const item of unified) {
    const d = new Date(item.data.date)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const dayKey = item.data.date.slice(0, 10)
    const dayLabel = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    if (!_dataMonths.has(monthKey)) _dataMonths.set(monthKey, [])
    const days = _dataMonths.get(monthKey)!
    let dg = days.find(dg => dg.dayKey === dayKey)
    if (!dg) { dg = { dayKey, dayLabel, items: [] }; days.push(dg) }
    dg.items.push(item)
  }

  // Generate full range — at least 12 months back
  const allMonths: MonthGroup[] = []
  const _now = new Date()
  const _oldest = unified.length > 0 ? new Date(unified[unified.length - 1].data.date) : _now
  let _cur = new Date(_now.getFullYear(), _now.getMonth(), 1)
  const _minBack = new Date(_now.getFullYear(), _now.getMonth() - 11, 1)
  const _oldestStart = new Date(Math.min(
    new Date(_oldest.getFullYear(), _oldest.getMonth(), 1).getTime(),
    _minBack.getTime()
  ))
  while (_cur >= _oldestStart) {
    const monthKey = `${_cur.getFullYear()}-${String(_cur.getMonth() + 1).padStart(2, "0")}`
    const label = _cur.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    allMonths.push({ label, days: _dataMonths.get(monthKey) ?? [] })
    _cur = new Date(_cur.getFullYear(), _cur.getMonth() - 1, 1)
  }

  const safeMonthIdx = Math.min(selectedMonthIdx, Math.max(0, allMonths.length - 1))
  const currentMonth = allMonths[safeMonthIdx] ?? null

  // ─── Add / forms ──────────────────────────────────────────────────────────

  const sessionLimit = 5
  const sessionLimitReached = plan === "free" && sessionsThisMonth >= sessionLimit

  function handleAdd() {
    if (isDemo) { setUpgradeMsg("Crée un compte pour ajouter des activités."); return }
    if (sessionLimitReached) { setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit. Passez Pro pour des séances illimitées."); return }
    setShowTypeSelector(true)
  }

  async function handleCreateWorkout() {
    if (!wName.trim()) return
    setWSaving(true)
    const r = await authFetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wName.trim(), notes: wNotes, date: wDate, exercises: wExercises }),
    })
    if (r.status === 429) {
      setShowWorkoutForm(false)
      setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit. Passez Pro pour des séances illimitées.")
      setWSaving(false)
      return
    }
    if (r.ok) {
      const workout = await r.json()
      setWorkouts(prev => [workout, ...prev])
      setSessionsThisMonth(prev => prev + 1)
      setSelectedMonthIdx(0)
      setShowWorkoutForm(false)
      setWExercises([])
    }
    setWSaving(false)
  }

  function saveWorkoutAsPreset(w: Workout, e: React.MouseEvent) {
    e.stopPropagation()
    const alreadySaved = customPresets.some(p => p.sourceWorkoutId === w.id)
    if (alreadySaved) {
      const updated = customPresets.filter(p => p.sourceWorkoutId !== w.id)
      setCustomPresets(updated)
      localStorage.setItem("custom-presets", JSON.stringify(updated))
      return
    }
    const preset: PresetWorkout = {
      key: `custom_${Date.now()}`,
      label: w.name,
      tag: "Personnalisée",
      sourceWorkoutId: w.id,
      exercises: w.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length > 0 ? ex.sets.length : 3,
      })),
    }
    const updated = [...customPresets, preset]
    setCustomPresets(updated)
    localStorage.setItem("custom-presets", JSON.stringify(updated))
    setPresetSavedToast(`"${w.name}" ajouté aux séances préfaites`)
    setTimeout(() => setPresetSavedToast(null), 2800)
  }

  // ── Preset helpers ────────────────────────────────────────────────────────────

  const allPresets = [...customPresets]

  function applyPreset(preset: PresetWorkout) {
    setSelectedPreset(preset.key)
    setWName(preset.label)
    setWExercises(preset.exercises.map(ex => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({ reps: null, weight: null })),
    })))
    setShowPresetPicker(false)
  }

  function removeCustomPreset(key: string) {
    const updated = customPresets.filter(p => p.key !== key)
    setCustomPresets(updated)
    localStorage.setItem("custom-presets", JSON.stringify(updated))
    if (selectedPreset === key) { setSelectedPreset(null); setWExercises([]); setWName("") }
  }

  function removeBuiltinPreset(key: string) {
    const updated = [...deletedBuiltinKeys, key]
    setDeletedBuiltinKeys(updated)
    localStorage.setItem("deleted-builtin-presets", JSON.stringify(updated))
    if (selectedPreset === key) { setSelectedPreset(null); setWExercises([]); setWName("") }
  }

  function removePreset(key: string) {
    if (customPresets.some(p => p.key === key)) removeCustomPreset(key)
    else removeBuiltinPreset(key)
  }

  // ── Long-press delete ──────────────────────────────────────────────────────────

  function startLongPress(w: Workout) {
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setDeleteConfirm({ id: w.id, name: w.name })
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  async function handleDeleteWorkout(id: string) {
    setDeleting(true)
    const r = await authFetch(`/api/workouts/${id}`, { method: "DELETE" })
    if (r.ok) {
      setWorkouts(prev => prev.filter(w => w.id !== id))
      invalidateCache("/api/workouts")
    }
    setDeleting(false)
    setDeleteConfirm(null)
  }

  function openEditActivity(act: Activity) {
    setEditingActivity(act)
    setCType(act.type)
    setCDate(act.date.slice(0, 10))
    const h = act.durationSec ? Math.floor(act.durationSec / 3600) : 0
    const m = act.durationSec ? Math.floor((act.durationSec % 3600) / 60) : 0
    const s = act.durationSec ? act.durationSec % 60 : 0
    setCDurH(h > 0 ? String(h) : "")
    setCDurM(m > 0 ? String(m) : "")
    setCDurS(s > 0 ? String(s) : "")
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

  async function handleSaveCustomActivity() {
    if (!custName.trim()) return
    setCustSaving(true)
    const durationSec = custDurH || custDurM || custDurS
      ? parseInt(custDurH || "0") * 3600 + parseInt(custDurM || "0") * 60 + parseInt(custDurS || "0")
      : null
    const r = await authFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom", name: custName.trim(), date: custDate,
        durationSec, notes: custNotes || null,
      }),
    })
    if (r.ok) {
      const act = await r.json()
      setActivities(prev => [act, ...prev])
      setSessionsThisMonth(prev => prev + 1)
      setSelectedMonthIdx(0)
      setShowCustomForm(false)
      setCustName(""); setCustDate(new Date().toISOString().slice(0, 10))
      setCustDurH(""); setCustDurM(""); setCustDurS(""); setCustNotes("")
    }
    setCustSaving(false)
  }

  async function handleSaveActivity() {
    setCSaving(true)
    const autoName = CARDIO_TYPES.find(t => t.key === cType)?.label ?? cType
    const durationSec = cDurH || cDurM || cDurS ? parseInt(cDurH || "0") * 3600 + parseInt(cDurM || "0") * 60 + parseInt(cDurS || "0") : null
    const distanceM = cDist ? parseFloat(cDist) * 1000 : null
    const body = {
      type: cType, name: autoName, date: cDate, durationSec, distanceM,
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
      if (r.status === 429) {
        closeCardioForm()
        setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit. Passez Pro pour des séances illimitées.")
        setCSaving(false)
        return
      }
      if (r.ok) {
        const act = await r.json()
        setActivities(prev => [act, ...prev])
        setSessionsThisMonth(prev => prev + 1)
        closeCardioForm()
        setSelectedMonthIdx(0)
      }
    }
    setCSaving(false)
  }

  function resetCardioForm() {
    setCType("running"); setCDate(new Date().toISOString().slice(0, 10))
    setCDurH(""); setCDurM(""); setCDurS(""); setCDist(""); setCElev(""); setCHR(""); setCCal(""); setCNotes("")
  }

  // ─── Voice ────────────────────────────────────────────────────────────────

  async function startVoice() {
    if (isDemo) return
    setVoiceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported(t)) ?? ""
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" })
        processAudio(blob, mimeType)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setVoiceTranscript("")
      setVoiceRecording(true)
    } catch (err) {
      const name = (err as { name?: string })?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceError("permission")
      } else if (name === "NotFoundError") {
        setVoiceError("notfound")
      } else {
        setVoiceError("unknown")
      }
    }
  }

  function stopVoice() {
    mediaRecorderRef.current?.stop()
    setVoiceRecording(false)
  }

  async function processAudio(blob: Blob, mimeType: string) {
    setVoiceParsing(true)
    try {
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm"
      const formData = new FormData()
      formData.append("audio", blob, `recording.${ext}`)

      const tr = await authFetch("/api/voice/transcribe", { method: "POST", body: formData })
      const { transcript, error } = await tr.json()
      if (!transcript) { alert(error ?? "Transcription échouée"); setVoiceParsing(false); return }

      setVoiceTranscript(transcript)
      await parseVoice(transcript)
    } catch {
      alert("Erreur lors de la transcription")
    }
    setVoiceParsing(false)
  }

  async function parseVoice(text: string) {
    try {
      // Pass local date so AI can resolve "hier", "avant-hier", etc.
      const localDate = new Date().toLocaleDateString("fr-CA") // YYYY-MM-DD in local TZ
      const r = await authFetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, today: localDate }),
      })
      const result: VoiceResult = await r.json()
      applyVoiceResult(result)
    } catch {
      alert("Erreur lors de l'analyse vocale")
    }
  }

  function applyVoiceResult(result: VoiceResult) {
    const items = result?.items
    if (!items || items.length === 0) { setVoiceError("empty"); return }

    const usefulItems = items.filter(item => {
      if (item.kind === "workout") {
        const w = item.workout
        return w && (w.name?.trim() || w.exercises?.length > 0)
      } else {
        const a = item.activity
        return a && (a.durationSec || a.distanceM || a.calories || a.avgHeartRate)
      }
    })
    if (usefulItems.length === 0) { setVoiceError("empty"); return }

    // Post-process for exercise disambiguation, then show preview
    const processed = postProcessVoiceItems(usefulItems)
    setVoicePreview(processed)
  }

  async function saveVoiceItems(items: VoiceItem[]) {
    setVoiceSaving(true)
    let savedCount = 0
    let limitHit = false
    const localToday = new Date().toLocaleDateString("fr-CA")

    for (const item of items) {
      if (item.kind === "workout") {
        const w = item.workout
        const r = await authFetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: w.name || "Séance",
            notes: w.notes || null,
            date: item.date || localToday,
            exercises: w.exercises || [],
          }),
        })
        if (r.status === 429) { limitHit = true; break }
        if (r.ok) {
          const workout = await r.json()
          setWorkouts(prev => [workout, ...prev])
          setSessionsThisMonth(prev => prev + 1)
          setSelectedMonthIdx(0)
          savedCount++
        }
      } else {
        const a = item.activity
        const autoName = CARDIO_TYPES.find(t => t.key === a.type)?.label ?? a.type
        const r = await authFetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: a.type,
            name: autoName,
            date: item.date || localToday,
            durationSec: a.durationSec ?? null,
            distanceM: a.distanceM ?? null,
            elevationM: a.elevationM ?? null,
            avgHeartRate: a.avgHeartRate ?? null,
            calories: a.calories ?? null,
            notes: a.notes ?? null,
          }),
        })
        if (r.status === 429) { limitHit = true; break }
        if (r.ok) {
          const act = await r.json()
          setActivities(prev => [act, ...prev])
          setSessionsThisMonth(prev => prev + 1)
          setSelectedMonthIdx(0)
          savedCount++
        }
      }
    }

    setVoiceSaving(false)
    if (limitHit) {
      setVoicePreview(null)
      setUpgradeMsg("Limite atteinte : 5 séances par mois sur le plan Gratuit. Passez Pro pour des séances illimitées.")
    } else if (savedCount > 0) {
      setVoiceSuccess(savedCount)
      setTimeout(() => setVoiceSuccess(0), 4000)
    }
  }

  const isEmpty = unified.length === 0

  return (
    <div className={`${(isEmpty && !loading) ? "h-screen overflow-hidden" : "min-h-screen"} bg-gray-100 text-gray-900`}>

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-blue-700 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-100">
            Mode démo — <a href="/login" className="underline text-white">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-blue-600 bg-white px-3 py-1 rounded-full">Se connecter</a>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-3 z-30 px-3 md:px-4 pt-3">
        <div className="max-w-3xl mx-auto bg-blue-600/85 backdrop-blur-xl rounded-2xl shadow-lg shadow-blue-900/20 px-4 md:px-5 pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">Tes séances & entraînements</p>
              <h1 className="text-3xl font-bold text-white tracking-tight font-[family-name:var(--font-barlow-condensed)]">Activités</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Voice button */}
              <button
                onClick={voiceRecording ? stopVoice : startVoice}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  voiceRecording
                    ? "bg-red-500 shadow-lg shadow-red-500/40 animate-pulse"
                    : "bg-white/20 hover:bg-white/30"
                }`}
                title="Commande vocale"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              {/* Add button */}
              <button
                onClick={handleAdd}
                className={`flex items-center gap-2 font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors ${sessionLimitReached ? "bg-white/30 text-white/60 cursor-not-allowed" : "bg-white text-blue-600 hover:bg-blue-50"}`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">{sessionLimitReached ? "Limite atteinte" : "Nouvelle activité"}</span>
              </button>
            </div>
          </div>

          {/* Free plan usage */}
          {!loading && !isDemo && plan === "free" && (
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: sessionLimit }).map((_, i) => (
                    <div key={i} className={`w-4 h-2.5 rounded-sm ${i < sessionsThisMonth ? "bg-white" : "bg-white/30"}`} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-blue-100">{sessionsThisMonth}/{sessionLimit} séances ce mois</span>
              </div>
              <a href="/pricing" className="text-[10px] font-bold text-white/70 hover:text-white">Passer Pro →</a>
            </div>
          )}

          {/* Tab bar + bookmark button */}
          {!isDemo && (
            <div className="flex items-center gap-1.5 mt-3">
              {/* Bookmark — separate pill */}
              {!loading && (
                <button
                  onClick={() => setShowPresetList(true)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  title="Séances enregistrées"
                >
                  <BookmarkCheck size={14} className="text-white" />
                </button>
              )}
              {/* Tabs */}
              <div className="flex-1 flex gap-1 bg-white/15 rounded-xl p-0.5">
                <button
                  onClick={() => setActTab("journal")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-[10px] transition-all ${actTab === "journal" ? "bg-white text-blue-700 shadow-sm" : "text-white/70 hover:text-white"}`}
                >Journal</button>
                <button
                  onClick={() => setActTab("programme")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-[10px] transition-all flex items-center justify-center gap-1 ${actTab === "programme" ? "bg-white text-blue-700 shadow-sm" : "text-white/70 hover:text-white"}`}
                >
                  Programme IA
                  {plan === "free" && <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Programme IA tab */}
      {!isDemo && actTab === "programme" && (
        <div className="max-w-3xl mx-auto px-3 md:px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {plan === "free" ? (
            <div className="flex flex-col items-center text-center px-4 pt-8 pb-10 gap-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-300/40">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-extrabold text-gray-900 mb-1">Programme IA · Pro</p>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">Le coach analyse tes séances, détecte ton split (PPL, Full Body…) et génère un programme complet avec les charges exactes à utiliser.</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs text-left">
                {["Programme personnalisé selon ton historique", "Charges adaptées à ta progression réelle", "Détection automatique Push / Pull / Legs", "Séances complètes avec 6–9 exercices"].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span className="text-sm text-gray-600">{f}</span>
                  </div>
                ))}
              </div>
              <a href="/pricing" className="w-full max-w-xs bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-3 rounded-2xl transition-colors text-center shadow-md shadow-violet-200">
                Passer Pro →
              </a>
              <p className="text-[11px] text-gray-400">Plan Gratuit · 1 question coach/semaine</p>
            </div>
          ) : progLoading ? (
            <div className="flex flex-col gap-2 px-1">
              {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : !progPlan ? (
            <div className="py-10 flex flex-col items-center text-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mb-1">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <p className="text-sm font-bold text-gray-800">Programme d&apos;entraînement</p>
              <p className="text-xs text-gray-400 font-medium max-w-xs">L'IA analyse tes séances et génère un programme avec les charges et séries recommandées.</p>
              <button
                onClick={generateProgPlan} disabled={progGenerating}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl font-bold text-sm text-white transition-colors disabled:opacity-50 flex items-center gap-2 mt-1"
              >
                {progGenerating && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {progGenerating ? "Génération…" : "Générer mon programme →"}
              </button>
              {progError && <p className="text-xs text-red-500 font-medium">{progError}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Coach advice */}
              <div className="bg-violet-50 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm text-gray-700 leading-snug">{progPlan.weekGoal}</p>
              </div>

              {/* Sessions */}
              {progPlan.sessions.map((session, si) => {
                const isCardioSession = session.exercises.every(ex => ex.weightKg === null)
                return (
                <div key={si} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Session header */}
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 ${isCardioSession ? "bg-orange-50" : "bg-gray-50"}`}>
                    <span className={`w-5 h-5 rounded-md text-white text-[10px] font-black flex items-center justify-center shrink-0 ${isCardioSession ? "bg-orange-500" : "bg-violet-600"}`}>{si + 1}</span>
                    <p className="text-xs font-bold text-gray-700 flex-1">{session.name}</p>
                    <span className="text-[10px] text-gray-400">{session.exercises.length} exos</span>
                  </div>
                  {/* Column headers */}
                  <div className="flex items-center px-4 pt-2 pb-1">
                    <div className="flex-1" />
                    <div className="w-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Séries</div>
                    <div className="w-14 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Reps</div>
                    <div className="w-14 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Charge</div>
                  </div>
                  {/* Exercise rows */}
                  {session.exercises.map((ex, ei) => {
                    const isCardio = ex.weightKg === null && ex.sets <= 1
                    return (
                    <div key={ei} className={`flex items-center py-2 px-4 ${ei < session.exercises.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[13px] font-medium text-gray-900 leading-tight truncate">{ex.name}</p>
                      </div>
                      {isCardio ? (
                        <div className="w-40 text-right">
                          <span className="text-[11px] font-bold text-orange-600">{ex.reps}</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 text-center text-[13px] font-bold text-gray-700">{ex.sets}</div>
                          <div className="w-14 text-center text-[13px] font-bold text-gray-700">{ex.reps}</div>
                          <div className="w-14 text-right text-[13px] font-bold text-violet-600">
                            {ex.weightKg != null ? `${ex.weightKg} kg` : <span className="text-gray-400 font-medium text-[11px]">pdc</span>}
                          </div>
                        </>
                      )}
                    </div>
                    )
                  })}
                </div>
                )
              })}

              {/* Footer */}
              <div className="flex items-center justify-between px-1">
                {progPlanAt && <p className="text-[11px] text-gray-400">Généré le {new Date(progPlanAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>}
                {progCooldownUntil ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-gray-400">Dispo le {new Date(progCooldownUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    <a href="/pricing" className="text-[11px] font-bold text-violet-600 hover:text-violet-500 transition-colors">Premium+ →</a>
                  </div>
                ) : (
                  <button onClick={generateProgPlan} disabled={progGenerating}
                    className="text-[11px] font-bold text-violet-600 hover:text-violet-500 disabled:opacity-50 transition-colors ml-auto">
                    {progGenerating ? "Génération…" : "Mettre à jour →"}
                  </button>
                )}
              </div>
              {progError && <p className="text-xs text-red-500 font-medium px-1">{progError}</p>}
            </div>
          )}
        </div>
      )}


      {/* Journal tab */}
      {(isDemo || actTab === "journal") && (
      <div className="pt-4 md:pb-8 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : unified.length === 0 ? (
          <div className="flex flex-col items-center py-20 px-4">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-200">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-sky-400 flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Journal d&apos;entraînement</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-xs text-center leading-relaxed">Musculation, course, vélo, natation… enregistrez toutes vos activités sportives</p>
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-colors shadow-lg shadow-blue-200">
              Ajouter une activité
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0 mt-2">
            {/* Month navigator */}
            <div className="flex items-center justify-between px-2 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white">
              <button
                onClick={() => setSelectedMonthIdx(i => Math.min(i + 1, allMonths.length - 1))}
                disabled={safeMonthIdx >= allMonths.length - 1}
                className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-extrabold text-gray-900 capitalize">{currentMonth?.label}</p>
                {currentMonth && (() => {
                  const count = currentMonth.days.reduce((s, d) => s + d.items.length, 0)
                  if (count === 0) return <p className="text-[10px] text-gray-400 mt-0.5">Aucune activité ce mois</p>
                  return <p className="text-[10px] text-gray-400 mt-0.5">{count} activité{count > 1 ? "s" : ""}</p>
                })()}
              </div>
              {safeMonthIdx > 0 ? (
                <button
                  onClick={() => setSelectedMonthIdx(i => Math.max(i - 1, 0))}
                  className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>

            {/* Empty state for months without data */}
            {currentMonth && currentMonth.days.length === 0 && (
              <div className="text-center py-12 px-4 flex flex-col items-center gap-4">
                <p className="text-gray-400 text-sm">Aucune activité enregistrée ce mois</p>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une séance
                </button>
              </div>
            )}

            {/* Items grouped by day */}
            <div className="flex flex-col gap-0 pb-3">
              {currentMonth?.days.map(dayGroup => (
                <div key={dayGroup.dayKey} className="px-3 md:px-4 pt-3">
                  <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <p className="text-[11px] font-bold text-gray-500 capitalize">{dayGroup.dayLabel}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-px">
                    {dayGroup.items.map(item => {
                      if (item.kind === "workout") {
                        const w = item.data
                        return (
                          <div
                            key={`w-${w.id}`}
                            className="flex items-center gap-3 py-3 px-4 rounded-2xl cursor-pointer select-none bg-white hover:bg-gray-50 active:scale-[0.98] transition-transform"
                            onTouchStart={() => startLongPress(w)}
                            onTouchMove={cancelLongPress}
                            onTouchEnd={cancelLongPress}
                            onMouseDown={() => startLongPress(w)}
                            onMouseUp={cancelLongPress}
                            onMouseLeave={cancelLongPress}
                            onClick={() => {
                              if (longPressTriggered.current) { longPressTriggered.current = false; return }
                              router.push(`/app/workouts/${w.id}`)
                            }}
                          >
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 text-white">
                              <DumbbellIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{w.name}</p>
                              {w.exercises.length > 0 && (
                                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{w.exercises.length} exo{w.exercises.length > 1 ? "s" : ""} · {w.exercises.map(e => e.name).join(" · ")}</p>
                              )}
                            </div>
                            {(() => {
                              const saved = customPresets.some(p => p.sourceWorkoutId === w.id)
                              return (
                                <button
                                  onClick={e => saveWorkoutAsPreset(w, e)}
                                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${saved ? "text-blue-500 bg-blue-50" : "text-gray-300 hover:text-blue-400 hover:bg-blue-50"}`}
                                  title={saved ? "Retirer des préfaites" : "Enregistrer comme séance préfaite"}
                                >
                                  {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                                </button>
                              )
                            })()}
                          </div>
                        )
                      } else {
                        const a = item.data
                        const info = getCardioInfo(a.type)
                        return (
                          <div
                            key={`a-${a.id}`}
                            className="flex items-center gap-3 py-3 px-4 rounded-2xl cursor-pointer select-none bg-white hover:bg-gray-50"
                            onClick={() => router.push(`/app/activities/${a.id}`)}
                          >
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: getCardioInfo(a.type).color }}>
                              <CardioIcon type={a.type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate text-gray-900">{a.name || info.label}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {a.distanceM && <span className="text-[11px] text-gray-500">{fmtDist(a.distanceM)}</span>}
                                {a.durationSec && <span className="text-[11px] text-gray-500">{fmtDuration(a.durationSec)}</span>}
                                {a.avgPaceSecKm && <span className="text-[11px] text-gray-400">{fmtPace(a.avgPaceSecKm)}</span>}
                                {!a.avgPaceSecKm && a.avgSpeedKmh && <span className="text-[11px] text-gray-400">{a.avgSpeedKmh.toFixed(1)} km/h</span>}
                                {a.avgHeartRate && <span className="text-[11px] text-red-400">{a.avgHeartRate} bpm</span>}
                              </div>
                            </div>
                          </div>
                        )
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Load more button */}
            {(hasMoreWorkouts || hasMoreActivities) && currentMonth && currentMonth.days.length > 0 && (
              <div className="flex justify-center pt-2 pb-4 px-4">
                <button
                  onClick={async () => {
                    setLoadingMore(true)
                    try {
                      const [w, a] = await Promise.all([
                        hasMoreWorkouts ? authFetch(`/api/workouts?limit=20&offset=${workouts.length}`).then(r => r.json()).catch(() => ({ items: [] })) : Promise.resolve(null),
                        hasMoreActivities ? authFetch(`/api/activities?limit=20&offset=${activities.length}`).then(r => r.json()).catch(() => ({ items: [] })) : Promise.resolve(null),
                      ])
                      if (w) { const more = w?.items ?? []; setWorkouts(p => [...p, ...more]); setHasMoreWorkouts((w?.total ?? 0) > workouts.length + more.length) }
                      if (a) { const more = a?.items ?? []; setActivities(p => [...p, ...more]); setHasMoreActivities((a?.total ?? 0) > activities.length + more.length) }
                    } catch (e) { console.error("[load more]", e) }
                    finally { setLoadingMore(false) }
                  }}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── Type Selector modal ── */}
      {showTypeSelector && (
        <div
          data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTypeSelector(false)}
        >
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pb-6 pt-5">
              <h3 className="text-base font-black text-gray-900 mb-5">Quel type d&apos;activité ?</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTypeSelector(false); setWName(""); setWDate(new Date().toISOString().slice(0, 10)); setWNotes(""); setWExercises([]); setSelectedPreset(null); setShowPresetPicker(false); setShowWorkoutForm(true) }}

                  className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-left hover:border-blue-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <DumbbellIcon size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Séance de sport</p>
                    <p className="text-xs text-gray-500 mt-0.5">Exercices avec séries, répétitions et charges</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowTypeSelector(false); resetCardioForm(); setShowCardioForm(true) }}
                  className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl text-left hover:border-orange-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                    <CardioIcon type="running" size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Activité cardio</p>
                    <p className="text-xs text-gray-500 mt-0.5">Course, vélo, natation, randonnée…</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowTypeSelector(false); setCustName(""); setCustDate(new Date().toISOString().slice(0, 10)); setCustDurH(""); setCustDurM(""); setCustDurS(""); setCustNotes(""); setShowCustomForm(true) }}
                  className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-left hover:border-green-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                    <CardioIcon type="custom" size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Autres</p>
                    <p className="text-xs text-gray-500 mt-0.5">Foot, boxe, tennis, yoga…</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Workout Form modal ── */}
      {showWorkoutForm && (
        <div
          data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowWorkoutForm(false)}
        >
          <div
            ref={workoutModalRef}
            tabIndex={-1}
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl outline-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pb-6 pt-5">
              <h3 className="text-base font-black text-gray-900 mb-4">Nouvelle séance</h3>

              {/* ── Preset picker ── */}
              {(() => {
                const activePreset = allPresets.find(p => p.key === selectedPreset)
                return (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowPresetPicker(p => !p)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-600 shrink-0">Séance préfaite</span>
                        {activePreset ? (
                          <span className="text-[11px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full truncate">{activePreset.label}</span>
                        ) : (
                          <span className="text-[11px] text-gray-400 truncate">optionnel</span>
                        )}
                      </div>
                      <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform duration-200 ${showPresetPicker ? "rotate-180" : ""}`} />
                    </button>

                    {showPresetPicker && (
                      <div className="mt-2 animate-fade-slide-up">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                          {allPresets.map(preset => {
                            const active = selectedPreset === preset.key
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => active ? (setSelectedPreset(null), setWExercises([]), setWName("")) : applyPreset(preset)}
                                className={`shrink-0 relative flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors ${
                                  active ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300"
                                }`}
                              >
                                <span className="text-xs font-extrabold leading-tight whitespace-nowrap pr-5">{preset.label}</span>
                                <span
                                  role="button"
                                  onClick={e => { e.stopPropagation(); removeCustomPreset(preset.key) }}
                                  className={`absolute top-1.5 right-1.5 rounded-full p-0.5 transition-colors ${active ? "text-blue-200 hover:text-white" : "text-gray-300 hover:text-red-400"}`}
                                >
                                  <Trash2 size={10} />
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Nom de la séance</label>
                  <input value={wName} onChange={e => setWName(e.target.value)} placeholder="ex: Push Day A"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <textarea value={wNotes} onChange={e => setWNotes(e.target.value)} placeholder="Ressenti, objectifs..." rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none"/>
                </div>
              </div>

              {/* Exercises from voice */}
              {wExercises.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {selectedPreset ? "Exercices de la séance" : "Exercices détectés"} ({wExercises.length})
                    </p>
                    <button onClick={() => { setWExercises([]); setSelectedPreset(null) }} className="text-[11px] text-gray-400 hover:text-red-400 transition-colors">
                      Effacer
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {wExercises.map((ex, i) => (
                      <div key={`${selectedPreset ?? "voice"}-${i}`} className="preset-ex-enter bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5" style={{ animationDelay: `${i * 45}ms` }}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-900">{ex.name}</p>
                          <span className="text-[11px] font-bold text-blue-500">{ex.sets.length} série{ex.sets.length > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ex.sets.map((s, j) => (
                            <span key={j} className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {s.reps != null ? `${s.reps} rép` : "—"}
                              {s.weight != null ? ` × ${s.weight} kg` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleCreateWorkout} disabled={wSaving || !wName.trim()} className="w-full mt-5 py-3 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                {wSaving ? "..." : selectedPreset ? `Créer · ${wExercises.length} exercices →` : wExercises.length > 0 ? `Créer avec ${wExercises.length} exercice${wExercises.length > 1 ? "s" : ""} →` : "Créer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cardio Form modal ── */}
      {showCardioForm && (
        <div
          data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeCardioForm}
        >
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pb-6 pt-5">
              <h3 className="text-base font-black text-gray-900 mb-4">
                {editingActivity ? "Modifier l'activité" : "Nouvelle activité cardio"}
              </h3>
              <div className="overflow-x-auto mb-4">
                <div className="flex gap-2 w-max pb-1">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.key} onClick={() => setCType(t.key)}
                      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all"
                      style={cType === t.key
                        ? { backgroundColor: t.color + "22", borderColor: t.color + "66", color: t.color }
                        : { backgroundColor: "rgb(249,250,251)", borderColor: "rgb(229,231,235)", color: "#6b7280" }}>
                      <CardioIcon type={t.key} />
                      <span className="text-[10px] font-bold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-sky-500/50"/>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Distance (km)</label>
                    <input type="number" min="0" step="0.1" value={cDist} onChange={e => setCDist(e.target.value)} placeholder="ex: 5.2"
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"/>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Durée</label>
                    <div className="flex gap-1 mt-1">
                      <input type="number" min="0" value={cDurH} onChange={e => setCDurH(e.target.value)} placeholder="0h"
                        className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                      <input type="number" min="0" max="59" value={cDurM} onChange={e => setCDurM(e.target.value)} placeholder="min"
                        className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                      <input type="number" min="0" max="59" value={cDurS} onChange={e => setCDurS(e.target.value)} placeholder="sec"
                        className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(cType === "running" || cType === "cycling" || cType === "hiking") && (
                    <div>
                      <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Dénivelé (m)</label>
                      <input type="number" min="0" value={cElev} onChange={e => setCElev(e.target.value)} placeholder="—"
                        className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">FC moy</label>
                    <input type="number" min="0" value={cHR} onChange={e => setCHR(e.target.value)} placeholder="bpm"
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Calories</label>
                    <input type="number" min="0" value={cCal} onChange={e => setCCal(e.target.value)} placeholder="kcal"
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                  </div>
                </div>
                <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Notes (optionnel)" rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none"/>
              </div>
              <button onClick={handleSaveActivity} disabled={cSaving} className="w-full mt-5 py-3 bg-sky-500 rounded-xl text-sm font-bold text-white hover:bg-sky-400 transition-colors disabled:opacity-50">
                {cSaving ? "..." : editingActivity ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Activity Form modal ── */}
      {showCustomForm && (
        <div
          data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCustomForm(false)}
        >
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pb-6 pt-5">
              <h3 className="text-base font-black text-gray-900 mb-4">Nouvelle activité</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Titre <span className="text-red-400">*</span></label>
                  <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="ex: Football, Boxe, Yoga…" autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-green-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Date</label>
                  <input type="date" value={custDate} onChange={e => setCustDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-500/50"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Durée <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input type="number" min="0" value={custDurH} onChange={e => setCustDurH(e.target.value)} placeholder="0h"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                    </div>
                    <div className="flex-1">
                      <input type="number" min="0" max="59" value={custDurM} onChange={e => setCustDurM(e.target.value)} placeholder="min"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                    </div>
                    <div className="flex-1">
                      <input type="number" min="0" max="59" value={custDurS} onChange={e => setCustDurS(e.target.value)} placeholder="sec"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none text-center"/>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <textarea value={custNotes} onChange={e => setCustNotes(e.target.value)} placeholder="Ressenti, résultat…" rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none"/>
                </div>
              </div>
              <button onClick={handleSaveCustomActivity} disabled={custSaving || !custName.trim()} className="w-full mt-5 py-3 bg-green-600 rounded-xl text-sm font-bold text-white hover:bg-green-500 transition-colors disabled:opacity-50">
                {custSaving ? "..." : "Ajouter →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice recording overlay ── */}
      {voiceRecording && (
        <div data-modal="" className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
            <svg className="w-9 h-9 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Enregistrement…</p>
            <p className="text-gray-400 text-sm">Décrivez votre activité à voix haute</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-1.5 rounded-full bg-red-400 animate-bounce"
                style={{ height: `${12 + (i % 2) * 8}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <button onClick={stopVoice} className="mt-2 px-6 py-2.5 border border-white/20 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-colors">
            Arrêter
          </button>
        </div>
      )}

      {/* ── Voice parsing overlay ── */}
      {voiceParsing && (
        <div data-modal="" className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Analyse en cours…</p>
            {voiceTranscript && (
              <p className="text-gray-400 text-sm italic max-w-xs">&ldquo;{voiceTranscript}&rdquo;</p>
            )}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Voice saving overlay ── */}
      {voiceSaving && (
        <div data-modal="" className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Enregistrement…</p>
            <p className="text-gray-400 text-sm">Sauvegarde de toutes les activités</p>
          </div>
        </div>
      )}

      {/* ── Delete workout confirmation ── */}
      {deleteConfirm && (
        <div
          data-modal=""
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5">
              <p className="text-base font-black text-gray-900 mb-1">Supprimer cette séance ?</p>
              <p className="text-sm text-gray-500 mb-6 leading-snug">
                <span className="font-semibold text-gray-700">&ldquo;{deleteConfirm.name}&rdquo;</span> sera définitivement supprimée.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteWorkout(deleteConfirm.id)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-sm font-bold text-white hover:bg-red-400 transition-colors disabled:opacity-40"
                >
                  {deleting ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preset list modal ── */}
      {showPresetList && (
        <div
          data-modal=""
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowPresetList(false)}
        >
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-black text-gray-900">Séances enregistrées</h3>
              <button onClick={() => setShowPresetList(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 overscroll-contain" onTouchMove={e => e.stopPropagation()}>
              {customPresets.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <BookmarkCheck size={32} className="text-gray-200 mb-3" />
                  <p className="text-sm font-bold text-gray-400">Aucune séance enregistrée</p>
                  <p className="text-xs text-gray-400 mt-1">Appuie sur le signet <BookmarkCheck size={11} className="inline" /> depuis l&apos;historique pour sauvegarder une séance</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {[...customPresets].sort((a, b) => (parseInt(b.key.replace("custom_", "")) || 0) - (parseInt(a.key.replace("custom_", "")) || 0)).map((preset, idx) => (
                    <div
                      key={preset.key}
                      className="preset-ex-enter flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl"
                      style={{ animationDelay: `${idx * 35}ms` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{preset.label}</p>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {preset.exercises.map((ex, i) => (
                            <p key={i} className="text-[11px] text-gray-400 leading-tight">
                              {ex.name} <span className="text-gray-300">·</span> {ex.sets} série{ex.sets > 1 ? "s" : ""}
                            </p>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCustomPreset(preset.key)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Preset saved toast ── */}
      {presetSavedToast && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-fade-slide-up"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
        >
          <div className="bg-blue-500/20 border border-blue-500/40 backdrop-blur-md rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl">
            <BookmarkCheck size={16} className="text-blue-400 shrink-0" />
            <p className="text-sm font-bold text-blue-700">{presetSavedToast}</p>
          </div>
        </div>
      )}

      {/* ── Voice success toast ── */}
      {voiceSuccess > 0 && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
        >
          <div className="bg-green-500/20 border border-green-500/40 backdrop-blur-md rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl pointer-events-auto">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-bold text-green-300">
              {voiceSuccess} activité{voiceSuccess > 1 ? "s" : ""} ajoutée{voiceSuccess > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── Voice error modal ── */}
      {voiceError && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVoiceError(null)}>
          <div className="modal-enter bg-white rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 pb-6 pt-5">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  {voiceError === "empty" && (
                    <>
                      <p className="text-sm font-extrabold text-gray-900 mb-1">On n&apos;a pas compris</p>
                      <p className="text-sm text-gray-500">Décris ton activité plus précisément et réessaie.</p>
                      <p className="text-xs text-gray-400 mt-2">Ex : &ldquo;Course 10 km en 50 min&rdquo; ou &ldquo;Développé couché 3×10 à 80 kg&rdquo;</p>
                    </>
                  )}
                  {voiceError === "permission" && (
                    <>
                      <p className="text-sm font-extrabold text-gray-900 mb-1">Microphone bloqué</p>
                      <p className="text-sm text-gray-500">Autorisez l&apos;accès au microphone dans les réglages de votre navigateur, puis réessayez.</p>
                      <p className="text-xs text-gray-400 mt-2">Sur iOS : Réglages → Safari → Microphone → Autoriser</p>
                    </>
                  )}
                  {voiceError === "notfound" && (
                    <>
                      <p className="text-sm font-extrabold text-gray-900 mb-1">Aucun microphone détecté</p>
                      <p className="text-sm text-gray-500">Vérifiez qu&apos;un microphone est connecté et accessible.</p>
                    </>
                  )}
                  {voiceError === "unknown" && (
                    <>
                      <p className="text-sm font-extrabold text-gray-900 mb-1">Erreur microphone</p>
                      <p className="text-sm text-gray-500">Impossible d&apos;accéder au microphone. Vérifiez vos permissions et réessayez.</p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setVoiceError(null)}
                className="w-full py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice preview modal ── */}
      {voicePreview && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVoicePreview(null)}>
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-2 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Activités détectées</p>
                  {voiceTranscript && (
                    <p className="text-[11px] text-gray-400 italic truncate max-w-[240px]">&ldquo;{voiceTranscript}&rdquo;</p>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-2">
              <div className="flex flex-col gap-3">
                {voicePreview.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                    {item.kind === "workout" ? (
                      <div className="p-3.5">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                            <DumbbellIcon size={15} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{item.workout.name || "Séance"}</p>
                            {item.date && (
                              <p className="text-[11px] text-blue-500">{fmtDate(item.date)}</p>
                            )}
                          </div>
                        </div>
                        {item.workout.exercises.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {item.workout.exercises.map((ex, ei) => (
                              <div key={ei} className={`rounded-xl p-2.5 ${ex.ambiguous ? "bg-blue-50 border border-blue-200" : "bg-gray-100"}`}>
                                {ex.ambiguous ? (
                                  <>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <p className="text-[11px] font-bold text-blue-600">Préciser : &ldquo;{ex.name}&rdquo;</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {ex.options!.map(opt => (
                                        <button
                                          key={opt}
                                          onClick={() => setVoicePreview(prev => prev ? prev.map((it, i) => {
                                            if (i !== idx || it.kind !== "workout") return it
                                            return {
                                              ...it,
                                              workout: {
                                                ...it.workout,
                                                exercises: it.workout.exercises.map((e, j) =>
                                                  j === ei ? { ...e, name: opt, ambiguous: false, options: undefined } : e
                                                )
                                              }
                                            }
                                          }) : prev)}
                                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[12px] font-bold text-gray-900">{ex.name}</p>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {ex.sets.map((s, si) => (
                                        <span key={si} className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                          {s.reps != null ? `${s.reps}` : "—"}
                                          {s.weight != null ? `×${s.weight}kg` : ""}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 flex items-center gap-3">
                        {(() => {
                          const info = getCardioInfo(item.activity.type)
                          return (
                            <>
                              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-sky-500">
                                <CardioIcon type={item.activity.type} size={15} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900">{info.label}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  {item.activity.distanceM && <span className="text-[11px] text-gray-500">{fmtDist(item.activity.distanceM)}</span>}
                                  {item.activity.durationSec && <span className="text-[11px] text-gray-500">{fmtDuration(item.activity.durationSec)}</span>}
                                  {item.activity.calories && <span className="text-[11px] text-gray-400">{item.activity.calories} kcal</span>}
                                  {item.activity.avgHeartRate && <span className="text-[11px] text-red-400">{item.activity.avgHeartRate} bpm</span>}
                                  {item.date && <span className="text-[11px] text-gray-400">{fmtDate(item.date)}</span>}
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pb-6 pt-3 flex gap-3 shrink-0 border-t border-gray-100">
              <button
                onClick={() => setVoicePreview(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { const p = voicePreview; setVoicePreview(null); saveVoiceItems(p!) }}
                disabled={voicePreview.some(item => item.kind === "workout" && item.workout.exercises.some(e => e.ambiguous))}
                className="flex-[2] py-3 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {(() => {
                  const n = voicePreview.length
                  const hasAmbig = voicePreview.some(item => item.kind === "workout" && item.workout.exercises.some(e => e.ambiguous))
                  if (hasAmbig) return "Précisez les exercices"
                  return `Enregistrer ${n} activité${n > 1 ? "s" : ""} →`
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}
    </div>
  )
}
