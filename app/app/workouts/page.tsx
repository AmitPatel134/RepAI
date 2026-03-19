"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { DEMO_WORKOUTS, calcWorkoutVolume } from "@/lib/demoData"
import LoadingScreen from "@/components/LoadingScreen"

type SetData = { id?: string; reps: number | ""; weight: number | ""; rpe?: number | ""; notes?: string }
type ExerciseData = { id?: string; name: string; category: string; sets: SetData[] }
type WorkoutData = {
  id: string
  name: string
  date: string
  notes?: string | null
  exercises: {
    id: string
    name: string
    category: string
    sets: { id: string; reps: number | null; weight: number | null; rpe: number | null; notes?: string | null }[]
  }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${v}kg`
}

const EXERCISE_SUGGESTIONS = [
  "Développé couché", "Développé épaules", "Squat", "Soulevé de terre", "Tractions",
  "Dips", "Rowing barre", "Curl biceps", "Triceps poulie", "Leg press",
  "Leg curl", "Leg extension", "Développé incliné", "Rowing haltère", "Face pull",
  "Hip thrust", "RDL", "Presse à épaules", "Écarté poulie", "Crunch",
]

function WorkoutModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void
  onSave: (w: { name: string; notes: string; date: string; exercises: ExerciseData[] }) => void
  initial?: WorkoutData | null
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [exercises, setExercises] = useState<ExerciseData[]>(
    initial?.exercises.map(e => ({
      id: e.id,
      name: e.name,
      category: e.category,
      sets: e.sets.map(s => ({ id: s.id, reps: s.reps ?? "", weight: s.weight ?? "", rpe: s.rpe ?? "" })),
    })) ?? [{ name: "", category: "strength", sets: [{ reps: "", weight: "" }] }]
  )

  function addExercise() {
    setExercises(prev => [...prev, { name: "", category: "strength", sets: [{ reps: "", weight: "" }] }])
  }

  function removeExercise(i: number) {
    setExercises(prev => prev.filter((_, idx) => idx !== i))
  }

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { reps: "", weight: "" }] } : ex
    ))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
    ))
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof SetData, value: string) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        sets: ex.sets.map((s, j) =>
          j === setIdx ? { ...s, [field]: value === "" ? "" : Number(value) } : s
        ),
      } : ex
    ))
  }

  function updateExerciseName(exIdx: number, value: string) {
    setExercises(prev => prev.map((ex, i) => i === exIdx ? { ...ex, name: value } : ex))
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), notes: notes ?? "", date, exercises })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-start justify-center sm:p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl sm:my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h2 className="text-lg font-extrabold text-white">{initial ? "Modifier la séance" : "Nouvelle séance"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">Nom de la séance</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ex: Push Day A"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-medium outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">Notes (optionnel)</label>
            <input
              value={notes ?? ""}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ressenti, observations..."
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Exercices</p>
            </div>
            <div className="flex flex-col gap-4">
              {exercises.map((ex, exIdx) => (
                <div key={exIdx} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={ex.name}
                      onChange={e => updateExerciseName(exIdx, e.target.value)}
                      placeholder="Nom de l'exercice"
                      list={`exo-list-${exIdx}`}
                      className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 font-semibold outline-none focus:border-violet-500 transition-colors"
                    />
                    <datalist id={`exo-list-${exIdx}`}>
                      {EXERCISE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <button
                      onClick={() => removeExercise(exIdx)}
                      className="w-8 h-8 rounded-xl bg-red-900/40 flex items-center justify-center text-red-400 hover:bg-red-900/60 transition-colors shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Sets header */}
                  <div className="grid grid-cols-12 gap-1 mb-2 px-1">
                    <p className="col-span-1 text-xs text-gray-600 font-bold text-center">#</p>
                    <p className="col-span-4 text-xs text-gray-600 font-bold">Reps</p>
                    <p className="col-span-4 text-xs text-gray-600 font-bold">Poids (kg)</p>
                    <p className="col-span-2 text-xs text-gray-600 font-bold">RPE</p>
                    <p className="col-span-1"></p>
                  </div>

                  {/* Sets */}
                  {ex.sets.map((s, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-12 gap-1 mb-1.5 items-center">
                      <p className="col-span-1 text-xs text-gray-500 font-bold text-center">{setIdx + 1}</p>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                        placeholder="8"
                        min={0}
                        className="col-span-4 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-medium outline-none focus:border-violet-500 text-center transition-colors"
                      />
                      <input
                        type="number"
                        value={s.weight}
                        onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)}
                        placeholder="0"
                        min={0}
                        step={0.5}
                        className="col-span-4 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-medium outline-none focus:border-violet-500 text-center transition-colors"
                      />
                      <input
                        type="number"
                        value={s.rpe ?? ""}
                        onChange={e => updateSet(exIdx, setIdx, "rpe", e.target.value)}
                        placeholder="8"
                        min={1}
                        max={10}
                        step={0.5}
                        className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-medium outline-none focus:border-violet-500 text-center transition-colors"
                      />
                      <button
                        onClick={() => removeSet(exIdx, setIdx)}
                        disabled={ex.sets.length <= 1}
                        className="col-span-1 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => addSet(exIdx)}
                    className="mt-2 w-full py-1.5 border border-dashed border-white/20 rounded-xl text-xs font-bold text-gray-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
                  >
                    + Série
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addExercise}
              className="mt-3 w-full py-3 border border-dashed border-white/20 rounded-2xl text-sm font-bold text-gray-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
            >
              + Ajouter un exercice
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
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
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editWorkout, setEditWorkout] = useState<WorkoutData | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
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
          setWorkouts(Array.isArray(d) ? d : DEMO_WORKOUTS as unknown as WorkoutData[])
          setReady(true)
        })
        .catch(() => {
          setIsDemo(true)
          setWorkouts(DEMO_WORKOUTS as unknown as WorkoutData[])
          setReady(true)
        })
    })
  }, [])

  async function handleSave(data: { name: string; notes: string; date: string; exercises: ExerciseData[] }) {
    if (isDemo) {
      const newWorkout: WorkoutData = {
        id: `local-${Date.now()}`,
        name: data.name,
        date: data.date,
        notes: data.notes,
        exercises: data.exercises.map((ex, ei) => ({
          id: `local-ex-${ei}`,
          name: ex.name,
          category: ex.category,
          sets: ex.sets.map((s, si) => ({
            id: `local-s-${si}`,
            reps: typeof s.reps === "number" ? s.reps : null,
            weight: typeof s.weight === "number" ? s.weight : null,
            rpe: typeof s.rpe === "number" ? s.rpe : null,
          })),
        })),
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
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-6 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline hover:text-white">Connectez-vous</a> pour sauvegarder vos données.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full hover:bg-violet-500 transition-colors">
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
        <div className="flex items-center justify-between mb-6 md:mb-8">
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
            <p className="text-gray-600 text-sm mb-6">Commencez à logger vos entraînements pour suivre vos progrès</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Logger ma première séance
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workouts.map(w => {
              const vol = calcWorkoutVolume(w as unknown as typeof DEMO_WORKOUTS[0])
              const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
              const isOpen = expanded === w.id
              return (
                <div key={w.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {/* Workout header */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : w.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                      <span className="text-lg">💪</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{w.name}</p>
                      <p className="text-xs text-gray-500 font-medium">{formatDate(w.date)}</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-bold text-violet-400">{formatVolume(vol)}</p>
                        <p className="text-xs text-gray-600">{totalSets} séries</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEditWorkout(w); setShowModal(true) }}
                          className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(w.id) }}
                          className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded exercises */}
                  {isOpen && (
                    <div className="border-t border-white/5 px-5 py-4 flex flex-col gap-4">
                      {w.notes && (
                        <p className="text-xs text-gray-500 italic">{w.notes}</p>
                      )}
                      {w.exercises.map(ex => (
                        <div key={ex.id}>
                          <p className="text-xs font-bold text-violet-400 mb-2">{ex.name}</p>
                          <div className="grid grid-cols-4 gap-1 mb-1">
                            {["#", "Reps", "Poids", "RPE"].map(h => (
                              <p key={h} className="text-xs text-gray-600 font-bold">{h}</p>
                            ))}
                          </div>
                          {ex.sets.map((s, si) => (
                            <div key={s.id} className="grid grid-cols-4 gap-1 mb-1">
                              <p className="text-xs text-gray-600">{si + 1}</p>
                              <p className="text-xs text-white font-semibold">{s.reps ?? "—"}</p>
                              <p className="text-xs text-white font-semibold">{s.weight ? `${s.weight}kg` : "PDC"}</p>
                              <p className="text-xs text-gray-400">{s.rpe ? `@${s.rpe}` : "—"}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
