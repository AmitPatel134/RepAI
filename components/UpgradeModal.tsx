"use client"
import { useEffect } from "react"

export default function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  // Lock scroll when open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      data-modal=""
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5"
      onClick={onClose}
    >
      <div
        className="modal-enter bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-purple-400" />

        <div className="px-6 pt-6 pb-5 text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h3 className="text-base font-extrabold text-gray-900 mb-2">Fonctionnalité Premium</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2.5">
          <a
            href="/pricing"
            className="w-full py-3.5 bg-violet-600 rounded-2xl text-sm font-bold text-white hover:bg-violet-500 transition-colors text-center block"
          >
            Passer au plan Premium →
          </a>
          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Pas maintenant
          </button>
        </div>
      </div>
    </div>
  )
}
