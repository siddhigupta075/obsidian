import { useState } from 'react'
import type { AnalysisResult } from '../services/riskEvaluator'
import PayPalButton from './PayPalButton'
import PausedStatusView from './PausedStatusView'

interface PaymentResultViewProps {
  payee: string
  amount: string
  analysis: AnalysisResult
  onEdit: () => void
  onReset: () => void
}

export default function PaymentResultView({
  payee,
  amount,
  analysis,
  onEdit,
  onReset,
}: PaymentResultViewProps) {
  const [showPayPal, setShowPayPal] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [completedStatus, setCompletedStatus] = useState<{
    status: 'CAPTURED' | 'HELD'
    message: string
  } | null>(null)

  const isSafe = analysis.risk === 'LOW'
  const isMedium = analysis.risk === 'MEDIUM'
  const isHigh = analysis.risk === 'HIGH'

  const canProceed = Boolean(analysis.paymentId && analysis.isLocalEvaluation !== true)

  const handleProceedToCheckout = () => {
    if (!canProceed) {
      setErrorMsg('Checkout is unavailable because a valid payment record was not created.')
      return
    }
    setShowPayPal(true)
  }

  const checkoutUnavailableMessage = !canProceed
    ? 'Checkout is unavailable because a valid payment record was not created.'
    : null
  const displayError = errorMsg || checkoutUnavailableMessage

  // If transaction has been authorized or captured, render the live Paused/Receipt view
  if (completedStatus && analysis.paymentId) {
    return (
      <PausedStatusView
        paymentId={analysis.paymentId}
        payee={payee}
        amount={amount}
        risk={analysis.risk}
        initialStatus={completedStatus.status}
        initialMessage={completedStatus.message}
        onReset={onReset}
      />
    )
  }

  return (
    <div
      className="flex flex-col items-center py-4 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Payment assessment complete: ${analysis.risk} risk`}
    >
      {/* ── Visual Shield Illustration & Risk Badge ── */}
      <div className="mb-6 flex flex-col items-center">
        <RiskIllustration risk={analysis.risk} />

        {/* Risk Badge */}
        <div className="mt-4">
          {isSafe && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#009F91]/20 bg-[#DDF7F0] px-3.5 py-1 text-xs font-bold text-[#063B3B]">
              <span className="h-2 w-2 rounded-full bg-[#009F91]" />
              LOW RISK · VERIFIED SAFE
            </span>
          )}
          {isMedium && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              MEDIUM RISK · PAUSED FOR REVIEW
            </span>
          )}
          {isHigh && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3.5 py-1 text-xs font-bold text-rose-800">
              <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
              HIGH RISK · SCAM INDICATORS DETECTED
            </span>
          )}
        </div>

        {/* Heading */}
        <h2 className="mt-3 font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#063B3B]">
          {isSafe && 'Payment Verified Safe to Proceed'}
          {isMedium && 'Payment Paused for a Second Look'}
          {isHigh && 'High Risk: Payment Paused to Protect You'}
        </h2>

        {/* Reassuring description */}
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed">
          {isSafe &&
            'SecondSight analyzed the context, recipient, and amount. No coercion, high-risk flags, or deceptive patterns were found.'}
          {isMedium && (
            <>
              This transaction triggered caution flags. To keep your money safe,{' '}
              <strong className="text-amber-900 font-semibold">
                no funds will leave your account
              </strong>
              . If you proceed, PayPal will reserve the funds and invite your family to review.
            </>
          )}
          {isHigh && (
            <>
              Critical safety alert: This payment exhibits patterns common to fraud or extortion.{' '}
              <strong className="text-rose-900 font-semibold">
                Zero money will leave your account.
              </strong>{' '}
              If you proceed, your family must confirm before funds can ever move.
            </>
          )}
        </p>

        {/* Assessment Details Box */}
        {analysis.reasons.length > 0 && (
          <div
            className={`mt-4 w-full max-w-lg rounded-2xl border p-4 text-left ${
              isSafe
                ? 'border-[#009F91]/20 bg-[#DDF7F0]/40'
                : isHigh
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Safety Analysis Summary
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {analysis.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={isHigh ? 'text-rose-600 font-bold' : isSafe ? 'text-[#009F91] font-bold' : 'text-amber-600 font-bold'}>
                    •
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            {analysis.questionForUser && (
              <div
                className={`mt-3 rounded-xl border p-3 ${
                  isHigh ? 'border-rose-300 bg-white' : 'border-amber-300 bg-white'
                }`}
              >
                <p className="text-xs font-semibold text-slate-800">
                  ⚠️ Question to consider before continuing:
                </p>
                <p className="mt-1 text-xs italic text-slate-700 font-medium">
                  "{analysis.questionForUser}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {displayError && (
        <div
          role="alert"
          className="mb-4 w-full max-w-md rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 text-left flex items-center gap-2"
        >
          <span className="font-bold text-rose-600 shrink-0">⚠</span>
          <span>{displayError}</span>
        </div>
      )}

      {/* ── PayPal Smart Button Container ── */}
      {showPayPal && canProceed && analysis.paymentId ? (
        <div className="w-full max-w-md rounded-2xl border border-[#009F91]/20 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-[#063B3B]">PayPal Sandbox Gateway</span>
            <span className="text-[11px] font-mono text-[#009F91] bg-[#DDF7F0] px-2 py-0.5 rounded">
              intent: AUTHORIZE
            </span>
          </div>

          <PayPalButton
            paymentId={analysis.paymentId}
            amount={parseFloat(amount.replace(/,/g, '')) || 100}
            risk={analysis.risk}
            onSuccess={(status, message) => {
              setCompletedStatus({ status, message })
            }}
            onError={(err) => {
              setErrorMsg(err)
            }}
          />

          <button
            type="button"
            onClick={() => setShowPayPal(false)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            ← Cancel PayPal Checkout
          </button>
        </div>
      ) : (
        /* ── Action Buttons ── */
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
          {isSafe ? (
            <>
              <button
                type="button"
                disabled={!canProceed}
                onClick={handleProceedToCheckout}
                className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#009F91] hover:bg-[#00877A] active:bg-[#063B3B] text-white text-base font-semibold shadow-xs transition-all duration-200 ${
                  !canProceed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Proceed to PayPal Checkout →
              </button>
              <button
                type="button"
                onClick={onReset}
                className="w-full sm:w-auto py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canProceed}
                onClick={handleProceedToCheckout}
                className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#063B3B] hover:bg-[#009F91] text-white text-base font-semibold shadow-xs transition-all duration-200 ${
                  !canProceed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Proceed with Protected Hold →
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="w-full sm:w-auto py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all duration-200 cursor-pointer"
              >
                ← Edit Details
              </button>
              <button
                type="button"
                onClick={onReset}
                className="w-full sm:w-auto py-3.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Footer Policy Notice ── */}
      <p className="mt-4 text-[11px] text-slate-400 max-w-md text-center">
        {isSafe
          ? 'Notice: Standard transaction. Funds move only after your explicit PayPal confirmation.'
          : 'Safety Guarantee: SecondSight uses the PayPal Authorize protocol. Monies remain reserved in your account until family confirms.'}
      </p>
    </div>
  )
}

// ─── Custom SVG Illustrations ──────────────────────────────────────────────────

function RiskIllustration({ risk }: { risk: string }) {
  if (risk === 'LOW') {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DDF7F0] text-[#009F91]">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
    )
  }
  if (risk === 'MEDIUM') {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 animate-bounce">
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
      </svg>
    </div>
  )
}
