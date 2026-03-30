"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import AppLogo from "@/components/AppLogo"

const FREE_FEATURES = [
  "5 séances par mois",
  "5 repas par mois",
  "1 question coach par semaine",
  "Calories uniquement",
  "Historique 7 jours",
  "Réponses IA génériques",
]

const PREMIUM_FEATURES = [
  "Séances & activités illimitées",
  "Repas illimités",
  "Questions coach illimitées",
  "Macros complètes (P/G/L)",
  "Historique complet",
  "Graphiques de progression",
  "Conseils IA personnalisés",
]

const PREMIUM_PLUS_FEATURES = [
  "Tout Premium inclus",
  "IA avancée avec analyse croisée",
  "Détection de patterns sport/nutrition",
  "Prédictions fatigue & stagnation",
  "Recommandations dynamiques",
  "Analyse récupération",
]

const PREMIUM_PRICE_ID = process.env.NEXT_PUBLIC_PREMIUM_PRICE_ID!
const PREMIUM_PLUS_PRICE_ID = process.env.NEXT_PUBLIC_PREMIUM_PLUS_PRICE_ID!

export default function PricingPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setEmail(session.user.email ?? null)
        authFetch("/api/plan")
          .then(r => r.json())
          .then(d => setPlan(d.plan ?? "free"))
          .catch(() => {})
      }
      setReady(true)
    })
  }, [])

  if (!ready) return <LoadingScreen />

  const isSubscribed = plan === "premium" || plan === "premium_plus" || plan === "pro"
  const isCurrent = (p: string) => plan === p || (p === "premium" && plan === "pro")

  async function handleSubscribe(priceId: string, tier: string) {
    if (!email) { window.location.href = "/login"; return }
    setLoading(tier)
    try {
      // If already subscribed, go to billing portal to upgrade/downgrade
      if (isSubscribed) {
        const res = await authFetch("/api/billing-portal", { method: "POST" })
        const data = await res.json()
        if (data.url) { window.location.href = data.url; return }
        setLoading(null)
        return
      }
      // New subscription via Stripe Checkout
      const res = await authFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.redirectToBillingPortal) {
        const portalRes = await authFetch("/api/billing-portal", { method: "POST" })
        const portalData = await portalRes.json()
        if (portalData.url) { window.location.href = portalData.url; return }
      }
      if (data.url) { window.location.href = data.url; return }
      setLoading(null)
    } catch { setLoading(null) }
  }

  async function handleManage() {
    if (!email) { window.location.href = "/login"; return }
    setLoading("manage")
    try {
      const res = await authFetch("/api/billing-portal", { method: "POST" })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
    } catch { /* ignore */ }
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-gray-100 bg-white sticky top-0 z-50">
        <a href="/" className="flex items-center gap-2">
          <AppLogo size={28} variant="dark" />
          <span className="font-extrabold text-lg tracking-tight text-gray-900">RepAI</span>
        </a>
        <a href={email ? "/app" : "/login"} className="bg-gray-900 text-white font-bold text-sm px-4 py-2 rounded-full hover:bg-gray-700 transition-colors">
          {email ? "Mon espace" : "Se connecter"}
        </a>
      </nav>

      {/* HEADER */}
      <div className="relative overflow-hidden bg-gray-900 text-white px-6 md:px-10 pt-16 pb-20">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Choisissez votre plan</p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-none mb-4">Transformez vos données<br />en résultats</h1>
          <p className="text-gray-400 font-medium text-lg max-w-md mx-auto">Du suivi simple à l&apos;IA d&apos;élite — choisissez le niveau qui correspond à vos ambitions.</p>
        </div>
      </div>

      {/* PRICING CARDS */}
      <div className="bg-gray-100 px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">

          {/* FREE */}
          <div className="p-6 rounded-2xl bg-white border border-gray-200 flex flex-col gap-5">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Gratuit</p>
              <p className="text-4xl font-extrabold text-gray-900">0€</p>
              <p className="text-sm text-gray-400 font-medium mt-1">Pour toujours</p>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm text-gray-500 font-medium flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1.5" />{f}
                </li>
              ))}
            </ul>
            {isCurrent("free") && !plan ? (
              <a href={email ? "/app" : "/login"} className="text-center py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-300 transition-colors">
                {email ? "Plan actuel" : "Commencer"}
              </a>
            ) : isCurrent("free") ? (
              <div className="text-center py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-400">Plan actuel</div>
            ) : (
              <a href={email ? "/app" : "/login"} className="text-center py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-300 transition-colors">
                {email ? "Mon espace" : "Commencer gratuitement"}
              </a>
            )}
          </div>

          {/* PREMIUM */}
          <div className="relative p-6 rounded-2xl bg-white border-2 border-gray-900 flex flex-col gap-5">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
              Le plus populaire
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Premium</p>
              <div className="flex items-end gap-1">
                <p className="text-4xl font-extrabold text-gray-900">14,99€</p>
                <p className="text-sm text-gray-400 font-medium mb-1">/mois</p>
              </div>
              <p className="text-sm text-gray-400 font-medium mt-0.5">Sans engagement</p>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm text-gray-700 font-medium flex-1">
              {PREMIUM_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-900 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {isCurrent("premium") ? (
              <div className="flex flex-col gap-2">
                <div className="text-center py-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-500">Plan actuel</div>
                <button onClick={handleManage} disabled={loading === "manage"} className="text-center py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                  {loading === "manage" ? "Chargement…" : "Gérer mon abonnement →"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSubscribe(PREMIUM_PRICE_ID, "premium")}
                disabled={loading === "premium"}
                className="py-3 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading === "premium" ? "Chargement…" : email ? (isSubscribed ? "Changer de plan →" : "S'abonner →") : "Se connecter →"}
              </button>
            )}
          </div>

          {/* PREMIUM+ */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-violet-700 text-white flex flex-col gap-5">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet-600/40" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-violet-800/40" />
            <div className="relative z-10">
              <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-2">Premium+</p>
              <div className="flex items-end gap-1">
                <p className="text-4xl font-extrabold">24,99€</p>
                <p className="text-sm text-violet-300 font-medium mb-1">/mois</p>
              </div>
              <p className="text-sm text-violet-300 font-medium mt-0.5">Sans engagement</p>
            </div>
            <ul className="relative z-10 flex flex-col gap-2.5 text-sm text-violet-100 font-medium flex-1">
              {PREMIUM_PLUS_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {isCurrent("premium_plus") ? (
              <div className="relative z-10 flex flex-col gap-2">
                <div className="text-center py-3 bg-violet-600 rounded-xl text-sm font-bold text-white">Plan actuel</div>
                <button onClick={handleManage} disabled={loading === "manage"} className="text-center py-2 text-xs font-bold text-violet-300 hover:text-white transition-colors disabled:opacity-50">
                  {loading === "manage" ? "Chargement…" : "Gérer mon abonnement →"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSubscribe(PREMIUM_PLUS_PRICE_ID, "premium_plus")}
                disabled={loading === "premium_plus"}
                className="relative z-10 py-3 bg-white text-violet-700 font-bold rounded-xl text-sm hover:bg-violet-50 transition-colors disabled:opacity-50"
              >
                {loading === "premium_plus" ? "Chargement…" : email ? (isSubscribed ? "Changer de plan →" : "S'abonner →") : "Se connecter →"}
              </button>
            )}
          </div>

        </div>

        {/* Comparison note */}
        <p className="text-center text-xs text-gray-400 font-medium mt-8">Tous les plans incluent la synchronisation multi-appareils et le stockage sécurisé des données.</p>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-12">
          <h3 className="text-xl font-extrabold text-gray-900 mb-6 text-center">Questions fréquentes</h3>
          <div className="flex flex-col gap-3">
            {[
              { q: "Puis-je annuler à tout moment ?", a: "Oui, sans engagement. L'annulation prend effet à la fin de la période de facturation en cours." },
              { q: "Quelle est la différence entre Premium et Premium+ ?", a: "Premium donne accès à toutes les fonctionnalités de suivi et des conseils personnalisés. Premium+ ajoute une IA avancée qui détecte des patterns dans vos données, corrèle sport et nutrition, et prédit votre progression." },
              { q: "Mes données sont-elles sécurisées ?", a: "Oui. Vos données sont stockées sur des serveurs sécurisés (Supabase / PostgreSQL) et ne sont jamais partagées avec des tiers." },
              { q: "Que se passe-t-il quand j'atteins les limites du plan gratuit ?", a: "Vous ne pourrez plus ajouter de séances ou de repas jusqu'à la fin du mois, ou upgrader à tout moment pour continuer." },
            ].map(item => (
              <div key={item.q} className="p-4 bg-white border border-gray-200 rounded-2xl">
                <p className="font-bold text-sm text-gray-900 mb-1.5">{item.q}</p>
                <p className="text-sm text-gray-500 font-medium">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
