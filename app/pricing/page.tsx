"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import LoadingScreen from "@/components/LoadingScreen"

// TODO: Replace with your actual Stripe price ID
const PRO_PRICE_ID = "price_YOUR_STRIPE_PRICE_ID"
const APP_NAME = "RepAI"

export default function PricingPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const userEmail = session.user.email ?? null
        setEmail(userEmail)
        if (userEmail) {
          fetch(`/api/plan?email=${encodeURIComponent(userEmail)}`)
            .then(r => r.json())
            .then(d => setPlan(d.plan ?? "free"))
        }
      }
      setReady(true)
    })
  }, [])

  if (!ready) return <LoadingScreen />

  async function handleSubscribe() {
    if (!email) { window.location.href = "/login"; return }
    setLoading(true)
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: PRO_PRICE_ID, email })
    })
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white sticky top-0 z-50">
        <a href="/" className="font-extrabold text-lg tracking-tight text-gray-900">{APP_NAME}</a>
        <a href={email ? "/app/profil" : "/login"} className="bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors">
          {email ? "My account" : "Sign in"}
        </a>
      </nav>

      {/* HEADER */}
      <div className="relative overflow-hidden bg-violet-700 text-white px-10 pt-20 pb-20">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-violet-600/50" />
        <div className="absolute bottom-[-50px] left-[20%] w-48 h-48 rounded-full bg-violet-800/40" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-4xl mx-auto">
          <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-4">Pricing</p>
          <h1 className="text-7xl font-extrabold leading-none mb-4">Simple and<br />transparent</h1>
          <p className="text-violet-200 font-medium text-lg max-w-md">Start for free. Upgrade when you&apos;re ready. Cancel whenever.</p>
        </div>
      </div>

      {/* PRICING CARDS */}
      <div className="bg-gray-100 px-10 py-16">
        <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* FREE */}
          <div className="p-8 rounded-2xl bg-white border border-gray-200 flex flex-col gap-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Free</p>
              {/* TODO: Update pricing */}
              <p className="text-5xl font-extrabold text-gray-900">$0</p>
              <p className="text-sm text-gray-400 font-medium mt-1">Forever free</p>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-gray-600 font-medium flex-1">
              {["5 items", "5 AI generations / month", "All generation types", "Generation history"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-300 shrink-0"></span>{f}
                </li>
              ))}
            </ul>
            {plan !== "pro" && (
              <a href={email ? "/app/profil" : "/login"} className="text-center py-3 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-700 hover:border-violet-400 hover:text-violet-600 transition-colors">
                {email ? "My account" : "Get started free"}
              </a>
            )}
          </div>

          {/* PRO */}
          <div className="relative overflow-hidden p-8 rounded-2xl bg-violet-700 text-white flex flex-col gap-6">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-violet-600/50" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-violet-800/50" />
            <span className="relative z-10 absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
              Most popular
            </span>
            <div className="relative z-10">
              <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-3">Pro</p>
              {/* TODO: Update pricing */}
              <p className="text-5xl font-extrabold">$29</p>
              <p className="text-sm text-violet-200 font-medium mt-1">per month · no commitment</p>
            </div>
            <ul className="relative z-10 flex flex-col gap-3 text-sm text-violet-100 font-medium flex-1">
              {["Unlimited items", "Unlimited AI generations", "All generation types", "Stripe invoice access", "Priority support"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>{f}
                </li>
              ))}
            </ul>
            {plan === "pro" ? (
              <a href="/app" className="relative z-10 text-center py-3 bg-white text-violet-700 font-bold rounded-full text-sm hover:bg-violet-50 transition-colors">
                My account
              </a>
            ) : (
              <>
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="relative z-10 py-3 bg-white text-violet-700 font-bold rounded-full text-sm hover:bg-violet-50 transition-colors disabled:opacity-50"
                >
                  {loading ? "Loading..." : email ? "Subscribe now →" : "Sign in to subscribe →"}
                </button>
                {email && <p className="relative z-10 text-xs text-violet-200 font-medium text-center -mt-3">Signed in as: {email}</p>}
              </>
            )}
          </div>

        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h3 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">Frequently asked questions</h3>
          <div className="flex flex-col gap-4">
            {[
              { q: "Can I cancel at any time?", a: "Yes, no commitment. Cancellation takes effect at the end of the current billing period." },
              { q: "What happens when I reach the free plan limits?", a: "You won't be able to create new items or AI generations until the end of the month. You can upgrade to Pro at any time to remove limits." },
              { q: "Is my data secure?", a: "Yes. Your data is stored on secure servers (Supabase / PostgreSQL) and is never shared with third parties." },
            ].map(item => (
              <div key={item.q} className="p-5 bg-white border border-gray-200 rounded-2xl">
                <p className="font-bold text-sm text-gray-900 mb-2">{item.q}</p>
                <p className="text-sm text-gray-500 font-medium">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
