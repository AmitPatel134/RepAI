"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import { DEMO_WORKOUTS } from "@/lib/demoData"

type Session = { question: string; response: string; createdAt: string }

const LS_KEY = "repai_last_coach"

function loadStored(): Session | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") } catch { return null }
}
function saveStored(s: Session) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.*$)/gm, "<h4 class='font-bold text-white mt-3 mb-1 text-sm'>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3 class='font-extrabold text-white mt-4 mb-2'>$1</h3>")
    .replace(/^- (.*$)/gm, "<li class='ml-4 list-disc text-gray-300'>$1</li>")
    .replace(/^\d+\. (.*$)/gm, "<li class='ml-4 list-decimal text-gray-300'>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>")
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

const QUICK_QUESTIONS = [
  "Comment améliorer ma force sur le squat ?",
  "Est-ce que mon volume d'entraînement est adapté ?",
  "Analyse mon alimentation et mes entraînements",
  "Quelle fréquence d'entraînement me recommandes-tu ?",
  "Comment optimiser ma récupération entre les séances ?",
  "Mon apport en protéines est-il suffisant ?",
]

export default function CoachPage() {
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [lastSession, setLastSession] = useState<Session | null>(null)
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [workoutContext, setWorkoutContext] = useState("")
  const [activityContext, setActivityContext] = useState("")
  const [nutritionContext, setNutritionContext] = useState("")

  useEffect(() => {
    // Show stored response immediately (before auth check)
    const stored = loadStored()
    if (stored) setLastSession(stored)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        // Build demo workout context
        const ctx = DEMO_WORKOUTS.slice(0, 3).map(w =>
          `Séance: ${w.name} (${w.date.slice(0, 10)}) — ${w.exercises.map(e =>
            `${e.name}: ${e.sets.map(s => `${s.reps}×${s.weight}kg`).join(", ")}`
          ).join(" | ")}`
        ).join("\n")
        setWorkoutContext(ctx)
        setReady(true)
        return
      }

      Promise.all([
        authFetch("/api/workouts").then(r => r.json()).catch(() => []),
        authFetch("/api/activities").then(r => r.json()).catch(() => []),
        authFetch("/api/nutrition").then(r => r.json()).catch(() => []),
        authFetch("/api/coach").then(r => r.json()).catch(() => []),
      ]).then(([workouts, activities, meals, coachSessions]) => {
        // Build workout context
        if (Array.isArray(workouts) && workouts.length > 0) {
          const ctx = workouts.slice(0, 5).map((w: typeof DEMO_WORKOUTS[0]) =>
            `Séance: ${w.name} (${w.date.slice(0, 10)}) — ${w.exercises?.map(e =>
              `${e.name}: ${e.sets.map(s => `${s.reps}×${s.weight}kg`).join(", ")}`
            ).join(" | ") ?? ""}`
          ).join("\n")
          setWorkoutContext(ctx)
        }
        // Build activity context
        if (Array.isArray(activities) && activities.length > 0) {
          const ctx = activities.slice(0, 5).map((a: { type: string; name: string; date: string; distanceM: number | null; durationSec: number | null; avgHeartRate: number | null; avgPaceSecKm: number | null }) => {
            const parts = [
              a.distanceM ? `${(a.distanceM / 1000).toFixed(1)}km` : null,
              a.durationSec ? `${Math.floor(a.durationSec / 60)}min` : null,
              a.avgHeartRate ? `FC ${a.avgHeartRate}bpm` : null,
              a.avgPaceSecKm ? `allure ${Math.floor(a.avgPaceSecKm / 60)}'${(a.avgPaceSecKm % 60).toString().padStart(2, "0")}"/km` : null,
            ].filter(Boolean).join(", ")
            return `${a.type} "${a.name}" (${a.date.slice(0, 10)})${parts ? ` : ${parts}` : ""}`
          }).join("\n")
          setActivityContext(ctx)
        }
        // Build nutrition context
        if (Array.isArray(meals) && meals.length > 0) {
          const today = new Date().toISOString().slice(0, 10)
          const todayMeals = meals.filter((m: { date: string }) => m.date.slice(0, 10) === today)
          const todayCal = todayMeals.reduce((s: number, m: { calories: number | null }) => s + (m.calories ?? 0), 0)
          const ctx = meals.slice(0, 10).map((m: { name: string; date: string; calories: number | null; proteins: number | null; carbs: number | null; fats: number | null }) => {
            const parts = [
              m.calories ? `${m.calories} kcal` : null,
              m.proteins ? `P: ${Math.round(m.proteins)}g` : null,
              m.carbs ? `G: ${Math.round(m.carbs)}g` : null,
              m.fats ? `L: ${Math.round(m.fats)}g` : null,
            ].filter(Boolean).join(", ")
            return `${m.name} (${m.date.slice(0, 10)})${parts ? ` — ${parts}` : ""}`
          }).join("\n")
          setNutritionContext((todayCal > 0 ? `Calories aujourd'hui : ${todayCal} kcal\n` : "") + ctx)
        }
        // Use most recent session from API if newer than stored
        if (Array.isArray(coachSessions) && coachSessions.length > 0) {
          const apiLatest = coachSessions[0] as { question: string; response: string; createdAt: string }
          const storedTs = stored ? new Date(stored.createdAt).getTime() : 0
          const apiTs = new Date(apiLatest.createdAt).getTime()
          if (apiTs > storedTs) {
            const s: Session = { question: apiLatest.question, response: apiLatest.response, createdAt: apiLatest.createdAt }
            setLastSession(s)
            saveStored(s)
          }
        }
      }).catch(() => {
        setIsDemo(true)
      }).finally(() => setReady(true))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAsk() {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion("")
    setLoading(true)

    if (isDemo) {
      const demoResponse = `Excellente question ! 🎯

**Analyse basée sur tes données :**

En regardant tes séances récentes, voici mes observations :
- Tu t'entraînes 3x/semaine avec un split Push/Pull/Legs
- Tes charges progressent régulièrement (+2.5kg toutes les 1-2 semaines)
- Ton RPE moyen est autour de 8/10, ce qui est dans la zone idéale

**Mes recommandations :**

1. Continue ta progression linéaire — elle fonctionne bien
2. Assure-toi de dormir 7-9h pour maximiser la récupération
3. Maintiens un surplus calorique modéré (+200-300 kcal/jour)

*Note : Ceci est une réponse de démonstration. Connecte-toi pour des conseils personnalisés.*`

      const s: Session = { question: q, response: demoResponse, createdAt: new Date().toISOString() }
      setLastSession(s)
      saveStored(s)
      setLoading(false)
      return
    }

    try {
      const r = await authFetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, workoutContext, activityContext, nutritionContext }),
      })
      const data = await r.json()
      const s: Session = {
        question: q,
        response: data.response,
        createdAt: data.createdAt ?? new Date().toISOString(),
      }
      setLastSession(s)
      saveStored(s)
    } catch {
      const s: Session = {
        question: q,
        response: "Désolé, une erreur s'est produite. Vérifiez votre connexion et réessayez.",
        createdAt: new Date().toISOString(),
      }
      setLastSession(s)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      {isDemo && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 px-6 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs font-semibold text-violet-300">
            Mode démo — <a href="/login" className="underline hover:text-white">Connectez-vous</a> pour des conseils IA personnalisés.
          </p>
          <a href="/login" className="text-xs font-bold text-white bg-violet-600 px-3 py-1 rounded-full hover:bg-violet-500 transition-colors">
            Se connecter
          </a>
        </div>
      )}

      <div className="max-w-3xl mx-auto w-full px-4 py-6 md:px-6 md:py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Intelligence artificielle</p>
          <h1 className="text-2xl font-extrabold text-white">Coach IA</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Posez vos questions — le coach analyse vos données sportives et nutritionnelles.
          </p>
        </div>

        {/* Quick questions */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-3">Questions rapides</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Ask input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
            placeholder="Posez votre question au coach…"
            rows={3}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 font-medium outline-none focus:border-violet-500 transition-colors resize-none"
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || loading}
            className="sm:self-end px-5 py-3 bg-violet-600 hover:bg-violet-500 rounded-2xl font-bold text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {loading ? "Analyse…" : "Demander"}
          </button>
        </div>

        {/* Loading animation */}
        {loading && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-violet-400">Coach IA analyse vos données…</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Last session */}
        {!loading && lastSession && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {/* Question */}
            <div className="px-5 py-4 border-b border-white/5 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white leading-relaxed">{lastSession.question}</p>
                <p className="text-xs text-gray-600 mt-1">{formatDate(lastSession.createdAt)}</p>
              </div>
            </div>
            {/* Response */}
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div
                className="flex-1 text-sm text-gray-300 font-medium leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(lastSession.response) }}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !lastSession && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">🤖</p>
            <p className="text-gray-400 font-semibold mb-2">Posez votre première question</p>
            <p className="text-gray-600 text-sm">Le coach IA analysera vos données sportives et alimentaires pour vous répondre</p>
          </div>
        )}
      </div>
    </div>
  )
}
