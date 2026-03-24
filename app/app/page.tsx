"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
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
      Promise.all([
        authFetch("/api/dashboard").then(r => r.json()).catch(() => null),
        authFetch("/api/profile").then(r => r.json()).catch(() => null),
      ]).then(([dashboard, prof]) => {
        if (dashboard) setData(dashboard)
        if (prof) {
          setProfile(prof)
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

  if (!ready) return <LoadingScreen />

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
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Greeting */}
        <div className="pt-2 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Accueil</p>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
            </h1>
          </div>
          <a href="/app/profil" className="mt-1 w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0">
            <svg className="w-[18px] h-[18px] text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </a>
        </div>

        {/* Profile card */}
        {profile?.profileComplete ? (
          <a href="/app/profil" className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 hover:border-violet-300 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-y-1 mb-1.5">
                {[
                  profile.age ? `${profile.age} ans` : null,
                  profile.heightCm ? `${profile.heightCm} cm` : null,
                  profile.weightKg ? `${profile.weightKg} kg` : null,
                  profile.weightKg && profile.heightCm ? `IMC ${bmi(profile.weightKg, profile.heightCm)}` : null,
                  profile.restingHR ? `FC ${profile.restingHR} bpm` : null,
                ].filter(Boolean).map((item, i, arr) => (
                  <span key={i} className="flex items-center">
                    <span className="text-xs font-semibold text-gray-600">{item}</span>
                    {i < arr.length - 1 && <span className="mx-2 text-gray-300 font-light">|</span>}
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
          <a href="/app/onboarding" className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-violet-100 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-violet-800">Complète ton profil</p>
              <p className="text-xs text-violet-600">Âge, taille, poids, objectif — pour des conseils IA personnalisés</p>
            </div>
            <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Cette semaine</p>
            <p className="text-3xl font-black text-gray-900">{data?.thisWeek ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">séance{(data?.thisWeek ?? 0) > 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Dernière</p>
            {data?.lastWorkout ? (
              <>
                <p className="text-sm font-extrabold text-gray-900 truncate">{TYPE_LABELS[data.lastWorkout.type] ?? data.lastWorkout.type}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(data.lastWorkout.date)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 font-medium mt-1">Aucune encore</p>
            )}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-violet-600 uppercase tracking-widest">Conseil du coach</p>
          </div>
          {loadingReco ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin shrink-0" />
              <p className="text-sm text-gray-500 font-medium">Analyse de tes habitudes...</p>
            </div>
          ) : data?.recommendation ? (
            <p className="text-sm text-gray-700 font-medium leading-relaxed">{data.recommendation}</p>
          ) : data?.lastWorkout === null ? (
            <p className="text-sm text-gray-500 font-medium">Ajoute tes premières séances pour recevoir des conseils personnalisés.</p>
          ) : (
            <p className="text-sm text-gray-500 font-medium">Continue comme ça, tu gères ta programmation.</p>
          )}
          {(data?.missingHabitual?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data!.missingHabitual.map(t => (
                <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-100 text-violet-600 border border-violet-200">
                  {TYPE_LABELS[t] ?? t} à faire
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/app/activities" className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Activités</p>
              <p className="text-xs text-gray-500">Nouvelle activité</p>
            </div>
          </a>
          <a href="/app/nutrition" className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-orange-100 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Nutrition</p>
              <p className="text-xs text-gray-500">Analyser un repas</p>
            </div>
          </a>
        </div>

      </div>
    </div>
  )
}
