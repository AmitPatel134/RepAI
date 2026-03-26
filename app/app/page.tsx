"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"

const TYPE_LABELS: Record<string, string> = {
  fullbody: "Full Body", push: "Push", pull: "Pull", legs: "Legs",
  upper: "Upper Body", lower: "Lower Body", cardio: "Cardio", hiit: "HIIT",
  mobility: "Mobilité", crossfit: "CrossFit", force: "Force", dos: "Dos",
  bras: "Bras", epaules: "Épaules", abdos: "Abdominaux",
}

const GOAL_LABELS: Record<string, string> = {
  prise_de_masse: "Prise de masse 💪",
  perte_de_poids: "Perte de poids 🔥",
  performance_cardio: "Performance cardio 🏃",
  sante_cardiaque: "Santé cardiaque ❤️",
  endurance: "Endurance 🚴",
  force_max: "Force maximale 🏋️",
  flexibilite: "Souplesse & mobilité 🧘",
  maintien: "Maintien du poids ⚖️",
  bien_etre: "Bien-être général 🌿",
  competition: "Compétition sportive 🏆",
  reeducation: "Rééducation 🩹",
}

type DashboardData = {
  recommendation: string | null
  lastWorkout: { name: string; type: string; date: string } | null
  thisWeek: number
  habitualTypes: string[]
  missingHabitual: string[]
}

type UserProfile = {
  age: number | null
  heightCm: number | null
  weightKg: number | null
  sex: string | null
  goal: string | null
  activityLevel: string | null
  restingHR: number | null
  dailySteps: number | null
  profileComplete: boolean
}

function getGreeting() {
  return new Date().getHours() < 18 ? "Bonjour" : "Bonsoir"
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "hier"
  return `il y a ${days} jours`
}

function bmi(weight: number, height: number) {
  const h = height / 100
  return (weight / (h * h)).toFixed(1)
}

export default function HomePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingReco, setLoadingReco] = useState(false)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setNoSession(true); setReady(true); return }
      const meta = session.user.user_metadata
      const name = meta?.full_name?.split(" ")[0] ?? meta?.name?.split(" ")[0] ?? null
      setFirstName(name)
      setLoadingReco(true)

      // Instant display from cache
      const cD = getCached<unknown>("/api/dashboard")
      const cPr = getCached<{ profileComplete?: boolean }>("/api/profile")
      if (cD) setData(cD as Parameters<typeof setData>[0])
      if (cPr) setProfile(cPr as Parameters<typeof setProfile>[0])
      if (cD && cPr) setReady(true)

      Promise.all([
        authFetch("/api/dashboard").then(r => r.json()).catch(() => null),
        authFetch("/api/profile").then(r => r.json()).catch(() => null),
      ]).then(([dashboard, prof]) => {
        if (dashboard) { setData(dashboard); setCached("/api/dashboard", dashboard) }
        if (prof) {
          setProfile(prof); setCached("/api/profile", prof)
          if (!prof.profileComplete) {
            router.push("/app/onboarding")
            return
          }
        }
        setReady(true)
      }).catch(() => setReady(true))
        .finally(() => setLoadingReco(false))
    })
  }, [router])

  if (!ready) return <LoadingScreen color="#111827" />

  if (noSession) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-2xl font-extrabold text-gray-900">Bienvenue sur RepAI</p>
        <p className="text-gray-500 text-sm">Connectez-vous pour accéder à votre espace.</p>
        <a href="/login" className="px-6 py-3 bg-gray-900 rounded-2xl text-sm font-bold text-white">Se connecter</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">

      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gray-900 px-4 pt-8 pb-20">
        {/* Dot pattern */}
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        {/* Decorative glows */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-700/30 blur-2xl" />
        <div className="absolute top-4 left-1/3 w-32 h-32 rounded-full bg-blue-700/20 blur-2xl" />
        {/* Curve at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-100 rounded-t-[2rem]" />

        <div className="relative max-w-2xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight font-[family-name:var(--font-barlow-condensed)]">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm font-medium text-gray-400 mt-1">Prêt pour la séance du jour ?</p>
          </div>
          <a href="/app/profil" className="mt-1 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0 backdrop-blur-sm">
            <svg className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 flex flex-col gap-4">

        {/* ── STATS — pulled up over hero ─────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 -mt-10 relative z-10">
          {/* Séances cette semaine */}
          <div className="relative overflow-hidden bg-blue-600 rounded-2xl p-4 shadow-lg shadow-blue-600/30">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-blue-500/50" />
            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Cette semaine</p>
            <p className="text-4xl font-black text-white leading-none">{data?.thisWeek ?? 0}</p>
            <p className="text-xs text-blue-200 mt-1">séance{(data?.thisWeek ?? 0) > 1 ? "s" : ""}</p>
          </div>
          {/* Dernière séance */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dernière</p>
            {data?.lastWorkout ? (
              <>
                <p className="text-sm font-extrabold text-gray-900 leading-tight">{TYPE_LABELS[data.lastWorkout.type] ?? data.lastWorkout.type}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(data.lastWorkout.date)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 font-medium mt-1">Aucune encore</p>
            )}
          </div>
        </div>

        {/* ── PROFILE CARD ────────────────────────────────────────── */}
        {profile?.profileComplete ? (
          <a href="/app/profil" className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:border-violet-200 transition-colors group shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-violet-500" />
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 shadow-md shadow-violet-500/30 ml-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-y-1 mb-1">
                {[
                  profile.age ? `${profile.age} ans` : null,
                  profile.heightCm ? `${profile.heightCm} cm` : null,
                  profile.weightKg ? `${profile.weightKg} kg` : null,
                  profile.weightKg && profile.heightCm ? `IMC ${bmi(profile.weightKg, profile.heightCm)}` : null,
                  profile.restingHR ? `♥ ${profile.restingHR} bpm` : null,
                ].filter(Boolean).map((item, i, arr) => (
                  <span key={i} className="flex items-center">
                    <span className="text-xs font-semibold text-gray-600">{item}</span>
                    {i < arr.length - 1 && <span className="mx-1.5 text-gray-200">·</span>}
                  </span>
                ))}
              </div>
              {profile.goal && (
                <p className="text-sm font-bold text-gray-900 truncate">{GOAL_LABELS[profile.goal] ?? profile.goal}</p>
              )}
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-violet-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ) : (
          <a href="/app/onboarding" className="relative overflow-hidden bg-violet-600 rounded-2xl p-4 flex items-center gap-3 hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/25">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-violet-500/50" />
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="relative z-10 flex-1">
              <p className="text-sm font-bold text-white">Complète ton profil</p>
              <p className="text-xs text-violet-200">Pour des conseils IA personnalisés</p>
            </div>
            <svg className="relative z-10 w-4 h-4 text-white/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* ── AI COACH CARD ────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gray-900 rounded-2xl p-5">
          {/* Pattern */}
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.12) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          {/* Glow */}
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-violet-700/40 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-blue-700/30 blur-xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/40">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Coach IA</p>
              </div>
            </div>

            {loadingReco ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-gray-400 font-medium">Analyse de tes habitudes…</p>
              </div>
            ) : data?.recommendation ? (
              <p className="text-sm text-gray-300 font-medium leading-relaxed">{data.recommendation}</p>
            ) : data?.lastWorkout === null ? (
              <p className="text-sm text-gray-400 font-medium">Ajoute tes premières séances pour recevoir des conseils personnalisés.</p>
            ) : (
              <p className="text-sm text-gray-400 font-medium">Continue comme ça, tu gères ta programmation.</p>
            )}

            {(data?.missingHabitual?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data!.missingHabitual.map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-900/60 text-violet-300 border border-violet-800">
                    {TYPE_LABELS[t] ?? t} à faire
                  </span>
                ))}
              </div>
            )}

            <a href="/app/coach" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
              Poser une question →
            </a>
          </div>
        </div>

        {/* ── QUICK NAV ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Activités */}
          <a href="/app/activities" className="relative overflow-hidden bg-blue-600 rounded-2xl p-5 flex flex-col gap-3 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25 group">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-blue-500/50" />
            <div className="absolute bottom-2 right-2 opacity-10">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="relative z-10">
              <p className="text-base font-extrabold text-white">Activités</p>
              <p className="text-xs text-blue-200 mt-0.5">Enregistrer une séance</p>
            </div>
          </a>

          {/* Nutrition */}
          <a href="/app/nutrition" className="relative overflow-hidden bg-orange-500 rounded-2xl p-5 flex flex-col gap-3 hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/25 group">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-orange-400/50" />
            <div className="absolute bottom-2 right-2 opacity-10">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
              </svg>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
              </svg>
            </div>
            <div className="relative z-10">
              <p className="text-base font-extrabold text-white">Nutrition</p>
              <p className="text-xs text-orange-100 mt-0.5">Analyser un repas</p>
            </div>
          </a>
        </div>

        {/* ── BOTTOM SHORTCUTS ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/app/progress" className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-red-200 transition-colors group shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-red-500 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M7 20V14m4 6V8m4 12V3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Progrès</p>
              <p className="text-xs text-gray-400">Voir l'évolution</p>
            </div>
          </a>
          <a href="/app/coach" className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-violet-200 transition-colors group shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <svg className="w-[18px] h-[18px] text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Coach</p>
              <p className="text-xs text-gray-400">Poser une question</p>
            </div>
          </a>
        </div>

      </div>
    </div>
  )
}
