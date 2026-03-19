"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// TODO: Update APP_NAME
const APP_NAME = "MyApp"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase handles the token from the URL hash automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    if (!password) { setMessage("Please enter a new password."); return }
    if (password !== confirm) { setMessage("Passwords do not match."); return }
    if (password.length < 6) { setMessage("Password must be at least 6 characters."); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setMessage(error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = "/app" }, 2000)
  }

  return (
    <div className="relative min-h-screen bg-violet-700 flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-violet-600/50" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet-800/50" />
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div className="relative w-full max-w-sm">
        <a href="/" className="block text-center text-white font-extrabold text-2xl mb-10 tracking-tight">{APP_NAME}</a>
        <div className="bg-white rounded-3xl p-8 shadow-xl">

          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Password updated!</h1>
              <p className="text-sm text-gray-500 font-medium">Redirecting to your account...</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500 font-medium">Verifying link...</p>
              <p className="text-xs text-gray-400 mt-2">If this page is stuck, the link may have expired.</p>
              <a href="/login" className="text-xs text-violet-600 font-semibold hover:text-violet-700 mt-4 block">
                ← Back to login
              </a>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">New password</h1>
              <p className="text-sm text-gray-500 font-medium mb-6">Choose a new password for your account.</p>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                />
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update password →"}
                </button>
              </div>
              {message && <p className="text-xs text-center mt-4 text-red-500 font-medium">{message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
