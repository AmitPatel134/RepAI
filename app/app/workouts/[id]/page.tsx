"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { authFetch } from "@/lib/authFetch"
import { supabase } from "@/lib/supabase"
import LoadingScreen from "@/components/LoadingScreen"
import UpgradeModal from "@/components/UpgradeModal"

// ─── Exercise Database ────────────────────────────────────────────────────────

type ExerciseEntry = {
  name: string
  primary_muscle: string
  secondary_muscles: string[]
  type: string
  movement: string
  equipment: string
  difficulty: "débutant" | "intermédiaire" | "avancé"
}

const EXERCISE_DB: ExerciseEntry[] = [
  // PECTORAUX
  { name: "Développé couché barre", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Développé couché haltères", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire" },
  { name: "Développé incliné barre", primary_muscle: "pectoraux", secondary_muscles: ["épaules", "triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Développé incliné haltères", primary_muscle: "pectoraux", secondary_muscles: ["épaules", "triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire" },
  { name: "Développé décliné", primary_muscle: "pectoraux", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Pompes", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "core"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Écarté haltères", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant" },
  { name: "Écarté poulie basse", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant" },
  { name: "Dips", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "intermédiaire" },
  { name: "Pec deck", primary_muscle: "pectoraux", secondary_muscles: [], type: "isolation", movement: "push", equipment: "machine", difficulty: "débutant" },

  // DOS
  { name: "Tractions pronation", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé" },
  { name: "Tractions supination", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé" },
  { name: "Rowing barre", primary_muscle: "dos", secondary_muscles: ["biceps", "core"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Rowing haltère", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "haltères", difficulty: "débutant" },
  { name: "Tirage vertical", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "machine", difficulty: "débutant" },
  { name: "Tirage poulie haute", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "débutant" },
  { name: "Tirage horizontal poulie", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "débutant" },
  { name: "Pull-over", primary_muscle: "dos", secondary_muscles: ["pectoraux"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "intermédiaire" },
  { name: "Soulevé de terre", primary_muscle: "dos", secondary_muscles: ["jambes", "core", "fessiers"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "avancé" },

  // JAMBES
  { name: "Squat barre", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios", "core"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Squat haltères", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant" },
  { name: "Squat bulgare", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "intermédiaire" },
  { name: "Presse à cuisses", primary_muscle: "quadriceps", secondary_muscles: ["fessiers"], type: "polyarticulaire", movement: "legs", equipment: "machine", difficulty: "débutant" },
  { name: "Soulevé de terre roumain", primary_muscle: "ischios", secondary_muscles: ["fessiers", "dos"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Fentes", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant" },
  { name: "Leg extension", primary_muscle: "quadriceps", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant" },
  { name: "Leg curl", primary_muscle: "ischios", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant" },
  { name: "Hip thrust", primary_muscle: "fessiers", secondary_muscles: ["ischios"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Mollets debout", primary_muscle: "mollets", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant" },
  { name: "Good morning", primary_muscle: "ischios", secondary_muscles: ["dos", "fessiers"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire" },

  // ÉPAULES
  { name: "Développé militaire", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Développé épaules haltères", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "débutant" },
  { name: "Élévations latérales", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant" },
  { name: "Élévations latérales poulie", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant" },
  { name: "Oiseau", primary_muscle: "épaules", secondary_muscles: ["dos"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant" },
  { name: "Face pull", primary_muscle: "épaules", secondary_muscles: ["dos"], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "intermédiaire" },
  { name: "Upright row", primary_muscle: "épaules", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Arnold press", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire" },

  // BRAS
  { name: "Curl barre", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant" },
  { name: "Curl haltères", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant" },
  { name: "Curl marteau", primary_muscle: "biceps", secondary_muscles: ["avant-bras"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant" },
  { name: "Curl poulie basse", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "débutant" },
  { name: "Curl incliné", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "intermédiaire" },
  { name: "Extension triceps poulie", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant" },
  { name: "Barre au front", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "barre", difficulty: "intermédiaire" },
  { name: "Extension triceps haltère", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant" },
  { name: "Kickback triceps", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant" },
  { name: "Dips banc", primary_muscle: "triceps", secondary_muscles: ["épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "débutant" },

  // CORE
  { name: "Crunch", primary_muscle: "abdominaux", secondary_muscles: [], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Gainage", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Gainage latéral", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Relevé de jambes suspendu", primary_muscle: "abdominaux", secondary_muscles: ["hanches"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "intermédiaire" },
  { name: "Russian twist", primary_muscle: "abdominaux", secondary_muscles: ["obliques"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Ab wheel", primary_muscle: "core", secondary_muscles: ["abdominaux", "épaules"], type: "polyarticulaire", movement: "core", equipment: "roue abdominale", difficulty: "avancé" },
  { name: "Mountain climbers", primary_muscle: "core", secondary_muscles: ["cardio"], type: "polyarticulaire", movement: "core", equipment: "poids du corps", difficulty: "débutant" },
  { name: "Crunch poulie", primary_muscle: "abdominaux", secondary_muscles: [], type: "isolation", movement: "core", equipment: "poulie", difficulty: "débutant" },

  // CARDIO
  { name: "Course à pied", primary_muscle: "cardio", secondary_muscles: ["jambes"], type: "endurance", movement: "cardio", equipment: "aucun", difficulty: "débutant" },
  { name: "Burpees", primary_muscle: "cardio", secondary_muscles: ["full body"], type: "polyarticulaire", movement: "cardio", equipment: "poids du corps", difficulty: "intermédiaire" },
  { name: "Corde à sauter", primary_muscle: "cardio", secondary_muscles: ["mollets"], type: "endurance", movement: "cardio", equipment: "corde", difficulty: "débutant" },
  { name: "Vélo elliptique", primary_muscle: "cardio", secondary_muscles: ["jambes"], type: "endurance", movement: "cardio", equipment: "machine", difficulty: "débutant" },
  { name: "Rameur", primary_muscle: "cardio", secondary_muscles: ["dos", "jambes"], type: "endurance", movement: "cardio", equipment: "machine", difficulty: "intermédiaire" },
  { name: "Sprints", primary_muscle: "cardio", secondary_muscles: ["jambes"], type: "HIIT", movement: "cardio", equipment: "aucun", difficulty: "intermédiaire" },
  { name: "Jump squats", primary_muscle: "cardio", secondary_muscles: ["quadriceps", "fessiers"], type: "HIIT", movement: "cardio", equipment: "poids du corps", difficulty: "intermédiaire" },
]

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "pectoraux", label: "Pectoraux" },
  { key: "dos", label: "Dos" },
  { key: "quadriceps", label: "Jambes" },
  { key: "épaules", label: "Épaules" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
  { key: "custom", label: "Perso ✦" },
]

const DIFFICULTY_COLORS = {
  débutant: "text-emerald-400 bg-emerald-400/10",
  intermédiaire: "text-amber-400 bg-amber-400/10",
  avancé: "text-red-400 bg-red-400/10",
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SetData = { id?: string; reps: number | ""; weight: number | ""; rpe: number | "" }
type ExerciseData = { id?: string; name: string; sets: SetData[] }
type WorkoutDetail = {
  id: string
  name: string
  type: string
  date: string
  notes?: string | null
  exercises: ExerciseData[]
}

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  fullbody: "Full Body", push: "Push", pull: "Pull", legs: "Legs",
  upper: "Upper Body", lower: "Lower Body", cardio: "Cardio", hiit: "HIIT",
  mobility: "Mobilité", crossfit: "CrossFit", force: "Force", dos: "Dos",
  bras: "Bras", epaules: "Épaules", abdos: "Abdominaux",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

// ─── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePicker({ onSelect, onClose }: {
  onSelect: (name: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const searchRef = useRef<HTMLInputElement>(null)
  const dragY = useRef(0)
  const [translateY, setTranslateY] = useState(0)
  const isDragging = useRef(false)
  const [customExercises, setCustomExercises] = useState<string[]>([])
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [newExName, setNewExName] = useState("")

  useEffect(() => {
    searchRef.current?.focus()
    try {
      setCustomExercises(JSON.parse(localStorage.getItem("repai_custom_exercises") ?? "[]"))
    } catch {}
  }, [])

  function saveCustomExercise() {
    if (!newExName.trim()) return
    const updated = [...customExercises, newExName.trim()]
    setCustomExercises(updated)
    localStorage.setItem("repai_custom_exercises", JSON.stringify(updated))
    onSelect(newExName.trim())
  }

  function deleteCustomExercise(e: React.MouseEvent, name: string) {
    e.stopPropagation()
    const updated = customExercises.filter(ex => ex !== name)
    setCustomExercises(updated)
    localStorage.setItem("repai_custom_exercises", JSON.stringify(updated))
  }

  function onDragStart(e: React.TouchEvent) {
    dragY.current = e.touches[0].clientY
    isDragging.current = true
  }

  function onDragMove(e: React.TouchEvent) {
    if (!isDragging.current) return
    const dy = e.touches[0].clientY - dragY.current
    if (dy > 0) setTranslateY(dy)
  }

  function onDragEnd() {
    isDragging.current = false
    if (translateY > 100) {
      onClose()
    } else {
      setTranslateY(0)
    }
  }

  const filtered = EXERCISE_DB.filter(ex => {
    const matchCat = category === "all" || ex.primary_muscle === category || ex.primary_muscle.includes(category)
    const matchSearch = search === "" || ex.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Custom exercise (if search doesn't match exactly)
  const exactMatch = EXERCISE_DB.some(ex => ex.name.toLowerCase() === search.toLowerCase())

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg flex flex-col"
        style={{ height: "85vh", transform: `translateY(${translateY}px)`, transition: translateY === 0 ? "transform 0.3s ease" : "none" }}
        onClick={e => e.stopPropagation()}
      >

        {/* Handle — drag zone */}
        <div
          className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header + search */}
        <div className="px-4 pt-2 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-extrabold text-white">Choisir un exercice</p>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher ou saisir un nom..."
              className="w-full bg-white/10 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 font-medium outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  category === cat.key
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">

          {/* Custom category */}
          {category === "custom" && (
            <>
              {!creatingCustom ? (
                <button
                  onClick={() => setCreatingCustom(true)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-600/10 border border-violet-500/30 hover:bg-violet-600/20 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-violet-300">Créer un exercice</p>
                </button>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <input
                    autoFocus
                    value={newExName}
                    onChange={e => setNewExName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCustomExercise() }}
                    placeholder="Nom de l'exercice..."
                    className="w-full bg-white/10 border border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 font-medium outline-none focus:border-violet-500 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setCreatingCustom(false); setNewExName("") }} className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                      Annuler
                    </button>
                    <button onClick={saveCustomExercise} disabled={!newExName.trim()} className="flex-1 py-2 rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
                      Ajouter
                    </button>
                  </div>
                </div>
              )}

              {customExercises.length === 0 && !creatingCustom && (
                <p className="text-center text-gray-600 text-sm py-6">Aucun exercice personnalisé</p>
              )}

              {customExercises.filter(ex => search === "" || ex.toLowerCase().includes(search.toLowerCase())).map(ex => (
                <button
                  key={ex}
                  onClick={() => onSelect(ex)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left border border-white/5 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-violet-400 uppercase">{ex.slice(0, 2)}</span>
                  </div>
                  <p className="text-sm font-bold text-white flex-1 truncate">{ex}</p>
                  <button
                    onClick={e => deleteCustomExercise(e, ex)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}
            </>
          )}

          {/* Custom exercise option (from search) */}
          {category !== "custom" && search.length > 1 && !exactMatch && (
            <button
              onClick={() => onSelect(search)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-600/10 border border-violet-500/30 hover:bg-violet-600/20 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-300">Ajouter &ldquo;{search}&rdquo;</p>
                <p className="text-xs text-gray-500">Exercice personnalisé</p>
              </div>
            </button>
          )}

          {category !== "custom" && filtered.length === 0 && search.length <= 1 && (
            <p className="text-center text-gray-600 text-sm py-8">Aucun exercice trouvé</p>
          )}

          {category !== "custom" && filtered.map(ex => (
            <button
              key={ex.name}
              onClick={() => onSelect(ex.name)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors text-left border border-white/5"
            >
              {/* Muscle dot */}
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-gray-400 uppercase">{ex.primary_muscle.slice(0, 2)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{ex.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-500 font-medium">{ex.primary_muscle}</span>
                  {ex.secondary_muscles.length > 0 && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="text-[10px] text-gray-600">{ex.secondary_muscles.slice(0, 2).join(", ")}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${DIFFICULTY_COLORS[ex.difficulty]}`}>
                  {ex.difficulty}
                </span>
                <span className="text-[10px] text-gray-600 font-medium">{ex.equipment}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [ready, setReady] = useState(false)
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [exercises, setExercises] = useState<ExerciseData[]>([])
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [renamingExIdx, setRenamingExIdx] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [plan, setPlan] = useState("free")
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)
  const originalExercises = useRef<ExerciseData[]>([])
  const originalNotes = useRef("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.email) {
        authFetch(`/api/plan`)
          .then(r => r.json())
          .then(d => setPlan(d.plan ?? "free"))
          .catch(() => {})
      }
    })
    authFetch(`/api/workouts/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/app/activities"); return }
        setWorkout(d)
        setNotes(d.notes ?? "")
        setExercises(
          (d.exercises ?? []).map((ex: WorkoutDetail["exercises"][0]) => ({
            id: ex.id,
            name: ex.name,
            sets: (ex.sets as unknown as { id?: string; reps: number | null; weight: number | null; rpe: number | null }[]).map(s => ({
              id: s.id,
              reps: s.reps ?? "",
              weight: s.weight ?? "",
              rpe: s.rpe ?? "",
            })),
          }))
        )
        setReady(true)
      })
      .catch(() => router.push("/app/activities"))
  }, [id, router])

  function enterEditMode() {
    originalExercises.current = JSON.parse(JSON.stringify(exercises))
    originalNotes.current = notes
    setEditMode(true)
  }

  function cancelEdit() {
    setExercises(originalExercises.current)
    setNotes(originalNotes.current)
    setEditMode(false)
  }

  function handleSelectExercise(name: string) {
    if (renamingExIdx !== null) {
      // Replace only the name, keep all sets intact
      setExercises(prev => prev.map((ex, i) => i === renamingExIdx ? { ...ex, name } : ex))
      setRenamingExIdx(null)
      setShowPicker(false)
      return
    }
    if (plan === "free" && exercises.length >= 3) {
      setShowPicker(false)
      setUpgradeMsg("Vous avez atteint la limite de 3 exercices par séance avec le plan Gratuit. Passez Pro pour des exercices illimités.")
      return
    }
    setExercises(prev => [...prev, { name, sets: [{ reps: "", weight: "", rpe: "" }] }])
    setShowPicker(false)
  }

  function startRenameExercise(idx: number) {
    setRenamingExIdx(idx)
    setShowPicker(true)
  }

  function removeExercise(i: number) {
    setExercises(prev => prev.filter((_, idx) => idx !== i))
  }

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { reps: "", weight: "", rpe: "" }] } : ex
    ))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
    ))
  }

  function updateSet(exIdx: number, setIdx: number, field: "reps" | "weight" | "rpe", value: string) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        sets: ex.sets.map((s, j) =>
          j === setIdx ? { ...s, [field]: value === "" ? "" : Number(value) } : s
        ),
      } : ex
    ))
  }

  const handleSave = useCallback(async () => {
    if (!workout) return
    setSaving(true)
    try {
      await authFetch(`/api/workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          exercises: exercises.filter(ex => ex.name.trim()).map(ex => ({
            name: ex.name.trim(),
            category: "strength",
            sets: ex.sets.map(s => ({
              reps: s.reps === "" ? null : Number(s.reps),
              weight: s.weight === "" ? null : Number(s.weight),
              rpe: s.rpe === "" ? null : Number(s.rpe),
            })),
          })),
        }),
      })
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }, [workout, id, notes, exercises])

  if (!ready) return <LoadingScreen />
  if (!workout) return null

  const typeLabel = WORKOUT_TYPE_LABELS[workout.type] ?? workout.type

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}

      {showPicker && (
        <ExercisePicker
          onSelect={handleSelectExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/app/activities")}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-white truncate">{workout.name}</p>
          <p className="text-xs text-gray-500 font-medium">{typeLabel} · {formatDate(workout.date)}</p>
        </div>
        {!editMode && (
          <button
            onClick={enterEditMode}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">

        {/* ── READ MODE ── */}
        {!editMode && (
          <div className="flex flex-col gap-3 py-4">
            {exercises.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-4xl mb-3">🏋️</p>
                <p className="text-gray-400 font-semibold mb-1">Aucun exercice</p>
                <p className="text-gray-600 text-sm">Appuyez sur le crayon pour modifier</p>
              </div>
            ) : exercises.map((ex, exIdx) => {
              const info = EXERCISE_DB.find(e => e.name === ex.name)
              return (
                <div key={exIdx} className="bg-white/5 border border-white/10 overflow-hidden">
                  {/* Exercise header */}
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-sm font-extrabold text-white">{ex.name}</p>
                    {info && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-violet-400 font-semibold">{info.primary_muscle}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-[10px] text-gray-500">{info.equipment}</span>
                        <span className="text-gray-700">·</span>
                        <span className={`text-[10px] font-bold ${DIFFICULTY_COLORS[info.difficulty].split(" ")[0]}`}>{info.difficulty}</span>
                      </div>
                    )}
                  </div>

                  {/* Sets header */}
                  <div className="grid grid-cols-12 gap-1 px-4 pb-1">
                    <p className="col-span-1 text-xs text-gray-600 font-bold text-center">#</p>
                    <p className="col-span-4 text-xs text-gray-600 font-bold text-center">Reps</p>
                    <p className="col-span-4 text-xs text-gray-600 font-bold text-center">Kg</p>
                    <p className="col-span-3 text-xs text-gray-600 font-bold text-center">RPE</p>
                  </div>

                  {/* Sets */}
                  <div className="px-4 flex flex-col gap-1.5 pb-4">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="grid grid-cols-12 gap-1 items-center">
                        <p className="col-span-1 text-xs text-gray-600 font-bold text-center">{si + 1}</p>
                        <p className="col-span-4 bg-white/[0.06] rounded-lg px-2 py-1 text-sm text-white font-semibold text-center">{s.reps !== "" ? s.reps : "—"}</p>
                        <p className="col-span-4 bg-white/[0.06] rounded-lg px-2 py-1 text-sm text-white font-semibold text-center">{s.weight !== "" ? s.weight : "—"}</p>
                        <p className="col-span-3 bg-white/[0.06] rounded-lg px-1 py-1 text-sm text-white font-semibold text-center">{s.rpe !== "" ? s.rpe : "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {notes ? (
              <div className="mx-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 block mb-2">Notes de séance</p>
                <p className="text-sm text-gray-300 leading-relaxed">{notes}</p>
              </div>
            ) : null}

            {plan === "free" && exercises.length >= 3 ? (
              <div className="mx-4 py-3 border border-dashed border-white/10 rounded-2xl flex items-center justify-between px-4">
                <span className="text-xs font-bold text-gray-600">Limite 3 exos — plan Gratuit</span>
                <a href="/pricing" className="text-xs font-bold text-violet-400 hover:text-violet-300">Passer Pro →</a>
              </div>
            ) : (
              <button
                onClick={() => { enterEditMode(); setShowPicker(true) }}
                className="mx-4 py-4 border-2 border-dashed border-white/15 rounded-2xl text-sm font-bold text-gray-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un exercice {plan === "free" ? `(${exercises.length}/3)` : ""}
              </button>
            )}
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {editMode && (
          <div className="flex flex-col gap-3 py-4">

            {exercises.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="text-4xl mb-3">🏋️</p>
                <p className="text-gray-400 font-semibold mb-1">Aucun exercice</p>
                <p className="text-gray-600 text-sm">Appuyez sur le bouton ci-dessous pour commencer</p>
              </div>
            )}

            {exercises.map((ex, exIdx) => (
              <div key={exIdx} className="bg-white/5 border border-white/10 overflow-hidden">
                {/* Exercise header */}
                <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{ex.name}</p>
                    {(() => {
                      const info = EXERCISE_DB.find(e => e.name === ex.name)
                      return info ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-violet-400 font-semibold">{info.primary_muscle}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-[10px] text-gray-500">{info.equipment}</span>
                          <span className="text-gray-700">·</span>
                          <span className={`text-[10px] font-bold ${DIFFICULTY_COLORS[info.difficulty].split(" ")[0]}`}>{info.difficulty}</span>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <button
                    onClick={() => startRenameExercise(exIdx)}
                    className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                    title="Renommer l'exercice"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeExercise(exIdx)}
                    className="w-8 h-8 rounded-xl bg-red-900/30 flex items-center justify-center text-red-400 hover:bg-red-900/50 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sets header */}
                <div className="grid grid-cols-12 gap-1 px-4 pb-1">
                  <p className="col-span-1 text-xs text-gray-600 font-bold text-center">#</p>
                  <p className="col-span-4 text-xs text-gray-600 font-bold text-center">Reps</p>
                  <p className="col-span-4 text-xs text-gray-600 font-bold text-center">Kg</p>
                  <p className="col-span-2 text-xs text-gray-600 font-bold text-center">RPE</p>
                  <p className="col-span-1" />
                </div>

                {/* Sets */}
                <div className="px-4 flex flex-col gap-1.5 pb-3">
                  {ex.sets.map((s, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-12 gap-1 items-center">
                      <p className="col-span-1 text-xs text-gray-600 font-bold text-center">{setIdx + 1}</p>
                      <input type="number" inputMode="numeric" value={s.reps} onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)} placeholder="8" min={0}
                        className="col-span-4 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white font-semibold outline-none focus:border-violet-500 text-center transition-colors" />
                      <input type="number" inputMode="decimal" value={s.weight} onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)} placeholder="0" min={0} step={0.5}
                        className="col-span-4 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white font-semibold outline-none focus:border-violet-500 text-center transition-colors" />
                      <input type="number" inputMode="decimal" value={s.rpe} onChange={e => updateSet(exIdx, setIdx, "rpe", e.target.value)} placeholder="8" min={1} max={10} step={0.5}
                        className="col-span-2 bg-white/10 border border-white/10 rounded-lg px-1 py-1 text-sm text-white font-semibold outline-none focus:border-violet-500 text-center transition-colors" />
                      <button onClick={() => removeSet(exIdx, setIdx)} disabled={ex.sets.length <= 1}
                        className="col-span-1 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors disabled:opacity-20">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => addSet(exIdx)}
                  className="w-full py-2.5 border-t border-white/5 text-xs font-bold text-gray-500 hover:text-violet-400 hover:bg-white/5 transition-colors">
                  + Ajouter une série
                </button>
              </div>
            ))}

            {/* Add exercise */}
            {plan === "free" && exercises.length >= 3 ? (
              <div className="mx-4 py-3 border border-dashed border-white/10 rounded-2xl flex items-center justify-between px-4">
                <span className="text-xs font-bold text-gray-600">Limite 3 exos — plan Gratuit</span>
                <a href="/pricing" className="text-xs font-bold text-violet-400 hover:text-violet-300">Passer Pro →</a>
              </div>
            ) : (
              <button
                onClick={() => setShowPicker(true)}
                className="mx-4 py-4 border-2 border-dashed border-white/15 rounded-2xl text-sm font-bold text-gray-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un exercice {plan === "free" ? `(${exercises.length}/3)` : ""}
              </button>
            )}

            {/* Notes */}
            <div className="mx-4 bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="text-xs font-bold text-gray-400 block mb-2">Notes de séance</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ressenti général, observations, objectifs pour la prochaine fois..."
                rows={3}
                className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 font-medium outline-none resize-none leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating bar in edit mode */}
      {editMode && (
        <div
          className="fixed left-0 right-0 flex justify-center gap-3 z-40 pointer-events-none"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={cancelEdit}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-gray-800 border border-white/15 rounded-2xl text-sm font-bold text-white shadow-2xl shadow-black/60 hover:bg-gray-700 transition-colors backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-violet-600 border border-violet-500/40 rounded-2xl text-sm font-bold text-white shadow-2xl shadow-black/60 hover:bg-violet-500 transition-colors backdrop-blur-sm disabled:opacity-50"
          >
            {saving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      )}
    </div>
  )
}
