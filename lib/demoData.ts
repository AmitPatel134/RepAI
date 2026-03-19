// Demo data for visualization without database

export const DEMO_WORKOUTS = [
  {
    id: "demo-1",
    name: "Push Day A",
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Bonne séance, PR sur le bench",
    exercises: [
      {
        id: "ex-1",
        name: "Développé couché",
        category: "strength",
        sets: [
          { id: "s-1", reps: 5, weight: 100, rpe: 8 },
          { id: "s-2", reps: 5, weight: 100, rpe: 8.5 },
          { id: "s-3", reps: 4, weight: 100, rpe: 9 },
        ],
      },
      {
        id: "ex-2",
        name: "Développé épaules",
        category: "strength",
        sets: [
          { id: "s-4", reps: 8, weight: 70, rpe: 7 },
          { id: "s-5", reps: 8, weight: 70, rpe: 7.5 },
          { id: "s-6", reps: 7, weight: 70, rpe: 8 },
        ],
      },
      {
        id: "ex-3",
        name: "Triceps poulie",
        category: "strength",
        sets: [
          { id: "s-7", reps: 12, weight: 35, rpe: 7 },
          { id: "s-8", reps: 12, weight: 35, rpe: 7 },
          { id: "s-9", reps: 10, weight: 35, rpe: 8 },
        ],
      },
    ],
  },
  {
    id: "demo-2",
    name: "Pull Day A",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "",
    exercises: [
      {
        id: "ex-4",
        name: "Soulevé de terre",
        category: "strength",
        sets: [
          { id: "s-10", reps: 3, weight: 160, rpe: 8 },
          { id: "s-11", reps: 3, weight: 160, rpe: 8.5 },
          { id: "s-12", reps: 2, weight: 160, rpe: 9 },
        ],
      },
      {
        id: "ex-5",
        name: "Tractions",
        category: "strength",
        sets: [
          { id: "s-13", reps: 8, weight: 0, rpe: 7 },
          { id: "s-14", reps: 7, weight: 0, rpe: 7.5 },
          { id: "s-15", reps: 6, weight: 0, rpe: 8 },
        ],
      },
      {
        id: "ex-6",
        name: "Curl biceps",
        category: "strength",
        sets: [
          { id: "s-16", reps: 10, weight: 20, rpe: 7 },
          { id: "s-17", reps: 10, weight: 20, rpe: 7.5 },
          { id: "s-18", reps: 9, weight: 20, rpe: 8 },
        ],
      },
    ],
  },
  {
    id: "demo-3",
    name: "Leg Day",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Cuisses cramées",
    exercises: [
      {
        id: "ex-7",
        name: "Squat",
        category: "strength",
        sets: [
          { id: "s-19", reps: 5, weight: 120, rpe: 8 },
          { id: "s-20", reps: 5, weight: 120, rpe: 8.5 },
          { id: "s-21", reps: 4, weight: 120, rpe: 9 },
        ],
      },
      {
        id: "ex-8",
        name: "Leg press",
        category: "strength",
        sets: [
          { id: "s-22", reps: 10, weight: 200, rpe: 7 },
          { id: "s-23", reps: 10, weight: 200, rpe: 7 },
          { id: "s-24", reps: 9, weight: 200, rpe: 8 },
        ],
      },
      {
        id: "ex-9",
        name: "Leg curl",
        category: "strength",
        sets: [
          { id: "s-25", reps: 12, weight: 50, rpe: 7 },
          { id: "s-26", reps: 12, weight: 50, rpe: 7.5 },
          { id: "s-27", reps: 10, weight: 50, rpe: 8 },
        ],
      },
    ],
  },
  {
    id: "demo-4",
    name: "Push Day B",
    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "",
    exercises: [
      {
        id: "ex-10",
        name: "Développé couché",
        category: "strength",
        sets: [
          { id: "s-28", reps: 5, weight: 97.5, rpe: 7.5 },
          { id: "s-29", reps: 5, weight: 97.5, rpe: 8 },
          { id: "s-30", reps: 5, weight: 97.5, rpe: 8 },
        ],
      },
      {
        id: "ex-11",
        name: "Développé incliné",
        category: "strength",
        sets: [
          { id: "s-31", reps: 8, weight: 80, rpe: 7 },
          { id: "s-32", reps: 8, weight: 80, rpe: 7.5 },
          { id: "s-33", reps: 7, weight: 80, rpe: 8 },
        ],
      },
    ],
  },
  {
    id: "demo-5",
    name: "Pull Day B",
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Back pumpe",
    exercises: [
      {
        id: "ex-12",
        name: "Rowing barre",
        category: "strength",
        sets: [
          { id: "s-34", reps: 8, weight: 90, rpe: 7.5 },
          { id: "s-35", reps: 8, weight: 90, rpe: 8 },
          { id: "s-36", reps: 7, weight: 90, rpe: 8.5 },
        ],
      },
      {
        id: "ex-13",
        name: "Soulevé de terre",
        category: "strength",
        sets: [
          { id: "s-37", reps: 3, weight: 155, rpe: 7.5 },
          { id: "s-38", reps: 3, weight: 155, rpe: 8 },
          { id: "s-39", reps: 3, weight: 155, rpe: 8 },
        ],
      },
    ],
  },
]

export const DEMO_PROGRESS_CHART = [
  { date: "Lun", volume: 3200 },
  { date: "Mar", volume: 0 },
  { date: "Mer", volume: 4100 },
  { date: "Jeu", volume: 0 },
  { date: "Ven", volume: 3800 },
  { date: "Sam", volume: 2900 },
  { date: "Dim", volume: 0 },
]

export const DEMO_BENCH_PROGRESS = [
  { date: "13 Jan", weight: 90 },
  { date: "20 Jan", weight: 92.5 },
  { date: "27 Jan", weight: 95 },
  { date: "3 Fév", weight: 95 },
  { date: "10 Fév", weight: 97.5 },
  { date: "17 Fév", weight: 97.5 },
  { date: "24 Fév", weight: 100 },
  { date: "3 Mar", weight: 100 },
  { date: "10 Mar", weight: 102.5 },
  { date: "17 Mar", weight: 100 },
]

export const DEMO_SQUAT_PROGRESS = [
  { date: "13 Jan", weight: 100 },
  { date: "20 Jan", weight: 102.5 },
  { date: "27 Jan", weight: 105 },
  { date: "3 Fév", weight: 107.5 },
  { date: "10 Fév", weight: 110 },
  { date: "17 Fév", weight: 112.5 },
  { date: "24 Fév", weight: 115 },
  { date: "3 Mar", weight: 117.5 },
  { date: "10 Mar", weight: 120 },
  { date: "17 Mar", weight: 120 },
]

export const DEMO_DEADLIFT_PROGRESS = [
  { date: "13 Jan", weight: 140 },
  { date: "27 Jan", weight: 145 },
  { date: "10 Fév", weight: 150 },
  { date: "24 Fév", weight: 152.5 },
  { date: "10 Mar", weight: 155 },
  { date: "17 Mar", weight: 160 },
]

export const DEMO_STATS = {
  totalWorkouts: 28,
  workoutsThisWeek: 3,
  totalVolume: 124500,
  volumeThisWeek: 11000,
  prsThisMonth: 3,
  currentStreak: 3,
}

export const DEMO_COACH_SESSIONS = [
  {
    id: "cs-1",
    question: "Est-ce que je progresse bien sur le bench press ?",
    response: `Oui, ta progression sur le développé couché est très solide ! 🎯

**Analyse de ta progression :**
- Tu es passé de 90kg à 100kg en ~10 semaines (+11%)
- Ça représente ~1kg de gain toutes les 1-2 semaines, ce qui est excellent pour un lifter intermédiaire
- Ton RPE reste stable (8-8.5) malgré l'augmentation des charges

**Points positifs :**
- Volume hebdomadaire cohérent (3 séries x 5 reps)
- Récupération suffisante entre les séances push
- Tu respectes la progression linéaire

**Suggestions pour la suite :**
1. Passe à une micro-progression de +0.5kg par séance pour éviter les plateaux
2. Ajoute une série de travail technique à charge réduite (-30%) en début de séance
3. Surveille ton alimentation et ton sommeil — la progression en force est 70% hors salle`,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "cs-2",
    question: "Dois-je ajouter plus de volume pour le dos ?",
    response: `Bonne question ! En analysant tes séances pull, voici mon analyse : 💪

**Ton volume actuel :**
- ~6-8 séries directes dos par séance
- 1-2 séances pull/semaine = 6-16 séries/semaine

**Recommandations :**
Pour la plupart des lifters intermédiaires, 15-20 séries/semaine pour le dos est optimal.

**Si tu es en dessous :**
- Ajoute 1 mouvement (rowing unilatéral ou face pull)
- Augmente progressivement : +2 séries par semaine max

**Si tu es dans la plage :**
- Focus sur la progression des charges plutôt que le volume
- Améliore la connexion musculaire (slow negatives)

**Ma recommandation personnalisée :**
Ajoute des face pulls en fin de séance push (15-20 reps, 3 séries) pour équilibrer ton développement postérieur.`,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export function calcWorkoutVolume(workout: typeof DEMO_WORKOUTS[0]): number {
  return workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, set) => {
      return setTotal + (set.reps ?? 0) * (set.weight ?? 0)
    }, 0)
  }, 0)
}
