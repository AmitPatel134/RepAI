"use client"
import { usePathname, useRouter } from "next/navigation"
import { useRef, useEffect, useState } from "react"
import AppSidebar from "@/components/AppSidebar"

const PAGE_ORDER = [
  "/app",
  "/app/workouts",
  "/app/progress",
  "/app/coach",
  "/app/profil",
]

function getPageIndex(pathname: string) {
  // Match /app/workouts/[id] → /app/workouts
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

      if (dx < 0 && currentIndex < PAGE_ORDER.length - 1) {
        router.push(PAGE_ORDER[currentIndex + 1])
      } else if (dx > 0 && currentIndex > 0) {
        router.push(PAGE_ORDER[currentIndex - 1])
      }

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
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <AppSidebar />
      <div className={`flex-1 md:ml-52 overflow-y-auto min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 bg-gray-950 ${animClass}`}>
        {children}
      </div>
    </div>
  )
}
