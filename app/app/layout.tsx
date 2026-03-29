"use client"
import { usePathname, useRouter } from "next/navigation"
import { useRef, useEffect } from "react"
import AppSidebar from "@/components/AppSidebar"
import { prefetchAll } from "@/lib/appCache"
import HomePage from "./page"
import ActivitiesPage from "./activities/page"
import NutritionPage from "./nutrition/page"
import ProgressPage from "./progress/page"
import CoachPage from "./coach/page"

const PAGE_ORDER = ["/app/coach", "/app/nutrition", "/app", "/app/activities", "/app/progress"]

const MAIN_PAGES = [
  { path: "/app/coach",      Component: CoachPage },
  { path: "/app/nutrition",  Component: NutritionPage },
  { path: "/app",            Component: HomePage },
  { path: "/app/activities", Component: ActivitiesPage },
  { path: "/app/progress",   Component: ProgressPage },
]

function getPageIndex(p: string) {
  if (PAGE_ORDER.some(r => r !== "/app" && p.startsWith(r + "/"))) return -1
  const base = PAGE_ORDER.find(r => r !== "/app" && p.startsWith(r)) ?? (p === "/app" ? "/app" : null)
  return base ? PAGE_ORDER.indexOf(base) : -1
}

const EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
const DUR  = 280

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Refs for all page divs — transforms applied directly, never via React state
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Touch gesture state (refs only — zero React re-renders during drag)
  const touchStartX  = useRef<number | null>(null)
  const touchStartY  = useRef<number | null>(null)
  const touchStartMs = useRef(0)
  const isHoriz      = useRef(false)

  // Tracks which main-page index is "centered" (last known when on a sub-page)
  const prevIdx  = useRef(getPageIndex(pathname))
  // Set true before router.push() after a completed swipe so the pathname
  // effect knows not to re-animate (the swipe already moved the pages)
  const swipeNav = useRef(false)

  const isMainPage = PAGE_ORDER.includes(pathname)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Slide all pages to positions relative to baseIdx, optionally animated
  function snapPages(baseIdx: number, animated: boolean) {
    const tr = `transform ${DUR}ms ${EASE}`
    pageRefs.current.forEach((el, i) => {
      if (!el) return
      el.style.transition = animated ? tr : "none"
      el.style.transform  = `translateX(${(i - baseIdx) * 100}%)`
    })
  }

  // ── Prefetch ─────────────────────────────────────────────────────────────────
  useEffect(() => { prefetchAll() }, [])

  // ── Initial positioning (ref callback handles it per-element) ────────────────
  // Each page div positions itself at mount via the ref callback below so
  // there is zero flash before the first useEffect fires.

  // ── Pathname change ──────────────────────────────────────────────────────────
  useEffect(() => {
    const idx  = getPageIndex(pathname)
    const prev = prevIdx.current

    if (swipeNav.current) {
      // Swipe already animated the pages to the target position; just confirm.
      swipeNav.current  = false
      prevIdx.current   = idx
      if (idx !== -1) snapPages(idx, false)
      return
    }

    if (idx !== -1) {
      // Animate only between two known main pages
      const animated = prev !== -1 && prev !== idx
      snapPages(idx, animated)
    }
    prevIdx.current = idx
  }, [pathname])

  // ── Touch handlers (mounted once — refs keep everything fresh) ───────────────
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Block swipe navigation while any modal/overlay is open
      if (document.querySelector("[data-modal]")) return
      touchStartX.current  = e.touches[0].clientX
      touchStartY.current  = e.touches[0].clientY
      touchStartMs.current = Date.now()
      isHoriz.current      = false
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx     = e.touches[0].clientX - touchStartX.current
      const dy     = e.touches[0].clientY - touchStartY.current
      const curIdx = getPageIndex(pathnameRef.current)
      if (curIdx === -1) return

      // Axis detection on first significant movement
      if (!isHoriz.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return // too small to decide
        if (Math.abs(dy) >= Math.abs(dx)) return          // more vertical → bail
        isHoriz.current = true
      }

      // Block native browser scroll/rubber-band so the page sticks to the finger
      e.preventDefault()

      // Edge resistance when there is no adjacent page
      const atLeftEdge  = dx > 0 && curIdx === 0
      const atRightEdge = dx < 0 && curIdx === MAIN_PAGES.length - 1
      const effectiveDx = (atLeftEdge || atRightEdge) ? dx * 0.15 : dx

      // Move ALL pages together — no React state needed, pure DOM
      pageRefs.current.forEach((el, i) => {
        if (!el) return
        el.style.transition = "none"
        el.style.transform  = `translateX(calc(${(i - curIdx) * 100}% + ${effectiveDx}px))`
      })
    }

    function onTouchEnd(e: TouchEvent) {
      if (!isHoriz.current || touchStartX.current === null) {
        touchStartX.current = null
        touchStartY.current = null
        isHoriz.current     = false
        return
      }

      const dx       = e.changedTouches[0].clientX - touchStartX.current
      const dt       = Math.max(1, Date.now() - touchStartMs.current)
      const velocity = Math.abs(dx) / dt   // px / ms

      const curIdx = getPageIndex(pathnameRef.current)

      touchStartX.current = null
      touchStartY.current = null
      isHoriz.current     = false

      if (curIdx === -1) return

      const w     = pageRefs.current[curIdx]?.offsetWidth ?? window.innerWidth
      const toIdx = dx < 0 ? curIdx + 1 : curIdx - 1
      const valid = toIdx >= 0 && toIdx < MAIN_PAGES.length

      // Complete the swipe if past threshold or fast enough
      if (valid && (Math.abs(dx) > w * 0.3 || velocity > 0.4)) {
        snapPages(toIdx, true)                          // animate pages to target
        setTimeout(() => {
          swipeNav.current = true                       // tell pathname effect to skip
          router.push(MAIN_PAGES[toIdx].path)
        }, DUR)
      } else {
        snapPages(curIdx, true)                         // snap back to current
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true  })
    document.addEventListener("touchmove",  onTouchMove,  { passive: false }) // non-passive → can preventDefault
    document.addEventListener("touchend",   onTouchEnd,   { passive: true  })
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove",  onTouchMove)
      document.removeEventListener("touchend",   onTouchEnd)
    }
  }, [router])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar />
      <div className="flex-1 md:ml-52 overflow-hidden min-w-0 relative">

        {MAIN_PAGES.map(({ path, Component }, idx) => (
          <div
            key={path}
            ref={el => {
              pageRefs.current[idx] = el
              // Position immediately at mount so there is no single-frame overlap
              if (el) {
                const base = getPageIndex(pathnameRef.current)
                el.style.transition = "none"
                el.style.transform  = base !== -1
                  ? `translateX(${(idx - base) * 100}%)`
                  : `translateX(${(idx - (prevIdx.current !== -1 ? prevIdx.current : 2)) * 100}%)`
              }
            }}
            className="absolute inset-0 overflow-y-auto bg-gray-100"
          >
            <Component />
            <div className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden shrink-0" />
          </div>
        ))}

        {!isMainPage && (
          <div className="absolute inset-0 overflow-y-auto bg-gray-100 z-10">
            {children}
            <div className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden shrink-0" />
          </div>
        )}

      </div>
    </div>
  )
}
