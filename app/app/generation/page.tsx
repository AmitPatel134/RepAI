"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import PlanBanner from "@/components/PlanBanner"
import Toast from "@/components/Toast"

// TODO: Replace with your own generation types
type GenerationType = "text" | "email" | "summary" | "social"
type Tone = "professional" | "casual" | "formal" | "friendly"
type Length = "short" | "standard" | "long"

interface Item {
  id: string
  name: string
  description: string | null
  status: string
}

interface Generation {
  id: string
  content: string
  type: string
  prompt: string | null
  createdAt: string
}

const TYPES: { value: GenerationType; label: string; desc: string }[] = [
  { value: "text", label: "Text", desc: "General content" },
  { value: "email", label: "Email", desc: "Email copy" },
  { value: "summary", label: "Summary", desc: "Concise summary" },
  { value: "social", label: "Social", desc: "Social media post" },
]

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
]

const TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  text: { label: "Text", classes: "bg-violet-100 text-violet-700" },
  email: { label: "Email", classes: "bg-indigo-100 text-indigo-700" },
  summary: { label: "Summary", classes: "bg-emerald-100 text-emerald-700" },
  social: { label: "Social", classes: "bg-pink-100 text-pink-700" },
}

const HISTORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "summary", label: "Summary" },
  { value: "social", label: "Social" },
]

export default function GenerationPage() {
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [planLimit, setPlanLimit] = useState<number | null>(null)
  const [genCount, setGenCount] = useState(0)

  // Config
  const [selectedItem, setSelectedItem] = useState("")
  const [mode, setMode] = useState<GenerationType>("text")
  const [tone, setTone] = useState<Tone>("professional")
  const [length, setLength] = useState<Length>("standard")
  const [instructions, setInstructions] = useState("")

  // Result
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState("")
  const [resultLabel, setResultLabel] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  // History
  const [history, setHistory] = useState<Generation[]>([])
  const [historyFilter, setHistoryFilter] = useState("all")
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null)
  const [selectedGens, setSelectedGens] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const [lsPrefix, setLsPrefix] = useState("")

  // Persist config in localStorage (user-scoped)
  useEffect(() => { if (lsPrefix !== undefined) localStorage.setItem(`app_gen_mode${lsPrefix}`, mode) }, [mode, lsPrefix])
  useEffect(() => { if (lsPrefix !== undefined && selectedItem) localStorage.setItem(`app_gen_item${lsPrefix}`, selectedItem) }, [selectedItem, lsPrefix])
  useEffect(() => { if (lsPrefix !== undefined) localStorage.setItem(`app_gen_tone${lsPrefix}`, tone) }, [tone, lsPrefix])
  useEffect(() => { if (lsPrefix !== undefined) localStorage.setItem(`app_gen_length${lsPrefix}`, length) }, [length, lsPrefix])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      const prefix = `_${session.user.email}`
      setLsPrefix(prefix)
      Promise.all([
        authFetch("/api/items").then(r => r.json()),
        authFetch("/api/plan").then(r => r.json()),
        authFetch("/api/generations").then(r => r.json()),
      ]).then(([itemsData, planData, genData]) => {
        const iList = Array.isArray(itemsData) ? itemsData : []
        setItems(iList)
        setPlanLimit(planData.limits?.generationsPerMonth ?? null)
        setGenCount(planData.usage?.generationsThisMonth ?? 0)
        setHistory(Array.isArray(genData) ? genData : [])
        // Restore config from localStorage
        const savedItem = localStorage.getItem(`app_gen_item${prefix}`)
        if (savedItem && iList.some((i: { id: string }) => i.id === savedItem)) setSelectedItem(savedItem)
        const savedMode = localStorage.getItem(`app_gen_mode${prefix}`) as GenerationType
        if (savedMode) setMode(savedMode)
        const savedTone = localStorage.getItem(`app_gen_tone${prefix}`) as Tone
        if (savedTone) setTone(savedTone)
        const savedLength = localStorage.getItem(`app_gen_length${prefix}`) as Length
        if (savedLength) setLength(savedLength)
        setReady(true)
      })
    })
  }, [])

  if (!ready) return <LoadingScreen />

  const item = items.find(i => i.id === selectedItem)

  const filteredHistory = history.filter(h => {
    if (historyFilter === "all") return true
    return h.type === historyFilter
  })

  async function handleGenerate() {
    if (!item) return
    setGenerating(true)
    setResult("")
    setError("")
    setSelectedGen(null)
    try {
      const res = await authFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          mode,
          tone,
          length,
          instructions: instructions.trim(),
        }),
      })
      if (res.status === 403) {
        setError("Generation limit reached for this month. Upgrade to Pro to continue.")
        return
      }
      if (!res.ok) throw new Error("API error")
      const { content } = await res.json()
      setResult(content)
      showToast("Content generated")
      const modeLabel = TYPES.find(t => t.value === mode)?.label ?? mode
      setResultLabel(modeLabel)
      setGenCount(c => c + 1)
      const updated = await authFetch("/api/generations").then(r => r.json())
      setHistory(Array.isArray(updated) ? updated : [])
    } catch {
      setError("An error occurred.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/generations/${id}`, { method: "DELETE" })
    setHistory(prev => prev.filter(h => h.id !== id))
    if (selectedGen?.id === id) { setSelectedGen(null); setResult(""); setResultLabel("") }
  }

  async function handleBulkDelete() {
    await Promise.all([...selectedGens].map(id => authFetch(`/api/generations/${id}`, { method: "DELETE" })))
    setHistory(prev => prev.filter(h => !selectedGens.has(h.id)))
    if (selectedGen && selectedGens.has(selectedGen.id)) { setSelectedGen(null); setResult(""); setResultLabel("") }
    showToast(`${selectedGens.size} generation${selectedGens.size > 1 ? "s" : ""} deleted`)
    setSelectedGens(new Set())
    setConfirmBulk(false)
  }

  function toggleSelectGen(id: string) {
    setSelectedGens(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleSelectHistory(h: Generation) {
    setSelectedGen(h)
    setResult(h.content)
    const badge = TYPE_BADGE[h.type]
    setResultLabel(badge?.label ?? h.type)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* TOPBAR */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40">
        <h1 className="text-lg font-extrabold text-gray-900">AI Generation</h1>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-6">

        {/* GENERATOR */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

          {/* CONFIG PANEL */}
          <div className="col-span-1 md:col-span-4 flex flex-col gap-4">

            {/* Generation type */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Generation type</p>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button key={t.value} onClick={() => setMode(t.value)}
                    className={`text-left px-3 py-2.5 rounded-xl transition-colors ${mode === t.value ? "bg-violet-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}>
                    <p className={`text-xs font-bold leading-tight ${mode === t.value ? "text-white" : "text-gray-900"}`}>{t.label}</p>
                    <p className={`text-xs mt-0.5 ${mode === t.value ? "text-violet-200" : "text-gray-400"}`}>{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Item selection */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Item</p>
              <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400">
                <option value="">Choose an item...</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              {item && item.description && (
                <div className="mt-3 p-3 rounded-xl bg-gray-50 text-xs text-gray-500 font-medium">
                  <p>{item.description}</p>
                </div>
              )}
            </div>

            {/* Tone + length + instructions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tone</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setTone(t.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${tone === t.value ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Length</p>
                <div className="flex gap-1.5">
                  {(["short", "standard", "long"] as Length[]).map(l => (
                    <button key={l} onClick={() => setLength(l)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${length === l ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}>
                      {l === "short" ? "Short" : l === "standard" ? "Standard" : "Long"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Custom instructions</p>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="Ex: focus on the key benefits, keep it concise..."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 font-medium placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors resize-none"
                />
              </div>
            </div>

            <PlanBanner usage={genCount} limit={planLimit} label="Generations this month" />

            {planLimit !== null && genCount >= planLimit ? (
              <a href="/pricing" className="w-full py-4 bg-violet-600 text-white font-extrabold rounded-2xl hover:bg-violet-700 transition-colors flex items-center justify-center gap-2">
                Upgrade to Pro to continue →
              </a>
            ) : (
              <button onClick={handleGenerate} disabled={!selectedItem || generating}
                className="w-full py-4 bg-violet-600 text-white font-extrabold rounded-2xl hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {generating ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate with AI</>
                )}
              </button>
            )}
          </div>

          {/* RESULT PANEL */}
          <div className="col-span-1 md:col-span-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-96 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {resultLabel || "Result"}
                </p>
                <div className="flex items-center gap-2">
                  {result && (
                    <>
                      <button
                        onClick={handleGenerate}
                        disabled={!selectedItem || generating}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => handleCopy(result, "current")}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${copied === "current" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {copied === "current" ? "Copied ✓" : "Copy"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1">
                {error ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-sm font-medium text-red-400">{error}</p>
                  </div>
                ) : result ? (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-medium leading-relaxed font-sans">{result}</pre>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-300">
                    <div className="text-center">
                      <svg className="w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="text-sm font-medium">Select an item and click Generate</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HISTORY */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <p className="text-sm font-extrabold text-gray-900">History</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{history.length}</span>
              {selectedGens.size > 0 && (
                <button onClick={() => setConfirmBulk(true)}
                  className="bg-red-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">
                  Delete ({selectedGens.size})
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {HISTORY_FILTERS.map(f => (
                <button key={f.value} onClick={() => setHistoryFilter(f.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${historyFilter === f.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <p className="text-sm font-medium">No generations{historyFilter !== "all" ? " in this category" : ""}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredHistory.map(h => {
                const badge = TYPE_BADGE[h.type] ?? { label: h.type, classes: "bg-gray-100 text-gray-600" }
                return (
                  <div key={h.id}
                    className={`flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer group ${selectedGens.has(h.id) ? "bg-red-50" : selectedGen?.id === h.id ? "bg-violet-50" : ""}`}
                    onClick={() => handleSelectHistory(h)}
                  >
                    <input type="checkbox" checked={selectedGens.has(h.id)}
                      onChange={() => toggleSelectGen(h.id)}
                      onClick={e => e.stopPropagation()}
                      className={`mt-1 w-4 h-4 rounded accent-red-500 shrink-0 cursor-pointer transition-opacity ${selectedGens.has(h.id) ? "opacity-100" : "opacity-30"}`} />
                    <div className="shrink-0 pt-0.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium leading-relaxed line-clamp-2">{h.content}</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">
                        {new Date(h.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); handleCopy(h.content, h.id) }}
                        className={`p-1.5 rounded-lg transition-colors ${copied === h.id ? "bg-emerald-100 text-emerald-600" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
                        title="Copy"
                      >
                        {copied === h.id ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(h.id) }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* BULK DELETE CONFIRM MODAL */}
      {confirmBulk && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Delete {selectedGens.size} generation{selectedGens.size > 1 ? "s" : ""}?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">This action is irreversible. The selected generations will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulk(false)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 transition-colors">
                Cancel
              </button>
              <button onClick={handleBulkDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </div>
  )
}
