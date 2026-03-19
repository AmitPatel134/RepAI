"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"

const TYPE_LABELS: Record<string, string> = {
  fullbody: "Full Body", push: "Push", pull: "Pull", legs: "Legs",
  upper: "Upper Body", lower: "Lower Body", cardio: "Cardio", hiit: "HIIT",
  mobility: "Mobilité", crossfit: "CrossFit", force: "Force", dos: "Dos",
  bras: "Bras", epaules: "Épaules", abdos: "Abdominaux",
}

type DashboardData = {
  recommendation: string | null
  lastWorkout: { name: string; type: string; date: string } | null
  thisWeek: number
  habitualTypes: string[]
  missingHabitual: string[]
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

export default function HomePage() {
  const [ready, setReady] = useState(false)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingReco, setLoadingReco] = useState(false)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setNoSession(true); setReady(true); return }

      // Extract first name from email or user metadata
      const meta = session.user.user_metadata
      const name = meta?.full_name?.split(" ")[0] ?? meta?.name?.split(" ")[0] ?? null
      setFirstName(name)

      setLoadingReco(true)
      authFetch("/api/dashboard")
        .then(r => r.json())
        .then(d => { setData(d); setReady(true) })
        .catch(() => setReady(true))
        .finally(() => setLoadingReco(false))
    })
  }, [])

  if (!ready) return <LoadingScreen />

  if (noSession) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-2xl font-extrabold text-white">Bienvenue sur RepAI</p>
        <p className="text-gray-400 text-sm">Connectez-vous pour accéder à votre espace.</p>
        <a href="/login" className="px-6 py-3 bg-violet-600 rounded-2xl text-sm font-bold text-white">
          Se connecter
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Greeting */}
        <div className="pt-2 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Accueil</p>
            <h1 className="text-2xl font-extrabold text-white">
              {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
            </h1>
          </div>
          <a href="/app/profil" className="mt-1 w-9 h-9 rounded-full bg-white/[0.07] border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors shrink-0">
            <svg className="w-4.5 h-4.5 w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Cette semaine</p>
            <p className="text-3xl font-black text-white">{data?.thisWeek ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">séance{(data?.thisWeek ?? 0) > 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Dernière</p>
            {data?.lastWorkout ? (
              <>
                <p className="text-sm font-extrabold text-white truncate">{TYPE_LABELS[data.lastWorkout.type] ?? data.lastWorkout.type}</p>
                <p className="text-xs text-gray-500 mt-0.5">{timeAgo(data.lastWorkout.date)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-600 font-medium mt-1">Aucune encore</p>
            )}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="bg-violet-600/10 border border-violet-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600/30 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Conseil du coach IA</p>
          </div>

          {loadingReco ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin shrink-0" />
              <p className="text-sm text-gray-400 font-medium">Analyse de tes habitudes...</p>
            </div>
          ) : data?.recommendation ? (
            <p className="text-sm text-gray-200 font-medium leading-relaxed">{data.recommendation}</p>
          ) : data?.lastWorkout === null ? (
            <p className="text-sm text-gray-400 font-medium">Ajoute tes premières séances pour recevoir des conseils personnalisés.</p>
          ) : (
            <p className="text-sm text-gray-400 font-medium">Continue comme ça, tu gères ta programmation.</p>
          )}

          {/* Missing habitual types */}
          {(data?.missingHabitual?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data!.missingHabitual.map(t => (
                <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-600/20 text-violet-300 border border-violet-500/20">
                  {TYPE_LABELS[t] ?? t} à faire
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/app/activities" className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/10 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Activités</p>
              <p className="text-xs text-gray-500">Nouvelle activité</p>
            </div>
          </a>
          <a href="/app/nutrition" className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/10 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Nutrition</p>
              <p className="text-xs text-gray-500">Analyser un repas</p>
            </div>
          </a>
        </div>

      </div>
    </div>
  )
}
