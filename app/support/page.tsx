"use client"
import { useState } from "react"

// TODO: Update APP_NAME and contact info
const APP_NAME = "RepAI"
const SUPPORT_EMAIL = "support@example.com"

export default function SupportPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-4 md:px-10 py-5 border-b border-gray-200 bg-white sticky top-0 z-50">
        <a href="/" className="font-extrabold text-lg tracking-tight text-gray-900">{APP_NAME}</a>
        <a href="/app" className="bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors">
          My account
        </a>
      </nav>

      {/* HEADER */}
      <div className="relative overflow-hidden bg-violet-700 text-white px-4 md:px-10 pt-20 pb-20">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-violet-600/50" />
        <div className="absolute bottom-[-50px] left-[20%] w-48 h-48 rounded-full bg-violet-800/40" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-4xl mx-auto">
          <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-4">Support</p>
          <h1 className="text-4xl md:text-7xl font-extrabold leading-none mb-4">We&apos;re here<br />for you</h1>
          <p className="text-violet-200 font-medium text-lg max-w-md">A question, a bug, or just want to chat? Write to us, we respond within 24 hours.</p>
        </div>
      </div>

      <div className="bg-gray-100 px-4 md:px-10 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* CONTACT INFO */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-4">Contact</p>
              {[
                { label: "Email", value: SUPPORT_EMAIL },
                { label: "Response time", value: "Within 24 business hours" },
                { label: "Availability", value: "Mon – Fri, 9am – 6pm" },
                { label: "Typical response", value: "< 4h on weekdays" },
              ].map(item => (
                <div key={item.label} className="mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="p-5 bg-white rounded-2xl border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick FAQ</p>
              <div className="flex flex-col gap-3">
                {[
                  { q: "Payment issue", href: "/pricing" },
                  { q: "How to cancel my subscription", href: "/app" },
                  { q: "View available plans", href: "/pricing" },
                ].map(link => (
                  <a key={link.q} href={link.href} className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
                    → {link.q}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* FORM */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-8">
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-extrabold text-gray-900 mb-2">Message sent!</h2>
                <p className="text-sm text-gray-500 font-medium mb-6">We&apos;ll reply within 24 hours to the address you provided.</p>
                <button
                  onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }) }}
                  className="text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <h2 className="text-xl font-extrabold text-gray-900 mb-2">Send a message</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Name</label>
                    <input
                      name="name"
                      required
                      placeholder="Your name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Subject</label>
                  <select
                    name="subject"
                    required
                    value={form.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                  >
                    <option value="">Choose a subject...</option>
                    <option>Payment issue</option>
                    <option>Bug or technical error</option>
                    <option>Question about my subscription</option>
                    <option>Feature request</option>
                    <option>Question about AI generation</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Message</label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder="Describe your issue or question..."
                    value={form.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors resize-none"
                  />
                </div>
                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send →"}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-500 px-10 py-8 flex items-center justify-between">
        <span className="text-white font-extrabold">{APP_NAME}</span>
        <div className="flex gap-8 text-sm font-semibold">
          <a href="/confidentialite" className="hover:text-white transition-colors">Privacy</a>
          <a href="/conditions" className="hover:text-white transition-colors">Terms</a>
          <a href="/support" className="hover:text-white transition-colors">Contact</a>
        </div>
        <span className="text-xs font-medium">© 2026 {APP_NAME}</span>
      </footer>

    </div>
  )
}
