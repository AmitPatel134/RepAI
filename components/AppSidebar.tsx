"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import AppLogo from "./AppLogo"

const navItems = [
  {
    href: "/app",
    label: "Accueil",
    exact: true,
    activeColor: "text-gray-900",
    activeBg: "bg-gray-100",
    activeSolid: "bg-gray-900",
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
    activeSolid: "bg-blue-600",
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
    activeSolid: "bg-red-600",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M7 20V14m4 6V8m4 12V3" />
      </svg>
    ),
  },
  {
    href: "/app/coach",
    label: "Coach",
    exact: false,
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
    activeSolid: "bg-violet-600",
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
  activeSolid: "bg-orange-500",
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 6.5 9 7 8 7c-1 0-2.2-.7-3.2-.7C2.5 6.3 1.5 8.5 1.5 11c0 4 3 8.5 5.5 8.5.9 0 1.8-.6 2.8-.6s1.9.6 2.8.6C15 19.5 18 15 18 11c0-2.5-1.5-4.7-4-4.7-.8 0-1.6.3-2.5.3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C12 4.5 13.5 3 15 2" />
    </svg>
  ),
}

// Left: Progrès, Activités — Center: Accueil — Right: Coach, Nutrition
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

  const hideNav = pathname.startsWith("/app/workouts/") || pathname.startsWith("/app/activities/")

  function isActive(item: { href: string; exact?: boolean }) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-52 bg-white border-r border-gray-200 flex-col z-50">
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/app" className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="font-extrabold text-lg tracking-tight text-gray-900">RepAI</span>
          </Link>
          <p className="text-xs text-gray-400 font-medium mt-1">Suivi & Performance</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(item => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active ? `${item.activeSolid} text-white` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={active ? "text-white" : "text-gray-400"}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 flex flex-col gap-1">
          <Link
            href="/app/nutrition"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              pathname.startsWith("/app/nutrition") ? `${nutrition.activeSolid} text-white` : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className={pathname.startsWith("/app/nutrition") ? "text-white" : "text-gray-400"}>
              {nutrition.icon}
            </span>
            Nutrition
          </Link>
          <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Accueil
          </a>
          {email && (
            <Link href="/app/profil" className="px-3 py-1.5 text-xs text-gray-400 font-medium truncate hover:text-gray-700 transition-colors">{email}</Link>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
          transform: hideNav ? "translateY(120%)" : "translateY(0)",
          transition: "transform 0.3s ease",
        }}
      >
        <nav className="relative w-full max-w-sm flex items-end">
          {/* Pill */}
          <div className="absolute inset-x-0 bottom-0 h-[60px] rounded-2xl bg-white shadow-xl shadow-black/10 border border-gray-200" />

          {/* Left 2 items */}
          {mobileNavSide.slice(0, 2).map(item => {
            const active = isActive(item)
            return (
              <Link key={item.href} href={item.href} className="relative z-10 flex-1 flex flex-col items-center justify-center h-[60px] gap-0.5 transition-colors duration-200">
                <span className={`flex items-center justify-center transition-all duration-200 ${active ? item.activeColor : "text-gray-400"}`}>
                  {item.icon}
                </span>
                <span className={`text-[9px] font-semibold leading-none ${active ? item.activeColor : "text-gray-400"}`}>{item.label}</span>
              </Link>
            )
          })}

          {/* Center: Accueil — floating circle */}
          {(() => {
            const active = isActive(mobileNavHome)
            return (
              <Link href={mobileNavHome.href} className="relative z-20 flex flex-col items-center w-16 shrink-0" style={{ marginBottom: "10px" }}>
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 border border-gray-200 ${
                    active ? "bg-gray-900" : "bg-gray-100"
                  }`}
                  style={{ marginTop: "-18px" }}
                >
                  <svg className={`w-6 h-6 ${active ? "text-white" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </Link>
            )
          })()}

          {/* Right 2 items */}
          {mobileNavSide.slice(2).map(item => {
            const active = isActive(item)
            return (
              <Link key={item.href} href={item.href} className="relative z-10 flex-1 flex flex-col items-center justify-center h-[60px] gap-0.5 transition-colors duration-200">
                <span className={`flex items-center justify-center transition-all duration-200 ${active ? item.activeColor : "text-gray-400"}`}>
                  {item.icon}
                </span>
                <span className={`text-[9px] font-semibold leading-none ${active ? item.activeColor : "text-gray-400"}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
