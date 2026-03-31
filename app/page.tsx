"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import LoadingScreen from "@/components/LoadingScreen"
import AppLogo from "@/components/AppLogo"

const APP_NAME = "RepAI"

const TICKER_ITEMS = [
  "🏋️ Musculation", "🏃 Cardio", "🤖 Coach IA", "🍎 Nutrition IA",
  "💪 Prise de masse", "🔥 Sèche", "📊 Statistiques", "🎯 Objectifs",
  "🏊 Natation", "🚴 Vélo", "⚡ HIIT", "🧘 Récupération",
  "🏋️ Musculation", "🏃 Cardio", "🤖 Coach IA", "🍎 Nutrition IA",
  "💪 Prise de masse", "🔥 Sèche", "📊 Statistiques", "🎯 Objectifs",
  "🏊 Natation", "🚴 Vélo", "⚡ HIIT", "🧘 Récupération",
]

const FAQ_ITEMS = [
  { q: `${APP_NAME} est-il gratuit ?`, a: `Oui, ${APP_NAME} propose un plan gratuit pour toujours. Journal illimité, activités, et accès au coach IA limité. Aucune carte bancaire requise.` },
  { q: "Le Coach IA est-il vraiment personnalisé ?", a: "Oui. Il analyse ton historique d'entraînements, tes activités cardio et tes repas enregistrés pour te donner des conseils adaptés à ton profil, ton poids et ton objectif." },
  { q: "Mes données sont-elles sécurisées ?", a: "Tes données sont hébergées sur Supabase (serveurs Europe/US), chiffrées au repos et en transit. Elles ne sont jamais vendues ni partagées." },
  { q: "Puis-je annuler à tout moment ?", a: "Oui, aucun engagement. Annule depuis le portail Stripe accessible directement dans l'appli." },
  { q: `${APP_NAME} fonctionne-t-il sur mobile ?`, a: "L'interface est pensée mobile-first. Navigation par swipe, design compact, tout est optimisé pour smartphone." },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState("0px")
  useEffect(() => {
    if (ref.current) setHeight(open ? ref.current.scrollHeight + "px" : "0px")
  }, [open])
  return (
    <div className="border-b border-white/10 last:border-0">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-4 text-left gap-4">
        <span className="text-sm font-semibold text-white">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full border border-white/30 flex items-center justify-center transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
      <div style={{ height, overflow: "hidden", transition: "height 0.3s ease" }}>
        <div ref={ref} className="pb-4">
          <p className="text-sm text-gray-400 font-medium leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const testimonialsInnerRef = useRef<HTMLDivElement>(null)

  // Animated counter
  function useCounter(target: number | string, active: boolean) {
    const [val, setVal] = useState(0)
    useEffect(() => {
      if (!active || typeof target !== "number") return
      const dur = 1000
      const start = Date.now()
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1)
        const e = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(e * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, [active, target])
    return val
  }

  const c1 = useCounter(10, statsVisible)
  const c2 = useCounter(100, statsVisible)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const userEmail = session.user.email ?? null
        setEmail(userEmail)
        if (userEmail) {
          fetch(`/api/plan?email=${encodeURIComponent(userEmail)}`)
            .then(r => r.json()).then(d => setPlan(d.plan ?? "free")).catch(() => {})
        }
      }
      setReady(true)
    })
  }, [])

  // Scroll reveal
  useEffect(() => {
    if (!ready) return
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"))
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)"
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })
    els.forEach(el => {
      el.style.opacity = "0"
      el.style.transform = "translateY(28px)"
      el.style.transition = "opacity 0.6s ease, transform 0.6s ease"
      io.observe(el)
    })
    // Stats counter trigger
    const statsEl = statsRef.current
    if (statsEl) {
      const statsIo = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { setStatsVisible(true); statsIo.disconnect() }
      }, { threshold: 0.5 })
      statsIo.observe(statsEl)
      return () => { io.disconnect(); statsIo.disconnect() }
    }
    return () => io.disconnect()
  }, [ready])

  // Features scroll-driven animation (bidirectional, non-linear, varied directions)
  useEffect(() => {
    if (!ready) return
    // Each card: { x, y, r } = starting offset (px) and rotation (deg)
    const OFFSETS = [
      { x:   0, y: 110, r: -1.5 }, // Journal     — from below, slight tilt
      { x: -130, y:  55, r:  3.5 }, // Coach IA    — diagonal left
      { x:  110, y:  70, r: -4.5 }, // Nutrition   — diagonal right
      { x:  -45, y:  90, r:  1   }, // Cardio      — mostly from below, left lean
      { x: -120, y:  40, r:  5.5 }, // Voix        — from left, rotated
      { x:   85, y: 100, r: -3.5 }, // Stats       — from right-below
    ]
    // ease-out-back: slight overshoot on arrival
    function easeOutBack(t: number) {
      if (t <= 0) return 0
      if (t >= 1) return 1
      const c1 = 1.2, c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
    function onScroll() {
      const el = featuresRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const raw = (window.innerHeight - rect.top) / (window.innerHeight * 0.85)
      const p = Math.max(0, Math.min(1, raw))
      el.querySelectorAll<HTMLElement>("[data-fi]").forEach(card => {
        const fi = parseInt(card.dataset.fi ?? "0")
        const o = OFFSETS[fi]
        const ep = easeOutBack(p)
        card.style.transform = `translate(${o.x * (1 - ep)}px, ${o.y * (1 - ep)}px) rotate(${o.r * (1 - ep)}deg)`
        card.style.opacity = String(Math.min(1, p * 2))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [ready])


  // Testimonials infinite scroll + touch/mouse drag
  useEffect(() => {
    if (!ready) return
    const inner = testimonialsInnerRef.current
    if (!inner) return
    const outer = inner.parentElement
    if (!outer) return

    const SPEED = 55 // px/s
    let x = 0
    let halfW = 0
    let raf: number
    let dragging = false
    let paused = false
    let lastTs = 0
    let lastPointerX = 0
    let resumeTimer: ReturnType<typeof setTimeout>

    halfW = inner.scrollWidth / 2
    const innerEl = inner

    function tick(ts: number) {
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0
      lastTs = ts
      if (!dragging && !paused) x -= SPEED * dt
      // wrap
      if (x < -halfW) x += halfW
      if (x > 0) x -= halfW
      innerEl.style.transform = `translateX(${x}px)`
      raf = requestAnimationFrame(tick)
    }

    function onStart(clientX: number) {
      clearTimeout(resumeTimer)
      dragging = true
      paused = true
      lastPointerX = clientX
      lastTs = 0
    }
    function onMove(clientX: number) {
      if (!dragging) return
      x += clientX - lastPointerX
      lastPointerX = clientX
    }
    function onEnd() {
      if (!dragging) return
      dragging = false
      lastTs = 0
      resumeTimer = setTimeout(() => { paused = false }, 600)
    }

    const onTouchStart = (e: TouchEvent) => onStart(e.touches[0].clientX)
    const onTouchMove  = (e: TouchEvent) => onMove(e.touches[0].clientX)
    const onMouseDown  = (e: MouseEvent) => onStart(e.clientX)
    const onMouseMove  = (e: MouseEvent) => onMove(e.clientX)

    outer.addEventListener("touchstart", onTouchStart, { passive: true })
    outer.addEventListener("touchmove",  onTouchMove,  { passive: true })
    outer.addEventListener("touchend",   onEnd)
    outer.addEventListener("mousedown",  onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup",   onEnd)

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resumeTimer)
      outer.removeEventListener("touchstart", onTouchStart)
      outer.removeEventListener("touchmove",  onTouchMove)
      outer.removeEventListener("touchend",   onEnd)
      outer.removeEventListener("mousedown",  onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup",   onEnd)
    }
  }, [ready])

  async function handleLogout() {
    await supabase.auth.signOut()
    setEmail(null); setConfirm(false)
  }

  if (!ready) return <LoadingScreen />

  const ctaHref = email ? "/app" : "/login"

  return (
    <main className="min-h-screen text-gray-900 overflow-x-hidden">
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .float { animation: float 5s ease-in-out infinite }
        .float2 { animation: float2 3.5s ease-in-out 1s infinite }
        .ticker { animation: ticker 28s linear infinite }
        .ticker:hover { animation-play-state: paused }
      `}</style>

      {/* NAVBAR */}
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-2xl flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-950/85 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40">
        <a href={email ? "/app" : "/"} className="flex items-center gap-2">
          <AppLogo size={26} variant="light" />
          <span className="text-sm font-extrabold tracking-tight text-white">{APP_NAME}</span>
        </a>
        <div className="flex items-center gap-2">
          {email ? (
            <button onClick={() => setConfirm(true)} className="text-xs font-bold text-gray-400 px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">
              Déconnexion
            </button>
          ) : (
            <a href="/login" className="text-xs font-bold text-gray-400 px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-all">
              Connexion
            </a>
          )}
          <a href={ctaHref} className="bg-violet-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/40">
            {email ? "Dashboard →" : "Commencer →"}
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen bg-gray-950 text-white flex flex-col justify-center px-5 pt-24 pb-16 overflow-hidden">
        {/* Animated glows */}
        <div className="absolute top-1/4 -right-20 w-72 h-72 rounded-full bg-violet-700/25 blur-3xl float" />
        <div className="absolute bottom-1/4 -left-16 w-56 h-56 rounded-full bg-violet-600/20 blur-3xl float2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-900/15 blur-3xl" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-2xl mx-auto w-full">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-3 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-bold text-violet-300 tracking-wide">Entraînement · Nutrition · Coach IA</span>
          </div>

          {/* Title */}
          <h1 className="text-[clamp(3rem,11vw,5.5rem)] font-extrabold leading-none tracking-tight mb-5 font-[family-name:var(--font-barlow-condensed)]">
            Progresse plus vite<br />
            <span className="text-violet-400">avec l&apos;IA.</span>
          </h1>

          <p className="text-base font-medium text-gray-400 max-w-sm leading-relaxed mb-8">
            Journal de sport, suivi nutritionnel et coach IA personnalisé — tout au même endroit. Pensé pour le mobile.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <a href={ctaHref} className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-colors shadow-lg shadow-violet-900/50">
              {email ? "Aller au dashboard" : "Démarrer gratuitement"}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </a>
            <a href="/app" className="flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white font-semibold text-sm px-7 py-3.5 rounded-2xl transition-colors hover:bg-white/5">
              Voir la démo
            </a>
          </div>

          {/* App preview cards — compact phone-like */}
          <div className="relative w-full max-w-sm mx-auto sm:mx-0">
            {/* Profile card mock */}
            <div className="float bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl mb-2 border border-gray-100">
              <div className="w-1 h-10 rounded-full bg-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Profil</span>
                  <span className="text-xs font-semibold text-gray-700 truncate">Prise de masse 💪</span>
                </div>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold">
                  <span>25 ans</span><span>·</span><span>80 kg</span><span>·</span><span>IMC 24.7</span>
                </div>
              </div>
              <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>

            {/* Nutrition mock */}
            <div className="float2 bg-white rounded-2xl p-4 shadow-xl mb-2 border border-orange-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Nutrition IA</span>
                <span className="text-[10px] text-gray-400">aujourd&apos;hui</span>
              </div>
              <div className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2 mb-2">
                <span className="text-xs font-bold text-gray-500">Calories</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-orange-600">2 850</span>
                  <span className="text-xs text-orange-400 font-semibold">kcal</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[{l:"Prot.",v:"178g",c:"text-blue-600",b:"bg-blue-50"},{l:"Glucides",v:"320g",c:"text-yellow-600",b:"bg-yellow-50"},{l:"Lipides",v:"89g",c:"text-green-600",b:"bg-green-50"},{l:"Fibres",v:"34g",c:"text-purple-600",b:"bg-purple-50"}].map(m => (
                  <div key={m.l} className={`${m.b} rounded-lg p-1.5 text-center`}>
                    <p className={`text-xs font-black ${m.c}`}>{m.v}</p>
                    <p className="text-[8px] text-gray-400 font-bold leading-none mt-0.5">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach mock */}
            <div className="bg-gray-900 rounded-2xl p-4 shadow-xl border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Coach IA</span>
              </div>
              <div className="bg-white/8 rounded-xl px-3 py-2 mb-2">
                <p className="text-[11px] font-semibold text-white">Combien de protéines par jour ?</p>
              </div>
              <div className="bg-violet-100 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-violet-800 mb-0.5">Recommandations</p>
                <p className="text-[11px] text-violet-700 leading-snug">Pour 80 kg en prise de masse : <strong>128–160g</strong> de protéines/jour.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="bg-violet-600 py-3 overflow-hidden">
        <div className="flex ticker whitespace-nowrap" style={{ width: "max-content" }}>
          {TICKER_ITEMS.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-white text-xs font-bold px-5">
              {item}
              <span className="text-violet-300">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="bg-gray-950 px-5 py-14" ref={statsRef}>
        <div className="reveal max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "∞", label: "séances à logger", special: true },
            { value: `${c1}s`, label: "par analyse IA", special: false },
            { value: `${c2}%`, label: "mobile-first", special: false },
            { value: "0€", label: "pour commencer", special: true },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-black text-white font-[family-name:var(--font-barlow-condensed)] leading-none">{s.value}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-white px-5 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="reveal mb-8">
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2">Fonctionnalités</p>
            <h2 className="text-3xl font-extrabold text-gray-900 font-[family-name:var(--font-barlow-condensed)]">Tout ce qu&apos;il te faut</h2>
          </div>

          <div className="grid grid-cols-2 gap-3" ref={featuresRef}>
            {/* Journal — wide card, dark */}
            <div data-fi="0" style={{ opacity: 0, willChange: "transform, opacity" }} className="col-span-2 relative overflow-hidden rounded-2xl bg-gray-950 p-5 min-h-[130px]">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-violet-700/30 blur-2xl" />
              <div className="absolute top-3 right-4 opacity-10">
                <svg className="w-24 h-24 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-900/40">
                  <svg className="w-4.5 h-4.5 w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <p className="text-sm font-extrabold text-white mb-1">Journal de sport</p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">Séries, reps, charges, RPE — mode dégressif et exercices unilatéraux inclus.</p>
                {/* mini workout log preview */}
                <div className="flex gap-2 mt-3">
                  {[{e:"Squat",s:"4×5",w:"120kg"},{e:"Bench",s:"4×8",w:"80kg"}].map(ex => (
                    <div key={ex.e} className="bg-white/8 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-300">{ex.e}</span>
                      <span className="text-[9px] text-violet-400 font-black">{ex.s}</span>
                      <span className="text-[9px] text-gray-500">{ex.w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coach IA */}
            <div data-fi="1" style={{ opacity: 0, willChange: "transform, opacity" }} className="relative overflow-hidden rounded-2xl bg-violet-600 p-4 min-h-[140px]">
              <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center mb-3 border border-white/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm font-extrabold text-white mb-1">Coach IA</p>
              <p className="text-xs text-violet-100 font-medium leading-relaxed">Conseils personnalisés à partir de tes vraies données.</p>
            </div>

            {/* Nutrition IA */}
            <div data-fi="2" style={{ opacity: 0, willChange: "transform, opacity" }} className="relative overflow-hidden rounded-2xl bg-orange-600 p-4 min-h-[140px]">
              <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center mb-3 border border-white/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 6.5 9 7 8 7c-1 0-2.2-.7-3.2-.7C2.5 6.3 1.5 8.5 1.5 11c0 4 3 8.5 5.5 8.5.9 0 1.8-.6 2.8-.6s1.9.6 2.8.6C15 19.5 18 15 18 11c0-2.5-1.5-4.7-4-4.7-.8 0-1.6.3-2.5.3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C12 4.5 13.5 3 15 2" />
                </svg>
              </div>
              <p className="text-sm font-extrabold text-white mb-1">Nutrition IA</p>
              <p className="text-xs text-orange-100 font-medium leading-relaxed">Calories & macros calculés selon ton profil et ton objectif.</p>
            </div>

            {/* Activités cardio — wide */}
            <div data-fi="3" style={{ opacity: 0, willChange: "transform, opacity" }} className="col-span-2 relative overflow-hidden rounded-2xl bg-blue-950 p-5 min-h-[110px]">
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #60a5fa 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
              <div className="absolute -top-6 right-8 w-28 h-28 rounded-full bg-blue-500/20 blur-2xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/50">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white mb-1">Activités cardio</p>
                  <p className="text-xs text-blue-300 font-medium leading-relaxed">Course, vélo, natation, randonnée — toutes tes activités au même endroit.</p>
                </div>
                <div className="ml-auto flex gap-1.5 shrink-0">
                  {["🏃","🚴","🏊"].map((e,i) => (
                    <span key={i} className="w-7 h-7 bg-blue-900/60 rounded-lg flex items-center justify-center text-sm border border-blue-800/50">{e}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Voix */}
            <div data-fi="4" style={{ opacity: 0, willChange: "transform, opacity" }} className="relative overflow-hidden rounded-2xl bg-green-800 p-4 min-h-[130px]">
              <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center mb-3 border border-white/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-sm font-extrabold text-white mb-1">Commande vocale</p>
              <p className="text-xs text-green-200 font-medium leading-relaxed">Log tes activités à la voix, mains libres.</p>
            </div>

            {/* Stats */}
            <div data-fi="5" style={{ opacity: 0, willChange: "transform, opacity" }} className="relative overflow-hidden rounded-2xl bg-amber-700 p-4 min-h-[130px]">
              <div className="absolute bottom-3 right-3 flex items-end gap-0.5 opacity-30">
                {[40,65,30,80,55,90].map((h,i) => (
                  <div key={i} className="w-2 rounded-sm bg-white" style={{height:`${h/5}px`}} />
                ))}
              </div>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center mb-3 border border-white/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M7 20V14m4 6V8m4 12V3" />
                </svg>
              </div>
              <p className="text-sm font-extrabold text-white mb-1">Stats & progrès</p>
              <p className="text-xs text-amber-100 font-medium leading-relaxed">Historique, graphiques, records perso.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-gray-100 px-5 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="reveal mb-8">
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2">Comment ça marche</p>
            <h2 className="text-3xl font-extrabold text-gray-900 font-[family-name:var(--font-barlow-condensed)]">Prêt en 3 étapes</h2>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { n: "1", title: "Crée ton profil", desc: "Renseigne ton objectif, ton poids, ton niveau d'activité. L'IA s'adapte à toi." },
              { n: "2", title: "Log tes séances", desc: "Enregistre tes entraînements, repas et activités cardio au fil de ta journée." },
              { n: "3", title: "Reçois des conseils", desc: "Le coach IA analyse tout et te donne des recommandations concrètes et actionnables." },
            ].map((s, i) => (
              <div key={s.n} className="reveal flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
                  <span className="text-base font-black text-white font-[family-name:var(--font-barlow-condensed)]">{s.n}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-1">{s.title}</p>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-gray-950 py-16 overflow-hidden">
        <div className="max-w-2xl mx-auto px-5">
          <div className="reveal mb-8">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">Témoignages</p>
            <h2 className="text-3xl font-extrabold text-white font-[family-name:var(--font-barlow-condensed)]">Ce qu&apos;ils en disent</h2>
          </div>
        </div>
        <div className="overflow-hidden cursor-grab active:cursor-grabbing select-none">
          <div ref={testimonialsInnerRef} className="flex gap-4" style={{ width: "max-content" }}>
            {[...Array(2)].flatMap((_, copy) =>
              [
                { quote: "Le coach IA m'a aidé à sortir d'un plateau sur le squat en 2 semaines. Des conseils vraiment adaptés à mes données.", name: "Marc D.", role: "Powerlifter amateur", stars: 5 },
                { quote: "La nutrition IA calcule mes besoins selon mon objectif et mon poids. Bien plus précis que les calculateurs en ligne.", name: "Léa M.", role: "Musculation & fitness", stars: 5 },
                { quote: "L'interface est super rapide à utiliser entre les séries. Pas besoin de naviguer partout, tout est accessible.", name: "Thomas R.", role: "Athlète naturel", stars: 5 },
                { quote: "Le mode dégressif et les exercices unilatéraux sont enfin bien gérés. C'est fait par quelqu'un qui s'entraîne vraiment.", name: "Karim B.", role: "PPL 5j/semaine", stars: 5 },
              ].map((t, i) => (
                <div key={`${copy}-${i}`} className="shrink-0 w-72 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <svg key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 font-medium leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{t.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-white px-5 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="reveal mb-8">
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2">Tarifs</p>
            <h2 className="text-3xl font-extrabold text-gray-900 font-[family-name:var(--font-barlow-condensed)]">Simple et transparent</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="reveal rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Gratuit</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-gray-900">0€</span>
                  <span className="text-sm text-gray-400 font-medium">/ mois</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 text-xs text-gray-600 font-medium flex-1">
                {["Journal illimité", "Activités cardio", "Profil & objectifs", "Coach IA (limité)", "Nutrition IA (locked)"].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={ctaHref} className="text-center py-2.5 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-violet-400 hover:text-violet-600 transition-colors">
                {email ? "Mon compte" : "Commencer →"}
              </a>
            </div>
            {/* Premium */}
            <div className="reveal relative overflow-hidden rounded-2xl bg-gray-950 p-6 flex flex-col gap-5">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-violet-700/30 blur-2xl" />
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.08) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Premium</p>
                  <span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Le plus populaire</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">14.99€</span>
                  <span className="text-sm text-gray-500 font-medium">/ mois</span>
                </div>
              </div>
              <ul className="relative z-10 flex flex-col gap-2.5 text-xs text-gray-400 font-medium flex-1">
                {["Journal illimité", "Activités cardio", "Coach IA illimité", "Nutrition IA complète", "Analyses croisées"].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>
              <a href={plan?.includes("premium") ? "/app/profil" : "/pricing"} className="relative z-10 text-center py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-violet-900/40">
                {plan?.includes("premium") ? "Mon compte" : "Passer Premium →"}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-950 px-5 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="reveal mb-8">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl font-extrabold text-white font-[family-name:var(--font-barlow-condensed)]">Questions fréquentes</h2>
          </div>
          <div className="reveal rounded-2xl border border-white/10 bg-white/3 px-5 divide-y divide-white/10 overflow-hidden">
            {FAQ_ITEMS.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-violet-700 px-5 py-16 text-center">
        <div className="absolute -top-16 left-1/4 w-48 h-48 rounded-full bg-violet-600/40 blur-3xl" />
        <div className="absolute -bottom-16 right-1/4 w-56 h-56 rounded-full bg-violet-800/40 blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-lg mx-auto">
          <h2 className="text-4xl font-extrabold text-white mb-3 font-[family-name:var(--font-barlow-condensed)]">Prêt à progresser ?</h2>
          <p className="text-violet-200 font-medium text-sm mb-7">Démarrez gratuitement. Passez Premium quand vous voulez.</p>
          <a href={ctaHref} className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold text-sm px-8 py-3.5 rounded-2xl hover:bg-violet-50 transition-colors shadow-xl">
            {email ? "Aller au dashboard" : "Commencer gratuitement"}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </a>
          {!email && <p className="text-violet-300/70 text-xs font-medium mt-3">Aucune carte · Sans engagement</p>}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 px-5 py-8 flex flex-col items-center gap-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <AppLogo size={22} variant="light" />
          <span className="text-white font-extrabold text-sm">{APP_NAME}</span>
        </div>
        <div className="flex gap-6 text-xs font-semibold text-gray-500">
          <a href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</a>
          <a href="/conditions" className="hover:text-white transition-colors">Conditions</a>
          <a href="/support" className="hover:text-white transition-colors">Support</a>
        </div>
        <span className="text-xs font-medium text-gray-700">© {new Date().getFullYear()} {APP_NAME}</span>
      </footer>

      {/* LOGOUT MODAL */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xs shadow-2xl">
            <h3 className="text-lg font-extrabold text-gray-900 mb-2">Se déconnecter ?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Vous serez redirigé vers la page de connexion.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 transition-colors">Annuler</button>
              <button onClick={handleLogout} className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-gray-700 transition-colors">Déconnexion</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
