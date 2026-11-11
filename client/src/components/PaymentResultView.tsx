import { useState } from 'react'
import type { AnalysisResult } from '../services/riskEvaluator'
import PayPalButton from './PayPalButton'
import PausedStatusView from './PausedStatusView'
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, ShieldAlertIcon } from './Icons'

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
      className="py-2 text-left"
      role="status"
      aria-live="polite"
      aria-label={`Payment check complete: ${isSafe ? 'looks fine' : 'review needed'}`}
    >
      {/* ── Status Tag ── */}
      <div>
        {isSafe && (
          <span className="inline-flex items-center gap-1.5 rounded-tag bg-safe-tint px-2.5 py-1 text-[0.875rem] font-semibold text-safe">
            <CheckCircleIcon />
            <span>Looks fine</span>
          </span>
        )}
        {!isSafe && !isHigh && (
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-hold-tint px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
            <ClockIcon />
            <span>Needs a second look</span>
          </span>
        )}
        {isHigh && (
          <span className="inline-flex items-center gap-1.5 rounded-tag bg-danger-tint px-2.5 py-1 text-[0.875rem] font-semibold text-danger">
            <ShieldAlertIcon />
            <span>Higher risk · family check needed</span>
          </span>
        )}
      </div>

      {/* ── Heading & Summary ── */}
      <h2 className="mt-4 font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
        {isSafe
          ? `Ready to send $${amount} to ${payee}`
          : `We'll ask Sarah to confirm $${amount} to ${payee}`}
      </h2>

      <p className="mt-3 text-[1.125rem] leading-[1.55] text-ink-2">
        {isSafe
          ? 'Nothing unusual stood out. Confirm with PayPal below to send your payment.'
          : 'Before any money leaves your account, PayPal will place this payment on hold and ask Sarah to take a look.'}
      </p>

      {/* ── Reasons & Question from API ── */}
      {analysis.reasons.length > 0 && (
        <div className="mt-6 rounded-control border border-line bg-paper p-4">
          <p className="text-[0.9375rem] font-semibold text-ink">What we checked</p>
          <ul className="mt-2 space-y-2 text-[1rem] leading-[1.5] text-ink-2">
            {analysis.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="text-ink-2">
                  •
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          {analysis.questionForUser && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                <AlertCircleIcon className="text-hold" />
                <span>A question before you continue</span>
              </p>
              <p className="mt-1.5 text-[1rem] leading-[1.5] text-ink-2">
                “{analysis.questionForUser}”
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Error Banner ── */}
      {displayError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-control border border-danger bg-danger-tint p-4 text-[0.9375rem] leading-[1.5] text-ink"
        >
          <AlertCircleIcon className="text-danger mt-0.5" />
          <span>{displayError}</span>
        </div>
      )}

      {/* ── PayPal Smart Button Container or Action Buttons ── */}
      {showPayPal && canProceed && analysis.paymentId ? (
        <div className="mt-6 rounded-control border border-line bg-surface p-5">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <span className="text-[1rem] font-semibold text-ink">PayPal checkout</span>
            <span className="text-[0.875rem] text-ink-2">Authorization only</span>
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
            className="mt-3 min-h-[48px] px-2 text-[1rem] font-semibold text-brand hover:text-brand-hover underline underline-offset-4 cursor-pointer"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleProceedToCheckout}
            className={`w-full min-h-[52px] px-6 py-3 rounded-control bg-brand hover:bg-brand-hover text-white text-[1.125rem] font-semibold ui-transition ${
              !canProceed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {isSafe ? 'Send payment' : 'Continue to PayPal hold'}
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!isSafe && (
              <button
                type="button"
                onClick={onEdit}
                className="min-h-[52px] px-6 py-3 rounded-control border-[1.5px] border-brand bg-surface text-brand hover:bg-brand-tint text-[1.125rem] font-semibold ui-transition cursor-pointer"
              >
                Edit details
              </button>
            )}

            <button
              type="button"
              onClick={onReset}
              className="min-h-[48px] px-4 py-2 rounded-control text-[1rem] font-semibold text-ink-2 hover:text-ink underline underline-offset-4 ui-transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Policy Notice ── */}
      <p className="mt-4 text-[0.9375rem] leading-[1.5] text-ink-3">
        {isSafe
          ? 'Funds move only after you confirm inside PayPal.'
          : 'Your money stays in your account while Sarah reviews this request.'}
      </p>
    </div>
  )
}
