"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import Toast from "@/components/Toast"

export default function ProfilPage() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [telephone, setTelephone] = useState("")
  const [company, setCompany] = useState("")
  const [plan, setPlan] = useState("free")
  const [toast, setToast] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setEmail(session.user.email ?? "")
      const user = await authFetch("/api/users").then(r => r.json())
      if (user?.name) setName(user.name)
      if (user?.telephone) setTelephone(user.telephone)
      if (user?.company) setCompany(user.company)
      if (user?.plan) setPlan(user.plan)
      setReady(true)
    })
  }, [])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingName(true)
    const res = await authFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), telephone: telephone.trim() || null, company: company.trim() || null }),
    })
    setSavingName(false)
    if (res.ok) showToast("Profile updated")
    else showToast("Error updating profile")
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { showToast("Passwords do not match"); return }
    if (newPassword.length < 6) { showToast("Password too short (min 6 characters)"); return }
    setSavingPassword(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (signInError) { showToast("Current password is incorrect"); setSavingPassword(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) showToast("Error: " + error.message)
    else {
      showToast("Password updated")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  async function handleBillingPortal() {
    setBillingLoading(true)
    const res = await authFetch("/api/billing-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const { url, error } = await res.json()
    setBillingLoading(false)
    if (error) { showToast(error); return }
    window.location.href = url
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  if (!ready) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40">
        <h1 className="text-lg font-extrabold text-gray-900">My profile</h1>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-6 md:px-6 md:py-10 flex flex-col gap-4 md:gap-6">

        {/* Plan */}
        <div className={`relative overflow-hidden p-6 rounded-2xl border ${plan === "pro" ? "bg-violet-700 text-white border-violet-700" : "bg-white border-gray-200"}`}>
          {plan === "pro" && (
            <>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-violet-600/50" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-violet-800/50" />
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            </>
          )}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan === "pro" ? "text-violet-200" : "text-gray-400"}`}>Current plan</p>
                <p className={`text-2xl font-extrabold ${plan === "pro" ? "text-white" : "text-gray-900"}`}>{plan === "pro" ? "Pro" : "Free"}</p>
              </div>
              <span className={`text-3xl font-extrabold ${plan === "pro" ? "text-violet-200" : "text-gray-200"}`}>{plan === "pro" ? "$29" : "$0"}</span>
            </div>
            {plan === "free" ? (
              <a href="/pricing" className="inline-block px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors">
                Upgrade to Pro — $29/month →
              </a>
            ) : (
              <button
                onClick={handleBillingPortal}
                disabled={billingLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {billingLoading ? "Loading..." : "Manage subscription"}
              </button>
            )}
          </div>
        </div>

        {/* General info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Information</p>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Email address</label>
            <p className="text-sm font-medium text-gray-400 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">{email}</p>
          </div>
          <form onSubmit={handleSaveName} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: John Doe"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="Ex: +1 234 567 8900"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Company <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Ex: Acme Corp"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
              />
            </div>
            <button type="submit" disabled={savingName || !name.trim()} className="self-start px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50">
              {savingName ? "Saving..." : "Save"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Change password</p>
          <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Current password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="self-start px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
              {savingPassword ? "Updating..." : "Change password"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Session</p>
          <button onClick={handleLogout} className="px-5 py-2.5 border-2 border-gray-200 text-sm font-bold text-gray-600 rounded-xl hover:border-gray-400 hover:text-gray-900 transition-colors">
            Sign out
          </button>
        </div>

      </div>

      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </div>
  )
}
