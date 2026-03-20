"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"

// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string; type: string; name: string; date: string
  durationSec: number | null; distanceM: number | null; elevationM: number | null
  avgHeartRate: number | null; calories: number | null
  avgSpeedKmh: number | null; avgPaceSecKm: number | null; notes: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDIO_TYPES = [
  { key: "running",    label: "Course",     color: "#f97316" },
  { key: "cycling",    label: "Vélo",       color: "#3b82f6" },
  { key: "swimming",   label: "Natation",   color: "#06b6d4" },
  { key: "walking",    label: "Marche",     color: "#22c55e" },
  { key: "hiking",     label: "Randonnée",  color: "#a3a3a3" },
  { key: "rowing",     label: "Aviron",     color: "#8b5cf6" },
  { key: "elliptical", label: "Elliptique", color: "#ec4899" },
  { key: "other",      label: "Autre",      color: "#6b7280" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCardioInfo(type: string) {
  return CARDIO_TYPES.find(t => t.key === type) ?? CARDIO_TYPES[CARDIO_TYPES.length - 1]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

function fmtDuration(sec: number | null) {
  if (!sec) return null
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h > 0) return s > 0 ? `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s` : `${h}h${m.toString().padStart(2, "0")}`
  return s > 0 ? `${m}min${s}s` : `${m}min`
}

function fmtDist(m: number | null) {
  if (!m) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtPace(s: number | null) {
  if (!s) return null
  return `${Math.floor(s / 60)}'${(s % 60).toString().padStart(2, "0")}"/km`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CardioIcon({ type, size = 20 }: { type: string; size?: number }) {
  const s = size
  if (type === "running") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 4a1 1 0 100-2 1 1 0 000 2zM7 8l3 2-2 5h5l2-5 2.5 1M6 20l2.5-5M15 20l-1.5-5" />
    </svg>
  )
  if (type === "cycling") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17l-2-5 3-2 2 4h4M14 5a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>
  )
  if (type === "swimming") return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
      <circle cx="12" cy="6" r="2"/><path strokeLinecap="round" d="M12 8v4"/>
    </svg>
  )
  return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [activity, setActivity] = useState<Activity | null>(null)
  const [ready, setReady] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [cType, setCType] = useState("running")
  const [cDate, setCDate] = useState("")
  const [cDurH, setCDurH] = useState("")
  const [cDurM, setCDurM] = useState("")
  const [cDurS, setCDurS] = useState("")
  const [cDist, setCDist] = useState("")
  const [cElev, setCElev] = useState("")
  const [cHR, setCHR] = useState("")
  const [cCal, setCCal] = useState("")
  const [cNotes, setCNotes] = useState("")

  useEffect(() => {
    authFetch(`/api/activities/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/app/activities"); return }
        setActivity(d)
        loadFormFromActivity(d)
        setReady(true)
      })
      .catch(() => router.push("/app/activities"))
  }, [id, router])

  function loadFormFromActivity(act: Activity) {
    setCType(act.type)
    setCDate(act.date.slice(0, 10))
    const h = act.durationSec ? Math.floor(act.durationSec / 3600) : 0
    const m = act.durationSec ? Math.floor((act.durationSec % 3600) / 60) : 0
    const s = act.durationSec ? act.durationSec % 60 : 0
    setCDurH(h > 0 ? String(h) : "")
    setCDurM(m > 0 ? String(m) : "")
    setCDurS(s > 0 ? String(s) : "")
    setCDist(act.distanceM ? String((act.distanceM / 1000).toFixed(2)).replace(/\.?0+$/, "") : "")
    setCElev(act.elevationM ? String(act.elevationM) : "")
    setCHR(act.avgHeartRate ? String(act.avgHeartRate) : "")
    setCCal(act.calories ? String(act.calories) : "")
    setCNotes(act.notes ?? "")
  }

  function cancelEdit() {
    if (activity) loadFormFromActivity(activity)
    setEditMode(false)
  }

  async function handleSave() {
    if (!activity) return
    setSaving(true)
    const autoName = CARDIO_TYPES.find(t => t.key === cType)?.label ?? cType
    const durationSec = cDurH || cDurM || cDurS
      ? parseInt(cDurH || "0") * 3600 + parseInt(cDurM || "0") * 60 + parseInt(cDurS || "0")
      : null
    const distanceM = cDist ? parseFloat(cDist) * 1000 : null

    const r = await authFetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: cType, name: autoName, date: cDate, durationSec, distanceM,
        elevationM: cElev ? parseFloat(cElev) : null,
        avgHeartRate: cHR ? parseInt(cHR) : null,
        calories: cCal ? parseInt(cCal) : null,
        notes: cNotes || null,
      }),
    })
    if (r.ok) {
      const updated = await r.json()
      setActivity(updated)
      setEditMode(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await authFetch(`/api/activities/${id}`, { method: "DELETE" })
    router.push("/app/activities")
  }

  if (!ready) return <LoadingScreen />
  if (!activity) return null

  const info = getCardioInfo(activity.type)

  return (
    <div className="min-h-screen bg-gray-950 text-white">

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
          <p className="text-sm font-extrabold text-white truncate">{info.label}</p>
          <p className="text-xs text-gray-500 font-medium">{fmtDate(activity.date)}</p>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">

        {/* ── READ MODE ── */}
        {!editMode && (
          <div className="flex flex-col gap-4 py-4 px-4">

            {/* Icon + type hero */}
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: info.color + "22" }}>
                <span style={{ color: info.color }}>
                  <CardioIcon type={activity.type} size={36} />
                </span>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: info.color }}>{info.label}</p>
              <p className="text-sm text-gray-500">{fmtDate(activity.date)}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {activity.durationSec && (
                <StatCard label="Durée" value={fmtDuration(activity.durationSec)!} icon="⏱" />
              )}
              {activity.distanceM && (
                <StatCard label="Distance" value={fmtDist(activity.distanceM)!} icon="📍" />
              )}
              {activity.avgPaceSecKm && (
                <StatCard label="Allure moy." value={fmtPace(activity.avgPaceSecKm)!} icon="⚡" />
              )}
              {!activity.avgPaceSecKm && activity.avgSpeedKmh && (
                <StatCard label="Vitesse moy." value={`${activity.avgSpeedKmh.toFixed(1)} km/h`} icon="💨" />
              )}
              {activity.avgHeartRate && (
                <StatCard label="FC moyenne" value={`${activity.avgHeartRate} bpm`} icon="❤️" />
              )}
              {activity.calories && (
                <StatCard label="Calories" value={`${activity.calories} kcal`} icon="🔥" />
              )}
              {activity.elevationM && (
                <StatCard label="Dénivelé" value={`${activity.elevationM} m`} icon="⛰" />
              )}
            </div>

            {/* Notes */}
            {activity.notes && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-gray-300 leading-relaxed">{activity.notes}</p>
              </div>
            )}

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-2 w-full py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Supprimer cette activité
            </button>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {editMode && (
          <div className="py-4 px-4 flex flex-col gap-4">

            {/* Type selector */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Type d&apos;activité</p>
              <div className="overflow-x-auto">
                <div className="flex gap-2 w-max pb-1">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.key} onClick={() => setCType(t.key)}
                      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all"
                      style={cType === t.key
                        ? { backgroundColor: t.color + "22", borderColor: t.color + "66", color: t.color }
                        : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "#6b7280" }}>
                      <CardioIcon type={t.key} size={18} />
                      <span className="text-[10px] font-bold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Date</label>
              <input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"/>
            </div>

            {/* Distance + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Distance (km)</label>
                <input type="number" min="0" step="0.1" value={cDist} onChange={e => setCDist(e.target.value)} placeholder="ex: 5.2"
                  className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none"/>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Durée</label>
                <div className="flex gap-1 mt-1">
                  <input type="number" min="0" value={cDurH} onChange={e => setCDurH(e.target.value)} placeholder="0h"
                    className="w-1/3 bg-white/[0.06] border border-white/10 rounded-xl px-1 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                  <input type="number" min="0" max="59" value={cDurM} onChange={e => setCDurM(e.target.value)} placeholder="min"
                    className="w-1/3 bg-white/[0.06] border border-white/10 rounded-xl px-1 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                  <input type="number" min="0" max="59" value={cDurS} onChange={e => setCDurS(e.target.value)} placeholder="sec"
                    className="w-1/3 bg-white/[0.06] border border-white/10 rounded-xl px-1 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                </div>
              </div>
            </div>

            {/* Other stats */}
            <div className="grid grid-cols-3 gap-2">
              {(cType === "running" || cType === "cycling" || cType === "hiking") && (
                <div>
                  <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Dénivelé (m)</label>
                  <input type="number" min="0" value={cElev} onChange={e => setCElev(e.target.value)} placeholder="—"
                    className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
                </div>
              )}
              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">FC moy</label>
                <input type="number" min="0" value={cHR} onChange={e => setCHR(e.target.value)} placeholder="bpm"
                  className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wide ml-1">Calories</label>
                <input type="number" min="0" value={cCal} onChange={e => setCCal(e.target.value)} placeholder="kcal"
                  className="w-full mt-1 bg-white/[0.06] border border-white/10 rounded-xl px-2 py-3 text-sm text-white placeholder-gray-600 outline-none text-center"/>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Notes</label>
              <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Notes (optionnel)" rows={3}
                className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none resize-none"/>
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
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-gray-800 border border-white/15 rounded-2xl text-sm font-bold text-white shadow-2xl shadow-black/60 hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-violet-600 border border-violet-500/40 rounded-2xl text-sm font-bold text-white shadow-2xl shadow-black/60 hover:bg-violet-500 transition-colors disabled:opacity-50"
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

      {/* Delete confirm sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="px-5 pb-8 pt-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">Supprimer cette activité ?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-[2] py-3 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                  {deleting ? "..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-extrabold text-white">{value}</p>
    </div>
  )
}
