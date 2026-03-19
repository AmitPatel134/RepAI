"use client"
import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

// TODO: Replace with your app name
const APP_NAME = "MyApp"

type View = "login" | "signup" | "forgot" | "forgot-sent" | "signup-sent"

export default function LoginPage() {
  const [view, setView] = useState<View>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [fading, setFading] = useState(false)
  const firstNameRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmPasswordRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordTooShort = password.length > 0 && password.length < 6

  function switchView(next: View) {
    setFading(true)
    setTimeout(() => {
      setView(next)
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setFirstName("")
      setLastName("")
      setPhone("")
      setCompany("")
      setMessage("")
      if (firstNameRef.current) firstNameRef.current.value = ""
      if (lastNameRef.current) lastNameRef.current.value = ""
      if (emailRef.current) emailRef.current.value = ""
      if (passwordRef.current) passwordRef.current.value = ""
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = ""
      if (phoneRef.current) phoneRef.current.value = ""
      if (companyRef.current) companyRef.current.value = ""
      setFading(false)
    }, 180)
  }

  async function handleAuth() {
    setLoading(true)
    if (view === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        setMessage("First name and last name are required.")
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setMessage("Password too short (minimum 6 characters).")
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.")
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setMessage(error.message); setLoading(false); return }
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: `${firstName.trim()} ${lastName.trim()}`,
          telephone: phone.trim() || undefined,
          company: company.trim() || undefined,
        })
      })
      switchView("signup-sent")
      setLoading(false)
      return
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMessage("Incorrect email or password."); setLoading(false); return }
      window.location.href = "/app"
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) { setMessage("Enter your email address."); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setLoading(false)
    if (error) { setMessage(error.message); return }
    switchView("forgot-sent")
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div className="relative min-h-screen bg-violet-700 flex items-center justify-center px-4 overflow-hidden">
      {/* Decorations */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-violet-600/50" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet-800/50" />
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div className={`relative w-full transition-all duration-200 ${view === "signup" ? "max-w-md" : "max-w-sm"}`}>
        <a href="/" className="block text-center text-white font-extrabold text-2xl mb-10 tracking-tight">{APP_NAME}</a>
        <div className="bg-white rounded-3xl p-8 shadow-xl">

          {/* View: signup confirmation */}
          {view === "signup-sent" ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your inbox</h1>
              <p className="text-sm text-gray-500 font-medium mb-1">A confirmation email was sent to</p>
              <p className="text-sm font-bold text-gray-900 mb-6">{email}</p>
              <p className="text-xs text-gray-400 font-medium mb-8">Click the link in the email to activate your account, then come back to sign in.</p>
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors mb-3"
              >
                Open my inbox →
              </a>
              <button
                onClick={() => switchView("login")}
                className="text-xs text-gray-400 font-semibold hover:text-violet-600 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : view === "forgot-sent" ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Email sent!</h1>
              <p className="text-sm text-gray-500 font-medium mb-6">Check your inbox and click the link to reset your password.</p>
              <button onClick={() => switchView("login")} className="text-xs text-violet-600 font-semibold hover:text-violet-700">
                ← Back to sign in
              </button>
            </div>
          ) : view === "forgot" ? (
            /* View: Forgot password */
            <div
              className="transition-all duration-200 ease-in-out"
              style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)' }}
            >
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Forgot password</h1>
              <p className="text-sm text-gray-500 font-medium mb-6">We&apos;ll send you a link to reset it.</p>
              <div className="flex flex-col gap-3">
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="your@email.com"
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                />
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link →"}
                </button>
              </div>
              {message && <p className="text-xs text-center mt-4 text-red-500 font-medium">{message}</p>}
              <p
                onClick={() => switchView("login")}
                className="text-xs text-center mt-5 text-gray-400 font-semibold cursor-pointer hover:text-violet-600 transition-colors"
              >
                ← Back to sign in
              </p>
            </div>
          ) : (
            /* View: Login / Signup */
            <>
              <div
                className="transition-all duration-200 ease-in-out"
                style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)' }}
              >
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
                  {view === "signup" ? "Create an account" : "Sign in"}
                </h1>
                <p className="text-sm text-gray-500 font-medium mb-6">
                  {view === "signup" ? "Start free, no credit card required." : `Sign in to your ${APP_NAME} account.`}
                </p>
              </div>

              {/* OAuth buttons */}
              <div className="flex flex-col gap-2 mb-5">
                <button
                  onClick={() => handleOAuth("google")}
                  className="flex items-center justify-center gap-3 w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.4l-6.5-5.5C29.7 35 27 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.5 5.5C37.2 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Form fields */}
              <div
                className="flex flex-col gap-3 transition-all duration-200 ease-in-out"
                style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)' }}
              >
                {view === "signup" && (
                  <>
                    <div className="flex gap-2">
                      <input
                        ref={firstNameRef}
                        type="text"
                        placeholder="First name"
                        onChange={e => setFirstName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && lastNameRef.current?.focus()}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                      />
                      <input
                        ref={lastNameRef}
                        type="text"
                        placeholder="Last name"
                        onChange={e => setLastName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && phoneRef.current?.focus()}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                      />
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      placeholder="Phone (optional)"
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && companyRef.current?.focus()}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                    />
                    <input
                      ref={companyRef}
                      type="text"
                      placeholder="Company (optional)"
                      onChange={e => setCompany(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && emailRef.current?.focus()}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                    />
                  </>
                )}
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="your@email.com"
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && passwordRef.current?.focus()}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                />
                <div>
                  <input
                    ref={passwordRef}
                    type="password"
                    placeholder="Password"
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (view === "signup" ? confirmPasswordRef.current?.focus() : handleAuth())}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                  />
                  {view === "signup" && passwordTooShort && (
                    <p className="text-xs text-red-500 font-medium mt-1 ml-1">Minimum 6 characters</p>
                  )}
                </div>
                {view === "signup" && (
                  <div>
                    <input
                      ref={confirmPasswordRef}
                      type="password"
                      placeholder="Confirm password"
                      onChange={e => setConfirmPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAuth()}
                      className={`w-full px-4 py-3 rounded-xl bg-gray-50 border text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white transition-colors ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? "border-green-400 focus:border-green-400"
                            : "border-red-300 focus:border-red-400"
                          : "border-gray-200 focus:border-violet-400"
                      }`}
                    />
                    {confirmPassword.length > 0 && (
                      <p className={`text-xs font-medium mt-1 ml-1 ${passwordsMatch ? "text-green-600" : "text-red-500"}`}>
                        {passwordsMatch ? "✓ Passwords match" : "Passwords do not match"}
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={handleAuth}
                  disabled={loading}
                  className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Loading..." : view === "signup" ? "Create account →" : "Sign in →"}
                </button>
              </div>

              {view === "login" && (
                <p
                  onClick={() => switchView("forgot")}
                  className="text-xs text-center mt-3 text-gray-400 font-semibold cursor-pointer hover:text-violet-600 transition-colors"
                >
                  Forgot password?
                </p>
              )}

              {message && (
                <div className="mt-4 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs font-semibold text-red-700">{message}</p>
                </div>
              )}

              <p
                onClick={() => switchView(view === "signup" ? "login" : "signup")}
                className="text-xs text-center mt-5 text-gray-400 font-semibold cursor-pointer hover:text-violet-600 transition-colors"
              >
                {view === "signup" ? "Already have an account? Sign in" : "No account? Sign up free"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
