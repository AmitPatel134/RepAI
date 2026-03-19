"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"

type Activity = {
  id: string
  type: string
  name: string
  date: string
  durationSec: number | null
  distanceM: number | null
  elevationM: number | null
  avgHeartRate: number | null
  calories: number | null
  avgSpeedKmh: number | null
  avgPaceSecKm: number | null
  laps: number | null
  poolLengthM: number | null
  notes: string | null
  source: string
}

const ACTIVITY_TYPES = [
  { key: "running", label: "Course", color: "#f97316" },
  { key: "cycling", label: "Vélo", color: "#3b82f6" },
  { key: "swimming", label: "Natation", color: "#06b6d4" },
  { key: "walking", label: "Marche", color: "#22c55e" },
  { key: "hiking", label: "Rando", color: "#a3a3a3" },
  { key: "rowing", label: "Aviron", color: "#8b5cf6" },
  { key: "elliptical", label: "Elliptique", color: "#ec4899" },
  { key: "other", label: "Autre", color: "#6b7280" },
]

function getTypeInfo(type: string) {
  return ACTIVITY_TYPES.find(t => t.key === type) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1]
}

function TypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const s = size
  if (type === "running") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5"/><path d="M8 8l2 2-2 4h4l2-4 2 1"/>
      <path d="M7 20l2-4"/><path d="M17 20l-2-4"/>
    </svg>
  )
  if (type === "cycling") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
      <path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5L9 10l3-2 2 4h4"/>
    </svg>
  )
  if (type === "swimming") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
      <circle cx="12" cy="6" r="2"/><path d="M12 8v4"/>
    </svg>
  )
  if (type === "walking") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5"/><path d="M10 8l-2 6 2 2 2-4 2 2 2 4M8 20l2-4M16 20l-1-4"/>
    </svg>
  )
  if (type === "hiking") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20l5-8 4 4 4-6 5 10"/><circle cx="12" cy="4" r="1.5"/>
    </svg>
  )
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )
}

function formatDuration(sec: number | null) {
  if (!sec) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`
  return `${m}min`
}

function formatPace(secKm: number | null) {
  if (!secKm) return null
  const m = Math.floor(secKm / 60)
  const s = secKm % 60
  return `${m}'${s.toString().padStart(2, "0")}"/km`
}

function formatDistance(m: number | null) {
  if (!m) return null
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

export default function ActivitiesPage() {
  const searchParams = useSearchParams()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [stravaConnected, setStravaConnected] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // New activity form state
  const [newType, setNewType] = useState("running")
  const [newName, setNewName] = useState("")
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [newDurH, setNewDurH] = useState("")
  const [newDurM, setNewDurM] = useState("")
  const [newDist, setNewDist] = useState("")
  const [newElev, setNewElev] = useState("")
  const [newHR, setNewHR] = useState("")
  const [newCal, setNewCal] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stravaOk = searchParams.get("strava_connected")
    const stravaErr = searchParams.get("strava_error")
    const synced = searchParams.get("synced")
    if (stravaOk) showToast(`Strava connecté ! ${synced} activités importées`)
    if (stravaErr) showToast("Erreur lors de la connexion Strava")
  }, [searchParams])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setIsLoggedIn(true)

      Promise.all([
        authFetch("/api/activities").then(r => r.json()),
        authFetch("/api/strava/status").then(r => r.json()),
      ]).then(([acts, strava]) => {
        setActivities(Array.isArray(acts) ? acts : [])
        setStravaConnected(strava?.connected ?? false)
      }).finally(() => setLoading(false))
    })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSync() {
    setSyncLoading(true)
    try {
      const r = await authFetch("/api/strava/sync", { method: "POST" })
      const data = await r.json()
      showToast(`${data.synced} activités synchronisées`)
      const r2 = await authFetch("/api/activities")
      setActivities(await r2.json())
    } finally {
      setSyncLoading(false)
    }
  }

  async function handleDisconnect() {
    await authFetch("/api/strava/disconnect", { method: "DELETE" })
    setStravaConnected(false)
    showToast("Strava déconnecté")
  }

  async function handleAdd() {
    if (!newName || !newType) return
    setSaving(true)
    const durationSec = newDurH || newDurM ? (parseInt(newDurH || "0") * 3600 + parseInt(newDurM || "0") * 60) : null
    const distanceM = newDist ? parseFloat(newDist) * 1000 : null

    const r = await authFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        name: newName,
        date: newDate,
        durationSec,
        distanceM,
        elevationM: newElev ? parseFloat(newElev) : null,
        avgHeartRate: newHR ? parseInt(newHR) : null,
        calories: newCal ? parseInt(newCal) : null,
        notes: newNotes || null,
      }),
    })
    if (r.ok) {
      const act = await r.json()
      setActivities(prev => [act, ...prev])
      setShowAdd(false)
      resetForm()
      showToast("Activité ajoutée !")
    }
    setSaving(false)
  }

  function resetForm() {
    setNewType("running"); setNewName(""); setNewDate(new Date().toISOString().slice(0, 10))
    setNewDurH(""); setNewDurM(""); setNewDist(""); setNewElev(""); setNewHR(""); setNewCal(""); setNewNotes("")
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/activities/${id}`, { method: "DELETE" })
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  const filtered = filter === "all" ? activities : activities.filter(a => a.type === filter)

  // Stats this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeek = activities.filter(a => new Date(a.date) >= weekAgo)
  const totalKm = thisWeek.reduce((s, a) => s + (a.distanceM ?? 0) / 1000, 0)
  const totalMin = thisWeek.reduce((s, a) => s + (a.durationSec ?? 0) / 60, 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 md:pt-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black text-white">Activités</h1>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <>
                {stravaConnected ? (
                  <button
                    onClick={handleSync}
                    disabled={syncLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FC4C02]/10 border border-[#FC4C02]/30 rounded-xl text-xs font-bold text-[#FC4C02] hover:bg-[#FC4C02]/20 transition-colors"
                  >
                    <svg className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.93-4.38M20 15a9 9 0 01-14.93 4.38"/></svg>
                    Strava
                  </button>
                ) : (
                  <a
                    href="/api/strava/connect"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FC4C02] rounded-xl text-xs font-bold text-white hover:bg-[#e04402] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
                    Connecter Strava
                  </a>
                )}
                <button
                  onClick={() => { resetForm(); setShowAdd(true) }}
                  className="w-9 h-9 rounded-2xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">Course, vélo, natation et plus</p>
      </div>

      {/* Stats */}
      {activities.length > 0 && (
        <div className="px-4 mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Cette semaine", value: `${totalKm.toFixed(1)} km` },
            { label: "Temps total", value: totalMin >= 60 ? `${Math.floor(totalMin / 60)}h${Math.round(totalMin % 60).toString().padStart(2, "0")}` : `${Math.round(totalMin)} min` },
            { label: "Séances", value: `${thisWeek.length}` },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-3 text-center">
              <p className="text-lg font-black text-white">{s.value}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 w-max">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filter === "all" ? "bg-white text-gray-900" : "bg-white/[0.06] text-gray-400 hover:text-white"}`}
          >
            Toutes ({activities.length})
          </button>
          {ACTIVITY_TYPES.filter(t => activities.some(a => a.type === t.key)).map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filter === t.key ? "text-white" : "bg-white/[0.06] text-gray-400 hover:text-white"}`}
              style={filter === t.key ? { backgroundColor: t.color + "33", color: t.color, borderColor: t.color + "66", border: "1px solid" } : {}}
            >
              {t.label} ({activities.filter(a => a.type === t.key).length})
            </button>
          ))}
        </div>
      </div>

      {/* Strava connect CTA */}
      {isLoggedIn && !stravaConnected && activities.length === 0 && (
        <div className="mx-4 mb-4 bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FC4C02] flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Connecte Strava</p>
            <p className="text-xs text-gray-400 mt-0.5">Importe toutes tes activités automatiquement</p>
          </div>
          <a href="/api/strava/connect" className="shrink-0 px-3 py-2 bg-[#FC4C02] rounded-xl text-xs font-bold text-white">
            Connecter
          </a>
        </div>
      )}

      {/* Activity list */}
      <div className="px-4 flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">Aucune activité</p>
            {isLoggedIn && (
              <button onClick={() => { resetForm(); setShowAdd(true) }} className="mt-3 text-violet-400 text-sm font-bold">
                + Ajouter une activité
              </button>
            )}
          </div>
        )}
        {filtered.map(a => {
          const info = getTypeInfo(a.type)
          return (
            <div key={a.id} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: info.color + "22" }}>
                <span style={{ color: info.color }}><TypeIcon type={a.type} /></span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(a.date)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.source === "strava" && (
                      <span className="text-[10px] font-black text-[#FC4C02] bg-[#FC4C02]/10 px-1.5 py-0.5 rounded-md">S</span>
                    )}
                    <button onClick={() => handleDelete(a.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {a.distanceM && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{formatDistance(a.distanceM)}</span>
                  )}
                  {a.durationSec && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{formatDuration(a.durationSec)}</span>
                  )}
                  {a.avgPaceSecKm && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{formatPace(a.avgPaceSecKm)}</span>
                  )}
                  {a.avgSpeedKmh && !a.avgPaceSecKm && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{a.avgSpeedKmh.toFixed(1)} km/h</span>
                  )}
                  {a.elevationM && a.elevationM > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">↑{Math.round(a.elevationM)}m</span>
                  )}
                  {a.avgHeartRate && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">{a.avgHeartRate} bpm</span>
                  )}
                  {a.calories && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.06] text-gray-300">{a.calories} kcal</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Strava disconnect */}
      {stravaConnected && (
        <div className="px-4 mt-6">
          <button onClick={handleDisconnect} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Déconnecter Strava
          </button>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-6">
              <h3 className="text-base font-black text-white mb-4 mt-2">Nouvelle activité</h3>

              {/* Type selector */}
              <div className="overflow-x-auto mb-4">
                <div className="flex gap-2 w-max pb-1">
                  {ACTIVITY_TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setNewType(t.key); setNewName(t.label === "Course" ? "Sortie running" : t.label === "Vélo" ? "Sortie vélo" : t.label === "Natation" ? "Séance natation" : t.label) }}
                      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all"
                      style={newType === t.key
                        ? { backgroundColor: t.color + "22", borderColor: t.color + "66", color: t.color }
                        : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "#6b7280" }
                      }
                    >
                      <TypeIcon type={t.key} size={18} />
                      <span className="text-[10px] font-bold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nom de l'activité"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500/50"
                />
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Distance (km)</label>
                    <input type="number" min="0" step="0.1" value={newDist} onChange={e => setNewDist(e.target.value)}
                      placeholder="ex: 5.2"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Durée</label>
                    <div className="flex gap-1 mt-1">
                      <input type="number" min="0" value={newDurH} onChange={e => setNewDurH(e.target.value)} placeholder="0h"
                        className="w-1/2 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 text-center" />
                      <input type="number" min="0" max="59" value={newDurM} onChange={e => setNewDurM(e.target.value)} placeholder="00min"
                        className="w-1/2 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 text-center" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(newType === "running" || newType === "cycling" || newType === "hiking") && (
                    <div>
                      <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Dénivelé (m)</label>
                      <input type="number" min="0" value={newElev} onChange={e => setNewElev(e.target.value)} placeholder="—"
                        className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 text-center" />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">FC moy (bpm)</label>
                    <input type="number" min="0" value={newHR} onChange={e => setNewHR(e.target.value)} placeholder="—"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 text-center" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Calories</label>
                    <input type="number" min="0" value={newCal} onChange={e => setNewCal(e.target.value)} placeholder="—"
                      className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 text-center" />
                  </div>
                </div>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Notes (optionnel)"
                  rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
                  Annuler
                </button>
                <button onClick={handleAdd} disabled={saving || !newName || !newType} className="flex-1 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50">
                  {saving ? "..." : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-800 border border-white/10 rounded-2xl text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
