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
  subcategory: string
}

const EXERCISE_DB: ExerciseEntry[] = [
  // PECTORAUX — Développé
  { name: "Développé couché barre", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé couché haltères", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé incliné barre", primary_muscle: "pectoraux", secondary_muscles: ["épaules", "triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé incliné haltères", primary_muscle: "pectoraux", secondary_muscles: ["épaules", "triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé décliné barre", primary_muscle: "pectoraux", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Développé" },
  // PECTORAUX — Écarté
  { name: "Écarté haltères plat", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Écarté" },
  { name: "Écarté haltères incliné", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Écarté" },
  { name: "Écarté poulie basse", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant", subcategory: "Écarté" },
  { name: "Câble croisé", primary_muscle: "pectoraux", secondary_muscles: ["épaules"], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant", subcategory: "Écarté" },
  // PECTORAUX — Poids du corps
  { name: "Pompes", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "core"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },
  { name: "Dips pectoraux", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  { name: "Push-up incliné", primary_muscle: "pectoraux", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },
  { name: "Push-up décliné", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  // PECTORAUX — Machine
  { name: "Pec deck", primary_muscle: "pectoraux", secondary_muscles: [], type: "isolation", movement: "push", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Développé couché machine", primary_muscle: "pectoraux", secondary_muscles: ["triceps", "épaules"], type: "polyarticulaire", movement: "push", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Développé incliné machine", primary_muscle: "pectoraux", secondary_muscles: ["épaules", "triceps"], type: "polyarticulaire", movement: "push", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Développé décliné machine", primary_muscle: "pectoraux", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },

  // DOS — Rowing
  { name: "Rowing barre", primary_muscle: "dos", secondary_muscles: ["biceps", "core"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire", subcategory: "Rowing" },
  { name: "Rowing haltère unilatéral", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Rowing" },
  { name: "Rowing poulie assis", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Rowing" },
  { name: "Rowing TRX", primary_muscle: "dos", secondary_muscles: ["biceps", "core"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "débutant", subcategory: "Rowing" },
  { name: "T-bar row", primary_muscle: "dos", secondary_muscles: ["biceps", "core"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire", subcategory: "Rowing" },
  // DOS — Traction
  { name: "Tractions pronation", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé", subcategory: "Traction" },
  { name: "Tractions supination", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé", subcategory: "Traction" },
  { name: "Tractions prise neutre", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé", subcategory: "Traction" },
  { name: "Tractions lestées", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "avancé", subcategory: "Traction" },
  { name: "Tractions assistées", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "machine", difficulty: "débutant", subcategory: "Traction" },
  // DOS — Tirage
  { name: "Tirage vertical", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "machine", difficulty: "débutant", subcategory: "Tirage" },
  { name: "Tirage poulie haute", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Tirage" },
  { name: "Tirage horizontal poulie", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Tirage" },
  { name: "Tirage nuque", primary_muscle: "dos", secondary_muscles: ["biceps", "épaules"], type: "polyarticulaire", movement: "pull", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Tirage" },
  // DOS — Isolation
  { name: "Pull-over haltère", primary_muscle: "dos", secondary_muscles: ["pectoraux"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Isolation" },
  { name: "Shrug barre", primary_muscle: "dos", secondary_muscles: ["trapèzes"], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant", subcategory: "Isolation" },
  // DOS — Poids du corps
  { name: "Inverted row", primary_muscle: "dos", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },
  { name: "Face pull", primary_muscle: "dos", secondary_muscles: ["épaules"], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Poids du corps" },

  // JAMBES/QUADRICEPS — Squat
  { name: "Squat barre", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios", "core"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire", subcategory: "Squat" },
  { name: "Squat haltères", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant", subcategory: "Squat" },
  { name: "Goblet squat", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "core"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant", subcategory: "Squat" },
  { name: "Squat bulgare barre", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "avancé", subcategory: "Squat" },
  { name: "Squat avant", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "core"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "avancé", subcategory: "Squat" },
  { name: "Squat prise large (sumo)", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "adducteurs"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire", subcategory: "Squat" },
  // JAMBES/QUADRICEPS — Fentes
  { name: "Fentes haltères", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant", subcategory: "Fentes" },
  { name: "Fentes bulgares haltères", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Fentes" },
  { name: "Fentes latérales", primary_muscle: "quadriceps", secondary_muscles: ["adducteurs", "fessiers"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant", subcategory: "Fentes" },
  { name: "Fentes marchées", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Fentes" },
  // JAMBES/QUADRICEPS — Machine
  { name: "Presse à cuisses", primary_muscle: "quadriceps", secondary_muscles: ["fessiers"], type: "polyarticulaire", movement: "legs", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Leg extension", primary_muscle: "quadriceps", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Hack squat machine", primary_muscle: "quadriceps", secondary_muscles: ["fessiers"], type: "polyarticulaire", movement: "legs", equipment: "machine", difficulty: "intermédiaire", subcategory: "Machine" },
  { name: "Smith squat", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "ischios"], type: "polyarticulaire", movement: "legs", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  // JAMBES/QUADRICEPS — Poids du corps
  { name: "Jump squat", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "mollets"], type: "polyarticulaire", movement: "legs", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  { name: "Pistol squat", primary_muscle: "quadriceps", secondary_muscles: ["fessiers", "core"], type: "polyarticulaire", movement: "legs", equipment: "poids du corps", difficulty: "avancé", subcategory: "Poids du corps" },

  // ISCHIOS/FESSIERS — Deadlift
  { name: "Soulevé de terre", primary_muscle: "ischios", secondary_muscles: ["dos", "fessiers", "core"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "avancé", subcategory: "Deadlift" },
  { name: "Soulevé de terre roumain", primary_muscle: "ischios", secondary_muscles: ["fessiers", "dos"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire", subcategory: "Deadlift" },
  { name: "Soulevé de terre sumo", primary_muscle: "ischios", secondary_muscles: ["fessiers", "adducteurs", "dos"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire", subcategory: "Deadlift" },
  { name: "Soulevé de terre déficit", primary_muscle: "ischios", secondary_muscles: ["dos", "fessiers"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "avancé", subcategory: "Deadlift" },
  // ISCHIOS/FESSIERS — Hip Thrust
  { name: "Hip thrust haltère", primary_muscle: "fessiers", secondary_muscles: ["ischios"], type: "polyarticulaire", movement: "legs", equipment: "haltères", difficulty: "débutant", subcategory: "Hip Thrust" },
  { name: "Hip thrust barre", primary_muscle: "fessiers", secondary_muscles: ["ischios"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire", subcategory: "Hip Thrust" },
  { name: "Glute bridge", primary_muscle: "fessiers", secondary_muscles: ["ischios"], type: "polyarticulaire", movement: "legs", equipment: "poids du corps", difficulty: "débutant", subcategory: "Hip Thrust" },
  // ISCHIOS/FESSIERS — Machine
  { name: "Leg curl couché", primary_muscle: "ischios", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Leg curl assis", primary_muscle: "ischios", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Cable kickback fessiers", primary_muscle: "fessiers", secondary_muscles: ["ischios"], type: "isolation", movement: "legs", equipment: "poulie", difficulty: "débutant", subcategory: "Machine" },
  // ISCHIOS/FESSIERS — Poids du corps
  { name: "Good morning", primary_muscle: "ischios", secondary_muscles: ["dos", "fessiers"], type: "polyarticulaire", movement: "legs", equipment: "barre", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  { name: "Nordic curl", primary_muscle: "ischios", secondary_muscles: [], type: "isolation", movement: "legs", equipment: "poids du corps", difficulty: "avancé", subcategory: "Poids du corps" },

  // ÉPAULES — Développé
  { name: "Développé militaire barre", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé épaules haltères", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Développé" },
  { name: "Arnold press", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Développé" },
  { name: "Développé épaules machine", primary_muscle: "épaules", secondary_muscles: ["triceps"], type: "polyarticulaire", movement: "push", equipment: "machine", difficulty: "débutant", subcategory: "Développé" },
  // ÉPAULES — Élévations
  { name: "Élévations latérales haltères", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Élévations" },
  { name: "Élévations frontales", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Élévations" },
  { name: "Oiseau (reverse fly)", primary_muscle: "épaules", secondary_muscles: ["dos"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Élévations" },
  { name: "Face pull poulie", primary_muscle: "épaules", secondary_muscles: ["dos"], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Élévations" },
  { name: "Upright row barre", primary_muscle: "épaules", secondary_muscles: ["biceps"], type: "polyarticulaire", movement: "pull", equipment: "barre", difficulty: "intermédiaire", subcategory: "Élévations" },
  // ÉPAULES — Rotation
  { name: "Rotation externe haltère", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Rotation" },
  { name: "Rotation interne poulie", primary_muscle: "épaules", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Rotation" },
  { name: "Band pull-apart", primary_muscle: "épaules", secondary_muscles: ["dos"], type: "isolation", movement: "pull", equipment: "élastique", difficulty: "débutant", subcategory: "Rotation" },

  // BICEPS — Barre
  { name: "Curl barre droite", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant", subcategory: "Barre" },
  { name: "Curl barre EZ", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant", subcategory: "Barre" },
  { name: "Curl barre droit", primary_muscle: "biceps", secondary_muscles: ["avant-bras"], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant", subcategory: "Barre" },
  { name: "Curl reverse barre", primary_muscle: "biceps", secondary_muscles: ["avant-bras"], type: "isolation", movement: "pull", equipment: "barre", difficulty: "débutant", subcategory: "Barre" },
  // BICEPS — Haltères
  { name: "Curl haltères alterné", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Haltères" },
  { name: "Curl marteau", primary_muscle: "biceps", secondary_muscles: ["avant-bras"], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Haltères" },
  { name: "Curl incliné haltères", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Haltères" },
  { name: "Curl concentration", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "débutant", subcategory: "Haltères" },
  { name: "Spider curl", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "haltères", difficulty: "intermédiaire", subcategory: "Haltères" },
  // BICEPS — Poulie
  { name: "Curl poulie basse", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },
  { name: "Curl câble unilatéral", primary_muscle: "biceps", secondary_muscles: [], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },
  { name: "Curl corde poulie", primary_muscle: "biceps", secondary_muscles: ["avant-bras"], type: "isolation", movement: "pull", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },

  // TRICEPS — Barre
  { name: "Barre au front", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Barre" },
  { name: "Développé serré", primary_muscle: "triceps", secondary_muscles: ["pectoraux", "épaules"], type: "polyarticulaire", movement: "push", equipment: "barre", difficulty: "intermédiaire", subcategory: "Barre" },
  { name: "JM press", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "barre", difficulty: "avancé", subcategory: "Barre" },
  // TRICEPS — Haltères
  { name: "Extension triceps overhead haltère", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Haltères" },
  { name: "Kickback triceps", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "haltères", difficulty: "débutant", subcategory: "Haltères" },
  // TRICEPS — Poulie
  { name: "Extension triceps corde", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },
  { name: "Extension triceps barre droite", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },
  { name: "Extension triceps barre V", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "débutant", subcategory: "Poulie" },
  { name: "Extension overhead poulie", primary_muscle: "triceps", secondary_muscles: [], type: "isolation", movement: "push", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Poulie" },
  // TRICEPS — Poids du corps
  { name: "Dips triceps", primary_muscle: "triceps", secondary_muscles: ["pectoraux", "épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  { name: "Dips banc", primary_muscle: "triceps", secondary_muscles: ["épaules"], type: "polyarticulaire", movement: "push", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },

  // CORE — Gainage
  { name: "Planche (plank)", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Gainage" },
  { name: "Gainage latéral", primary_muscle: "core", secondary_muscles: ["obliques"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Gainage" },
  { name: "RKC plank", primary_muscle: "core", secondary_muscles: ["abdominaux", "fessiers"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Gainage" },
  { name: "Dragon flag", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "avancé", subcategory: "Gainage" },
  // CORE — Crunch
  { name: "Crunch", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Crunch" },
  { name: "Crunch poulie", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isolation", movement: "core", equipment: "poulie", difficulty: "débutant", subcategory: "Crunch" },
  { name: "Crunch obliques", primary_muscle: "core", secondary_muscles: ["obliques"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Crunch" },
  { name: "Crunch décliné", primary_muscle: "core", secondary_muscles: ["abdominaux"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Crunch" },
  // CORE — Relevé
  { name: "Relevé de jambes suspendu", primary_muscle: "core", secondary_muscles: ["hanches"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Relevé" },
  { name: "Knee raise suspendu", primary_muscle: "core", secondary_muscles: ["hanches"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Relevé" },
  { name: "L-sit", primary_muscle: "core", secondary_muscles: ["quadriceps", "triceps"], type: "isométrique", movement: "core", equipment: "poids du corps", difficulty: "avancé", subcategory: "Relevé" },
  // CORE — Rotation
  { name: "Russian twist", primary_muscle: "core", secondary_muscles: ["obliques"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Rotation" },
  { name: "Pallof press", primary_muscle: "core", secondary_muscles: ["obliques"], type: "isométrique", movement: "core", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Rotation" },
  { name: "Woodchop poulie", primary_muscle: "core", secondary_muscles: ["obliques", "épaules"], type: "polyarticulaire", movement: "core", equipment: "poulie", difficulty: "intermédiaire", subcategory: "Rotation" },
  // CORE — Poids du corps
  { name: "Mountain climbers", primary_muscle: "core", secondary_muscles: ["cardio"], type: "polyarticulaire", movement: "core", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },
  { name: "Ab wheel", primary_muscle: "core", secondary_muscles: ["abdominaux", "épaules"], type: "polyarticulaire", movement: "core", equipment: "roue abdominale", difficulty: "avancé", subcategory: "Poids du corps" },
  { name: "V-up", primary_muscle: "core", secondary_muscles: ["abdominaux", "hanches"], type: "isolation", movement: "core", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "Poids du corps" },

  // CARDIO — Machine
  { name: "Rameur", primary_muscle: "cardio", secondary_muscles: ["dos", "jambes"], type: "endurance", movement: "cardio", equipment: "machine", difficulty: "intermédiaire", subcategory: "Machine" },
  { name: "Vélo elliptique", primary_muscle: "cardio", secondary_muscles: ["jambes"], type: "endurance", movement: "cardio", equipment: "machine", difficulty: "débutant", subcategory: "Machine" },
  { name: "Assault bike", primary_muscle: "cardio", secondary_muscles: ["full body"], type: "HIIT", movement: "cardio", equipment: "machine", difficulty: "intermédiaire", subcategory: "Machine" },
  // CARDIO — HIIT
  { name: "Burpees", primary_muscle: "cardio", secondary_muscles: ["full body"], type: "polyarticulaire", movement: "cardio", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "HIIT" },
  { name: "Box jump", primary_muscle: "cardio", secondary_muscles: ["quadriceps", "fessiers"], type: "polyarticulaire", movement: "cardio", equipment: "poids du corps", difficulty: "intermédiaire", subcategory: "HIIT" },
  { name: "Jumping jack", primary_muscle: "cardio", secondary_muscles: ["épaules", "jambes"], type: "polyarticulaire", movement: "cardio", equipment: "poids du corps", difficulty: "débutant", subcategory: "HIIT" },
  { name: "Thruster", primary_muscle: "cardio", secondary_muscles: ["quadriceps", "épaules"], type: "polyarticulaire", movement: "cardio", equipment: "barre", difficulty: "intermédiaire", subcategory: "HIIT" },
  // CARDIO — Poids du corps
  { name: "Corde à sauter", primary_muscle: "cardio", secondary_muscles: ["mollets"], type: "endurance", movement: "cardio", equipment: "corde", difficulty: "débutant", subcategory: "Poids du corps" },
  { name: "Sprints", primary_muscle: "cardio", secondary_muscles: ["jambes"], type: "HIIT", movement: "cardio", equipment: "aucun", difficulty: "intermédiaire", subcategory: "Poids du corps" },
  { name: "Mountain climbers cardio", primary_muscle: "cardio", secondary_muscles: ["core"], type: "polyarticulaire", movement: "cardio", equipment: "poids du corps", difficulty: "débutant", subcategory: "Poids du corps" },
]

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "pectoraux", label: "Pectoraux" },
  { key: "dos", label: "Dos" },
  { key: "quadriceps", label: "Jambes" },
  { key: "ischios", label: "Ischios" },
  { key: "épaules", label: "Épaules" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
  { key: "custom", label: "Perso ✦" },
]

const DIFFICULTY_COLORS = {
  débutant: "text-emerald-600 bg-emerald-50",
  intermédiaire: "text-amber-600 bg-amber-50",
  avancé: "text-red-600 bg-red-50",
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SetData = { id?: string; reps: number | ""; weight: number | ""; rpe: number | "" }
type ExerciseData = { id?: string; name: string; sets: SetData[] }
type WorkoutDetail = {
  id: string
  name: string
  type?: string
  date: string
  notes?: string | null
  exercises: ExerciseData[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

// ─── Subcategory Accordion ────────────────────────────────────────────────────

function StarButton({ name, favorites, onToggle }: { name: string; favorites: Set<string>; onToggle: (name: string, e: React.MouseEvent) => void }) {
  const isFav = favorites.has(name)
  return (
    <button
      onClick={e => onToggle(name, e)}
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 active:scale-90"
    >
      <svg className={`w-4 h-4 transition-colors duration-200 ${isFav ? "text-amber-400" : "text-gray-300"}`} viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFav ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    </button>
  )
}

function SubcategoryAccordion({
  subcategory,
  exercises,
  onSelect,
  favorites,
  onToggleFavorite,
}: {
  subcategory: string
  exercises: ExerciseEntry[]
  onSelect: (name: string) => void
  favorites: Set<string>
  onToggleFavorite: (name: string, e: React.MouseEvent) => void
}) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      {!open && <div className="h-px bg-gray-100 mx-1" />}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-2 text-left"
      >
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{subcategory}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        ref={contentRef}
        style={{
          overflow: "hidden",
          maxHeight: open ? "2000px" : "0px",
          transition: "max-height 0.25s ease",
        }}
      >
        <div className="flex flex-col gap-1 pb-2">
          {exercises.map(ex => (
            <div key={ex.name} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-200">
              <button onClick={() => onSelect(ex.name)} className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{ex.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-500 font-medium">{ex.primary_muscle}</span>
                  {ex.secondary_muscles.length > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{ex.secondary_muscles.slice(0, 2).join(", ")}</span>
                    </>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${DIFFICULTY_COLORS[ex.difficulty]}`}>{ex.difficulty}</span>
                <StarButton name={ex.name} favorites={favorites} onToggle={onToggleFavorite} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
  const [mounted, setMounted] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    searchRef.current?.focus()
    try {
      setCustomExercises(JSON.parse(localStorage.getItem("repai_custom_exercises") ?? "[]"))
    } catch {}
    try {
      const stored: string[] = JSON.parse(localStorage.getItem("repai_favorite_exercises") ?? "[]")
      setFavorites(new Set(stored))
    } catch {}
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  function toggleFavorite(name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      localStorage.setItem("repai_favorite_exercises", JSON.stringify([...next]))
      return next
    })
  }

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

  const exactMatch = EXERCISE_DB.some(ex => ex.name.toLowerCase() === search.toLowerCase())

  // Group filtered exercises by subcategory (only when not searching)
  const subcategoryGroups = (() => {
    if (search.length > 0) return null
    const groups: Record<string, ExerciseEntry[]> = {}
    filtered.forEach(ex => {
      if (!groups[ex.subcategory]) groups[ex.subcategory] = []
      groups[ex.subcategory].push(ex)
    })
    return groups
  })()

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg flex flex-col shadow-2xl"
        style={{ height: "85vh", transform: mounted ? `translateY(${translateY}px)` : "translateY(100%)", transition: translateY === 0 ? "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)" : "none" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle — drag zone */}
        <div
          className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header + search */}
        <div className="px-4 pt-2 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-extrabold text-gray-900">Choisir un exercice</p>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher ou saisir un nom..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-medium outline-none focus:border-violet-400 transition-colors"
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
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 active:scale-95 ${
                  category === cat.key
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div key={category} className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-1">

          {/* Custom category */}
          {category === "custom" && (
            <>
              {!creatingCustom ? (
                <button
                  onClick={() => setCreatingCustom(true)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-violet-700">Créer un exercice</p>
                </button>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <input
                    autoFocus
                    value={newExName}
                    onChange={e => setNewExName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCustomExercise() }}
                    placeholder="Nom de l'exercice..."
                    className="w-full bg-gray-50 border border-violet-400 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-medium outline-none focus:border-violet-500 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setCreatingCustom(false); setNewExName("") }} className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">
                      Annuler
                    </button>
                    <button onClick={saveCustomExercise} disabled={!newExName.trim()} className="flex-1 py-2 rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
                      Ajouter
                    </button>
                  </div>
                </div>
              )}

              {customExercises.length === 0 && !creatingCustom && (
                <p className="text-center text-gray-400 text-sm py-6">Aucun exercice personnalisé</p>
              )}

              {customExercises.filter(ex => search === "" || ex.toLowerCase().includes(search.toLowerCase())).map(ex => (
                <button
                  key={ex}
                  onClick={() => onSelect(ex)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left border border-gray-100 group"
                >
                  <p className="text-sm font-semibold text-gray-900 flex-1 truncate">{ex}</p>
                  <button
                    onClick={e => deleteCustomExercise(e, ex)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-all shrink-0"
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors text-left mb-2"
            >
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-700">Ajouter &ldquo;{search}&rdquo;</p>
                <p className="text-xs text-gray-400">Exercice personnalisé</p>
              </div>
            </button>
          )}

          {category !== "custom" && filtered.length === 0 && search.length <= 1 && (
            <p className="text-center text-gray-400 text-sm py-8">Aucun exercice trouvé</p>
          )}

          {/* Favoris section */}
          {category !== "custom" && search.length === 0 && favorites.size > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-2">
                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">Favoris</p>
              </div>
              <div className="flex flex-col gap-1">
                {EXERCISE_DB.filter(ex => favorites.has(ex.name)).map(ex => (
                  <div key={ex.name} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 transition-all duration-200">
                    <button onClick={() => onSelect(ex.name)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ex.name}</p>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${DIFFICULTY_COLORS[ex.difficulty]}`}>{ex.difficulty}</span>
                      <StarButton name={ex.name} favorites={favorites} onToggle={toggleFavorite} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-gray-100 mx-1 mt-3" />
            </div>
          )}

          {/* Subcategory accordion (no search) */}
          {category !== "custom" && search.length === 0 && subcategoryGroups && (
            Object.entries(subcategoryGroups).map(([sub, exList]) => (
              <SubcategoryAccordion
                key={sub}
                subcategory={sub}
                exercises={exList}
                onSelect={onSelect}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}

          {/* Flat filtered list (when searching) */}
          {category !== "custom" && search.length > 0 && filtered.map(ex => (
            <div key={ex.name} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-200">
              <button onClick={() => onSelect(ex.name)} className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{ex.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-500 font-medium">{ex.primary_muscle}</span>
                  {ex.secondary_muscles.length > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{ex.secondary_muscles.slice(0, 2).join(", ")}</span>
                    </>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${DIFFICULTY_COLORS[ex.difficulty]}`}>{ex.difficulty}</span>
                <StarButton name={ex.name} favorites={favorites} onToggle={toggleFavorite} />
              </div>
            </div>
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

  if (!ready) return <LoadingScreen color="#2563eb" />
  if (!workout) return null

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {upgradeMsg && <UpgradeModal message={upgradeMsg} onClose={() => setUpgradeMsg(null)} />}

      {showPicker && (
        <ExercisePicker
          onSelect={handleSelectExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-gray-100/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/app/activities")}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors shrink-0 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-gray-900 truncate">{workout.name}</p>
          <p className="text-xs text-gray-400 font-medium">{formatDate(workout.date)}</p>
        </div>
        {!editMode && (
          <button
            onClick={enterEditMode}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors shrink-0 shadow-sm"
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
          <div className="flex flex-col gap-3 py-4 px-4">
            {exercises.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🏋️</p>
                <p className="text-gray-500 font-semibold mb-1">Aucun exercice</p>
                <p className="text-gray-400 text-sm">Appuyez sur le crayon pour modifier</p>
              </div>
            ) : exercises.map((ex, exIdx) => {
              const info = EXERCISE_DB.find(e => e.name === ex.name)
              return (
                <div key={exIdx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200">
                  {/* Exercise header */}
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-sm font-extrabold text-gray-900">{ex.name}</p>
                    {info && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-violet-600 font-semibold">{info.primary_muscle}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">{info.equipment}</span>
                        <span className="text-gray-300">·</span>
                        <span className={`text-[10px] font-bold ${DIFFICULTY_COLORS[info.difficulty].split(" ")[0]}`}>{info.difficulty}</span>
                      </div>
                    )}
                  </div>

                  {/* Sets header */}
                  <div className="grid grid-cols-12 gap-1 px-4 pb-1">
                    <p className="col-span-1 text-xs text-gray-400 font-bold text-center">#</p>
                    <p className="col-span-4 text-xs text-gray-400 font-bold text-center">Reps</p>
                    <p className="col-span-4 text-xs text-gray-400 font-bold text-center">Kg</p>
                    <p className="col-span-3 text-xs text-gray-400 font-bold text-center">RPE</p>
                  </div>

                  {/* Sets */}
                  <div className="px-4 flex flex-col gap-1.5 pb-4">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="grid grid-cols-12 gap-1 items-center">
                        <p className="col-span-1 text-xs text-gray-400 font-bold text-center">{si + 1}</p>
                        <p className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 font-semibold text-center">{s.reps !== "" ? s.reps : "—"}</p>
                        <p className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 font-semibold text-center">{s.weight !== "" ? s.weight : "—"}</p>
                        <p className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-1 py-1 text-sm text-gray-900 font-semibold text-center">{s.rpe !== "" ? s.rpe : "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {notes ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 block mb-2">Notes de séance</p>
                <p className="text-sm text-gray-600 leading-relaxed">{notes}</p>
              </div>
            ) : null}

            {plan === "free" && exercises.length >= 3 ? (
              <div className="py-3 border border-dashed border-gray-300 rounded-2xl flex items-center justify-between px-4">
                <span className="text-xs font-bold text-gray-400">Limite 3 exos — plan Gratuit</span>
                <a href="/pricing" className="text-xs font-bold text-violet-600 hover:text-violet-500">Passer Pro →</a>
              </div>
            ) : (
              <button
                onClick={() => { enterEditMode(); setShowPicker(true) }}
                className="py-4 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-bold text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-2"
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
          <div className="flex flex-col gap-3 py-4 px-4">

            {exercises.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🏋️</p>
                <p className="text-gray-500 font-semibold mb-1">Aucun exercice</p>
                <p className="text-gray-400 text-sm">Appuyez sur le bouton ci-dessous pour commencer</p>
              </div>
            )}

            {exercises.map((ex, exIdx) => (
              <div key={exIdx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200">
                {/* Exercise header */}
                <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-gray-900 truncate">{ex.name}</p>
                    {(() => {
                      const info = EXERCISE_DB.find(e => e.name === ex.name)
                      return info ? (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-violet-600 font-semibold">{info.primary_muscle}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{info.equipment}</span>
                          <span className="text-gray-300">·</span>
                          <span className={`text-[10px] font-bold ${DIFFICULTY_COLORS[info.difficulty].split(" ")[0]}`}>{info.difficulty}</span>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <button
                    onClick={() => startRenameExercise(exIdx)}
                    className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
                    title="Renommer l'exercice"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeExercise(exIdx)}
                    className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sets header */}
                <div className="grid grid-cols-12 gap-1 px-4 pb-1">
                  <p className="col-span-1 text-xs text-gray-400 font-bold text-center">#</p>
                  <p className="col-span-4 text-xs text-gray-400 font-bold text-center">Reps</p>
                  <p className="col-span-4 text-xs text-gray-400 font-bold text-center">Kg</p>
                  <p className="col-span-2 text-xs text-gray-400 font-bold text-center">RPE</p>
                  <p className="col-span-1" />
                </div>

                {/* Sets */}
                <div className="px-4 flex flex-col gap-1.5 pb-3">
                  {ex.sets.map((s, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-12 gap-1 items-center">
                      <p className="col-span-1 text-xs text-gray-400 font-bold text-center">{setIdx + 1}</p>
                      <input type="number" inputMode="numeric" value={s.reps} onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)} placeholder="8" min={0}
                        className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 font-semibold outline-none focus:border-violet-400 text-center transition-colors" />
                      <input type="number" inputMode="decimal" value={s.weight} onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)} placeholder="0" min={0} step={0.5}
                        className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 font-semibold outline-none focus:border-violet-400 text-center transition-colors" />
                      <input type="number" inputMode="decimal" value={s.rpe} onChange={e => updateSet(exIdx, setIdx, "rpe", e.target.value)} placeholder="8" min={1} max={10} step={0.5}
                        className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-1 py-1 text-sm text-gray-900 font-semibold outline-none focus:border-violet-400 text-center transition-colors" />
                      <button onClick={() => removeSet(exIdx, setIdx)} disabled={ex.sets.length <= 1}
                        className="col-span-1 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-20">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => addSet(exIdx)}
                  className="w-full py-2.5 border-t border-gray-100 text-xs font-bold text-gray-400 hover:text-violet-600 hover:bg-gray-50 transition-colors">
                  + Ajouter une série
                </button>
              </div>
            ))}

            {/* Add exercise */}
            {plan === "free" && exercises.length >= 3 ? (
              <div className="py-3 border border-dashed border-gray-300 rounded-2xl flex items-center justify-between px-4">
                <span className="text-xs font-bold text-gray-400">Limite 3 exos — plan Gratuit</span>
                <a href="/pricing" className="text-xs font-bold text-violet-600 hover:text-violet-500">Passer Pro →</a>
              </div>
            ) : (
              <button
                onClick={() => setShowPicker(true)}
                className="py-4 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-bold text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un exercice {plan === "free" ? `(${exercises.length}/3)` : ""}
              </button>
            )}

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <label className="text-xs font-bold text-gray-400 block mb-2">Notes de séance</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ressenti général, observations, objectifs pour la prochaine fois..."
                rows={3}
                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-300 font-medium outline-none resize-none leading-relaxed"
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
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 shadow-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-violet-600 border border-violet-500/40 rounded-2xl text-sm font-bold text-white shadow-lg hover:bg-violet-500 transition-colors disabled:opacity-50"
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
