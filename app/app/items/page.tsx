"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/authFetch"
import LoadingScreen from "@/components/LoadingScreen"
import PlanBanner from "@/components/PlanBanner"
import Toast from "@/components/Toast"

type ItemStatus = "active" | "inactive" | "archived"

interface Item {
  id: string
  name: string
  description: string | null
  status: ItemStatus
}

const statusConfig: Record<ItemStatus, { label: string; classes: string }> = {
  active: { label: "Active", classes: "bg-emerald-100 text-emerald-700" },
  inactive: { label: "Inactive", classes: "bg-gray-100 text-gray-500" },
  archived: { label: "Archived", classes: "bg-amber-100 text-amber-700" },
}

const EMPTY: Item = {
  id: "", name: "", description: null, status: "active",
}

export default function ItemsPage() {
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [filter, setFilter] = useState<ItemStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Item>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [planLimit, setPlanLimit] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setConfirmDelete(null)
      setShowForm(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      Promise.all([
        authFetch("/api/items").then(r => r.json()),
        authFetch("/api/plan").then(r => r.json()),
      ]).then(([itemsData, planData]) => {
        setItems(Array.isArray(itemsData) ? itemsData : [])
        setPlanLimit(planData.limits?.items ?? null)
        setReady(true)
      })
    })
  }, [])

  if (!ready) return <LoadingScreen />

  const filtered = items.filter(item => {
    const matchFilter = filter === "all" || item.status === filter
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? "").toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    if (form.id) {
      const res = await authFetch(`/api/items/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const updated = await res.json()
      setItems(prev => prev.map(item => item.id === form.id ? updated : item))
    } else {
      const res = await authFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.status === 403) {
        setSaving(false)
        setShowForm(false)
        window.location.href = "/pricing"
        return
      }
      const created = await res.json()
      setItems(prev => [created, ...prev])
    }
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
    showToast(form.id ? "Item updated" : "Item added")
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/items/${id}`, { method: "DELETE" })
    setItems(prev => prev.filter(item => item.id !== id))
    setConfirmDelete(null)
    showToast("Item deleted")
  }

  async function handleBulkDelete() {
    await Promise.all([...selected].map(id => authFetch(`/api/items/${id}`, { method: "DELETE" })))
    setItems(prev => prev.filter(item => !selected.has(item.id)))
    showToast(`${selected.size} item${selected.size > 1 ? "s" : ""} deleted`)
    setSelected(new Set())
    setConfirmBulk(false)
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* TOPBAR */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-lg font-extrabold text-gray-900">Items</h1>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button onClick={() => setConfirmBulk(true)}
              className="bg-red-500 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-red-600 transition-colors">
              Delete ({selected.size})
            </button>
          )}
          {planLimit !== null && items.length >= planLimit ? (
            <a href="/pricing" className="bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors">
              Upgrade to Pro →
            </a>
          ) : (
            <button onClick={() => { setForm(EMPTY); setShowForm(true) }}
              className="bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors">
              + New item
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">

        <PlanBanner usage={items.length} limit={planLimit} label="Items" />

        {/* FILTERS + SEARCH */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors"
          />
          {(["all", "active", "inactive", "archived"] as const).map(fi => (
            <button
              key={fi}
              onClick={() => setFilter(fi)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${filter === fi ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}
            >
              {fi === "all" ? "All" : statusConfig[fi]?.label ?? fi}
              <span className="ml-2 text-xs opacity-60">
                {fi === "all" ? items.length : items.filter(item => item.status === fi).length}
              </span>
            </button>
          ))}
        </div>

        {/* LIST */}
        {filtered.length === 0 ? (
          items.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-base font-extrabold text-gray-900 mb-1">No items yet</p>
              <p className="text-sm text-gray-400 font-medium mb-5">Add your first item to get started.</p>
              <button
                onClick={() => { setForm(EMPTY); setShowForm(true) }}
                className="inline-flex items-center gap-2 bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700 transition-colors"
              >
                + Add my first item
              </button>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm font-medium">No items match this filter.</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(item => (
              <div key={item.id} className={`bg-white rounded-2xl border p-5 flex items-center gap-5 transition-colors group ${selected.has(item.id) ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-violet-200"}`}>
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                  onClick={e => e.stopPropagation()}
                  className={`w-4 h-4 rounded accent-red-500 shrink-0 cursor-pointer transition-opacity ${selected.has(item.id) ? "opacity-100" : "opacity-30"}`} />
                <div className="w-12 h-12 rounded-xl bg-violet-50 shrink-0 flex items-center justify-center text-violet-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${(statusConfig[item.status as ItemStatus] ?? statusConfig.active).classes}`}>
                      {(statusConfig[item.status as ItemStatus] ?? statusConfig.active).label}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900 truncate">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-gray-500 font-medium mt-0.5 truncate">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => { setForm(item); setShowForm(true) }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(item.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE CONFIRM MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Delete this item?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">This action is irreversible. The item will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-xl my-8">
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">
              {form.id ? "Edit item" : "New item"}
            </h2>
            <div className="flex flex-col gap-5">

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Item name"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ItemStatus }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Description <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                <textarea
                  value={form.description ?? ""}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value || null }))}
                  rows={3}
                  placeholder="Describe this item..."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-violet-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY) }}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl text-sm hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRM MODAL */}
      {confirmBulk && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Delete {selected.size} item{selected.size > 1 ? "s" : ""}?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">This action is irreversible. The selected items will be permanently deleted.</p>
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
