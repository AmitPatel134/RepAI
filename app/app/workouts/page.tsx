"use client"
import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import LoadingScreen from "@/components/LoadingScreen"
import UpgradeModal from "@/components/UpgradeModal"
import type { PreviewWorkout } from "@/app/api/workouts/import/route"

const WORKOUT_TYPES = [
  { value: "fullbody", label: "Full Body" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper Body" },
  { value: "lower", label: "Lower Body" },
  { value: "cardio", label: "Cardio" },
  { value: "hiit", label: "HIIT" },
  { value: "mobility", label: "Mobilité" },
  { value: "crossfit", label: "CrossFit" },
  { value: "force", label: "Force" },
  { value: "dos", label: "Dos" },
  { value: "bras", label: "Bras" },
  { value: "epaules", label: "Épaules" },
  { value: "abdos", label: "Abdos" },
]

type WorkoutData = {
  id: string
  name: string
  type: string
  date: string
  notes?: string | null
  exercises: {
    id: string
    name: string
    sets: { id: string; reps: number | null; weight: number | null }[]
  }[]
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}


function getTypeInfo(type: string) {
  return WORKOUT_TYPES.find(t => t.value === type) ?? { label: type }
}

function WorkoutModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void
  onSave: (w: { name: string; type: string; notes: string; date: string }) => void
  initial?: WorkoutData | null
}) {
  const isKnownType = (t?: string | null) => !!t && WORKOUT_TYPES.some(wt => wt.value === t)
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState(isKnownType(initial?.type) ? initial!.type! : initial?.type ? "custom" : "fullbody")
  const [customType, setCustomType] = useState(!isKnownType(initial?.type) && initial?.type ? initial.type : "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )

  function handleSave() {
    if (!name.trim()) return
    const finalType = type === "custom" ? (customType.trim() || "autre") : type
    onSave({ name: name.trim(), type: finalType, notes: notes ?? "", date })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-extrabold text-white">
            {initial ? "Modifier la séance" : "Nouvelle séance"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Nom de la séance</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Push Day A"
              autoFocus
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">Type de séance</label>
            <div className="grid grid-cols-3 gap-2">
              {WORKOUT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center justify-center px-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    type === t.value
                      ? "bg-violet-600/20 border-violet-500 text-violet-300"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
                  }`}
                >
                  <span className="leading-tight text-center">{t.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setType("custom")}
                className={`flex items-center justify-center px-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  type === "custom"
                    ? "bg-violet-600/20 border-violet-500 text-violet-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
                }`}
              >
                <span className="leading-tight text-center">Personnalisé</span>
              </button>
            </div>
            {type === "custom" && (
              <input
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                placeholder="ex: Yoga, Natation, Escalade..."
                autoFocus
                className="mt-2 w-full bg-white/10 border border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-3 text-sm text-white font-medium outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">
              Notes <span className="text-gray-600 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={notes ?? ""}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ressenti, observations, objectifs..."
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initial ? "Enregistrer" : "Créer la séance"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportPreviewModal({
  workouts,
  onConfirm,
  onCancel,
  importing,
}: {
  workouts: PreviewWorkout[]
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
}) {
  const totalExercises = workouts.reduce((s, w) => s + w.exercises.length, 0)
  const totalSets = workouts.reduce((s, w) => s + w.exercises.reduce((es, e) => es + e.setCount, 0), 0)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-white">Aperçu de l&apos;import</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {workouts.length} séance{workouts.length > 1 ? "s" : ""} · {totalExercises} exercices · {totalSets} séries
            </p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {workouts.map((w, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-violet-400 uppercase">{w.type.slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{w.name}</p>
                  <p className="text-xs text-gray-500">{formatDateShort(w.date)} · {getTypeInfo(w.type).label}</p>
                </div>
                <span className="text-xs text-gray-600 shrink-0">{w.exercises.length} exo{w.exercises.length > 1 ? "s" : ""}</span>
              </div>
              {w.exercises.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-12">
                  {w.exercises.map((ex, j) => (
                    <span key={j} className="text-[10px] font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                      {ex.name} <span className="text-gray-600">×{ex.setCount}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3 shrink-0">
          <button
            onClick={onCancel}
            disabled={importing}
            className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="flex-1 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importation...
              </>
            ) : (
              `Importer ${workouts.length} séance${workouts.length > 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  count,
  onConfirm,
  onCancel,
  deleting,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-sm">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pt-5 pb-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-white mb-1">
            Supprimer {count} séance{count > 1 ? "s" : ""} ?
          </h3>
          <p className="text-sm text-gray-500">
            Cette action est irréversible. Tous les exercices et séries associés seront supprimés.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-3 bg-red-600 rounded-xl text-sm font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WorkoutsPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editWorkout, setEditWorkout] = useState<WorkoutData | null>(null)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState("free")
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  // Import/export
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewWorkout[] | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ workouts: number; exercises: number; sets: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit / bulk delete
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressActive = useRef(false)

  // Sort
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  // Accordion
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const openInitialized = useRef(false)

  useEffect(() => {
    if (workouts.length === 0 || openInitialized.current) return
    const firstDate = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date
    if (firstDate) {
      const label = new Date(firstDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      setOpenMonths(new Set([label]))
      openInitialized.current = true
    }
  }, [workouts])

  function toggleMonth(label: string) {
    setOpenMonths(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function toggleYear(year: string) {
    setOpenYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setWorkouts(DEMO_WORKOUTS as unknown as WorkoutData[])
        setReady(true)
        return
      }
      const email = session.user.email ?? ""
      fetch(`/api/plan?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(d => setPlan(d.plan ?? "free"))
        .catch(() => {})
      authFetch("/api/workouts")
        .then(r => r.json())
        .then(d => {
          setWorkouts(Array.isArray(d) ? d : [])
          setReady(true)
        })
        .catch(() => {
          setIsDemo(true)
          setWorkouts(DEMO_WORKOUTS as unknown as WorkoutData[])
          setReady(true)
        })
    })
  }, [])

  function handleClickAdd() {
    if (!isDemo && plan === "free") {
      const now = new Date()
      const thisMonth = workouts.filter(w => {
        const d = new Date(w.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      if (thisMonth.length >= 5) {
        setUpgradeMsg("Vous avez atteint la limite de 5 séances par mois avec le plan Gratuit. Passez Pro pour des séances illimitées.")
        return
      }
    }
    setEditWorkout(null)
    setShowModal(true)
  }

  async function handleSave(data: { name: string; type: string; notes: string; date: string }) {
    if (isDemo) {
      const newWorkout: WorkoutData = {
        id: `local-${Date.now()}`,
        name: data.name,
        type: data.type,
        date: data.date,
        notes: data.notes,
        exercises: [],
      }
      if (editWorkout) {
        setWorkouts(prev => prev.map(w => w.id === editWorkout.id ? { ...newWorkout, id: editWorkout.id } : w))
      } else {
        setWorkouts(prev => [newWorkout, ...prev])
      }
      setShowModal(false)
      setEditWorkout(null)
      return
    }

    setSaving(true)
    try {
      if (editWorkout) {
        const r = await authFetch(`/api/workouts/${editWorkout.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const updated = await r.json()
        setWorkouts(prev => prev.map(w => w.id === editWorkout.id ? updated : w))
      } else {
        const r = await authFetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const created = await r.json()
        setWorkouts(prev => [created, ...prev])
        router.push(`/app/workouts/${created.id}`)
      }
      setShowModal(false)
      setEditWorkout(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    const r = await authFetch("/api/workouts/export")
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "repai_workouts.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ""

    setPreviewing(true)
    setImportError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const r = await authFetch("/api/workouts/import?preview=true", { method: "POST", body: form })
      const data = await r.json()
      if (!r.ok || data.error) {
        setImportError(data.error ?? "Impossible d'analyser le fichier")
      } else {
        setPreviewData(data.workouts)
        setPendingFile(file)
      }
    } catch {
      setImportError("Erreur de connexion")
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirmImport() {
    if (!pendingFile) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append("file", pendingFile)
      const r = await authFetch("/api/workouts/import", { method: "POST", body: form })
      const data = await r.json()
      if (!r.ok || data.error) {
        setImportError(data.error ?? "Erreur lors de l'import")
      } else {
        setImportResult(data.imported)
        const r2 = await authFetch("/api/workouts")
        const d = await r2.json()
        setWorkouts(Array.isArray(d) ? d : [])
      }
    } catch {
      setImportError("Erreur de connexion")
    } finally {
      setImporting(false)
      setPreviewData(null)
      setPendingFile(null)
    }
  }

  function startLongPress(id: string) {
    longPressActive.current = false
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true
      setEditMode(true)
      setSelectedIds(new Set([id]))
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitEditMode() {
    setEditMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    setDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => authFetch(`/api/workouts/${id}`, { method: "DELETE" }))
      )
      setWorkouts(prev => prev.filter(w => !selectedIds.has(w.id)))
      exitEditMode()
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  async function handleDeleteSingle(id: string) {
    if (isDemo) { setWorkouts(prev => prev.filter(w => w.id !== id)); return }
    await authFetch(`/api/workouts/${id}`, { method: "DELETE" })
    setWorkouts(prev => prev.filter(w => w.id !== id))
    exitEditMode()
  }

  if (!ready) return <LoadingScreen />

  // Sort + group by year then month
  const sorted = [...workouts].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime()
    return sortOrder === "desc" ? diff : -diff
  })
  const currentYear = String(new Date().getFullYear())
  type MonthGroup = { label: string; items: WorkoutData[] }
  type YearGroup = { year: string; months: MonthGroup[] }
  const yearGroups: YearGroup[] = []
  for (const w of sorted) {
    const year = String(new Date(w.date).getFullYear())
    const label = new Date(w.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    let yg = yearGroups.find(g => g.year === year)
    if (!yg) { yg = { year, months: [] }; yearGroups.push(yg) }
    const lastMonth = yg.months[yg.months.length - 1]
    if (lastMonth && lastMonth.label === label) lastMonth.items.push(w)
    else yg.months.push({ label, items: [w] })
  }

  const multiSelected = selectedIds.size > 1
  const singleSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline hover:text-white">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full hover:bg-violet-500 transition-colors shrink-0">
            Se connecter
          </a>
        </div>
      )}

      {(showModal || editWorkout) && (
        <WorkoutModal
          initial={editWorkout}
          onClose={() => { setShowModal(false); setEditWorkout(null) }}
          onSave={handleSave}
        />
      )}

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}

      {previewData && (
        <ImportPreviewModal
          workouts={previewData}
          onConfirm={handleConfirmImport}
          onCancel={() => { setPreviewData(null); setPendingFile(null) }}
          importing={importing}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          deleting={deleting}
        />
      )}

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Journal</p>
              <h1 className="text-2xl font-extrabold text-white">Mes séances</h1>
            </div>
            <div className="flex items-center gap-2">
              {!isDemo && !editMode && (
                <>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={previewing}
                    className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold text-xs px-3 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {previewing ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">{previewing ? "Analyse..." : "Importer"}</span>
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold text-xs px-3 py-2.5 rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden sm:inline">Exporter</span>
                  </button>
                </>
              )}
              {!editMode && (
                <button
                  onClick={handleClickAdd}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Nouvelle séance</span>
                </button>
              )}
            </div>
          </div>

          {/* Free plan usage */}
          {!isDemo && plan === "free" && (() => {
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
                  <span className="text-[10px] font-bold text-gray-500">{used}/5 ce mois</span>
                </div>
                <a href="/pricing" className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors">Passer Pro →</a>
              </div>
            )
          })()}

          {/* Sort toggle */}
          {workouts.length > 0 && (
            <div className="flex items-center justify-end mt-2">
              <button
                onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={sortOrder === "desc"
                    ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                    : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                  } />
                </svg>
                {sortOrder === "desc" ? "Plus récent d'abord" : "Plus ancien d'abord"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        {/* Import feedback */}
        {importResult && (
          <div className="mx-4 md:mx-6 mt-4 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-green-400 font-semibold">
              {importResult.workouts} séance{importResult.workouts > 1 ? "s" : ""} importée{importResult.workouts > 1 ? "s" : ""} · {importResult.exercises} exercices · {importResult.sets} séries
            </p>
            <button onClick={() => setImportResult(null)} className="text-green-400/60 hover:text-green-300 transition-colors ml-3 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {importError && (
          <div className="mx-4 md:mx-6 mt-4 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-400 font-semibold">{importError}</p>
            <button onClick={() => setImportError(null)} className="text-red-400/60 hover:text-red-300 transition-colors ml-3 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Workout list */}
        {workouts.length === 0 ? (
          <div className="text-center py-20 px-4 md:px-6">
            <p className="text-4xl mb-4">🏋️</p>
            <p className="text-gray-400 font-semibold mb-2">Aucune séance enregistrée</p>
            <p className="text-gray-600 text-sm mb-6">Créez votre première séance pour commencer à tracker</p>
            <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors">
              Créer ma première séance
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
                      onClick={() => toggleMonth(group.label)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] border-t border-white/10 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <p className="text-sm font-extrabold text-white capitalize">{group.label}</p>
                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{group.items.length} séance{group.items.length > 1 ? "s" : ""}</span>
                      </div>
                      <svg
                        className="w-4 h-4 text-gray-500 transition-transform duration-300"
                        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                      <div style={{ overflow: "hidden" }}>
                        <div className="divide-y divide-white/[0.10]">
                          {group.items.map(w => {
                            const typeInfo = getTypeInfo(w.type ?? "fullbody")
                            const isSelected = selectedIds.has(w.id)
                            const isSingleSelected = singleSelectedId === w.id
                            return (
                              <div
                                key={w.id}
                                className={`flex items-center gap-3 py-2.5 px-4 md:px-6 select-none transition-colors ${editMode && isSelected ? "bg-violet-600/5" : ""}`}
                                onMouseDown={() => !isDemo && startLongPress(w.id)}
                                onMouseUp={cancelLongPress}
                                onMouseLeave={cancelLongPress}
                                onTouchStart={() => !isDemo && startLongPress(w.id)}
                                onTouchEnd={cancelLongPress}
                                onTouchMove={cancelLongPress}
                                onClick={() => {
                                  if (longPressActive.current) { longPressActive.current = false; return }
                                  if (editMode) { toggleSelect(w.id); return }
                                  if (!isDemo) router.push(`/app/workouts/${w.id}`)
                                }}
                              >
                                {editMode && (
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-violet-600 border-violet-500" : "border-gray-600"}`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{w.name}</p>
                                  <p className="text-xs text-gray-500 font-medium mt-0.5">{typeInfo.label}</p>
                                </div>
                                {editMode && isSingleSelected && !multiSelected ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditWorkout(w); setShowModal(true); exitEditMode() }}
                                      className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDeleteSingle(w.id) }}
                                      className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-gray-400">
                                      {new Date(w.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                    </p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">
                                      {w.exercises.length > 0 ? `${w.exercises.length} exo${w.exercises.length > 1 ? "s" : ""}` : "—"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })

              if (isCurrentYear) return <React.Fragment key={yg.year}>{monthBlocks}</React.Fragment>

              return (
                <div key={yg.year} className="border-b border-white/10">
                  {/* Year header */}
                  <button
                    onClick={() => toggleYear(yg.year)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.06] border-t border-white/10 hover:bg-white/[0.09] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <p className="text-base font-black text-white">{yg.year}</p>
                      <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{totalInYear} séance{totalInYear > 1 ? "s" : ""}</span>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-400 transition-transform duration-300"
                      style={{ transform: isYearOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Animated months */}
                  <div style={{ display: "grid", gridTemplateRows: isYearOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                    <div style={{ overflow: "hidden" }}>
                      {monthBlocks}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating edit-mode bar */}
      {editMode && (
        <div
          className="fixed left-0 right-0 flex justify-center gap-3 z-40 pointer-events-none"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={exitEditMode}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-gray-800 border border-white/15 rounded-2xl text-sm font-bold text-white shadow-2xl shadow-black/60 hover:bg-gray-700 transition-colors backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Annuler
          </button>
          {multiSelected && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-red-600/20 border border-red-500/40 rounded-2xl text-sm font-bold text-red-400 shadow-2xl shadow-black/60 hover:bg-red-600/30 transition-colors backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer ({selectedIds.size})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
