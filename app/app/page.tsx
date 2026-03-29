"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached, invalidateCache } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"


const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  running: "Course à pied", cycling: "Vélo", swimming: "Natation",
  walking: "Marche", hiking: "Randonnée", rowing: "Aviron",
  elliptical: "Elliptique", other: "Autre",
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  running: "text-orange-500", cycling: "text-blue-500", swimming: "text-cyan-500",
  walking: "text-green-500", hiking: "text-emerald-600", rowing: "text-indigo-500",
  elliptical: "text-purple-500", other: "text-gray-500",
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}m`
  return `${m}min`
}

function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
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

type LastSession =
  | { kind: "workout"; id: string; name: string; type: string; date: string; exerciseCount: number; totalSets: number }
  | { kind: "activity"; id: string; name: string; type: string; date: string; durationSec: number | null; distanceM: number | null; calories: number | null; avgHeartRate: number | null }

type DashboardData = {
  recommendation: string | null
  lastSession: LastSession | null
  thisWeek: number
}

type UserProfile = {
  birthDate: string | null
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

type NutritionReco = {
  locked: boolean
  reco: { calories: number; proteins: number; carbs: number; fats: number; fiber: number; summary: string } | null
  generatedAt: string | null
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

function HomePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingReco, setLoadingReco] = useState(false)
  const [noSession, setNoSession] = useState(false)
  const [nutritionReco, setNutritionReco] = useState<NutritionReco | null>(null)
  const [generatingReco, setGeneratingReco] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Detect post-payment redirect
  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (!sessionId) return
    // Remove session_id from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete("session_id")
    window.history.replaceState({}, "", url.toString())
    // Verify payment and update plan
    authFetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then(r => r.json()).then(data => {
      if (data.success) {
        setPaymentSuccess(true)
        invalidateCache("/api/plan")
        invalidateCache("/api/nutrition-reco")
        setTimeout(() => setPaymentSuccess(false), 6000)
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const cNr = getCached<NutritionReco>("/api/nutrition-reco")
      if (cD) setData(cD as Parameters<typeof setData>[0])
      if (cPr) setProfile(cPr as Parameters<typeof setProfile>[0])
      if (cNr) setNutritionReco(cNr)
      if (cD && cPr) setReady(true)

      Promise.all([
        authFetch("/api/dashboard").then(r => r.json()).catch(() => null),
        authFetch("/api/profile").then(r => r.json()).catch(() => null),
        authFetch("/api/nutrition-reco").then(r => r.json()).catch(() => null),
      ]).then(([dashboard, prof, nr]) => {
        if (dashboard) { setData(dashboard); setCached("/api/dashboard", dashboard) }
        if (prof) {
          setProfile(prof); setCached("/api/profile", prof)
          if (!prof.profileComplete) {
            router.push("/app/onboarding")
            return
          }
        }
        if (nr) { setNutritionReco(nr); setCached("/api/nutrition-reco", nr) }
        setReady(true)
      }).catch(() => setReady(true))
        .finally(() => setLoadingReco(false))
    })
  }, [router])

  async function generateNutritionReco() {
    setGeneratingReco(true)
    try {
      const r = await authFetch("/api/nutrition-reco", { method: "POST" })
      const nr = await r.json()
      if (nr && !nr.error) { setNutritionReco(nr); setCached("/api/nutrition-reco", nr) }
    } finally {
      setGeneratingReco(false)
    }
  }

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

      {/* ── POST-PAYMENT SUCCESS BANNER ─────────────────────────────── */}
      {paymentSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-violet-600 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-extrabold text-sm">Bienvenue en Premium !</p>
              <p className="text-xs text-violet-200 font-medium">Toutes les fonctionnalités sont maintenant actives.</p>
            </div>
            <button onClick={() => setPaymentSuccess(false)} className="ml-auto text-white/60 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

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
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[96px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Dernière séance</p>
            {data?.lastSession ? (
              <>
                <p className="text-sm font-extrabold text-blue-600 leading-tight truncate">{data.lastSession.name}</p>
                {data.lastSession.kind === "activity" && (
                  <p className={`text-[11px] font-bold mt-0.5 ${ACTIVITY_TYPE_COLORS[data.lastSession.type] ?? "text-gray-500"}`}>
                    {ACTIVITY_TYPE_LABELS[data.lastSession.type] ?? data.lastSession.type}
                  </p>
                )}
                {/* Details */}
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                  {data.lastSession.kind === "workout" ? (
                    <>
                      {data.lastSession.exerciseCount > 0 && (
                        <span className="text-[11px] text-gray-500">{data.lastSession.exerciseCount} exo</span>
                      )}
                      {data.lastSession.totalSets > 0 && (
                        <span className="text-[11px] text-gray-500">{data.lastSession.totalSets} séries</span>
                      )}
                    </>
                  ) : (
                    <>
                      {data.lastSession.durationSec && (
                        <span className="text-[11px] text-gray-500">{fmtDuration(data.lastSession.durationSec)}</span>
                      )}
                      {data.lastSession.distanceM && (
                        <span className="text-[11px] text-gray-500">{fmtDistance(data.lastSession.distanceM)}</span>
                      )}
                      {data.lastSession.calories && (
                        <span className="text-[11px] text-gray-500">{data.lastSession.calories} kcal</span>
                      )}
                      {data.lastSession.avgHeartRate && (
                        <span className="text-[11px] text-gray-500">♥ {data.lastSession.avgHeartRate} bpm</span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-[10px] text-gray-300 mt-1.5">{timeAgo(data.lastSession.date)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 font-medium mt-1">Aucune encore</p>
            )}
          </div>
        </div>

        {/* ── PROFILE CARD ────────────────────────────────────────── */}
        {profile?.profileComplete ? (
          <a href="/app/profil" className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-violet-200 transition-colors group shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-violet-500" />
            <div className="flex-1 min-w-0 ml-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black text-violet-600 uppercase tracking-widest shrink-0">Profil</span>
                {profile.goal && (
                  <span className="text-sm text-gray-900 truncate">{GOAL_LABELS[profile.goal] ?? profile.goal}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-y-1">
                {[
                  profile.age ? `${profile.age} ans` : null,
                  profile.heightCm ? `${profile.heightCm} cm` : null,
                  profile.weightKg ? `${profile.weightKg} kg` : null,
                  profile.weightKg && profile.heightCm ? `IMC ${bmi(profile.weightKg, profile.heightCm)}` : null,
                  profile.restingHR ? `♥ ${profile.restingHR} bpm` : null,
                ].filter(Boolean).map((item, i, arr) => (
                  <span key={i} className="flex items-center">
                    <span className="text-xs font-semibold text-gray-500">{item}</span>
                    {i < arr.length - 1 && <span className="mx-1.5 text-gray-200">·</span>}
                  </span>
                ))}
              </div>
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
            ) : data?.lastSession === null ? (
              <p className="text-sm text-gray-400 font-medium">Ajoute tes premières séances pour recevoir des conseils personnalisés.</p>
            ) : (
              <p className="text-sm text-gray-400 font-medium">Continue comme ça, tu gères ta programmation.</p>
            )}

            <a href="/app/coach" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
              Poser une question →
            </a>
          </div>
        </div>

        {/* ── NUTRITION RECO ──────────────────────────────────────── */}
        {nutritionReco?.locked ? (
          // Free plan — locked card
          <div className="relative overflow-hidden bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-orange-400" />
            <div className="ml-1 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black text-orange-500 uppercase tracking-widest">Nutrition IA</span>
                  <span className="text-[10px] font-bold text-orange-400 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Premium</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug">Besoins nutritionnels personnalisés</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">Passe en Premium pour recevoir tes recommandations journalières en calories, protéines, glucides et lipides, calculées par l'IA selon ton profil et tes objectifs.</p>
                <a href="/app/profil" className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">
                  Passer Premium →
                </a>
              </div>
            </div>
          </div>
        ) : nutritionReco !== null ? (
          // Premium — show reco card
          <div className="relative overflow-hidden bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-orange-400" />
            <div className="ml-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-orange-500 uppercase tracking-widest">Nutrition IA</span>
                  {nutritionReco.generatedAt && (
                    <span className="text-[10px] text-gray-400">
                      {new Date(nutritionReco.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                <button
                  onClick={generateNutritionReco}
                  disabled={generatingReco}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
                >
                  {generatingReco ? (
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Régénérer
                </button>
              </div>

              {nutritionReco.reco ? (
                <>
                  {/* Calories — full width */}
                  <div className="bg-orange-50 rounded-xl p-3 flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">Calories</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-orange-600 leading-none">{nutritionReco.reco.calories}</span>
                      <span className="text-xs font-semibold text-orange-400">kcal</span>
                    </div>
                  </div>
                  {/* Macros — 4 cols */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: "Protéines", value: nutritionReco.reco.proteins, color: "text-blue-600", bg: "bg-blue-50" },
                      { label: "Glucides",  value: nutritionReco.reco.carbs,    color: "text-yellow-600", bg: "bg-yellow-50" },
                      { label: "Lipides",   value: nutritionReco.reco.fats,     color: "text-green-600", bg: "bg-green-50" },
                      { label: "Fibres",    value: nutritionReco.reco.fiber,    color: "text-purple-600", bg: "bg-purple-50" },
                    ].map(m => (
                      <div key={m.label} className={`${m.bg} rounded-xl p-2.5 text-center`}>
                        <p className={`text-base font-black ${m.color} leading-none`}>{m.value}</p>
                        <p className="text-[9px] font-semibold text-gray-400 mt-0.5">g</p>
                        <p className="text-[9px] font-bold text-gray-500 mt-0.5 leading-none">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Summary */}
                  <p className="text-xs text-gray-500 leading-relaxed italic">{nutritionReco.reco.summary}</p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  <p className="text-sm text-gray-500 text-center">Génère tes recommandations nutritionnelles personnalisées</p>
                  <button
                    onClick={generateNutritionReco}
                    disabled={generatingReco}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50"
                  >
                    {generatingReco ? "Calcul en cours…" : "Calculer mes besoins"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}


      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  )
}
