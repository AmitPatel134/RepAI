"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from "recharts"
import {
  DEMO_WORKOUTS, DEMO_PROGRESS_CHART, DEMO_STATS, calcWorkoutVolume,
} from "@/lib/demoData"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${v}kg`
}

export default function AppPage() {
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [workouts, setWorkouts] = useState(DEMO_WORKOUTS)
  const [volumeChart, setVolumeChart] = useState(DEMO_PROGRESS_CHART)
  const [stats, setStats] = useState(DEMO_STATS)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setReady(true)
        return
      }
      authFetch("/api/dashboard")
        .then(r => r.json())
        .then(d => {
          if (d && !d.error) {
            setWorkouts(d.workouts ?? DEMO_WORKOUTS)
            setVolumeChart(d.volumeChart ?? DEMO_PROGRESS_CHART)
            setStats(d.stats ?? DEMO_STATS)
          }
          setReady(true)
        })
        .catch(() => {
          setIsDemo(true)
          setReady(true)
        })
    })
  }, [])

  if (!ready) return <LoadingScreen />

  const recentWorkouts = workouts.slice(0, 4)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-6 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — données d&apos;exemple. <a href="/login" className="underline hover:text-white">Connectez-vous</a> pour vos vraies données.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full hover:bg-violet-500 transition-colors">
            Se connecter
          </a>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tableau de bord</p>
            <h1 className="text-2xl font-extrabold text-white">Bonjour 👋</h1>
          </div>
          <a
            href="/app/workouts"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nouvelle séance</span>
          </a>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
          {[
            { label: "Séances ce mois", value: stats.totalWorkouts, color: "text-violet-400", icon: "🏋️" },
            { label: "Cette semaine", value: stats.workoutsThisWeek, color: "text-emerald-400", icon: "📅" },
            { label: "Volume semaine", value: formatVolume(stats.volumeThisWeek), color: "text-amber-400", icon: "⚡" },
            { label: "PR ce mois", value: stats.prsThisMonth, color: "text-fuchsia-400", icon: "🏆" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-3 py-3 md:px-4 md:py-4">
              <p className="text-base md:text-lg mb-1">{s.icon}</p>
              <p className={`text-xl md:text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] md:text-xs text-gray-500 font-medium mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">

          {/* Volume chart */}
          <div className="md:col-span-3 bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Activité</p>
                <p className="text-sm font-extrabold text-white">Volume — 7 derniers jours</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={volumeChart}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", fontSize: "12px", color: "#fff" }}
                  formatter={(v: number) => [`${v} kg`, "Volume"]}
                  cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                <Area type="monotone" dataKey="volume" stroke="#7c3aed" strokeWidth={2} fill="url(#volumeGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent workouts */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-extrabold text-white">Séances récentes</p>
              <a href="/app/workouts" className="text-xs font-bold text-violet-400 hover:text-violet-300">Voir tout</a>
            </div>
            <div className="flex flex-col flex-1 overflow-y-auto">
              {recentWorkouts.map(w => {
                const vol = calcWorkoutVolume(w)
                const exCount = w.exercises.length
                return (
                  <div key={w.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{w.name}</p>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">{formatDate(w.date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-violet-400">{formatVolume(vol)}</p>
                        <p className="text-xs text-gray-600">{exCount} exo</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 mt-3 md:mt-4">
          {[
            {
              href: "/app/workouts",
              icon: "📝",
              title: "Logger une séance",
              desc: "Enregistrer vos séries, reps et charges",
              color: "hover:border-violet-500/40",
            },
            {
              href: "/app/progress",
              icon: "📈",
              title: "Voir mes progrès",
              desc: "Graphiques de progression par exercice",
              color: "hover:border-emerald-500/40",
            },
            {
              href: "/app/coach",
              icon: "🤖",
              title: "Consulter le Coach IA",
              desc: "Conseils personnalisés basés sur vos données",
              color: "hover:border-fuchsia-500/40",
            },
          ].map(a => (
            <a
              key={a.href}
              href={a.href}
              className={`group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-all ${a.color} hover:bg-white/[0.07]`}
            >
              <span className="text-2xl">{a.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">{a.title}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{a.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 ml-auto shrink-0 transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>

      </div>
    </div>
  )
}
