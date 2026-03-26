"use client"
import { usePathname, useRouter } from "next/navigation"
import { useRef, useEffect, useState } from "react"
import AppSidebar from "@/components/AppSidebar"
import { prefetchAll } from "@/lib/appCache"
import HomePage from "./page"
import ActivitiesPage from "./activities/page"
import NutritionPage from "./nutrition/page"
import ProgressPage from "./progress/page"
import CoachPage from "./coach/page"

const PAGE_ORDER = [
  "/app/progress",
  "/app/activities",
  "/app",
  "/app/coach",
  "/app/nutrition",
]

const MAIN_PAGES = [
  { path: "/app/progress",   Component: ProgressPage },
  { path: "/app/activities", Component: ActivitiesPage },
  { path: "/app",            Component: HomePage },
  { path: "/app/coach",      Component: CoachPage },
  { path: "/app/nutrition",  Component: NutritionPage },
]

function getPageIndex(pathname: string) {
  const isSubPage = PAGE_ORDER.some(p => p !== "/app" && pathname.startsWith(p + "/"))
  if (isSubPage) return -1
  const base = PAGE_ORDER.find(p => p !== "/app" && pathname.startsWith(p))
    ?? (pathname === "/app" ? "/app" : null)
  return base ? PAGE_ORDER.indexOf(base) : -1
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const prevIndexRef = useRef(getPageIndex(pathname))
  const [animClass, setAnimClass] = useState("")

  const isMainPage = PAGE_ORDER.includes(pathname)

  // Prefetch all pages' data in parallel on first mount
  useEffect(() => { prefetchAll() }, [])

  useEffect(() => {
    const currentIndex = getPageIndex(pathname)
    const prevIndex = prevIndexRef.current
    if (prevIndex !== -1 && currentIndex !== -1 && currentIndex !== prevIndex) {
      const cls = currentIndex > prevIndex ? "page-enter" : "page-enter-back"
      setAnimClass(cls)
      const t = setTimeout(() => setAnimClass(""), 300)
      prevIndexRef.current = currentIndex
      return () => clearTimeout(t)
    }
    prevIndexRef.current = currentIndex
  }, [pathname])

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      const currentIndex = getPageIndex(pathname)
      if (currentIndex === -1) return
      if (dx < 0 && currentIndex < PAGE_ORDER.length - 1) router.push(PAGE_ORDER[currentIndex + 1])
      else if (dx > 0 && currentIndex > 0) router.push(PAGE_ORDER[currentIndex - 1])
      touchStartX.current = null
      touchStartY.current = null
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [pathname, router])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar />
      {/* Clip container — prevents slide animation from showing outside viewport */}
      <div className="flex-1 md:ml-52 overflow-hidden min-w-0 relative">
        {/* Always-mounted main pages — show/hide with display */}
        {MAIN_PAGES.map(({ path, Component }) => {
          const isActive = pathname === path
          return (
            <div
              key={path}
              className={`absolute inset-0 overflow-y-auto bg-gray-100 ${isActive ? animClass : ""}`}
              style={{ display: isActive ? "block" : "none" }}
            >
              <Component />
              <div className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden shrink-0" />
            </div>
          )
        })}
        {/* Sub-pages (detail pages) rendered as overlay */}
        {!isMainPage && (
          <div className="absolute inset-0 overflow-y-auto bg-gray-100">
            {children}
            <div className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden shrink-0" />
          </div>
        )}
      </div>
    </div>
  )
}
