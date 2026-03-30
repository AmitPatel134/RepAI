"use client"
import { useState, useEffect } from "react"
import { authFetch } from "@/lib/authFetch"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import LoadingScreen from "@/components/LoadingScreen"

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

export default function OnboardingPage() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [step, setStep] = useState(1)
  const [sex, setSex] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [goal, setGoal] = useState("")
  const [activityLevel, setActivityLevel] = useState("")
  const [restingHR, setRestingHR] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      // Load existing profile if any
      authFetch("/api/profile").then(r => r.json()).then(prof => {
        if (prof?.profileComplete) router.push("/app")
        else {
          if (prof?.birthDate) setBirthDate(prof.birthDate)
          if (prof?.heightCm) setHeightCm(String(prof.heightCm))
          if (prof?.weightKg) setWeightKg(String(prof.weightKg))
          if (prof?.sex) setSex(prof.sex)
          if (prof?.goal) setGoal(prof.goal)
          if (prof?.activityLevel) setActivityLevel(prof.activityLevel)
          if (prof?.restingHR) setRestingHR(String(prof.restingHR))
          setAuthReady(true)
        }
      }).catch(() => setAuthReady(true))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSteps = 3

  async function handleFinish() {
    if (!birthDate || !heightCm || !weightKg || !goal) {
      setError("Merci de remplir les champs obligatoires.")
      return
    }
    if (new Date(birthDate) > new Date()) { setError("La date de naissance ne peut pas être dans le futur."); return }
    const h = Number(heightCm), w = Number(weightKg)
    if (h < 50 || h > 300) { setError("Taille invalide (50–300 cm)."); return }
    if (w < 20 || w > 1000) { setError("Poids invalide (20–1000 kg)."); return }
    setSaving(true)
    setError("")
    try {
      const res = await authFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex: sex || null,
          birthDate,
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          goal,
          activityLevel: activityLevel || null,
          restingHR: restingHR ? Number(restingHR) : null,
        }),
      })
      if (res.ok) {
        window.location.href = "/app"
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Erreur lors de la sauvegarde. Réessayez.")
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.")
    }
    setSaving(false)
  }

  if (!authReady) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-3xl font-black text-gray-900 mb-1">Bienvenue sur RepAI 👋</p>
          <p className="text-gray-500 text-sm font-medium">Quelques infos pour personnaliser ton expérience</p>
          {/* Progress */}
          <div className="flex items-center gap-2 justify-center mt-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i < step ? "bg-violet-600 w-10" : "bg-gray-200 w-6"}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">Étape {step} sur {totalSteps}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">

          {/* Step 1: Infos de base */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-base font-extrabold text-gray-900 mb-4">Tes informations de base</p>

                {/* Sexe */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Genre <span className="text-gray-300 font-normal normal-case">(optionnel)</span></label>
                  <div className="flex gap-2">
                    {[{ v: "homme", l: "Homme" }, { v: "femme", l: "Femme" }, { v: "autre", l: "Autre" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setSex(sex === v ? "" : v)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${sex === v ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date de naissance */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Date de naissance <span className="text-red-400">*</span></label>
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    min={new Date(new Date().setFullYear(new Date().getFullYear() - 100)).toISOString().slice(0, 10)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400 transition-colors" />
                </div>

                {/* Taille */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Taille <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="Ex : 175" min={50} max={300}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">cm</span>
                  </div>
                </div>

                {/* Poids */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Poids <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Ex : 72" min={20} max={1000} step={0.5}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">kg</span>
                  </div>
                </div>
              </div>

              <button onClick={() => { if (birthDate && heightCm && weightKg) setStep(2); else setError("Remplis les champs obligatoires.") }}
                className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-colors">
                Continuer →
              </button>
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
          )}

          {/* Step 2: Objectif */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <p className="text-base font-extrabold text-gray-900">Quel est ton objectif principal ? <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g.value} onClick={() => setGoal(g.value)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-colors ${goal === g.value ? "bg-violet-50 border-violet-400 text-violet-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:border-violet-200"}`}>
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-xs font-bold leading-tight">{g.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  ← Retour
                </button>
                <button onClick={() => { if (goal) { setError(""); setStep(3) } else setError("Choisis un objectif.") }}
                  className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-colors">
                  Continuer →
                </button>
              </div>
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
          )}

          {/* Step 3: Niveau d'activité + santé */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-base font-extrabold text-gray-900 mb-4">Ton niveau d'activité</p>

                <div className="flex flex-col gap-2 mb-5">
                  {ACTIVITY_LEVELS.map(a => (
                    <button key={a.value} onClick={() => setActivityLevel(a.value)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${activityLevel === a.value ? "bg-violet-50 border-violet-400" : "bg-gray-50 border-gray-200 hover:border-violet-200"}`}>
                      <div>
                        <p className={`text-sm font-bold ${activityLevel === a.value ? "text-violet-700" : "text-gray-700"}`}>{a.label}</p>
                        <p className="text-xs text-gray-400">{a.desc}</p>
                      </div>
                      {activityLevel === a.value && (
                        <svg className="w-4 h-4 text-violet-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* FC repos */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                    Fréquence cardiaque au repos <span className="text-gray-300 font-normal normal-case">(optionnel)</span>
                  </label>
                  <div className="relative">
                    <input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="Ex : 62" min={30} max={120}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">bpm</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Mesurable le matin au réveil. Utilisé par le coach IA pour personnaliser tes zones cardio.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  ← Retour
                </button>
                <button onClick={handleFinish} disabled={saving}
                  className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-500 transition-colors disabled:opacity-50">
                  {saving ? "Enregistrement…" : "Commencer 🎉"}
                </button>
              </div>
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Tu pourras modifier ces informations à tout moment dans ton profil.</p>
      </div>
    </div>
  )
}
