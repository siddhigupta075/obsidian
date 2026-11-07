import Navbar from '../components/Navbar'
import PaymentForm from '../components/PaymentForm'

export default function ElderPaymentView() {
  return (
    <div className="min-h-screen bg-[#F7FAF9] text-[#063B3B] flex flex-col font-sans selection:bg-[#DDF7F0] selection:text-[#063B3B]">
      {/* ── Navigation Bar ── */}
      <Navbar />

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="w-full max-w-xl space-y-8">
          {/* Header & Reassuring Messaging */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#009F91]/20 bg-[#DDF7F0]/80 px-3.5 py-1 text-xs font-bold text-[#063B3B] shadow-2xs">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#009F91]" />
              AI-POWERED PRE-CAPTURE PROTECTION
            </div>

            <h1 className="font-sans text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#063B3B] leading-tight">
              Every payment deserves a second look.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">
              SecondSight quietly analyzes recipient risk, coercion signals, and pressure tactics—keeping
              your money safe before any funds leave your account.
            </p>
          </div>

          {/* Payment Card Container */}
          <div className="relative rounded-3xl border border-[#009F91]/15 bg-white p-6 sm:p-9 shadow-[0_8px_30px_rgb(6,59,59,0.05)] transition-all">
            {/* Subtle top brand accent line */}
            <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-[#009F91] via-[#063B3B] to-[#009F91]" />

            <PaymentForm />
          </div>

          {/* Reassuring note for elders & families */}
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-[#009F91]"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 1a9 9 0 100 18 9 9 0 000-18zm3.707 7.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Payments remain held in authorization state until verified safe.</span>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-[#009F91]/10 bg-white/70 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#063B3B]">SecondSight</span>
            <span className="text-slate-300">·</span>
            <span>Pause the payment. Not the person.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>PayPal Authorize Protocol</span>
            <span>•</span>
            <span>Zero-Liability Hold</span>
            <span>•</span>
            <span className="font-semibold text-[#009F91]">Sandbox Demo Mode</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
