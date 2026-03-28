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

  useEffect(() => {
    authFetch(`/api/activities/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/app/activities"); return }
        setActivity(d)
        setReady(true)
      })
      .catch(() => router.push("/app/activities"))
  }, [id, router])

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
          </div>
        </div>
      </div>

      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">

        {/* Stats card */}
        {(activity.durationSec || activity.distanceM || activity.avgPaceSecKm || activity.avgSpeedKmh || activity.avgHeartRate || activity.calories || activity.elevationM) && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mx-3 mt-5">
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

        {/* Notes */}
        {activity.notes && (
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mx-3 mt-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
            <p className="text-sm text-gray-600 leading-relaxed">{activity.notes}</p>
          </div>
        )}

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
