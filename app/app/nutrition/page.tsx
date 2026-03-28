"use client"
import React, { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"

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

function cropAndResize(dataUrl: string, size: number, quality: number): Promise<string | null> {
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
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

const createThumbnail = (dataUrl: string) => cropAndResize(dataUrl, 80, 0.5)
const createMediumImage = (dataUrl: string) => cropAndResize(dataUrl, 400, 0.7)

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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("format")) }
    img.src = url
  })
}


// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
      <span className="text-lg font-black text-gray-900">{value != null ? Math.round(value) : "—"}</span>
      <span className="text-[10px] text-gray-400">{unit}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [mealsThisMonth, setMealsThisMonth] = useState(0)

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)

  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null)

  const [analyzingStep, setAnalyzingStep] = useState<"describe" | "calculate" | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compositionResult, setCompositionResult] = useState<CompositionResult | null>(null)
  const [compositionText, setCompositionText] = useState("")
  const [editingComposition, setEditingComposition] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [editName, setEditName] = useState("")
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [isManualEntry, setIsManualEntry] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10))
  const [showMealDeleteConfirm, setShowMealDeleteConfirm] = useState(false)
  const [deletingMeal, setDeletingMeal] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIsDemo(true); setLoading(false); return }

      // Instant display from cache
      const cM = getCached<Meal[]>("/api/nutrition")
      const cP = getCached<{ plan: string; usage?: { mealsThisMonth?: number } }>("/api/plan")
      if (cM) setMeals(cM)
      if (cP) { setPlan(cP.plan ?? "free"); setMealsThisMonth(cP.usage?.mealsThisMonth ?? 0) }
      if (cM && cP) setLoading(false)

      // Refresh in background
      Promise.all([
        authFetch("/api/nutrition").then(r => r.json()).catch(() => []),
        authFetch("/api/plan").then(r => r.json()).catch(() => ({ plan: "free", usage: { mealsThisMonth: 0 } })),
      ]).then(([data, p]) => {
        if (Array.isArray(data)) { setMeals(data); setCached("/api/nutrition", data) }
        setPlan(p?.plan ?? "free")
        setMealsThisMonth(p?.usage?.mealsThisMonth ?? 0)
        setCached("/api/plan", p)
      }).catch(() => {}).finally(() => setLoading(false))
    })
  }, [])

  // ─── Grouping ──────────────────────────────────────────────────────────────

  type DayGroup   = { dayKey: string; dayLabel: string; items: Meal[] }
  type MonthGroup = { label: string; days: DayGroup[] }

  const dataMonths = new Map<string, DayGroup[]>()
  for (const meal of meals) {
    const d = new Date(meal.date)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const dayKey = meal.date.slice(0, 10)
    const dayLabel = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    if (!dataMonths.has(monthKey)) dataMonths.set(monthKey, [])
    const days = dataMonths.get(monthKey)!
    let dg = days.find(d => d.dayKey === dayKey)
    if (!dg) { dg = { dayKey, dayLabel, items: [] }; days.push(dg) }
    dg.items.push(meal)
  }

  const allMonths: MonthGroup[] = []
  const _now = new Date()
  const _oldest = meals.length > 0 ? new Date(meals[meals.length - 1].date) : _now
  let _cur = new Date(_now.getFullYear(), _now.getMonth(), 1)
  const _minBack = new Date(_now.getFullYear(), _now.getMonth() - 11, 1)
  const _oldestStart = new Date(Math.min(
    new Date(_oldest.getFullYear(), _oldest.getMonth(), 1).getTime(),
    _minBack.getTime()
  ))
  while (_cur >= _oldestStart) {
    const monthKey = `${_cur.getFullYear()}-${String(_cur.getMonth() + 1).padStart(2, "0")}`
    const label = _cur.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    allMonths.push({ label, days: dataMonths.get(monthKey) ?? [] })
    _cur = new Date(_cur.getFullYear(), _cur.getMonth() - 1, 1)
  }

  const safeMonthIdx = Math.min(selectedMonthIdx, Math.max(0, allMonths.length - 1))
  const currentMonth = allMonths[safeMonthIdx] ?? null

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
      if (r.status === 429) {
        closeAnalysis()
        setAnalyzeError(data.error ?? "Limite atteinte. Passez Pro pour continuer.")
        setAnalyzingStep(null)
        return
      }
      if (!r.ok) { setAnalyzeError(data.error ?? "Erreur de calcul"); setAnalyzingStep(null); return }
      setAnalysisResult({
        ...data,
        calories: data.calories ?? 0,
        proteins: data.proteins ?? 0,
        carbs:    data.carbs    ?? 0,
        fats:     data.fats     ?? 0,
        fiber:    data.fiber    ?? 0,
      })
      setMealDate(new Date().toISOString().slice(0, 10))
      // Increment local counter — analysis is consumed regardless of whether meal is saved
      setMealsThisMonth(prev => prev + 1)
    } catch {
      setAnalyzeError("Erreur réseau")
    }
    setAnalyzingStep(null)
  }

  function closeAnalysis() {
    setPreviewUrl(null); setCompositionResult(null); setCompositionText("")
    setEditingComposition(false); setAnalysisResult(null); setEditName(""); setAnalyzeError(null)
    setIsManualEntry(false)
  }

  function openManualEntry() {
    setPreviewUrl(null)
    setCompositionResult({ name: "", composition: "" })
    setCompositionText("")
    setEditName("")
    setEditingComposition(true)
    setIsManualEntry(true)
    setAnalyzeError(null)
  }

  async function handleSaveMeal() {
    if (!analysisResult) return
    setSaving(true)
    const [imageThumb, imageUrl] = previewUrl
      ? await Promise.all([createThumbnail(previewUrl), createMediumImage(previewUrl)])
      : [null, null]
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
        imageUrl,
      }),
    })
    if (r.ok) {
      const meal = await r.json()
      setMeals(prev => [meal, ...prev])
      setSelectedMonthIdx(0)
      closeAnalysis()
    }
    setSaving(false)
  }

  function openMealDetail(id: string) {
    const meal = meals.find(m => m.id === id)
    if (meal) {
      setSelectedMeal(meal); setDetailImageUrl(null)
      authFetch(`/api/nutrition/${id}`).then(r => r.json()).then(d => {
        if (d.imageUrl) setDetailImageUrl(d.imageUrl)
      }).catch(() => {})
    }
  }

  async function handleDeleteMeal() {
    if (!selectedMeal) return
    setDeletingMeal(true)
    try {
      await authFetch(`/api/nutrition/${selectedMeal.id}`, { method: "DELETE" })
      setMeals(prev => prev.filter(m => m.id !== selectedMeal.id))
      setSelectedMeal(null)
      setShowMealDeleteConfirm(false)
    } finally {
      setDeletingMeal(false)
    }
  }

  if (loading) return <LoadingScreen color="#f97316" />

  const mealLimit = 5
  const mealLimitReached = plan === "free" && mealsThisMonth >= mealLimit

  return (
    <div className={`${meals.length === 0 ? "h-screen overflow-hidden" : "min-h-screen"} bg-gray-100 text-gray-900`}>

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-orange-600 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-orange-100">
            Mode démo — <a href="/login" className="underline text-white">Connectez-vous</a> pour sauvegarder.
          </p>
          <a href="/login" className="text-xs font-bold text-orange-600 bg-white px-3 py-1 rounded-full">Se connecter</a>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-3 z-30 px-3 md:px-4 pt-3">
        <div className="max-w-3xl mx-auto bg-orange-500/85 backdrop-blur-xl rounded-2xl shadow-lg shadow-orange-900/20 px-4 md:px-5 pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">Repas & suivi nutritionnel</p>
              <h1 className="text-3xl font-bold text-white tracking-tight font-[family-name:var(--font-barlow-condensed)]">Nutrition</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Camera button — photo entry */}
              <button
                onClick={() => { if (!isDemo && !mealLimitReached) fileInputRef.current?.click() }}
                disabled={mealLimitReached}
                title="Analyser une photo"
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${mealLimitReached ? "bg-white/30 text-white/60 cursor-not-allowed" : "bg-white/20 text-white hover:bg-white/30"}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </button>
              {/* Plus button — manual entry */}
              <button
                onClick={() => { if (!isDemo && !mealLimitReached) openManualEntry() }}
                disabled={mealLimitReached}
                className={`flex items-center gap-2 font-bold text-sm px-3 py-2.5 md:px-4 rounded-xl transition-colors ${mealLimitReached ? "bg-white/30 text-white/60 cursor-not-allowed" : "bg-white text-orange-600 hover:bg-orange-50"}`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden sm:inline">{mealLimitReached ? "Limite atteinte" : "Saisir un repas"}</span>
              </button>
            </div>
          </div>

          {/* Free plan meal usage */}
          {!isDemo && plan === "free" && (
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: mealLimit }).map((_, i) => (
                    <div key={i} className={`w-7 h-3 rounded ${i < mealsThisMonth ? "bg-white" : "bg-white/30"}`} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-orange-100">{mealsThisMonth}/{mealLimit} repas ce mois</span>
              </div>
              <a href="/pricing" className="text-[10px] font-bold text-white/70 hover:text-white">Passer Pro →</a>
            </div>
          )}

          {todayCal > 0 && (
            <div className="mt-3 flex items-center gap-4 py-2 px-3 bg-white/20 rounded-xl">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span className="text-xs font-black text-white">{todayCal} kcal</span>
              </div>
              {plan !== "free" ? (
                <>
                  <span className="text-[11px] text-orange-100 font-bold">P: {Math.round(todayProt)}g</span>
                  <span className="text-[11px] text-orange-100 font-bold">G: {Math.round(todayCarb)}g</span>
                  <span className="text-[11px] text-orange-100 font-bold">L: {Math.round(todayFat)}g</span>
                </>
              ) : (
                <a href="/pricing" className="flex items-center gap-1 text-[11px] font-bold text-white/70 hover:text-white">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Macros Premium
                </a>
              )}
              <span className="text-[10px] text-orange-100 ml-auto">Aujourd&apos;hui</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment" className="hidden" onChange={handleFileChange}
      />

      {/* List */}
      <div className="pt-4 md:pb-8 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {meals.length === 0 ? (
          <div className="flex flex-col items-center py-20 px-4">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-200">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Journal alimentaire</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-xs text-center leading-relaxed">Photographiez votre assiette pour analyser les calories et macronutriments en quelques secondes</p>
            <button
              onClick={() => !isDemo && fileInputRef.current?.click()}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-colors shadow-lg shadow-orange-200"
            >
              Analyser un repas
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0 pb-3 mt-2">
            {/* Month navigator */}
            <div className="flex items-center justify-between px-2 py-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white">
              <button
                onClick={() => setSelectedMonthIdx(i => Math.min(i + 1, allMonths.length - 1))}
                disabled={safeMonthIdx >= allMonths.length - 1}
                className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-extrabold text-gray-900 capitalize">{currentMonth?.label}</p>
                {currentMonth && (() => {
                  const items = currentMonth.days.flatMap(d => d.items)
                  if (items.length === 0) return <p className="text-[10px] text-gray-400 mt-0.5">Aucun repas ce mois</p>
                  const cal = items.reduce((s, i) => s + (i.calories ?? 0), 0)
                  return <p className="text-[10px] text-gray-400 mt-0.5">{items.length} repas{cal > 0 ? ` · ${Math.round(cal)} kcal` : ""}</p>
                })()}
              </div>
              {safeMonthIdx > 0 ? (
                <button
                  onClick={() => setSelectedMonthIdx(i => Math.max(i - 1, 0))}
                  className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>

            {currentMonth && currentMonth.days.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="text-gray-400 text-sm">Aucun repas enregistré ce mois</p>
              </div>
            )}

            {currentMonth?.days.map(dayGroup => {
              const dayCal = dayGroup.items.reduce((s, i) => s + (i.calories ?? 0), 0)
              return (
                <div key={dayGroup.dayKey} className="px-3 md:px-4 pt-3">
                  <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      <p className="text-[11px] font-bold text-gray-500 capitalize">{dayGroup.dayLabel}</p>
                    </div>
                    {dayCal > 0 && <span className="text-[11px] font-bold text-orange-500">{Math.round(dayCal)} kcal</span>}
                  </div>
                  <div className="flex flex-col gap-px">
                    {dayGroup.items.map(meal => (
                      <div
                        key={meal.id}
                        className="flex items-center gap-3 py-3 px-4 md:px-6 rounded-2xl cursor-pointer select-none bg-white hover:bg-gray-50"
                        onClick={() => openMealDetail(meal.id)}
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-orange-500 flex items-center justify-center text-white">
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
                          <p className="text-sm font-bold text-gray-900 truncate">{meal.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {meal.calories != null && <span className="text-[11px] font-bold text-orange-500">{meal.calories} kcal</span>}
                            {plan !== "free" && meal.proteins != null && <span className="text-[11px] text-gray-400">P: {Math.round(meal.proteins)}g</span>}
                            {plan !== "free" && meal.carbs != null && <span className="text-[11px] text-gray-400">G: {Math.round(meal.carbs)}g</span>}
                            {plan !== "free" && meal.fats != null && <span className="text-[11px] text-gray-400">L: {Math.round(meal.fats)}g</span>}
                            {plan === "free" && (meal.proteins != null || meal.carbs != null) && (
                              <a href="/pricing" className="flex items-center gap-0.5 text-[10px] font-bold text-gray-300 hover:text-orange-400 transition-colors">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Macros
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Step 1: Analyzing image overlay ── */}
      {analyzingStep === "describe" && (
        <div data-modal="" className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-5 px-6">
          {previewUrl && (
            <div className="w-28 h-28 rounded-2xl overflow-hidden border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-orange-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Identification des aliments…</p>
            <p className="text-gray-400 text-sm">L&apos;IA analyse le contenu de l&apos;assiette</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
        </div>
      )}

      {/* ── Step 2: Calculating macros overlay ── */}
      {analyzingStep === "calculate" && (
        <div data-modal="" className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-orange-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.504-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.656 4.5 4.77V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.77c0-1.114-.806-2.07-1.907-2.198A48.424 48.424 0 0012 2.25z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">Calcul des valeurs nutritionnelles…</p>
            <p className="text-gray-400 text-sm">Calories, protéines, glucides, lipides</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
        </div>
      )}

      {/* ── Step 1 result: Composition modal ── */}
      {!analyzingStep && compositionResult && !analysisResult && (
        <div data-modal="" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={!editingComposition ? closeAnalysis : undefined}>
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {!editingComposition ? (
              <>
                {previewUrl && (
                  <div className="w-full overflow-hidden rounded-t-3xl bg-gray-100 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Repas" className="w-full object-cover" style={{ maxHeight: "200px" }} />
                  </div>
                )}

                <div className="px-5 pt-4 pb-1 shrink-0">
                  <p className="text-base font-extrabold text-gray-900">{editName || compositionResult.name}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-2">
                  <div className="mt-1">
                    {compositionText.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} className="text-[11px] text-gray-400 leading-snug py-1">{line.trim().replace(/~/g, "")}</p>
                    ))}
                  </div>
                </div>

                <div className="px-5 pb-6 pt-3 shrink-0 border-t border-gray-100 flex flex-col gap-3">
                  <button
                    onClick={handleCalculate}
                    disabled={!compositionText.trim()}
                    className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors disabled:opacity-40 shadow-lg shadow-orange-500/20"
                  >
                    Calculer les valeurs nutritionnelles
                  </button>
                  <div className="flex gap-3">
                    <button onClick={closeAnalysis} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
                      Annuler
                    </button>
                    <button
                      onClick={() => setEditingComposition(true)}
                      className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors flex items-center justify-center gap-1.5"
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
              <>
                <div className="px-5 pt-5 pb-1 shrink-0 flex items-center justify-between">
                  <p className="text-sm font-extrabold text-gray-900">{isManualEntry ? "Saisie manuelle" : "Modifier la composition"}</p>
                  <button onClick={closeAnalysis} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 px-5 pt-3">
                  <div className="mb-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Nom du repas</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="ex: Poulet riz légumes"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-400"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Ingrédients &amp; quantités</label>
                    <textarea
                      autoFocus
                      value={compositionText}
                      onChange={e => setCompositionText(e.target.value)}
                      rows={Math.max(5, (compositionText || "").split("\n").length + 1)}
                      placeholder={"- 150g de poulet grillé\n- 100g de riz basmati\n- 60g de légumes sautés\n..."}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-400 resize-none leading-relaxed"
                    />
                  </div>
                </div>
                <div className="px-5 pb-6 pt-3 shrink-0 border-t border-gray-100 flex flex-col gap-3">
                  {isManualEntry ? (
                    <button
                      onClick={handleCalculate}
                      disabled={!compositionText.trim()}
                      className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-40"
                    >
                      Analyser les nutriments
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingComposition(false)}
                      className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20"
                    >
                      Valider les modifications
                    </button>
                  )}
                  <button
                    onClick={closeAnalysis}
                    className="w-full py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2 result: Macros modal ── */}
      {!analyzingStep && analysisResult && (
        <div data-modal="" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeAnalysis}>
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="pb-6">
              {previewUrl && (
                <div className="w-full overflow-hidden rounded-t-3xl bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Repas" className="w-full object-cover" style={{ maxHeight: "180px" }} />
                </div>
              )}

              <div className="px-5 pt-4 mb-4">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nom du repas"
                  className="w-full bg-transparent text-base font-extrabold text-gray-900 placeholder-gray-300 outline-none truncate mb-1.5"
                />
                {compositionText && (
                  <div className="mt-1">
                    {compositionText.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} className="text-[11px] text-gray-400 leading-snug py-1">{line.trim().replace(/~/g, "")}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 mx-5 mb-2" />

              {plan === "free" ? (
                <div className="mx-5 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center mb-1">
                    <svg className="w-4.5 h-4.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800">Données nutritionnelles masquées</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Passez Pro pour voir les calories, protéines, glucides et lipides de chaque repas.</p>
                  <a href="/pricing" className="mt-1 px-5 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-400 transition-colors">
                    Passer Pro →
                  </a>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6 px-5 pt-2">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Calories</p>
                    <p className="text-6xl font-black text-gray-900 leading-none">
                      {analysisResult.calories != null ? Math.round(analysisResult.calories) : "—"}
                      <span className="text-2xl font-bold text-gray-400 ml-2">kcal</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-4 px-5 mb-4">
                    {[
                      { label: "Protéines", value: analysisResult.proteins, color: "#3b82f6", daily: 50 },
                      { label: "Glucides",  value: analysisResult.carbs,    color: "#22c55e", daily: 260 },
                      { label: "Lipides",   value: analysisResult.fats,     color: "#f59e0b", daily: 70 },
                      { label: "Fibres",    value: analysisResult.fiber,    color: "#a78bfa", daily: 25 },
                    ].map((m, i) => (
                      <div key={m.label} className={`flex flex-col items-center pt-3 ${i > 0 ? "border-l border-gray-100" : ""}`}>
                        <div className="w-8 h-0.5 rounded-full mb-2" style={{ backgroundColor: m.color }} />
                        <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: m.color }}>{m.label}</span>
                        <span className="text-xl font-black text-gray-900 leading-none">
                          {m.value != null ? Math.round(m.value) : "—"}
                        </span>
                        <span className="text-[10px] font-bold mt-0.5" style={{ color: m.color + "99" }}>/{m.daily}g</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="h-2" />
              <div className="px-5">
                <button
                  onClick={handleSaveMeal} disabled={saving}
                  className="w-full py-4 bg-orange-500 rounded-2xl text-base font-extrabold text-white hover:bg-orange-400 transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20 mb-3"
                >
                  {saving ? "Enregistrement…" : "Enregistrer ce repas"}
                </button>
                <button onClick={() => setAnalysisResult(null)} className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors">
                  ← Modifier la composition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Meal detail modal ── */}
      {selectedMeal && (
        <div data-modal="" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedMeal(null); setDetailImageUrl(null); setShowMealDeleteConfirm(false) }}>
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="pb-6">
              <div className="w-full overflow-hidden rounded-t-3xl bg-gray-100">
                {(detailImageUrl || selectedMeal.imageThumb) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detailImageUrl ?? selectedMeal.imageThumb!} alt={selectedMeal.name} className="w-full object-cover" style={{ maxHeight: "180px" }} />
                ) : (
                  <div className="w-full h-16 flex items-center justify-center">
                    <svg className="w-7 h-7 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="px-5 pt-4 mb-4">
                <p className="text-base font-extrabold text-gray-900">{selectedMeal.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fmtDate(selectedMeal.date)}</p>
              </div>

              <div className="border-t border-gray-100 mx-5 mb-2" />

              <div className="text-center mb-6 px-5 pt-4">
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Calories</p>
                <p className="text-6xl font-black text-gray-900 leading-none">
                  {selectedMeal.calories != null ? Math.round(selectedMeal.calories) : "—"}
                  <span className="text-2xl font-bold text-gray-400 ml-2">kcal</span>
                </p>
              </div>

              <div className="grid grid-cols-4 px-5 mb-4">
                {[
                  { label: "Protéines", value: selectedMeal.proteins, color: "#3b82f6", daily: 50 },
                  { label: "Glucides",  value: selectedMeal.carbs,    color: "#22c55e", daily: 260 },
                  { label: "Lipides",   value: selectedMeal.fats,     color: "#f59e0b", daily: 70 },
                  { label: "Fibres",    value: selectedMeal.fiber,    color: "#a78bfa", daily: 25 },
                ].map((m, i) => (
                  <div key={m.label} className={`flex flex-col items-center pt-3 ${i > 0 ? "border-l border-gray-100" : ""}`}>
                    <div className="w-8 h-0.5 rounded-full mb-2" style={{ backgroundColor: m.color }} />
                    <span className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: m.color }}>{m.label}</span>
                    <span className="text-xl font-black text-gray-900 leading-none">
                      {m.value != null ? Math.round(m.value) : "—"}
                    </span>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: m.color + "99" }}>/{m.daily}g</span>
                  </div>
                ))}
              </div>
              <div className="px-5 pt-2 pb-2 border-t border-gray-100 mt-2 mx-0">
                {showMealDeleteConfirm ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-gray-700 text-center">Supprimer ce repas ?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowMealDeleteConfirm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500">Annuler</button>
                      <button onClick={handleDeleteMeal} disabled={deletingMeal} className="flex-1 py-2.5 bg-red-500 rounded-xl text-sm font-bold text-white disabled:opacity-50">
                        {deletingMeal ? "..." : "Confirmer"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMealDeleteConfirm(true)} className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Supprimer ce repas
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error modal ── */}
      {analyzeError && !analyzingStep && (
        <div data-modal="" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAnalyzeError(null)}>
          <div
            className="modal-enter bg-white rounded-3xl w-full max-w-sm text-center shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            {mealLimitReached ? (
              <>
                <p className="text-orange-500 font-bold mb-2">Limite atteinte</p>
                <p className="text-gray-500 text-sm mb-5">{analyzeError}</p>
                <div className="flex flex-col gap-2">
                  <a href="/pricing" className="px-6 py-3 bg-orange-500 rounded-xl text-sm font-bold text-white hover:bg-orange-400 transition-colors">
                    Passer Pro →
                  </a>
                  <button onClick={() => setAnalyzeError(null)} className="px-6 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors">
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-red-500 font-bold mb-2">Erreur d&apos;analyse</p>
                <p className="text-gray-500 text-sm mb-5">{analyzeError}</p>
                <button onClick={() => setAnalyzeError(null)} className="px-6 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors">
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
