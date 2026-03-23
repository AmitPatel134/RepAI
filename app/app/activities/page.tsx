"use client"
import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import UpgradeModal from "@/components/UpgradeModal"
import { Dumbbell } from "lucide-react"

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

type VoiceSet = { reps: number | null; weight: number | null }
type VoiceExercise = { name: string; sets: VoiceSet[]; ambiguous?: boolean; options?: string[] }
type VoiceActivityData = {
  type: string; durationSec?: number | null; distanceM?: number | null
  elevationM?: number | null; avgHeartRate?: number | null; calories?: number | null; notes?: string | null
}
type VoiceWorkoutData = { name: string; type: string; exercises: VoiceExercise[]; notes?: string | null }
type VoiceItem =
  | { kind: "workout"; workout: VoiceWorkoutData; date?: string }
  | { kind: "cardio"; activity: VoiceActivityData; date?: string }
type VoiceResult = { items: VoiceItem[] }

// ─── Exercise disambiguation ──────────────────────────────────────────────────

const EXERCISE_DISAMBIG: Record<string, string[]> = {
  "tractions":    ["Tractions pronation", "Tractions supination"],
  "développé":    ["Développé couché barre", "Développé couché haltères", "Développé incliné barre", "Développé incliné haltères", "Développé décliné", "Développé militaire"],
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

function findDisambigOptions(name: string): string[] | null {
  const firstWord = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(" ")[0]
  for (const [key, options] of Object.entries(EXERCISE_DISAMBIG)) {
    const normKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (firstWord === normKey) {
      const exactMatch = options.some(o => o.toLowerCase() === name.toLowerCase())
      return exactMatch ? null : options
    }
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
  { key: "cycling",    label: "Vélo",       color: "#0ea5e9" },
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
  return CARDIO_TYPES.find(t => t.key === type) ?? CARDIO_TYPES[CARDIO_TYPES.length - 1]
}
function getItemKey(item: UnifiedItem) {
  return item.kind === "workout" ? `w:${item.data.id}` : `a:${item.data.id}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DumbbellIcon({ size = 18 }: { size?: number }) {
  return <Dumbbell size={size} />
}

function CardioIcon({ type, size = 18 }: { type: string; size?: number }) {
  const s = size
  // Running figure — Phosphor Icons "PersonSimpleRun" stroke path
  if (type === "running") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 256 256" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="176" cy="48" r="20"/>
      <path d="M96 80l48 16 24 40-32 24 16 64"/>
      <path d="M144 96l16 48-64 16"/>
      <path d="M80 224l24-64"/>
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

// ─── useSheetDrag ─────────────────────────────────────────────────────────────

function useSheetDrag(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [translateY, setTranslateY] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const yRef = useRef(0)
  const startY = useRef(0)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const vel = useRef(0)
  const onDragStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    lastY.current = e.touches[0].clientY
    lastT.current = Date.now()
    vel.current = 0
    setTransitioning(false)
  }
  const onDragMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY
    const now = Date.now()
    const dt = now - lastT.current
    if (dt > 0) vel.current = (y - lastY.current) / dt
    lastY.current = y
    lastT.current = now
    const newY = Math.max(0, y - startY.current)
    yRef.current = newY
    setTranslateY(newY)
  }
  const onDragEnd = () => {
    setTransitioning(true)
    if (yRef.current > 120 || vel.current > 0.6) {
      setTranslateY(window.innerHeight)
      setTimeout(() => { onCloseRef.current(); yRef.current = 0; setTranslateY(0); setTransitioning(false) }, 300)
    } else {
      yRef.current = 0; setTranslateY(0)
      setTimeout(() => setTransitioning(false), 300)
    }
  }
  const reset = () => { yRef.current = 0; setTranslateY(0); setTransitioning(false) }
  const style: React.CSSProperties = (yRef.current > 0 || transitioning)
    ? {
        transform: `translateY(${translateY}px)`,
        transition: transitioning ? "transform 0.3s cubic-bezier(0.4,0,0.2,1)" : "none",
      }
    : {}
  return { style, onDragStart, onDragMove, onDragEnd, reset }
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

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Long press detection
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpFired = useRef(false)
  const lpMoved = useRef(false)
  const lpStartX = useRef(0)
  const lpStartY = useRef(0)

  // Bottom sheet drag-to-dismiss
  const sheetDragY = useRef<number | null>(null)
  const typeSelectorDrag = useSheetDrag(() => setShowTypeSelector(false))
  const workoutFormDrag = useSheetDrag(() => setShowWorkoutForm(false))
  const cardioFormDrag = useSheetDrag(() => closeCardioForm())
  const voicePreviewDrag = useSheetDrag(() => setVoicePreview(null))

  // Modals
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showCardioForm, setShowCardioForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

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
  const [wName, setWName] = useState("")
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wNotes, setWNotes] = useState("")
  const [wSaving, setWSaving] = useState(false)
  const [wExercises, setWExercises] = useState<VoiceExercise[]>([])

  // Voice preview
  const [voicePreview, setVoicePreview] = useState<VoiceItem[] | null>(null)

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setWorkouts(DEMO_WORKOUTS as unknown as Workout[])
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        // month nav
        setLoading(false)
        return
      }
      const email = session.user.email ?? ""
      Promise.all([
        authFetch("/api/workouts").then(r => r.json()).catch(() => []),
        authFetch("/api/activities").then(r => r.json()).catch(() => []),
        authFetch("/api/plan").then(r => r.json()).catch(() => ({ plan: "free" })),
      ]).then(([w, a, p]) => {
        setWorkouts(Array.isArray(w) ? w : [])
        setActivities(Array.isArray(a) ? a : [])
        setPlan(p?.plan ?? "free")
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        // month nav
      }).finally(() => setLoading(false))
    })
  }, [])

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
    const r = await authFetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wName.trim(), type: "", notes: wNotes, date: wDate, exercises: wExercises }),
    })
    if (r.ok) {
      const workout = await r.json()
      setWorkouts(prev => [workout, ...prev])
      const label = new Date(workout.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      setSelectedMonthIdx(0)
      setShowWorkoutForm(false)
      setWExercises([])
    }
    setWSaving(false)
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
      if (r.ok) {
        const act = await r.json()
        setActivities(prev => [act, ...prev])
        closeCardioForm()
        const label = new Date(act.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
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
    const localToday = new Date().toLocaleDateString("fr-CA")

    for (const item of items) {
      if (item.kind === "workout") {
        const w = item.workout
        const r = await authFetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: w.name || "Séance",
            type: w.type || "fullbody",
            notes: w.notes || null,
            date: item.date || localToday,
            exercises: w.exercises || [],
          }),
        })
        if (r.ok) {
          const workout = await r.json()
          setWorkouts(prev => [workout, ...prev])
          const label = new Date(workout.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
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
        if (r.ok) {
          const act = await r.json()
          setActivities(prev => [act, ...prev])
          const label = new Date(act.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          setSelectedMonthIdx(0)
          savedCount++
        }
      }
    }

    setVoiceSaving(false)
    if (savedCount > 0) {
      setVoiceSuccess(savedCount)
      setTimeout(() => setVoiceSuccess(0), 4000)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-700">
            Mode démo — <a href="/login" className="underline">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full">Se connecter</a>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-100/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Journal</p>
              <h1 className="text-2xl font-extrabold text-gray-900">Activités</h1>
            </div>
            {!editMode && (
              <div className="flex items-center gap-2">
                {/* Voice button */}
                <button
                  onClick={voiceRecording ? stopVoice : startVoice}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    voiceRecording
                      ? "bg-red-500 shadow-lg shadow-red-500/40 animate-pulse"
                      : "bg-gray-100 border border-gray-200 hover:bg-gray-200"
                  }`}
                  title="Commande vocale"
                >
                  <svg className={`w-4 h-4 ${voiceRecording ? "text-white" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                {/* Add button */}
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Nouvelle activité</span>
                </button>
              </div>
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
                      <div key={i} className={`w-4 h-1.5 rounded-full ${i < used ? "bg-blue-600" : "bg-gray-100"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{used}/5 séances ce mois</span>
                </div>
                <a href="/pricing" className="text-[10px] font-bold text-blue-500 hover:text-blue-400">Passer Pro →</a>
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
            <p className="text-gray-500 font-semibold mb-2">Aucune activité enregistrée</p>
            <p className="text-gray-400 text-sm mb-6">Ajoutez votre première séance ou activité cardio</p>
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors">
              Ajouter une activité
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {/* Month navigator */}
            <div className="flex items-center justify-between px-2 py-3 border-b border-gray-200 bg-white">
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
              <div className="text-center py-12 px-4">
                <p className="text-gray-400 text-sm">Aucune activité enregistrée ce mois</p>
              </div>
            )}

            {/* Items grouped by day */}
            <div className="flex flex-col gap-0 pb-3">
              {currentMonth?.days.map(dayGroup => (
                <div key={dayGroup.dayKey} className="px-3 md:px-4 pt-3">
                  <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 capitalize">{dayGroup.dayLabel}</p>
                  </div>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 divide-y divide-gray-100">
                    {dayGroup.items.map(item => {
                      const key = getItemKey(item)
                      const isSelected = selectedIds.has(key)
                      if (item.kind === "workout") {
                        const w = item.data
                        const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
                        return (
                          <div
                            key={`w-${w.id}`}
                            className={`flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors select-none ${
                              isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                            } ${editMode && !isSelected ? "opacity-50" : ""}`}
                            onTouchStart={e => onItemTouchStart(e, key)}
                            onTouchMove={onItemTouchMove}
                            onTouchEnd={onItemTouchEnd}
                            onClick={() => onItemClick(key, () => router.push(`/app/workouts/${w.id}`))}
                          >
                            {editMode && (
                              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                              <DumbbellIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{w.name}</p>
                              {w.exercises.length > 0 && (
                                <p className="text-[11px] text-gray-400 mt-0.5">{w.exercises.length} exo{w.exercises.length > 1 ? "s" : ""} · {totalSets} série{totalSets > 1 ? "s" : ""}</p>
                              )}
                            </div>
                          </div>
                        )
                      } else {
                        const a = item.data
                        const info = getCardioInfo(a.type)
                        return (
                          <div
                            key={`a-${a.id}`}
                            className={`flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors select-none ${
                              isSelected ? "bg-sky-50" : "hover:bg-gray-50"
                            } ${editMode && !isSelected ? "opacity-50" : ""}`}
                            onTouchStart={e => onItemTouchStart(e, key)}
                            onTouchMove={onItemTouchMove}
                            onTouchEnd={onItemTouchEnd}
                            onClick={() => onItemClick(key, () => router.push(`/app/activities/${a.id}`))}
                          >
                            {editMode && (
                              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                isSelected ? "bg-sky-500 border-sky-500" : "border-gray-600"
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-sky-500">
                              <CardioIcon type={a.type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate text-gray-900">{info.label}</p>
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
          </div>
        )}
      </div>

      {/* ── Floating edit action bar ── */}
      {editMode && selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
        >
          <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-2xl p-3 flex items-center gap-2">
            <button
              onClick={exitEditMode}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deletingSelected}
              className="flex-[2] py-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {deletingSelected ? "..." : selectedIds.size > 1 ? `Supprimer (${selectedIds.size})` : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Type Selector (bottom sheet, swipe-to-dismiss) ── */}
      {showTypeSelector && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowTypeSelector(false)}
        >
          <div
            className="sheet-enter bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg"
            style={typeSelectorDrag.style}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={typeSelectorDrag.onDragStart}
              onTouchMove={typeSelectorDrag.onDragMove}
              onTouchEnd={typeSelectorDrag.onDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-5 pb-8 pt-2">
              <h3 className="text-base font-black text-gray-900 mb-5">Quel type d&apos;activité ?</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTypeSelector(false); setWName(""); setWDate(new Date().toISOString().slice(0, 10)); setWNotes(""); setWExercises([]); setShowWorkoutForm(true) }}
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
                  className="flex items-center gap-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-left hover:border-sky-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-500 shrink-0">
                    <CardioIcon type="running" size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Activité cardio</p>
                    <p className="text-xs text-gray-500 mt-0.5">Course, vélo, natation, randonnée…</p>
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
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowWorkoutForm(false)}
        >
          <div
            className="sheet-enter bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={workoutFormDrag.style}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={workoutFormDrag.onDragStart}
              onTouchMove={workoutFormDrag.onDragMove}
              onTouchEnd={workoutFormDrag.onDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-5 pb-6 pt-2">
              <h3 className="text-base font-black text-gray-900 mb-4">Nouvelle séance</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">Nom de la séance</label>
                  <input value={wName} onChange={e => setWName(e.target.value)} placeholder="ex: Push Day A" autoFocus
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
                      Exercices détectés ({wExercises.length})
                    </p>
                    <button onClick={() => setWExercises([])} className="text-[11px] text-gray-400 hover:text-red-400 transition-colors">
                      Effacer
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {wExercises.map((ex, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
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
                {wSaving ? "..." : wExercises.length > 0 ? `Créer avec ${wExercises.length} exercice${wExercises.length > 1 ? "s" : ""} →` : "Créer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cardio Form (bottom sheet, swipe-to-dismiss) ── */}
      {showCardioForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={closeCardioForm}
        >
          <div
            className="sheet-enter bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={cardioFormDrag.style}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={cardioFormDrag.onDragStart}
              onTouchMove={cardioFormDrag.onDragMove}
              onTouchEnd={cardioFormDrag.onDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-5 pb-6 pt-2">
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

      {/* ── Voice recording overlay ── */}
      {voiceRecording && (
        <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-6 px-6">
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
        <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-5 px-6">
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
        <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Enregistrement…</p>
            <p className="text-gray-400 text-sm">Sauvegarde de toutes les activités</p>
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

      {/* ── Voice error overlay ── */}
      {voiceError && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setVoiceError(null)}>
          <div className="bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="px-5 pb-8 pt-3">
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

      {/* ── Delete confirmation ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="sheet-enter bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <div className="px-5 pb-8 pt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">
                    Supprimer {selectedIds.size} activité{selectedIds.size > 1 ? "s" : ""} ?
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Cette action est irréversible.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); handleDeleteSelected() }}
                  disabled={deletingSelected}
                  className="flex-[2] py-3 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletingSelected ? "..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice preview bottom sheet ── */}
      {voicePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setVoicePreview(null)}>
          <div
            className="sheet-enter bg-white border border-gray-200 shadow-2xl rounded-t-3xl w-full max-w-lg max-h-[85vh] flex flex-col"
            style={voicePreviewDrag.style}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab shrink-0"
              onTouchStart={voicePreviewDrag.onDragStart}
              onTouchMove={voicePreviewDrag.onDragMove}
              onTouchEnd={voicePreviewDrag.onDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-5 pt-2 pb-2 shrink-0">
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
                            <p className="text-[11px] text-blue-500">
                              {WORKOUT_TYPES.find(t => t.value === item.workout.type)?.label ?? item.workout.type}
                              {item.date ? ` · ${fmtDate(item.date)}` : ""}
                            </p>
                          </div>
                        </div>
                        {item.workout.exercises.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {item.workout.exercises.map((ex, ei) => (
                              <div key={ei} className={`rounded-xl p-2.5 ${ex.ambiguous ? "bg-amber-500/10 border border-amber-500/30" : "bg-gray-100"}`}>
                                {ex.ambiguous ? (
                                  <>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <p className="text-[11px] font-bold text-amber-400">Préciser : &ldquo;{ex.name}&rdquo;</p>
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
                                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
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
