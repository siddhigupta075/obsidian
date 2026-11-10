import { useEffect, useState } from 'react'

interface PausedStatusViewProps {
  paymentId: string
  payee: string
  amount: string
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  initialStatus: 'CAPTURED' | 'HELD'
  initialMessage: string
  onReset: () => void
}

export default function PausedStatusView({
  paymentId,
  payee,
  amount,
  initialStatus,
  initialMessage,
  onReset,
}: PausedStatusViewProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(initialStatus)
  const [statusMessage, setStatusMessage] = useState<string>(initialMessage)
  const [decision, setDecision] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)

  // Poll status every 3 seconds while payment is HELD
  useEffect(() => {
    if (currentStatus !== 'HELD') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`)
        if (res.ok) {
          const data = await res.json()
          setPollCount((prev) => prev + 1)
          if (data.status && data.status !== 'HELD') {
            setCurrentStatus(data.status)
            setStatusMessage(data.message || '')
            setDecision(data.decision || null)
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [paymentId, currentStatus])

  const isHeld = currentStatus === 'HELD'
  const isCaptured = currentStatus === 'CAPTURED'
  const isVoided = currentStatus === 'VOIDED'

  return (
    <div
      className="flex flex-col items-center py-6 text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      {/* ── Status Shield Icon ── */}
      <div className="mb-6 flex flex-col items-center">
        {isHeld && (
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-600 shadow-sm">
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
            </span>
            <svg className="h-10 w-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {isCaptured && (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#DDF7F0] border-2 border-[#009F91] text-[#009F91] shadow-sm">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {isVoided && (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 border-2 border-emerald-400 text-emerald-600 shadow-sm">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        )}

        {/* ── Status Badge ── */}
        <div className="mt-4">
          {isHeld && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              STATUS: PAUSED FOR A SECOND LOOK
            </span>
          )}
          {isCaptured && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#009F91]/30 bg-[#DDF7F0] px-3.5 py-1 text-xs font-bold text-[#063B3B]">
              <span className="h-2 w-2 rounded-full bg-[#009F91]" />
              STATUS: PAYMENT COMPLETED
            </span>
          )}
          {isVoided && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              STATUS: FUNDS PROTECTED & VOIDED
            </span>
          )}
        </div>

        {/* ── Headline ── */}
        <h2 className="mt-4 font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#063B3B]">
          {isHeld && 'Paused for a Second Look'}
          {isCaptured && 'Payment Approved & Sent'}
          {isVoided && 'Safe! Your Family Stopped This Payment'}
        </h2>

        {/* ── Explanatory Copy ── */}
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-md leading-relaxed">
          {isHeld && (
            <>
              {statusMessage ||
                'We placed this payment on a temporary hold before any money moved. A trusted family member was sent a review notice.'}
            </>
          )}
          {isCaptured && (
            <>
              Your family confirmed this transaction is legitimate. PayPal has captured the reserved funds for{' '}
              <strong className="text-slate-800 font-semibold">{payee}</strong>.
            </>
          )}
          {isVoided && (
            <>
              {decision === 'DECLINED' ? (
                <>
                  Your family reviewed the payment request and declined it to protect you.{' '}
                  <strong className="text-emerald-900 font-bold">
                    Zero money left your account.
                  </strong>{' '}
                  The PayPal authorization was completely cancelled.
                </>
              ) : (
                <>
                  The cooling-off review window expired without confirmation.{' '}
                  <strong className="text-emerald-900 font-bold">
                    The transaction was automatically cancelled.
                  </strong>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {/* ── Transaction Receipt Card ── */}
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left space-y-2.5 text-xs text-slate-600">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Recipient</span>
          <span className="font-bold text-slate-800 text-sm">{payee}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Amount</span>
          <span className="font-bold text-[#063B3B] text-sm">${amount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">PayPal Authorization</span>
          <span className="font-mono text-slate-500">{paymentId.substring(0, 14)}...</span>
        </div>
      </div>

      {/* ── Real-time Polling Feedback ── */}
      {isHeld && (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>Checking family decision live... (Checked {pollCount} times)</span>
        </div>
      )}

      {/* ── Action Button ── */}
      <div className="mt-6 w-full max-w-md">
        <button
          type="button"
          onClick={onReset}
          className="w-full py-3.5 px-6 rounded-xl bg-[#063B3B] hover:bg-[#009F91] text-white text-base font-semibold shadow-xs transition-all duration-200 focus:outline-none cursor-pointer"
        >
          {isHeld ? 'Return to Home' : 'Start New Payment'}
        </button>
      </div>
    </div>
  )
}
