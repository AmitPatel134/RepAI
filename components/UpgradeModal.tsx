export default function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-sm">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pt-5 pb-3 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-white mb-2">Limite du plan Gratuit</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Fermer
          </button>
          <a
            href="/pricing"
            className="flex-1 py-3 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors text-center"
          >
            Passer Pro →
          </a>
        </div>
      </div>
    </div>
  )
}
