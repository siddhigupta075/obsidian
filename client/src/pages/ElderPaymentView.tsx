import Navbar from '../components/Navbar'
import PaymentForm from '../components/PaymentForm'

export default function ElderPaymentView() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* ── Header ── */}
      <Navbar />

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl w-full px-6 py-6 lg:px-12 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left column: context & plain steps (stacks below form on mobile) */}
            <div className="lg:col-span-5 order-2 lg:order-1">
              <h1 className="font-serif font-semibold text-[2.25rem] leading-[1.15] tracking-[-0.01em] text-ink">
                Send a payment
              </h1>

              <p className="mt-4 text-[1.125rem] leading-[1.55] text-ink-2">
                Before any money leaves your account, SecondSight takes a quick look. Nothing is
                charged until it&apos;s checked.
              </p>

              <div className="mt-8 pt-6 border-t border-line">
                <h2 className="font-serif font-semibold text-[1.25rem] leading-[1.3] tracking-[-0.01em] text-ink">
                  What happens next
                </h2>
                <ol className="mt-4 space-y-3 text-[1.125rem] leading-[1.55] text-ink-2">
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-ink tabular-nums shrink-0">1.</span>
                    <span>Enter who you&apos;re paying, the amount, and what it&apos;s for.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-ink tabular-nums shrink-0">2.</span>
                    <span>SecondSight checks the details before any funds move.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-ink tabular-nums shrink-0">3.</span>
                    <span>
                      If it looks unusual or is over $100, Sarah is asked to confirm first.
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Right column: form card (first on mobile) */}
            <div className="lg:col-span-7 order-1 lg:order-2 flex lg:justify-end">
              <div className="w-full max-w-[560px] rounded-card border border-line bg-surface p-5 sm:p-8 shadow-card">
                <PaymentForm />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-line bg-paper pb-20 sm:pb-6">
        <div className="mx-auto max-w-6xl w-full px-6 py-5 lg:px-12 text-[0.875rem] leading-normal text-ink-2">
          SecondSight · PayPal sandbox · Demo mode
        </div>
      </footer>
    </div>
  )
}
