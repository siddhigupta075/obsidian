import { useEffect, useState } from 'react'

interface PaymentAnalysisViewProps {
  payee: string
  amount: string
}

export default function PaymentAnalysisView({ payee, amount }: PaymentAnalysisViewProps) {
  const [stepIndex, setStepIndex] = useState(0)

  const steps = [
    'Scanning recipient credentials & legitimacy…',
    'Analyzing context for urgency & coercion tactics…',
    'Cross-referencing pattern database & risk thresholds…',
    'Finalizing safety verification…',
  ]

  useEffect(() => {
    const timer1 = setTimeout(() => setStepIndex(1), 400)
    const timer2 = setTimeout(() => setStepIndex(2), 900)
    const timer3 = setTimeout(() => setStepIndex(3), 1400)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-4 text-center"
      role="status"
      aria-live="polite"
      aria-label="Analyzing payment for security and fraud indicators"
    >
      {/* ── Scanning Eye / Shield Illustration ── */}
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        {/* Subtle pulsing background aura */}
        <div className="absolute h-full w-full rounded-full bg-[#DDF7F0]/60 animate-ping opacity-40" />
        <div className="absolute h-28 w-28 rounded-full border border-[#009F91]/20 bg-[#F0FBF7]" />

        {/* Outer rotating scan ring */}
        <div className="absolute h-28 w-28 rounded-full border-2 border-transparent border-t-[#009F91] border-r-[#009F91]/40 animate-spin" />

        {/* Central Shield with Eye Aperture */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#063B3B] to-[#009F91] text-white shadow-md">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 animate-pulse-subtle"
            aria-hidden="true"
          >
            {/* Protective Shield */}
            <path
              d="M24 4L8 10V22C8 32.5 14.8 42.1 24 45C33.2 42.1 40 32.5 40 22V10L24 4Z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Scanning Eye Outline */}
            <path
              d="M14 24C17 18 31 18 34 24C31 30 17 30 14 24Z"
              stroke="#DDF7F0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Scanning Eye Iris/Lens */}
            <circle cx="24" cy="24" r="4" fill="#DDF7F0" />
            <circle cx="24" cy="24" r="1.5" fill="#063B3B" />
          </svg>
        </div>
      </div>

      {/* ── Title & Progress Details ── */}
      <div className="space-y-2 max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#DDF7F0] px-3 py-1 text-xs font-bold text-[#063B3B] tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009F91] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#009F91]"></span>
          </span>
          ACTIVE HEURISTIC SCAN
        </div>

        <h3 className="font-sans text-2xl font-bold tracking-tight text-[#063B3B]">
          Evaluating Payment Safety
        </h3>

        <p className="text-sm font-medium text-slate-500">
          Analyzing transaction to <strong className="text-slate-700">{payee}</strong> for ${amount}
        </p>
      </div>

      {/* ── Dynamic Stepper Feedback ── */}
      <div className="mt-6 w-full max-w-sm rounded-xl border border-[#009F91]/15 bg-white p-4 shadow-2xs text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#009F91] text-white">
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-xs font-semibold text-[#063B3B] transition-all duration-200">
            {steps[stepIndex]}
          </p>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-[#009F91] to-[#063B3B] transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

