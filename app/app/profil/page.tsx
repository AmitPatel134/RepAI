"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import Toast from "@/components/Toast"

const GOALS = [
  { value: "prise_de_masse", label: "Prise de masse", icon: "💪" },
  { value: "perte_de_poids", label: "Perte de poids", icon: "🔥" },
  { value: "performance_cardio", label: "Performance cardio", icon: "🏃" },
  { value: "sante_cardiaque", label: "Santé cardiaque", icon: "❤️" },
  { value: "endurance", label: "Endurance", icon: "🚴" },
  { value: "force_max", label: "Force maximale", icon: "🏋️" },
  { value: "flexibilite", label: "Souplesse & mobilité", icon: "🧘" },
  { value: "maintien", label: "Maintien du poids", icon: "⚖️" },
  { value: "bien_etre", label: "Bien-être général", icon: "🌿" },
  { value: "competition", label: "Compétition sportive", icon: "🏆" },
  { value: "reeducation", label: "Rééducation", icon: "🩹" },
]

const ACTIVITY_LEVELS = [
  { value: "sedentaire", label: "Sédentaire", desc: "Peu ou pas d'exercice" },
  { value: "leger", label: "Légèrement actif", desc: "1–3 jours/semaine" },
  { value: "modere", label: "Modérément actif", desc: "3–5 jours/semaine" },
  { value: "actif", label: "Très actif", desc: "6–7 jours/semaine" },
  { value: "tres_actif", label: "Extrêmement actif", desc: "Sport intensif + travail physique" },
]

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
  const [savingFitness, setSavingFitness] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Fitness profile
  const [sex, setSex] = useState("")
  const [age, setAge] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [goal, setGoal] = useState("")
  const [activityLevel, setActivityLevel] = useState("")
  const [restingHR, setRestingHR] = useState("")
  const [dailySteps, setDailySteps] = useState("")

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setEmail(session.user.email ?? "")
      const [user, prof] = await Promise.all([
        authFetch("/api/users").then(r => r.json()).catch(() => null),
        authFetch("/api/profile").then(r => r.json()).catch(() => null),
      ])
      if (user?.name) setName(user.name)
      if (user?.telephone) setTelephone(user.telephone)
      if (user?.company) setCompany(user.company)
      if (user?.plan) setPlan(user.plan)
      if (prof) {
        if (prof.sex) setSex(prof.sex)
        if (prof.age) setAge(String(prof.age))
        if (prof.heightCm) setHeightCm(String(prof.heightCm))
        if (prof.weightKg) setWeightKg(String(prof.weightKg))
        if (prof.goal) setGoal(prof.goal)
        if (prof.activityLevel) setActivityLevel(prof.activityLevel)
        if (prof.restingHR) setRestingHR(String(prof.restingHR))
        if (prof.dailySteps) setDailySteps(String(prof.dailySteps))
      }
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
    if (res.ok) showToast("Profil mis à jour")
    else showToast("Erreur lors de la mise à jour")
  }

  async function handleSaveFitness(e: React.FormEvent) {
    e.preventDefault()
    setSavingFitness(true)
    const res = await authFetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sex: sex || null,
        age: age ? Number(age) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        goal: goal || null,
        activityLevel: activityLevel || null,
        restingHR: restingHR ? Number(restingHR) : null,
        dailySteps: dailySteps ? Number(dailySteps) : null,
      }),
    })
    setSavingFitness(false)
    if (res.ok) showToast("Données fitness mises à jour")
    else showToast("Erreur lors de la mise à jour")
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { showToast("Les mots de passe ne correspondent pas"); return }
    if (newPassword.length < 6) { showToast("Mot de passe trop court (min 6 caractères)"); return }
    setSavingPassword(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (signInError) { showToast("Mot de passe actuel incorrect"); setSavingPassword(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) showToast("Erreur : " + error.message)
    else {
      showToast("Mot de passe mis à jour")
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
        <h1 className="text-lg font-extrabold text-gray-900">Mon profil</h1>
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
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan === "pro" ? "text-violet-200" : "text-gray-400"}`}>Plan actuel</p>
                <p className={`text-2xl font-extrabold ${plan === "pro" ? "text-white" : "text-gray-900"}`}>{plan === "pro" ? "Pro" : "Gratuit"}</p>
              </div>
              <span className={`text-3xl font-extrabold ${plan === "pro" ? "text-violet-200" : "text-gray-200"}`}>{plan === "pro" ? "$29" : "$0"}</span>
            </div>
            {plan === "free" ? (
              <a href="/pricing" className="inline-block px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors">
                Passer Pro — $29/mois →
              </a>
            ) : (
              <button onClick={handleBillingPortal} disabled={billingLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                {billingLoading ? "Chargement..." : "Gérer l'abonnement"}
              </button>
            )}
          </div>
        </div>

        {/* Fitness profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Profil fitness</p>
          <form onSubmit={handleSaveFitness} className="flex flex-col gap-5">

            {/* Sexe */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Genre</label>
              <div className="flex gap-2">
                {[{ v: "homme", l: "Homme" }, { v: "femme", l: "Femme" }, { v: "autre", l: "Autre" }].map(({ v, l }) => (
                  <button type="button" key={v} onClick={() => setSex(sex === v ? "" : v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${sex === v ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Métriques */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Âge</label>
                <div className="relative">
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="28" min={10} max={100}
                    className="w-full px-3 py-2.5 pr-8 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">ans</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Taille</label>
                <div className="relative">
                  <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" min={100} max={250}
                    className="w-full px-3 py-2.5 pr-7 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">cm</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Poids</label>
                <div className="relative">
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="72" min={30} max={300} step={0.5}
                    className="w-full px-3 py-2.5 pr-7 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">kg</span>
                </div>
              </div>
            </div>

            {/* Objectif */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Objectif principal</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button type="button" key={g.value} onClick={() => setGoal(g.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors ${goal === g.value ? "bg-violet-50 border-violet-400 text-violet-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-violet-200"}`}>
                    <span className="text-base">{g.icon}</span>
                    <span className="text-xs font-bold">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Niveau d'activité */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Niveau d'activité</label>
              <div className="flex flex-col gap-1.5">
                {ACTIVITY_LEVELS.map(a => (
                  <button type="button" key={a.value} onClick={() => setActivityLevel(a.value)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${activityLevel === a.value ? "bg-violet-50 border-violet-400" : "bg-gray-50 border-gray-200 hover:border-violet-200"}`}>
                    <div>
                      <p className={`text-xs font-bold ${activityLevel === a.value ? "text-violet-700" : "text-gray-700"}`}>{a.label}</p>
                      <p className="text-[11px] text-gray-400">{a.desc}</p>
                    </div>
                    {activityLevel === a.value && (
                      <svg className="w-4 h-4 text-violet-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Données santé */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Données santé</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-gray-400 mb-1">FC au repos</p>
                  <div className="relative">
                    <input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="62" min={30} max={120}
                      className="w-full px-3 py-2.5 pr-10 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">bpm</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1">Pas/jour moyen</p>
                  <input type="number" value={dailySteps} onChange={e => setDailySteps(e.target.value)} placeholder="8000" min={0} max={50000}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                </div>
              </div>
              <div className="mt-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
                  La connexion directe à l'app Santé iPhone n'est pas disponible depuis le web. Saisis tes données manuellement — elles sont utilisées par le coach IA pour calculer tes zones cardio et personnaliser tes conseils.
                </p>
              </div>
            </div>

            <button type="submit" disabled={savingFitness}
              className="self-start px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50">
              {savingFitness ? "Enregistrement…" : "Enregistrer le profil fitness"}
            </button>
          </form>
        </div>

        {/* General info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Informations générales</p>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Adresse email</label>
            <p className="text-sm font-medium text-gray-400 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">{email}</p>
          </div>
          <form onSubmit={handleSaveName} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom complet</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Jean Dupont"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Téléphone <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Ex : +33 6 12 34 56 78"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <button type="submit" disabled={savingName || !name.trim()} className="self-start px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50">
              {savingName ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Changer le mot de passe</p>
          <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Mot de passe actuel</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nouveau mot de passe</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Confirmer le mot de passe</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
            </div>
            <button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="self-start px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
              {savingPassword ? "Mise à jour…" : "Changer le mot de passe"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Session</p>
          <button onClick={handleLogout} className="px-5 py-2.5 border-2 border-gray-200 text-sm font-bold text-gray-600 rounded-xl hover:border-gray-400 hover:text-gray-900 transition-colors">
            Se déconnecter
          </button>
        </div>

      </div>

      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </div>
  )
}
