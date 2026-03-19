"use client"
import { useEffect } from "react"

interface ToastProps {
  message: string
  onHide: () => void
  type?: "success" | "error"
}

export default function Toast({ message, onHide, type = "success" }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onHide, 2500)
    return () => clearTimeout(t)
  }, [onHide])

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold whitespace-nowrap ${
      type === "success" ? "bg-gray-900 text-white" : "bg-red-500 text-white"
    }`}>
      {type === "success" ? (
        <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  )
}
