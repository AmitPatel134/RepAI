"use client"
import { useState } from "react"

const steps = [
  {
    icon: (
      <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    // TODO: Update with your app name and description
    title: "Welcome to MyApp!",
    description: "Your AI-powered platform. In a few steps, you'll be ready to manage your items and generate content efficiently.",
    cta: "Get started",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: "Add your items",
    description: "Create and organize your items. Give them a name, description, and status to keep everything structured.",
    cta: "Next",
    link: { href: "/app/items", label: "Add my first item →" },
  },
  {
    icon: (
      <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Generate content in seconds",
    description: "Select an item, choose a generation type, and let the AI write content for you. Emails, summaries, social posts and more.",
    cta: "Let's go!",
    link: { href: "/app/generation", label: "Try AI generation →" },
  },
]

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  function handleNext() {
    if (isLast) {
      onClose()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-violet-600 transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-6 bg-violet-600" : i < step ? "w-3 bg-violet-200" : "w-3 bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-gray-500 transition-colors text-xs font-medium"
            >
              Skip
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-6">
            {current.icon}
          </div>

          {/* Content */}
          <h2 className="text-xl font-extrabold text-gray-900 mb-3">{current.title}</h2>
          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">{current.description}</p>

          {/* Optional link */}
          {"link" in current && current.link && (
            <a
              href={current.link.href}
              className="block text-sm font-bold text-violet-600 hover:text-violet-700 mb-6 transition-colors"
            >
              {current.link.label}
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors"
            >
              {current.cta}
            </button>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="py-3 px-4 border border-gray-200 text-sm font-bold text-gray-500 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
