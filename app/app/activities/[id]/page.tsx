"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { authFetch } from "@/lib/authFetch"
import { invalidateCache } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"

// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string; type: string; name: string; date: string
  durationSec: number | null; distanceM: number | null; elevationM: number | null
  avgHeartRate: number | null; calories: number | null
  avgSpeedKmh: number | null; avgPaceSecKm: number | null; notes: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDIO_COLOR = "#f97316"
const CUSTOM_COLOR  = "#16a34a"

const CARDIO_TYPES = [
  { key: "running",    label: "Course",     color: CARDIO_COLOR },
  { key: "cycling",    label: "Vélo",       color: CARDIO_COLOR },
  { key: "swimming",   label: "Natation",   color: CARDIO_COLOR },
  { key: "walking",    label: "Marche",     color: CARDIO_COLOR },
  { key: "hiking",     label: "Randonnée",  color: CARDIO_COLOR },
  { key: "rowing",     label: "Aviron",     color: CARDIO_COLOR },
  { key: "elliptical", label: "Elliptique", color: CARDIO_COLOR },
  { key: "other",      label: "Autre",      color: CARDIO_COLOR },
  { key: "custom",     label: "Autre",      color: CUSTOM_COLOR },
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
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [pendingDate, setPendingDate] = useState("")

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
      invalidateCache("/api/activities")
      setEditMode(false)
    }
    setSaving(false)
  }

  async function handleSaveDate() {
    if (!pendingDate || pendingDate === activity?.date.slice(0, 10)) {
      setDatePickerOpen(false)
      return
    }
    setSavingDate(true)
    const r = await authFetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: pendingDate }),
    })
    if (r.ok) {
      const updated = await r.json()
      setActivity(updated)
      loadFormFromActivity(updated)
    }
    setSavingDate(false)
    setDatePickerOpen(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await authFetch(`/api/activities/${id}`, { method: "DELETE" })
    invalidateCache("/api/activities")
    router.push("/app/activities")
  }

  if (!ready) return <LoadingScreen color="#2563eb" />
  if (!activity) return null

  const info = getCardioInfo(activity.type)

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {/* Floating header */}
      <div className="sticky top-3 z-40 px-3 pt-3">
        <div
          className="rounded-2xl shadow-lg px-4 pt-3.5 pb-3.5 backdrop-blur-xl"
          style={{ backgroundColor: info.color + "dd", boxShadow: `0 8px 24px ${info.color}33` }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/app/activities")}
              className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white/60 leading-none mb-0.5 capitalize">{fmtDate(activity.date)}</p>
              <h1 className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold text-white tracking-wide leading-tight truncate">
                {activity.type === "custom" ? activity.name : info.label}
              </h1>
            </div>
            <button
              onClick={() => setEditMode(true)}
              className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">

        {/* ── READ MODE ── */}
        {!editMode && (
          <div className="flex flex-col gap-2.5 pt-5 px-3">

            {/* Stats card */}
            {(activity.durationSec || activity.distanceM || activity.avgPaceSecKm || activity.avgSpeedKmh || activity.avgHeartRate || activity.calories || activity.elevationM) && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  {activity.durationSec && <StatItem label="Durée" value={fmtDuration(activity.durationSec)!} color={info.color} />}
                  {activity.distanceM && <StatItem label="Distance" value={fmtDist(activity.distanceM)!} color={info.color} />}
                  {activity.avgPaceSecKm
                    ? <StatItem label="Allure" value={fmtPace(activity.avgPaceSecKm)!} color={info.color} />
                    : activity.avgSpeedKmh
                      ? <StatItem label="Vitesse" value={`${activity.avgSpeedKmh.toFixed(1)} km/h`} color={info.color} />
                      : <div />}
                </div>
                {(activity.avgHeartRate || activity.calories || activity.elevationM) && (
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                    {activity.avgHeartRate ? <StatItem label="FC moy." value={`${activity.avgHeartRate} bpm`} color={info.color} /> : <div />}
                    {activity.calories ? <StatItem label="Calories" value={`${activity.calories} kcal`} color={info.color} /> : <div />}
                    {activity.elevationM ? <StatItem label="Dénivelé" value={`+${activity.elevationM} m`} color={info.color} /> : <div />}
                  </div>
                )}
              </div>
            )}

            {/* Date — inline editable */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => { setPendingDate(activity.date.slice(0, 10)); setDatePickerOpen(v => !v) }}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{fmtDate(activity.date)}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-300 transition-transform duration-200" style={{ transform: datePickerOpen ? "rotate(180deg)" : "rotate(0)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div style={{ maxHeight: datePickerOpen ? "100px" : "0px", opacity: datePickerOpen ? 1 : 0, overflow: "hidden", transition: "max-height 0.28s ease, opacity 0.18s ease" }}>
                <div className="px-4 pb-3 flex gap-2 border-t border-gray-100">
                  <input type="date" value={pendingDate} onChange={e => setPendingDate(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none" />
                  <button onClick={() => setDatePickerOpen(false)}
                    className="px-3 py-2 text-xs font-bold text-gray-400 border border-gray-200 rounded-xl">✕</button>
                  <button onClick={handleSaveDate} disabled={savingDate}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: info.color }}>
                    {savingDate ? "…" : "OK"}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            {activity.notes && (
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
                <p className="text-sm text-gray-600 leading-relaxed">{activity.notes}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── EDIT MODAL ── */}
      {editMode && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={cancelEdit}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto modal-enter" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <p className="text-base font-extrabold text-gray-900">Modifier l&apos;activité</p>
              <button onClick={cancelEdit} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Type selector */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Type d&apos;activité</p>
                <div className="overflow-x-auto">
                  <div className="flex gap-2 w-max pb-1">
                    {CARDIO_TYPES.map(t => (
                      <button key={t.key} onClick={() => setCType(t.key)}
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all"
                        style={cType === t.key
                          ? { backgroundColor: t.color + "15", borderColor: t.color + "66", color: t.color }
                          : { backgroundColor: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }}>
                        <CardioIcon type={t.key} size={18} />
                        <span className="text-[10px] font-bold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Date</label>
                <input type="date" value={cDate} onChange={e => setCDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-violet-400 transition-colors"/>
              </div>

              {/* Distance + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Distance (km)</label>
                  <input type="number" min="0" step="0.1" value={cDist} onChange={e => setCDist(e.target.value)} placeholder="ex: 5.2"
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-violet-400 transition-colors"/>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Durée</label>
                  <div className="flex gap-1 mt-1">
                    <input type="number" min="0" value={cDurH} onChange={e => setCDurH(e.target.value)} placeholder="0h"
                      className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                    <input type="number" min="0" max="59" value={cDurM} onChange={e => setCDurM(e.target.value)} placeholder="min"
                      className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                    <input type="number" min="0" max="59" value={cDurS} onChange={e => setCDurS(e.target.value)} placeholder="sec"
                      className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-1 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                  </div>
                </div>
              </div>

              {/* Other stats */}
              <div className="grid grid-cols-3 gap-2">
                {(cType === "running" || cType === "cycling" || cType === "hiking") && (
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Dénivelé (m)</label>
                    <input type="number" min="0" value={cElev} onChange={e => setCElev(e.target.value)} placeholder="—"
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                  </div>
                )}
                <div>
                  <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">FC moy</label>
                  <input type="number" min="0" value={cHR} onChange={e => setCHR(e.target.value)} placeholder="bpm"
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wide ml-1">Calories</label>
                  <input type="number" min="0" value={cCal} onChange={e => setCCal(e.target.value)} placeholder="kcal"
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none text-center focus:border-violet-400 transition-colors"/>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Notes</label>
                <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Notes (optionnel)" rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none focus:border-violet-400 transition-colors"/>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button onClick={cancelEdit}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-[2] py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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

              {/* Delete — only in edit mode */}
              <button
                onClick={() => { cancelEdit(); setShowDeleteConfirm(true) }}
                className="w-full py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-400 hover:bg-red-100 transition-colors"
              >
                Supprimer cette activité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm modal-enter" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Supprimer cette activité ?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cette action est irréversible.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-[2] py-3 bg-red-50 border border-red-300 rounded-xl text-sm font-bold text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
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

// ─── StatItem ─────────────────────────────────────────────────────────────────

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: color + "cc" }}>{label}</p>
      <p className="text-base font-extrabold text-gray-900 leading-tight tabular-nums">{value}</p>
    </div>
  )
}
