"use client"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const APP_NAME = "RepAI"

const navItems = [
  {
    href: "/app",
    label: "Accueil",
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/app/workouts",
    label: "Séances",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/app/progress",
    label: "Progrès",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l4-8 4 5 3-4 4 7" />
      </svg>
    ),
  },
  {
    href: "/app/coach",
    label: "Coach IA",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
]

const profil = {
  href: "/app/profil",
  label: "Profil",
  exact: false,
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
}

// Left: Séances, Progrès — Center: Accueil — Right: Coach IA, Profil
const mobileNavSide = [navItems[2], navItems[1], navItems[3], profil]
const mobileNavHome = navItems[0]

export default function AppSidebar() {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setEmail(session.user.email ?? null)
    })
  }, [])

  function isActive(item: { href: string; exact?: boolean }) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-52 bg-white border-r border-gray-200 flex-col z-50">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <a href="/app/workouts" className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-gray-900">{APP_NAME}</span>
          </a>
          <p className="text-xs text-gray-400 font-medium mt-1">Suivi & Performance</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(item => {
            const active = isActive(item)
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={active ? "text-violet-600" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-100 flex flex-col gap-1">
          <a href="/app/profil" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${pathname === "/app/profil" ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <svg className={`w-4 h-4 ${pathname === "/app/profil" ? "text-violet-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profil
          </a>
          <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Accueil
          </a>
          {email && (
            <p className="px-3 text-xs text-gray-400 font-medium truncate">{email}</p>
          )}
        </div>

      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)", paddingTop: "0px" }}
      >
        <nav className="relative w-full max-w-sm flex items-end">

          {/* Pill background — behind everything */}
          <div className="absolute inset-x-0 bottom-0 h-[52px] rounded-2xl bg-gray-900/90 backdrop-blur-md border border-white/10 shadow-2xl" />

          {/* Left items: Séances, Progrès */}
          <div className="relative flex flex-1 z-10">
            {mobileNavSide.slice(0, 2).map(item => {
              const active = isActive(item)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center h-[52px] gap-0.5 transition-colors duration-200"
                >
                  <span className={active ? "text-white" : "text-gray-500"}>{item.icon}</span>
                  <span className={`text-[9px] font-bold leading-none ${active ? "text-white" : "text-gray-500"}`}>{item.label}</span>
                </a>
              )
            })}
          </div>

          {/* Center: Accueil — circle floating above */}
          {(() => {
            const active = isActive(mobileNavHome)
            return (
              <a
                href={mobileNavHome.href}
                className="relative z-20 flex flex-col items-center gap-0.5 pb-1.5 w-16 shrink-0"
                style={{ marginBottom: "0px" }}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 ${
                    active
                      ? "bg-violet-600 shadow-violet-900/60"
                      : "bg-gray-700 border border-white/15"
                  }`}
                  style={{ marginBottom: "2px", marginTop: "-14px" }}
                >
                  <span className={active ? "text-white" : "text-gray-300"}>{mobileNavHome.icon}</span>
                </div>
                <span className={`text-[9px] font-bold leading-none ${active ? "text-violet-300" : "text-gray-500"}`}>
                  {mobileNavHome.label}
                </span>
              </a>
            )
          })()}

          {/* Right items: Coach IA, Profil */}
          <div className="relative flex flex-1 z-10">
            {mobileNavSide.slice(2).map(item => {
              const active = isActive(item)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center h-[52px] gap-0.5 transition-colors duration-200"
                >
                  <span className={active ? "text-white" : "text-gray-500"}>{item.icon}</span>
                  <span className={`text-[9px] font-bold leading-none ${active ? "text-white" : "text-gray-500"}`}>{item.label}</span>
                </a>
              )
            })}
          </div>

        </nav>
      </div>
    </>
  )
}
