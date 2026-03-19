"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS } from "@/lib/demoData"
import LoadingScreen from "@/components/LoadingScreen"


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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

function calcWorkoutVolume(w: WorkoutData) {
  return (w.exercises ?? []).reduce((acc, ex) =>
    acc + (ex.sets ?? []).reduce((s, set) => s + (set.reps ?? 0) * (set.weight ?? 0), 0), 0)
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
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState(initial?.type ?? "fullbody")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), type, notes: notes ?? "", date })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg">
        {/* Handle bar mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
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

        {/* Form */}
        <div className="p-6 flex flex-col gap-5">
          {/* Name */}
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

          {/* Type */}
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
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-3 text-sm text-white font-medium outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">
              Notes <span className="text-gray-600 font-normal">(optionnel — à remplir après la séance)</span>
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

        {/* Footer */}
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

export default function WorkoutsPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editWorkout, setEditWorkout] = useState<WorkoutData | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setWorkouts(DEMO_WORKOUTS as unknown as WorkoutData[])
        setReady(true)
        return
      }
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
        // Navigate to the new workout detail page
        router.push(`/app/workouts/${created.id}`)
      }
      setShowModal(false)
      setEditWorkout(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (isDemo) {
      setWorkouts(prev => prev.filter(w => w.id !== id))
      return
    }
    await authFetch(`/api/workouts/${id}`, { method: "DELETE" })
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  if (!ready) return <LoadingScreen />

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

      <div className="max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Journal</p>
            <h1 className="text-2xl font-extrabold text-white">Mes séances</h1>
          </div>
          <button
            onClick={() => { setEditWorkout(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nouvelle séance</span>
          </button>
        </div>

        {/* Workout list */}
        {workouts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🏋️</p>
            <p className="text-gray-400 font-semibold mb-2">Aucune séance enregistrée</p>
            <p className="text-gray-600 text-sm mb-6">Créez votre première séance pour commencer à tracker</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Créer ma première séance
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {workouts.map(w => {
              const vol = calcWorkoutVolume(w)
              const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
              const typeInfo = getTypeInfo(w.type ?? "fullbody")
              return (
                <div
                  key={w.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Clickable row → workout detail */}
                  <div
                    className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-white/[0.07] transition-colors active:bg-white/10"
                    onClick={() => {
                      if (!isDemo) router.push(`/app/workouts/${w.id}`)
                    }}
                  >
                    {/* Type badge */}
                    <div className="w-11 h-11 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-violet-400 uppercase">{(w.type ?? "FB").slice(0, 2)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{w.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-md">{typeInfo.label}</span>
                        <span className="text-xs text-gray-500 font-medium">{formatDate(w.date)}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0 mr-1">
                      {w.exercises.length > 0 ? (
                        <>
                          <p className="text-sm font-bold text-violet-400">{vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${vol}kg`}</p>
                          <p className="text-xs text-gray-600">{totalSets} séries</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 italic">Pas d&apos;exo</p>
                      )}
                    </div>

                    {/* Arrow */}
                    {!isDemo && (
                      <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-3 flex gap-2">
                    <button
                      onClick={() => { setEditWorkout(w); setShowModal(true) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Supprimer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
