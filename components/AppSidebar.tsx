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
    activeColor: "text-gray-900",
    activeBg: "bg-gray-100",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/app/activities",
    label: "Activités",
    exact: false,
    activeColor: "text-blue-600",
    activeBg: "bg-blue-50",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/app/progress",
    label: "Progrès",
    exact: false,
    activeColor: "text-red-600",
    activeBg: "bg-red-50",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 20h20M5 20V10l5-5 4 4 5-7" />
      </svg>
    ),
  },
  {
    href: "/app/coach",
    label: "Coach IA",
    exact: false,
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
]

const nutrition = {
  href: "/app/nutrition",
  label: "Nutrition",
  exact: false,
  activeColor: "text-orange-500",
  activeBg: "bg-orange-50",
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
    </svg>
  ),
}

// Left: Progrès, Activités — Center: Accueil — Right: Coach IA, Nutrition
const mobileNavSide = [navItems[2], navItems[1], navItems[3], nutrition]
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
        <div className="px-5 py-5 border-b border-gray-100">
          <a href="/app/workouts" className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-gray-900">{APP_NAME}</span>
          </a>
          <p className="text-xs text-gray-400 font-medium mt-1">Suivi & Performance</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(item => {
            const active = isActive(item)
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active ? `${item.activeBg} ${item.activeColor}` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={active ? item.activeColor : "text-gray-400"}>{item.icon}</span>
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 flex flex-col gap-1">
          <a
            href="/app/nutrition"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              pathname.startsWith("/app/nutrition") ? "bg-orange-50 text-orange-500" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className={`w-4 h-4 ${pathname.startsWith("/app/nutrition") ? "text-orange-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 9c0-3 2-6 5-6s5 3 5 6H3M17 3v5a2 2 0 002 2v11" />
            </svg>
            Nutrition
          </a>
          <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Accueil
          </a>
          {email && (
            <a href="/app/profil" className="px-3 py-1.5 text-xs text-gray-400 font-medium truncate hover:text-gray-700 transition-colors">{email}</a>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        <nav className="relative w-full max-w-sm flex items-end">
          {/* Pill */}
          <div className="absolute inset-x-0 bottom-0 h-[52px] rounded-2xl bg-white border border-gray-200 shadow-lg" />

          {/* Left */}
          <div className="relative flex flex-1 z-10">
            {mobileNavSide.slice(0, 2).map(item => {
              const active = isActive(item)
              return (
                <a key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center h-[52px] gap-0.5 transition-colors duration-200">
                  <span className={active ? item.activeColor : "text-gray-400"}>{item.icon}</span>
                  <span className={`text-[9px] font-bold leading-none ${active ? item.activeColor : "text-gray-400"}`}>{item.label}</span>
                </a>
              )
            })}
          </div>

          {/* Center: Accueil */}
          {(() => {
            const active = isActive(mobileNavHome)
            return (
              <a href={mobileNavHome.href} className="relative z-20 flex flex-col items-center gap-0.5 pb-1.5 w-16 shrink-0">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-200 ${
                    active ? "bg-gray-900" : "bg-gray-100 border border-gray-200"
                  }`}
                  style={{ marginBottom: "2px", marginTop: "-14px" }}
                >
                  <span className={active ? "text-white" : "text-gray-500"}>{mobileNavHome.icon}</span>
                </div>
                <span className={`text-[9px] font-bold leading-none ${active ? "text-gray-900" : "text-gray-400"}`}>
                  {mobileNavHome.label}
                </span>
              </a>
            )
          })()}

          {/* Right */}
          <div className="relative flex flex-1 z-10">
            {mobileNavSide.slice(2).map(item => {
              const active = isActive(item)
              return (
                <a key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center h-[52px] gap-0.5 transition-colors duration-200">
                  <span className={active ? item.activeColor : "text-gray-400"}>{item.icon}</span>
                  <span className={`text-[9px] font-bold leading-none ${active ? item.activeColor : "text-gray-400"}`}>{item.label}</span>
                </a>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
