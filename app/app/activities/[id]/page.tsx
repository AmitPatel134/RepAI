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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [activity, setActivity] = useState<Activity | null>(null)
  const [ready, setReady] = useState(false)

  // Edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [eName, setEName] = useState("")
  const [eDate, setEDate] = useState("")
  const [eDurH, setEDurH] = useState("")
  const [eDurM, setEDurM] = useState("")
  const [eDurS, setEDurS] = useState("")
  const [eDist, setEDist] = useState("")
  const [eElev, setEElev] = useState("")
  const [eHR, setEHR] = useState("")
  const [eCal, setECal] = useState("")
  const [eNotes, setENotes] = useState("")
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    authFetch(`/api/activities/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/app/activities"); return }
        setActivity(d)
        setENotes(d.notes ?? "")
        setReady(true)
      })
      .catch(() => router.push("/app/activities"))
  }, [id, router])

  function openEdit() {
    if (!activity) return
    const dur = activity.durationSec ?? 0
    setEName(activity.name)
    setEDate(activity.date.slice(0, 10))
    setEDurH(dur >= 3600 ? String(Math.floor(dur / 3600)) : "")
    setEDurM(String(Math.floor((dur % 3600) / 60)))
    setEDurS(dur % 60 ? String(dur % 60) : "")
    setEDist(activity.distanceM ? String(activity.distanceM) : "")
    setEElev(activity.elevationM ? String(activity.elevationM) : "")
    setEHR(activity.avgHeartRate ? String(activity.avgHeartRate) : "")
    setECal(activity.calories ? String(activity.calories) : "")
    setENotes(activity.notes ?? "")
    setShowEdit(true)
  }

  async function handleSave() {
    if (!activity) return
    setSaving(true)
    const durationSec =
      (parseInt(eDurH) || 0) * 3600 +
      (parseInt(eDurM) || 0) * 60 +
      (parseInt(eDurS) || 0)
    try {
      const r = await authFetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activity.type,
          name: eName || activity.name,
          date: eDate || activity.date,
          durationSec: durationSec || null,
          distanceM: eDist ? Number(eDist) : null,
          elevationM: eElev ? Number(eElev) : null,
          avgHeartRate: eHR ? Number(eHR) : null,
          calories: eCal ? Number(eCal) : null,
          notes: eNotes || null,
        }),
      })
      if (r.ok) {
        const updated = await r.json()
        setActivity(updated)
        invalidateCache("/api/activities")
      }
    } finally {
      setSaving(false)
      setShowEdit(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await authFetch(`/api/activities/${id}`, { method: "DELETE" })
      invalidateCache("/api/activities")
      router.push("/app/activities")
    } finally {
      setDeleting(false)
    }
  }

  if (!ready) return <LoadingScreen color="#2563eb" />
  if (!activity) return null

  const info = getCardioInfo(activity.type)

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-enter bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-base font-extrabold text-gray-900 mb-2 text-center">Supprimer cette activité ?</p>
            <p className="text-sm text-gray-400 text-center mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 bg-red-500 rounded-2xl text-sm font-bold text-white disabled:opacity-50">
                {deleting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit bottom sheet */}
      {showEdit && (
        <div data-modal="" className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowEdit(false)}>
          <div className="sheet-enter bg-white rounded-t-3xl w-full px-5 pt-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-sm font-extrabold text-gray-900 mb-4">Modifier l&apos;activité</p>

            <div className="flex flex-col gap-3">
              {activity.type === "custom" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: info.color }}>Nom</label>
                  <input type="text" value={eName} onChange={e => setEName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 outline-none focus:border-orange-400 transition-colors" />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: info.color }}>Date</label>
                <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 transition-colors" />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: info.color }}>Durée</label>
                <div className="flex gap-2">
                  {[
                    { val: eDurH, set: setEDurH, unit: "h", placeholder: "0" },
                    { val: eDurM, set: setEDurM, unit: "min", placeholder: "0" },
                    { val: eDurS, set: setEDurS, unit: "s", placeholder: "0" },
                  ].map(f => (
                    <div key={f.unit} className="flex-1 relative">
                      <input type="number" inputMode="numeric" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} min={0}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 pr-7 text-sm font-medium text-gray-900 outline-none focus:border-orange-400 text-center transition-colors" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">{f.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {activity.type !== "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Distance", val: eDist, set: setEDist, unit: "m", placeholder: "ex: 5000" },
                    { label: "Dénivelé", val: eElev, set: setEElev, unit: "m", placeholder: "ex: 150" },
                    { label: "FC moy.", val: eHR, set: setEHR, unit: "bpm", placeholder: "ex: 145" },
                    { label: "Calories", val: eCal, set: setECal, unit: "kcal", placeholder: "ex: 400" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: info.color }}>{f.label}</label>
                      <div className="relative">
                        <input type="number" inputMode="numeric" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} min={0}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-medium text-gray-900 outline-none focus:border-orange-400 transition-colors" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{f.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: info.color }}>Notes</label>
                <textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} placeholder="Commentaire..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none resize-none focus:border-orange-400 transition-colors" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowEdit(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: info.color }}>
                {saving ? "..." : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating header */}
      <div className="sticky top-3 z-40 px-3 pt-3">
        <div
          className="rounded-2xl shadow-lg px-4 pt-3.5 pb-3.5 backdrop-blur-xl"
          style={{ backgroundColor: info.color + "dd", boxShadow: `0 8px 24px ${info.color}33` }}
        >
          <div className="flex items-center gap-2">
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
            <button onClick={() => setShowDeleteConfirm(true)} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 hover:bg-red-500/60 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={openEdit} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/30 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 pt-4">

        {/* Stats card */}
        {(activity.durationSec || activity.distanceM || activity.avgPaceSecKm || activity.avgSpeedKmh || activity.avgHeartRate || activity.calories || activity.elevationM) && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mx-3 mt-3">
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

        {/* Date */}
        <div className="bg-white border border-gray-200 rounded-2xl mx-3 mt-2.5 px-4 py-3 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-semibold text-gray-900 capitalize">{fmtDate(activity.date)}</p>
        </div>

        {/* Notes — always editable */}
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mx-3 mt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: info.color }}>Notes</p>
            {notesSaving && <span className="text-[10px] text-gray-400">Enregistrement…</span>}
            {!notesSaving && notesSaved && <span className="text-[10px] text-green-500 font-semibold">✓ Enregistré</span>}
          </div>
          <textarea
            value={eNotes}
            onChange={e => { setENotes(e.target.value); setNotesSaved(false) }}
            onBlur={async () => {
              if (eNotes === (activity.notes ?? "")) return
              setNotesSaving(true)
              try {
                const r = await authFetch(`/api/activities/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ notes: eNotes || null }),
                })
                if (r.ok) {
                  const updated = await r.json()
                  setActivity(updated)
                  invalidateCache("/api/activities")
                  setNotesSaved(true)
                  setTimeout(() => setNotesSaved(false), 3000)
                }
              } catch (e) {
                console.error("[notes save]", e)
              } finally {
                setNotesSaving(false)
              }
            }}
            rows={3}
            placeholder="Ajouter une note..."
            className="w-full bg-transparent text-sm text-gray-700 leading-relaxed outline-none resize-none placeholder:text-gray-300"
          />
        </div>

      </div>

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
