"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import LoadingScreen from "@/components/LoadingScreen"

const APP_NAME = "RepAI"

const FAQ_ITEMS = [
  {
    q: `${APP_NAME} est-il gratuit ?`,
    a: `Oui, ${APP_NAME} propose un plan gratuit pour toujours. Il inclut un journal illimité et 5 analyses IA par mois. Aucune carte bancaire requise.`,
  },
  {
    q: "Quel modèle IA est utilisé ?",
    a: `${APP_NAME} utilise Groq avec le modèle Llama 3.3 70B. Les réponses sont ultra-rapides — moins de 10 secondes par analyse.`,
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Vos données sont hébergées sur Supabase (serveurs en Europe/US), chiffrées au repos et en transit. Elles ne sont jamais vendues ni partagées.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui, aucun engagement. Vous pouvez annuler votre abonnement Pro directement depuis le portail Stripe, accessible depuis votre compte.",
  },
  {
    q: `${APP_NAME} fonctionne-t-il sur mobile ?`,
    a: "Oui. L'interface est 100% responsive et conçue pour fonctionner aussi bien sur smartphone que sur ordinateur.",
  },
  {
    q: "Puis-je suivre tous types d'exercices ?",
    a: "Oui ! Musculation, cardio, crossfit... Vous pouvez logger n'importe quel exercice avec reps, charges, durée et RPE.",
  },
]

export default function HomePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const testimonialRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const [tScales, setTScales] = useState([1, 1, 1])

  function handleTestimonialsMove(e: React.MouseEvent) {
    const FALLOFF = 320
    const proximities = testimonialRefs.current.map(el => {
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2)
      return Math.max(0, 1 - dist / FALLOFF)
    })
    const maxP = Math.max(...proximities)
    if (maxP < 0.02) { setTScales([1, 1, 1]); return }
    setTScales(proximities.map(p => {
      const norm = p / maxP
      return 1 + maxP * (norm * 0.12 - (1 - norm) * 0.12)
    }))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const userEmail = session.user.email ?? null
        setEmail(userEmail)
        if (userEmail) {
          fetch(`/api/plan?email=${encodeURIComponent(userEmail)}`)
            .then(r => r.json())
            .then(d => setPlan(d.plan ?? "free"))
            .catch(() => {})
        }
      }
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const els = Array.from(document.querySelectorAll<HTMLElement>(".fade-section"))
    els.forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.top > window.innerHeight * 0.7) {
        el.style.opacity = "0"
        el.style.transform = "translateY(32px)"
      }
    })
    const update = () => {
      els.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight * 0.65 && rect.bottom > 0) {
          el.style.opacity = "1"
          el.style.transform = "translateY(0)"
        } else if (rect.bottom < 0) {
          el.style.opacity = "0"
          el.style.transform = "translateY(-16px)"
        }
      })
    }
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [ready])

  async function handleLogout() {
    await supabase.auth.signOut()
    setEmail(null)
    setConfirm(false)
  }

  if (!ready) return <LoadingScreen />

  const ctaHref = email ? "/app" : "/login"

  return (
    <main className="min-h-screen text-gray-900">

      {/* NAVBAR */}
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 backdrop-blur-md border border-white/30 shadow-md">
        <a href={email ? "/app" : "/"} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900">{APP_NAME}</span>
        </a>
        <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500 absolute left-1/2 -translate-x-1/2">
          <a href="#features" className="hover:text-gray-900 transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Tarifs</a>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {email ? (
            <button onClick={() => setConfirm(true)} className="text-sm font-bold text-gray-600 px-3 md:px-4 py-2 rounded-full border border-gray-200 hover:border-gray-400 hover:text-gray-900 transition-colors">
              Déconnexion
            </button>
          ) : (
            <a href="/login" className="text-sm font-bold text-gray-600 px-3 md:px-4 py-2 rounded-full border border-gray-200 hover:border-gray-400 transition-colors">
              Connexion
            </a>
          )}
          <a href={ctaHref} className="bg-violet-600 text-white font-bold text-sm px-4 md:px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors">
            {email ? "Mon dashboard →" : "Commencer gratuitement →"}
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-violet-700 text-white px-4 md:px-10 pt-32 pb-16 min-h-screen flex flex-col justify-center">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/50" />
        <div className="absolute bottom-[-80px] left-[15%] w-72 h-72 rounded-full bg-violet-800/50" />
        <div className="absolute top-20 left-[40%] w-32 h-32 rounded-full bg-violet-500/30" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-4">Suivi de performance sportive par IA</p>
          <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-none tracking-tight mb-6">
            Trackez vos séances.<br />Visualisez vos progrès.<br />
            <span className="text-violet-200">Progressez avec l&apos;IA.</span>
          </h1>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <p className="text-base font-medium text-violet-100 max-w-md leading-relaxed">
              {APP_NAME} vous permet de logger vos entraînements (séries, reps, charges), de visualiser vos progressions sur des graphiques, et de recevoir des conseils personnalisés d&apos;un coach IA basés sur vos vraies données.
            </p>
            <div className="flex flex-col gap-3 md:items-end shrink-0">
              <a href={ctaHref} className="bg-white text-violet-700 font-bold text-sm px-8 py-3.5 rounded-full hover:bg-violet-50 transition-colors text-center">
                {email ? "Aller au dashboard →" : "Démarrer gratuitement →"}
              </a>
              <a href="/app" className="border border-white/30 text-white font-semibold text-sm px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors text-center">
                Voir la démo
              </a>
              {!email && <p className="text-violet-200 text-xs font-medium text-center md:text-right">Aucune carte bancaire · Gratuit pour toujours</p>}
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 gap-6 md:flex md:gap-12 mt-10 pt-8 border-t border-white/20">
            {[
              { value: "∞", label: "séances à logger" },
              { value: "< 10s", label: "par analyse IA" },
              { value: "Gratuit", label: "plan disponible" },
              { value: "100%", label: "responsive & mobile" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-4xl font-extrabold">{s.value}</p>
                <p className="text-violet-200 font-medium text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white px-4 md:px-10 py-24">
        <div className="fade-section max-w-5xl mx-auto" style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}>
          <p className="text-xs text-violet-600 font-bold uppercase tracking-widest mb-4">Comment ça marche</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-16 max-w-lg">
            Prêt en 3 étapes simples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Loggez vos séances",
                desc: "Enregistrez vos exercices, séries, répétitions et charges après chaque entraînement. Interface rapide et intuitive.",
              },
              {
                step: "2",
                title: "Visualisez vos progrès",
                desc: "Consultez vos graphiques de progression, vos records personnels et la distribution de votre volume d'entraînement.",
              },
              {
                step: "3",
                title: "Obtenez des conseils IA",
                desc: "Le coach IA analyse vos données réelles pour vous donner des recommandations personnalisées et scientifiques.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-xl font-extrabold text-violet-600">{item.step}</span>
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900 mb-2">{item.title}</p>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-gray-100 px-4 md:px-10 py-24">
        <div className="fade-section max-w-5xl mx-auto" style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}>
          <p className="text-xs text-violet-600 font-bold uppercase tracking-widest mb-4">Fonctionnalités</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-16 max-w-lg">
            Tout ce dont vous avez besoin
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: "📝",
                title: "Journal d'entraînement",
                desc: "Loggez chaque séance avec exercices, séries, répétitions, charges et RPE. Historique complet accessible.",
              },
              {
                icon: "📈",
                title: "Graphiques de progression",
                desc: "Visualisez votre progression sur les exercices principaux (squat, bench, deadlift...) au fil du temps.",
              },
              {
                icon: "🏆",
                title: "Records personnels",
                desc: "Calcul automatique de votre 1RM estimé (formule Brzycki) et suivi de vos PR par exercice.",
              },
              {
                icon: "🤖",
                title: "Coach IA personnalisé",
                desc: "Posez vos questions — le coach IA analyse vos vraies données pour vous donner des conseils sur mesure.",
              },
              {
                icon: "📊",
                title: "Analyse du volume",
                desc: "Visualisez la distribution de votre volume d'entraînement par exercice et par groupe musculaire.",
              },
              {
                icon: "💳",
                title: "Plans Free & Pro",
                desc: "Commencez gratuitement, passez Pro quand vous avez besoin de plus d'analyses IA. Sans engagement.",
              },
            ].map(f => (
              <div key={f.title} className="p-5 rounded-2xl bg-white border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all">
                <p className="text-2xl mb-3">{f.icon}</p>
                <p className="text-sm font-bold text-gray-900 mb-1">{f.title}</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative overflow-hidden bg-gray-950 text-white px-4 md:px-10 py-24">
        <div className="absolute top-[-60px] right-[-60px] w-80 h-80 rounded-full bg-violet-900/40" />
        <div className="absolute bottom-[-40px] left-[10%] w-48 h-48 rounded-full bg-violet-900/30" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-xs text-violet-400 font-bold uppercase tracking-widest mb-4">Témoignages</p>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-16">Ce que disent nos utilisateurs</h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-center"
            onMouseMove={handleTestimonialsMove}
            onMouseLeave={() => setTScales([1, 1, 1])}
          >
            {[
              {
                quote: "Enfin une app qui comprend vraiment le tracking de force. Le coach IA m'a aidé à sortir d'un plateau sur le squat en 2 semaines.",
                name: "Marc D.",
                role: "Powerlifter amateur",
              },
              {
                quote: "Les graphiques de progression sont exactement ce qu'il me fallait. Je vois clairement mes tendances et ça me motive à continuer.",
                name: "Léa M.",
                role: "CrossFit & musculation",
              },
              {
                quote: "Le coach IA donne des conseils vraiment pertinents basés sur mes vraies données, pas des généralités. C'est impressionnant.",
                name: "Thomas R.",
                role: "Athlète naturel",
              },
            ].map((t, i) => (
              <div
                key={t.name}
                ref={el => { testimonialRefs.current[i] = el }}
                style={{ transform: `scale(${tScales[i]})`, transition: "transform 0.12s ease" }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-gray-300 font-medium leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-gray-100 px-4 md:px-10 py-24">
        <div className="fade-section max-w-3xl mx-auto" style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}>
          <p className="text-xs text-violet-600 font-bold uppercase tracking-widest mb-4">Tarifs</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-16">Simple et transparent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="p-8 rounded-2xl bg-white border border-gray-200 flex flex-col gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Gratuit</p>
                <p className="text-5xl font-extrabold text-gray-900">$0</p>
                <p className="text-sm text-gray-400 font-medium mt-1">Pour toujours</p>
              </div>
              <ul className="flex flex-col gap-3 text-sm text-gray-600 font-medium flex-1">
                {[
                  "Journal illimité",
                  "Tous les exercices",
                  "Graphiques de base",
                  "5 analyses IA / mois",
                  "Records personnels",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {plan !== "pro" && (
                <a href={ctaHref} className="text-center py-3 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-700 hover:border-violet-400 hover:text-violet-600 transition-colors">
                  {email ? "Mon compte" : "Commencer gratuitement"}
                </a>
              )}
            </div>

            <div className="relative overflow-hidden p-8 rounded-2xl bg-violet-700 text-white flex flex-col gap-6">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-violet-600/50" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-violet-800/50" />
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative z-10">
                <span className="inline-block bg-white text-violet-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                  Plus populaire
                </span>
                <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-3">Pro</p>
                <p className="text-5xl font-extrabold">$19</p>
                <p className="text-sm text-violet-200 font-medium mt-1">par mois · sans engagement</p>
              </div>
              <ul className="relative z-10 flex flex-col gap-3 text-sm text-violet-100 font-medium flex-1">
                {[
                  "Journal illimité",
                  "Analyses IA illimitées",
                  "Graphiques avancés",
                  "Export des données",
                  "Support prioritaire",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {plan === "pro" ? (
                <a href="/app/profil" className="relative z-10 text-center py-3 bg-white text-violet-700 rounded-full text-sm font-bold hover:bg-violet-50 transition-colors">
                  Mon compte
                </a>
              ) : (
                <a href="/pricing" className="relative z-10 text-center py-3 bg-white text-violet-700 rounded-full text-sm font-bold hover:bg-violet-50 transition-colors">
                  {email ? "Passer Pro →" : "Essayer Pro →"}
                </a>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-100 px-4 md:px-10 py-24 border-t border-gray-200">
        <div className="fade-section max-w-3xl mx-auto" style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}>
          <p className="text-xs text-violet-600 font-bold uppercase tracking-widest mb-4">FAQ</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-16">Questions fréquentes</h2>
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
                >
                  <span className="text-sm font-bold text-gray-900">{item.q}</span>
                  <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center transition-transform" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-violet-700 px-4 md:px-10 py-24 text-center text-white">
        <div className="absolute -top-20 left-[10%] w-64 h-64 rounded-full bg-violet-600/40" />
        <div className="absolute -bottom-20 right-[10%] w-80 h-80 rounded-full bg-violet-800/40" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">Prêt à progresser ?</h2>
          <p className="text-violet-200 font-medium text-lg mb-10 max-w-xl mx-auto">
            Démarrez gratuitement, sans carte bancaire. Passez Pro quand vous avez besoin de plus d&apos;analyses IA.
          </p>
          <a href={ctaHref} className="inline-block bg-white text-violet-700 font-bold text-base px-10 py-4 rounded-full hover:bg-violet-50 transition-colors">
            {email ? "Aller au dashboard →" : "Commencer gratuitement →"}
          </a>
          {!email && <p className="text-violet-300 font-medium text-xs mt-4">Aucune carte · Annulez à tout moment</p>}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-500 px-4 md:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-white font-extrabold">{APP_NAME}</span>
        </div>
        <div className="flex gap-8 text-sm font-semibold">
          <a href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</a>
          <a href="/conditions" className="hover:text-white transition-colors">Conditions</a>
          <a href="/support" className="hover:text-white transition-colors">Support</a>
        </div>
        <span className="text-xs font-medium">© {new Date().getFullYear()} {APP_NAME}</span>
      </footer>

      {/* LOGOUT MODAL */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Se déconnecter ?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Vous serez redirigé vers la page de connexion.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 transition-colors">
                Annuler
              </button>
              <button onClick={handleLogout} className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-gray-700 transition-colors">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
