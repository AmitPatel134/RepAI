"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import { getCached, setCached } from "@/lib/appCache"
import LoadingScreen from "@/components/LoadingScreen"
import { DEMO_WORKOUTS } from "@/lib/demoData"

type Session = { question: string; response: string; createdAt: string }

function lsKey(email: string) { return `repai_last_coach_${email}` }

function loadStored(email: string): Session | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(lsKey(email)) ?? "null") } catch { return null }
}
function saveStored(email: string, s: Session) {
  try { localStorage.setItem(lsKey(email), JSON.stringify(s)) } catch { /* noop */ }
}

type ResponseSection = { title: string | null; subtitle: string | null; defaultOpen: boolean; body: string }

function parseResponseSections(text: string): ResponseSection[] {
  const lines = text.split("\n")
  const sections: ResponseSection[] = []
  let current: ResponseSection = { title: null, subtitle: null, defaultOpen: false, body: "" }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    const heading = h2?.[1] ?? h3?.[1]
    const blockquote = line.match(/^>\s*(.+)$/)

    if (heading) {
      if (current.body.trim() || current.title) sections.push(current)
      current = { title: heading, subtitle: null, defaultOpen: false, body: "" }
    } else if (blockquote && current.title && current.subtitle === null) {
      const content = blockquote[1].trim()
      if (content.toLowerCase().startsWith("false")) {
        // No useful subtitle — still closed by default
        current.defaultOpen = false
        current.subtitle = null
      } else {
        // "true | phrase" or just "phrase"
        const phrase = content.replace(/^true\s*[|:]\s*/i, "").trim()
        current.subtitle = phrase || null
        current.defaultOpen = false
      }
    } else {
      current.body += (current.body ? "\n" : "") + line
    }
  }
  if (current.body.trim() || current.title) sections.push(current)
  return sections.filter(s => s.title || s.body.trim())
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function renderBody(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\* (.*$)/gm, "<li class='ml-4 list-disc text-gray-600 mb-0.5'>$1</li>")
    .replace(/^- (.*$)/gm, "<li class='ml-4 list-disc text-gray-600 mb-0.5'>$1</li>")
    .replace(/^\d+\. (.*$)/gm, "<li class='ml-4 list-decimal text-gray-600 mb-0.5'>$1</li>")
    .replace(/\n\n/g, "<br/>")
    .replace(/\n/g, "<br/>")
}

function AccordionSection({ index, title, subtitle, body, defaultOpen }: { index: number; title: string; subtitle: string | null; body: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(defaultOpen ? "auto" : "0px")

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight + "px" : "0px")
    }
  }, [open])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/80 transition-colors"
      >
        <span className="w-7 h-7 rounded-xl bg-violet-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-violet-300/40">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug">{title}</p>
          {!open && subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div style={{ height, overflow: "hidden", transition: "height 0.28s ease" }}>
        <div ref={contentRef} className="px-4 pb-4 pt-0">
          <div className="h-px bg-gray-100 mb-3 mx-0" />
          <div
            className="text-sm text-gray-700 font-medium leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderBody(body) }}
          />
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

const QUICK_CATEGORIES = [
  {
    label: "Muscu",
    color: { pill: "bg-red-100 text-red-600", active: "bg-red-500 text-white", btn: "hover:border-red-400 hover:text-red-600 hover:bg-red-50" },
    questions: [
      "Est-ce que mon volume d'entraînement est adapté ?",
      "Comment améliorer ma force sur le squat ?",
      "Quelle fréquence d'entraînement me recommandes-tu ?",
      "Comment structurer un programme push/pull/legs ?",
    ],
  },
  {
    label: "Cardio",
    color: { pill: "bg-blue-100 text-blue-600", active: "bg-blue-500 text-white", btn: "hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50" },
    questions: [
      "Comment améliorer mon endurance rapidement ?",
      "Quelle zone cardiaque pour brûler des graisses ?",
      "Comment intégrer du cardio sans perdre du muscle ?",
      "Combien de séances cardio par semaine ?",
    ],
  },
  {
    label: "Alimentation",
    color: { pill: "bg-green-100 text-green-600", active: "bg-green-500 text-white", btn: "hover:border-green-400 hover:text-green-600 hover:bg-green-50" },
    questions: [
      "Mon apport en protéines est-il suffisant ?",
      "Analyse mon alimentation et mes entraînements",
      "Comment calculer mes besoins caloriques ?",
      "Que manger avant et après l'entraînement ?",
    ],
  },
  {
    label: "Récupération",
    color: { pill: "bg-violet-100 text-violet-600", active: "bg-violet-500 text-white", btn: "hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50" },
    questions: [
      "Comment optimiser ma récupération entre les séances ?",
      "Combien de temps de repos entre deux séances muscu ?",
      "Comment réduire les courbatures après l'effort ?",
      "Le sommeil impacte-t-il mes performances ?",
    ],
  },
]

export default function CoachPage() {
  const [ready, setReady] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [plan, setPlan] = useState("free")
  const [coachQuestionsThisWeek, setCoachQuestionsThisWeek] = useState(0)
  const [weekResetDate, setWeekResetDate] = useState<string | null>(null)
  const [lastSession, setLastSession] = useState<Session | null>(null)
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickCategory, setQuickCategory] = useState(0)
  const [workoutContext, setWorkoutContext] = useState("")
  const [activityContext, setActivityContext] = useState("")
  const [nutritionContext, setNutritionContext] = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsDemo(true)
        const ctx = DEMO_WORKOUTS.slice(0, 3).map(w =>
          `Séance: ${w.name} (${w.date.slice(0, 10)}) — ${w.exercises.map(e =>
            `${e.name}: ${e.sets.map(s => `${s.reps}×${s.weight}kg`).join(", ")}`
          ).join(" | ")}`
        ).join("\n")
        setWorkoutContext(ctx)
        setReady(true)
        return
      }

      const email = session.user.email ?? ""

      // Instant display from localStorage (user-scoped key)
      const stored = loadStored(email)
      if (stored) setLastSession(stored)

      // Instant display from cache
      const cached = getCached<{
        plan: string
        usage: { coachQuestionsThisWeek: number }
        weekResetDate: string
        workoutContext: string
        activityContext: string
        nutritionContext: string
        lastSession: Session | null
      }>("/api/coach/context")
      if (cached) {
        setPlan(cached.plan ?? "free")
        setCoachQuestionsThisWeek(cached.usage?.coachQuestionsThisWeek ?? 0)
        setWeekResetDate(cached.weekResetDate ?? null)
        setWorkoutContext(cached.workoutContext ?? "")
        setActivityContext(cached.activityContext ?? "")
        setNutritionContext(cached.nutritionContext ?? "")
        if (cached.lastSession) {
          const storedTs = stored ? new Date(stored.createdAt).getTime() : 0
          const apiTs = new Date(cached.lastSession.createdAt).getTime()
          if (apiTs > storedTs) { setLastSession(cached.lastSession); saveStored(email, cached.lastSession) }
        }
        setReady(true)
      }

      authFetch("/api/coach/context")
        .then(r => r.json())
        .then(ctx => {
          if (!ctx || ctx.error) { setIsDemo(true); return }
          setPlan(ctx.plan ?? "free")
          setCoachQuestionsThisWeek(ctx.usage?.coachQuestionsThisWeek ?? 0)
          setWeekResetDate(ctx.weekResetDate ?? null)
          setWorkoutContext(ctx.workoutContext ?? "")
          setActivityContext(ctx.activityContext ?? "")
          setNutritionContext(ctx.nutritionContext ?? "")
          if (ctx.lastSession) {
            const storedTs = stored ? new Date(stored.createdAt).getTime() : 0
            const apiTs = new Date(ctx.lastSession.createdAt).getTime()
            if (apiTs > storedTs) { setLastSession(ctx.lastSession); saveStored(email, ctx.lastSession) }
          }
          setCached("/api/coach/context", ctx)
        })
        .catch(() => setIsDemo(true))
        .finally(() => setReady(true))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const weeklyLimitReached = !isDemo && plan === "free" && coachQuestionsThisWeek >= 1

  async function handleAsk() {
    if (!question.trim() || loading || weeklyLimitReached) return
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
      setLoading(false)
      return
    }

    const email = (await supabase.auth.getSession()).data.session?.user.email ?? ""

    try {
      const r = await authFetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, workoutContext, activityContext, nutritionContext }),
      })
      if (r.status === 429) {
        setCoachQuestionsThisWeek(1)
        setLoading(false)
        return
      }
      const data = await r.json()
      const s: Session = { question: q, response: data.response, createdAt: data.createdAt ?? new Date().toISOString() }
      setLastSession(s)
      saveStored(email, s)
      setCoachQuestionsThisWeek(prev => prev + 1)
    } catch {
      const s: Session = { question: q, response: "Désolé, une erreur s'est produite. Vérifiez votre connexion et réessayez.", createdAt: new Date().toISOString() }
      setLastSession(s)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      {isDemo && (
        <div className="bg-violet-700 px-6 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs font-semibold text-violet-100">
            Mode démo — <a href="/login" className="underline text-white">Connectez-vous</a> pour des conseils IA personnalisés.
          </p>
          <a href="/login" className="text-xs font-bold text-violet-600 bg-white px-3 py-1 rounded-full hover:bg-violet-50 transition-colors">
            Se connecter
          </a>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-3 z-30 px-3 md:px-4 pt-3">
        <div className="max-w-3xl mx-auto bg-violet-600/85 backdrop-blur-xl rounded-2xl shadow-lg shadow-violet-900/20 px-4 md:px-5 pt-4 pb-4">
          <p className="text-xs font-medium text-white/60 mb-1">Entraîneur IA personnalisé</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight font-[family-name:var(--font-barlow-condensed)]">Coach IA</h1>
            {ready && !isDemo && plan === "free" && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className={`w-7 h-2.5 rounded ${coachQuestionsThisWeek >= 1 ? "bg-white" : "bg-white/30"}`} />
                  </div>
                  <span className="text-[11px] font-bold text-white/70">{coachQuestionsThisWeek}/1</span>
                  {weeklyLimitReached && (
                    <a href="/pricing" className="text-[11px] font-bold text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors shrink-0">Passer Pro →</a>
                  )}
                </div>
                {weekResetDate && (
                  <span className="text-[10px] text-white/40 font-medium">
                    Recharge le {new Date(weekResetDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-6 md:px-6 md:py-8 flex flex-col gap-6">

        {/* Quick questions */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setQuickOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Questions rapides</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${quickOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            style={{
              maxHeight: quickOpen ? "500px" : "0px",
              opacity: quickOpen ? 1 : 0,
              transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
              overflow: "hidden",
            }}
          >
            {/* Category tabs */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
              {QUICK_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setQuickCategory(i)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    quickCategory === i ? cat.color.active : cat.color.pill
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Questions for active category */}
            <div className="px-4 pb-4 flex flex-col gap-2">
              {QUICK_CATEGORIES[quickCategory].questions.map(q => (
                <button
                  key={q}
                  onClick={() => { setQuestion(q); setQuickOpen(false) }}
                  className={`w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:shadow-sm transition-all text-center ${QUICK_CATEGORIES[quickCategory].color.btn}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Plan tier indicator */}
        {!isDemo && plan !== "free" && (
          <div className="flex items-center gap-2 -mb-3">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${plan === "premium_plus" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
              {plan === "premium_plus" ? "IA Premium+" : "IA Premium"}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {plan === "premium_plus" ? "Analyse croisée · Détection de patterns" : "Conseils personnalisés · Données complètes"}
            </span>
          </div>
        )}

        {/* Ask input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
            placeholder={weeklyLimitReached ? "Limite hebdomadaire atteinte — passez Pro pour des questions illimitées" : "Posez votre question au coach…"}
            rows={3}
            disabled={weeklyLimitReached}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 font-medium outline-none focus:border-violet-400 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || loading || weeklyLimitReached}
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

        {/* Loading */}
        {loading && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-violet-600">Coach analyse vos données…</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Last session / Empty state / Skeleton */}
        {!ready && (
          <div className="flex flex-col gap-3">
            <div className="h-10 bg-gray-200 rounded-2xl animate-pulse" />
            <div className="h-12 bg-gray-200 rounded-2xl animate-pulse" />
            <div className="h-12 bg-gray-200 rounded-2xl animate-pulse" />
          </div>
        )}

        {/* Last session */}
        {ready && !loading && lastSession && (() => {
          const sections = parseResponseSections(lastSession.response)
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Question header */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 text-center">
                <p className="text-sm font-bold text-gray-900 leading-snug">{lastSession.question}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-medium">{formatDate(lastSession.createdAt)}</p>
              </div>
              {/* Sections */}
              <div className="flex flex-col divide-y divide-gray-100">
                {sections.filter(s => s.title).map((s, i) => (
                  <AccordionSection key={i} index={i} title={s.title!} subtitle={s.subtitle} body={s.body} defaultOpen={s.defaultOpen} />
                ))}
                {!sections.some(s => s.title) && (
                  <div className="p-4 text-sm text-gray-700 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBody(lastSession.response) }} />
                )}
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {ready && !loading && !lastSession && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">🤖</p>
            <p className="text-gray-700 font-semibold mb-2">Posez votre première question</p>
            <p className="text-gray-400 text-sm">Le coach analysera vos données sportives et alimentaires pour vous répondre</p>
          </div>
        )}
      </div>
    </div>
  )
}
