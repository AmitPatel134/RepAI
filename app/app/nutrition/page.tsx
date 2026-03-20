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
  imageThumb: string | null
}

type CompositionResult = {
  name: string
  composition: string
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

function createThumbnail(dataUrl: string, size = 80, quality = 0.5): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext("2d")!
        const s = Math.min(img.width, img.height)
        const ox = (img.width - s) / 2
        const oy = (img.height - s) / 2
        ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL("image/jpeg", quality))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
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
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("format"))
    }
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
  const [analyzingStep, setAnalyzingStep] = useState<"describe" | "calculate" | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compositionResult, setCompositionResult] = useState<CompositionResult | null>(null)
  const [compositionText, setCompositionText] = useState("")
  const [editingComposition, setEditingComposition] = useState(false)
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
    setAnalyzingStep("describe")
    try {
      const base64 = await resizeImage(file)
      setPreviewUrl(base64)
      const r = await authFetch("/api/nutrition/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await r.json()
      if (!r.ok) { setAnalyzeError(data.error ?? "Erreur d'analyse"); setAnalyzingStep(null); return }
      setCompositionResult(data)
      setCompositionText(typeof data.composition === "string" ? data.composition : "")
      setEditName(typeof data.name === "string" ? data.name : "")
    } catch (err) {
      if ((err as Error)?.message === "format") {
        setAnalyzeError("Format non supporté. Utilise une photo JPG ou PNG.")
      } else {
        setAnalyzeError("Erreur réseau")
      }
    }
    setAnalyzingStep(null)
  }

  async function handleCalculate() {
    if (!compositionResult) return
    setAnalyzingStep("calculate")
    try {
      const r = await authFetch("/api/nutrition/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composition: compositionText, name: editName }),
      })
      const data = await r.json()
      if (!r.ok) { setAnalyzeError(data.error ?? "Erreur de calcul"); setAnalyzingStep(null); return }
      // Garantir que toutes les valeurs numériques sont présentes
      setAnalysisResult({
        ...data,
        calories: data.calories ?? 0,
        proteins: data.proteins ?? 0,
        carbs:    data.carbs    ?? 0,
        fats:     data.fats     ?? 0,
        fiber:    data.fiber    ?? 0,
      })
      setMealDate(new Date().toISOString().slice(0, 10))
    } catch {
      setAnalyzeError("Erreur réseau")
    }
    setAnalyzingStep(null)
  }

  function closeAnalysis() {
    setPreviewUrl(null)
    setCompositionResult(null)
    setCompositionText("")
    setEditingComposition(false)
    setAnalysisResult(null)
    setEditName("")
    setAnalyzeError(null)
  }

  async function handleSaveMeal() {
    if (!analysisResult) return
    setSaving(true)
    const imageThumb = previewUrl ? (await createThumbnail(previewUrl)) : null
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
        imageThumb,
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
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
        accept="image/jpeg,image/png,image/webp,image/heic"
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
                                <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-orange-500/15 flex items-center justify-center text-orange-400">
                                  {meal.imageThumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={meal.imageThumb} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                    </svg>
                                  )}
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

      {/* ── Step 1: Analyzing image overlay ── */}
      {analyzingStep === "describe" && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center gap-5 px-6">
          {previewUrl && (
            <div className="w-28 h-28 rounded-2xl overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="w-14 h-14 rounded-full bg-violet-600/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-violet-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Identification des aliments…</p>
            <p className="text-gray-500 text-sm">L&apos;IA analyse le contenu de l&apos;assiette</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Calculating macros overlay ── */}
      {analyzingStep === "calculate" && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-orange-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.504-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.656 4.5 4.77V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.77c0-1.114-.806-2.07-1.907-2.198A48.424 48.424 0 0012 2.25z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Calcul des valeurs nutritionnelles…</p>
            <p className="text-gray-500 text-sm">Calories, protéines, glucides, lipides</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1 result: Composition sheet ── */}
      {!analyzingStep && compositionResult && !analysisResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" onClick={!editingComposition ? closeAnalysis : undefined}>
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab shrink-0"
              onTouchStart={onSheetHandleTouchStart}
              onTouchEnd={e => onSheetHandleTouchEnd(e, closeAnalysis)}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* ── Mode lecture (défaut) ── */}
            {!editingComposition ? (
              <>
                <div className="overflow-y-auto flex-1 px-5 pt-1">
                  {previewUrl && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden mb-4 bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Repas" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <p className="text-lg font-extrabold text-white mb-1">{editName || compositionResult.name}</p>
                  <p className="text-[11px] text-gray-500 mb-4">Quantités estimées visuellement — vérifiez avant de calculer</p>

                  {/* Composition en lecture seule */}
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 mb-2">
                    {compositionText.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} className="text-sm text-gray-200 leading-relaxed py-1 border-b border-white/[0.05] last:border-0">
                        {line.trim()}
                      </p>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-600 italic mb-5 px-1">
                    Cliquez sur &ldquo;Modifier&rdquo; pour corriger ou compléter.
                  </p>
                </div>

                <div className="px-5 pb-8 pt-3 shrink-0 border-t border-white/[0.07] flex flex-col gap-3">
                  {/* Bouton principal */}
                  <button
                    onClick={handleCalculate}
                    disabled={!compositionText.trim()}
                    className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors disabled:opacity-40 shadow-lg shadow-orange-500/20"
                  >
                    Calculer les valeurs nutritionnelles
                  </button>
                  {/* Boutons secondaires */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeAnalysis}
                      className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-500 hover:text-white transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => setEditingComposition(true)}
                      className="flex-1 py-3 border border-white/15 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                      Modifier
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── Mode édition ── */
              <>
                <div className="overflow-y-auto flex-1 px-5 pt-2">
                  <p className="text-sm font-extrabold text-white mb-3">Modifier la composition</p>

                  <div className="mb-3">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Nom du repas</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="ex: Poulet riz légumes"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                      Ingrédients &amp; quantités
                    </label>
                    <textarea
                      autoFocus
                      value={compositionText}
                      onChange={e => setCompositionText(e.target.value)}
                      rows={Math.max(5, (compositionText || "").split("\n").length + 1)}
                      placeholder={"- 150g de poulet grillé\n- 100g de riz basmati\n- 60g de légumes sautés\n..."}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500/50 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="px-5 pb-8 pt-3 shrink-0 border-t border-white/[0.07] flex flex-col gap-3">
                  <button
                    onClick={() => { setEditingComposition(false) }}
                    className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20"
                  >
                    Valider les modifications
                  </button>
                  <button
                    onClick={() => setEditingComposition(false)}
                    className="w-full py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-500 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2 result: Macros sheet ── */}
      {!analyzingStep && analysisResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" onClick={closeAnalysis}>
          <div
            className="bg-gray-900 border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="pb-8">

              {/* Photo pleine largeur — flush en haut, angles arrondis en haut */}
              <div
                className="relative cursor-grab"
                onTouchStart={onSheetHandleTouchStart}
                onTouchEnd={e => onSheetHandleTouchEnd(e, closeAnalysis)}
              >
                {previewUrl && (
                  <div className="w-full overflow-hidden rounded-t-3xl bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Repas" className="w-full object-cover" style={{ maxHeight: "240px" }} />
                  </div>
                )}
                {/* Drag handle superposé sur la photo */}
                <div className="absolute top-2.5 left-0 right-0 flex justify-center pointer-events-none">
                  <div className="w-10 h-1 rounded-full bg-white/40" />
                </div>
              </div>

              {/* Nom + composition sous la photo */}
              <div className="px-5 pt-3 mb-4">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nom du repas"
                  className="w-full bg-transparent text-base font-extrabold text-white placeholder-gray-600 outline-none truncate mb-1.5"
                />
                {compositionText && (
                  <div className="mt-1">
                    {compositionText.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} className="text-[11px] text-gray-500 leading-snug py-1">{line.trim().replace(/~/g, "")}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-white/[0.07] mx-5 mb-2" />

              {/* Calories — big */}
              <div className="text-center mb-6 px-5 pt-2">
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Calories</p>
                <p className="text-6xl font-black text-white leading-none">
                  {analysisResult.calories != null ? Math.round(analysisResult.calories) : "—"}
                  <span className="text-2xl font-bold text-gray-400 ml-2">kcal</span>
                </p>
              </div>

              {/* Macros — ligne colorée + titre + valeur */}
              <div className="grid grid-cols-4 px-5 mb-4">
                {[
                  { label: "Protéines", value: analysisResult.proteins, color: "#3b82f6", daily: 50 },
                  { label: "Glucides",  value: analysisResult.carbs,    color: "#22c55e", daily: 260 },
                  { label: "Lipides",   value: analysisResult.fats,     color: "#f59e0b", daily: 70 },
                  { label: "Fibres",    value: analysisResult.fiber,    color: "#a78bfa", daily: 25 },
                ].map((m, i) => (
                  <div key={m.label} className={`flex flex-col items-center pt-3 ${i > 0 ? "border-l border-white/[0.06]" : ""}`}>
                    <div className="w-8 h-0.5 rounded-full mb-2" style={{ backgroundColor: m.color }} />
                    <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: m.color }}>{m.label}</span>
                    <span className="text-xl font-black text-white leading-none">
                      {m.value != null ? Math.round(m.value) : "—"}
                    </span>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: m.color + "99" }}>
                      /{m.daily}g
                    </span>
                  </div>
                ))}
              </div>


              {/* Actions */}
              <div className="h-4" />
              <div className="px-5">
                <button
                  onClick={handleSaveMeal}
                  disabled={saving}
                  className="w-full py-4 bg-violet-600 rounded-2xl text-base font-extrabold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 shadow-lg shadow-violet-600/20 mb-3"
                >
                  {saving ? "Enregistrement…" : "Enregistrer ce repas"}
                </button>
                <button
                  onClick={() => setAnalysisResult(null)}
                  className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Modifier la composition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error sheet ── */}
      {analyzeError && !analyzingStep && (
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
