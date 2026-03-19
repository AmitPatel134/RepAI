interface PlanBannerProps {
  usage: number
  limit: number | null
  label: string
}

export default function PlanBanner({ usage, limit, label }: PlanBannerProps) {
  if (limit === null) return null // Pro — unlimited

  const pct = Math.min((usage / limit) * 100, 100)
  const atLimit = usage >= limit
  const nearLimit = usage >= limit - 1

  return (
    <div className={`rounded-2xl border px-5 py-4 mb-6 flex items-center justify-between gap-4 ${atLimit ? "bg-red-50 border-red-200" : nearLimit ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-bold ${atLimit ? "text-red-600" : nearLimit ? "text-amber-600" : "text-gray-500"}`}>
            {label} — {usage} / {limit} used
          </span>
          {atLimit && <span className="text-xs font-bold text-red-600">Limit reached</span>}
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : nearLimit ? "bg-amber-400" : "bg-violet-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {atLimit && (
        <a
          href="/pricing"
          className="shrink-0 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-violet-700 transition-colors whitespace-nowrap"
        >
          Upgrade to Pro →
        </a>
      )}
    </div>
  )
}
