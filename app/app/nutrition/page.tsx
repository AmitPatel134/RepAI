"use client"
import React, { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"

// ─── Types ────────────────────────────────────────────────────────────────────

type Meal = {
  id: string
  name: string
  date: string
  calories: number | null
  proteins: number | null
  carbs: number | null
  fats: number | null
  fiber: number | null
  notes: string | null
}

type AnalysisResult = {
  name: string
  calories: number | null
  proteins: number | null
  carbs: number | null
  fats: number | null
  fiber: number | null
  notes: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

function resizeImage(file: File, maxPx = 900, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
      <span className="text-lg font-black text-white">{value != null ? Math.round(value) : "—"}</span>
      <span className="text-[10px] text-gray-500">{unit}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  // Accordion state
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())

  // Image analysis flow
  const [analyzing, setAnalyzing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [editName, setEditName] = useState("")
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit mode (long press select + delete)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpFired = useRef(false)
  const lpMoved = useRef(false)
  const lpStartX = useRef(0)
  const lpStartY = useRef(0)

  // Sheet drag
  const sheetDragY = useRef<number | null>(null)

  // Saving
  const [saving, setSaving] = useState(false)
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        setLoading(false)
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        setOpenMonths(new Set([label]))
        return
      }
      authFetch("/api/nutrition").then(r => r.json()).then(data => {
        setMeals(Array.isArray(data) ? data : [])
        const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        setOpenMonths(new Set([label]))
      }).catch(() => {}).finally(() => setLoading(false))
    })
  }, [])

  // ─── Grouping ──────────────────────────────────────────────────────────────

  const currentYear = String(new Date().getFullYear())
  type MonthGroup = { label: string; items: Meal[] }
  type YearGroup = { year: string; months: MonthGroup[] }
  const yearGroups: YearGroup[] = []
  for (const meal of meals) {
    const year = String(new Date(meal.date).getFullYear())
    const label = new Date(meal.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    let yg = yearGroups.find(g => g.year === year)
    if (!yg) { yg = { year, months: [] }; yearGroups.push(yg) }
    const last = yg.months[yg.months.length - 1]
    if (last?.label === label) last.items.push(meal)
    else yg.months.push({ label, items: [meal] })
  }

  function toggleMonth(label: string) {
    setOpenMonths(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })
  }
  function toggleYear(year: string) {
    setOpenYears(prev => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n })
  }

  // Today's totals
  const today = new Date().toISOString().slice(0, 10)
  const todayMeals = meals.filter(m => m.date.slice(0, 10) === today)
  const todayCal = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0)
  const todayProt = todayMeals.reduce((s, m) => s + (m.proteins ?? 0), 0)
  const todayCarb = todayMeals.reduce((s, m) => s + (m.carbs ?? 0), 0)
  const todayFat = todayMeals.reduce((s, m) => s + (m.fats ?? 0), 0)

  // ─── Photo import & analysis ───────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setAnalyzeError(null)
    setAnalyzing(true)
    try {
      const base64 = await resizeImage(file)
      setPreviewUrl(base64)
      const r = await authFetch("/api/nutrition/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await r.json()
      if (!r.ok) { setAnalyzeError(data.error ?? "Erreur d'analyse"); setAnalyzing(false); return }
      setAnalysisResult(data)
      setEditName(data.name ?? "")
      setMealDate(new Date().toISOString().slice(0, 10))
    } catch {
      setAnalyzeError("Erreur réseau")
    }
    setAnalyzing(false)
  }

  function closeAnalysis() {
    setPreviewUrl(null)
    setAnalysisResult(null)
    setEditName("")
    setAnalyzeError(null)
  }

  async function handleSaveMeal() {
    if (!analysisResult) return
    setSaving(true)
    const r = await authFetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim() || analysisResult.name,
        date: mealDate,
        calories: analysisResult.calories,
        proteins: analysisResult.proteins,
        carbs: analysisResult.carbs,
        fats: analysisResult.fats,
        fiber: analysisResult.fiber,
        notes: analysisResult.notes,
      }),
    })
    if (r.ok) {
      const meal = await r.json()
      setMeals(prev => [meal, ...prev])
      const label = new Date(meal.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      setOpenMonths(prev => new Set([...prev, label]))
      closeAnalysis()
    }
    setSaving(false)
  }

  // ─── Edit mode ─────────────────────────────────────────────────────────────

  function enterEditMode(id: string) {
    setEditMode(true)
    setSelectedIds(new Set([id]))
  }
  function exitEditMode() {
    setEditMode(false)
    setSelectedIds(new Set())
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      if (n.size === 0) setEditMode(false)
      return n
    })
  }

  function onItemTouchStart(e: React.TouchEvent, id: string) {
    if (editMode) return
    lpFired.current = false; lpMoved.current = false
    lpStartX.current = e.touches[0].clientX; lpStartY.current = e.touches[0].clientY
    lpTimer.current = setTimeout(() => { lpFired.current = true; enterEditMode(id) }, 500)
  }
  function onItemTouchMove(e: React.TouchEvent) {
    if (editMode) return
    if (Math.abs(e.touches[0].clientX - lpStartX.current) > 8 || Math.abs(e.touches[0].clientY - lpStartY.current) > 8) {
      lpMoved.current = true
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
    }
  }
  function onItemTouchEnd() {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
  }
  function onItemClick(id: string) {
    if (lpFired.current) { lpFired.current = false; return }
    if (editMode) toggleSelect(id)
  }

  async function handleDeleteSelected() {
    setDeleting(true)
    for (const id of selectedIds) {
      await authFetch(`/api/nutrition/${id}`, { method: "DELETE" })
      setMeals(prev => prev.filter(m => m.id !== id))
    }
    setDeleting(false)
    exitEditMode()
  }

  // Sheet drag
  function onSheetHandleTouchStart(e: React.TouchEvent) { sheetDragY.current = e.touches[0].clientY }
  function onSheetHandleTouchEnd(e: React.TouchEvent, close: () => void) {
    if (sheetDragY.current !== null) {
      if (e.changedTouches[0].clientY - sheetDragY.current > 60) close()
      sheetDragY.current = null
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full">Se connecter</a>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                {editMode ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : "Suivi alimentaire"}
              </p>
              <h1 className="text-2xl font-extrabold text-white">{editMode ? "Modifier" : "Nutrition"}</h1>
            </div>
            {editMode ? (
              <button onClick={exitEditMode} className="text-sm font-bold text-gray-400 hover:text-white transition-colors px-3 py-2">
                Annuler
              </button>
            ) : (
              <button
                onClick={() => {
                  if (isDemo) return
                  fileInputRef.current?.click()
                }}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Analyser un repas</span>
              </button>
            )}
          </div>

          {/* Today summary */}
          {!editMode && todayCal > 0 && (
            <div className="mt-3 flex items-center gap-4 py-2 px-3 bg-white/[0.04] border border-white/[0.07] rounded-xl">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span className="text-xs font-black text-white">{todayCal} kcal</span>
              </div>
              <span className="text-[11px] text-gray-500 font-bold">P: {Math.round(todayProt)}g</span>
              <span className="text-[11px] text-gray-500 font-bold">G: {Math.round(todayCarb)}g</span>
              <span className="text-[11px] text-gray-500 font-bold">L: {Math.round(todayFat)}g</span>
              <span className="text-[10px] text-gray-600 ml-auto">Aujourd&apos;hui</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* List */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        {meals.length === 0 ? (
          <div className="text-center py-20 px-4">
            <p className="text-4xl mb-4">🥗</p>
            <p className="text-gray-400 font-semibold mb-2">Aucun repas enregistré</p>
            <p className="text-gray-600 text-sm mb-6">Prenez en photo votre assiette pour analyser ses calories et macros</p>
            <button
              onClick={() => !isDemo && fileInputRef.current?.click()}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Analyser un repas
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {yearGroups.map(yg => {
              const isCurrentYear = yg.year === currentYear
              const isYearOpen = openYears.has(yg.year)
              const totalCal = yg.months.reduce((s, m) => s + m.items.reduce((ss, i) => ss + (i.calories ?? 0), 0), 0)

              const monthBlocks = yg.months.map(group => {
                const isOpen = openMonths.has(group.label)
                const monthCal = group.items.reduce((s, i) => s + (i.calories ?? 0), 0)
                return (
                  <div key={group.label} className="border-b border-white/10">
                    <button
                      onClick={() => !editMode && toggleMonth(group.label)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] border-t border-white/10 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <p className="text-sm font-extrabold text-white capitalize">{group.label}</p>
                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                          {group.items.length} repas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {monthCal > 0 && <span className="text-[11px] font-bold text-orange-400">{Math.round(monthCal)} kcal</span>}
                        {!editMode && (
                          <svg className="w-4 h-4 text-gray-500 transition-transform duration-300"
                            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    <div style={{ display: "grid", gridTemplateRows: (isOpen || editMode) ? "1fr" : "0fr", transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                      <div style={{ overflow: "hidden" }}>
                        <div className="divide-y divide-white/[0.07]">
                          {group.items.map(meal => {
                            const isSelected = selectedIds.has(meal.id)
                            return (
                              <div
                                key={meal.id}
                                className={`flex items-center gap-3 py-3 px-4 md:px-6 cursor-pointer transition-colors select-none ${
                                  isSelected ? "bg-violet-500/10" : "hover:bg-white/[0.03]"
                                } ${editMode && !isSelected ? "opacity-50" : ""}`}
                                onTouchStart={e => onItemTouchStart(e, meal.id)}
                                onTouchMove={onItemTouchMove}
                                onTouchEnd={onItemTouchEnd}
                                onClick={() => onItemClick(meal.id)}
                              >
                                {editMode && (
                                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                    isSelected ? "bg-violet-600 border-violet-600" : "border-gray-600"
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0 text-orange-400">
                                  <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{meal.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {meal.calories != null && <span className="text-[11px] font-bold text-orange-400">{meal.calories} kcal</span>}
                                    {meal.proteins != null && <span className="text-[11px] text-gray-500">P: {Math.round(meal.proteins)}g</span>}
                                    {meal.carbs != null && <span className="text-[11px] text-gray-500">G: {Math.round(meal.carbs)}g</span>}
                                    {meal.fats != null && <span className="text-[11px] text-gray-500">L: {Math.round(meal.fats)}g</span>}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 shrink-0">{fmtDate(meal.date)}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })

              if (isCurrentYear) {
                return <React.Fragment key={yg.year}>{monthBlocks}</React.Fragment>
              }

              return (
                <div key={yg.year}>
                  <button
                    onClick={() => toggleYear(yg.year)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.06] border-t border-white/10 hover:bg-white/[0.09] transition-colors"
                  >
                    <p className="text-base font-black text-white">{yg.year}</p>
                    <div className="flex items-center gap-2">
                      {totalCal > 0 && <span className="text-xs font-bold text-orange-400">{Math.round(totalCal)} kcal total</span>}
                      <svg className="w-4 h-4 text-gray-500 transition-transform duration-300"
                        style={{ transform: isYearOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  <div style={{ display: "grid", gridTemplateRows: isYearOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={{ overflow: "hidden" }}>{monthBlocks}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Floating edit bar ── */}
      {editMode && selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
        >
          <div className="w-full max-w-sm bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-3 flex items-center gap-2">
            <button onClick={exitEditMode} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="flex-[2] py-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {deleting ? "..." : `Supprimer (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* ── Analyzing overlay ── */}
      {analyzing && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-violet-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Analyse en cours…</p>
            <p className="text-gray-500 text-sm">L&apos;IA analyse les valeurs nutritionnelles</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Analysis result sheet ── */}
      {!analyzing && analysisResult && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={closeAnalysis}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab"
              onTouchStart={onSheetHandleTouchStart}
              onTouchEnd={e => onSheetHandleTouchEnd(e, closeAnalysis)}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-8 pt-2">
              {/* Preview */}
              {previewUrl && (
                <div className="w-full h-44 rounded-2xl overflow-hidden mb-4 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Repas" className="w-full h-full object-cover" />
                </div>
              )}

              <h3 className="text-base font-black text-white mb-4">Résultat de l&apos;analyse</h3>

              {/* Editable name */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Nom du repas</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50"
                />
              </div>

              {/* Date */}
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Date</label>
                <input
                  type="date"
                  value={mealDate}
                  onChange={e => setMealDate(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
                />
              </div>

              {/* Macros */}
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 mb-4">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <MacroBar label="Calories" value={analysisResult.calories} unit="kcal" color="#f97316" />
                  <MacroBar label="Protéines" value={analysisResult.proteins} unit="g" color="#3b82f6" />
                  <MacroBar label="Glucides" value={analysisResult.carbs} unit="g" color="#22c55e" />
                  <MacroBar label="Lipides" value={analysisResult.fats} unit="g" color="#f59e0b" />
                </div>
                {analysisResult.fiber != null && (
                  <p className="text-[11px] text-gray-500 text-center">Fibres : {Math.round(analysisResult.fiber)}g</p>
                )}
              </div>

              {/* Notes from AI */}
              {analysisResult.notes && (
                <p className="text-xs text-gray-500 italic mb-4 px-1">{analysisResult.notes}</p>
              )}

              <button
                onClick={handleSaveMeal}
                disabled={saving}
                className="w-full py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer ce repas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error sheet ── */}
      {analyzeError && !analyzing && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" onClick={() => setAnalyzeError(null)}>
          <div className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg px-5 py-8 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-red-400 font-bold mb-2">Erreur d&apos;analyse</p>
            <p className="text-gray-400 text-sm mb-5">{analyzeError}</p>
            <button onClick={() => setAnalyzeError(null)} className="px-6 py-2.5 bg-white/10 rounded-xl text-sm font-bold text-white">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
