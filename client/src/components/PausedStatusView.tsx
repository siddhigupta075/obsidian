import { useEffect, useState } from 'react'
import { CheckCircleIcon, ClockIcon, ShieldCheckIcon } from './Icons'

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
    <div className="py-2 text-left" role="status" aria-live="polite">
      {isHeld && (
        <div className="rounded-card border border-hold-border bg-hold-tint p-5 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-surface px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
            <ClockIcon />
            <span>On hold</span>
          </span>

          <h2 className="mt-4 font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
            We&apos;ve paused this payment.
          </h2>

          <p className="mt-2 text-[1.125rem] leading-[1.55] text-ink">
            Sarah has been asked to take a look. Your money hasn&apos;t moved.
          </p>

          <dl className="mt-5 divide-y divide-hold-border rounded-control border border-hold-border bg-surface px-4 text-[1rem]">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Recipient</dt>
              <dd className="font-semibold text-ink text-right">{payee}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Amount</dt>
              <dd className="font-serif text-[1.375rem] font-semibold text-ink tabular-nums">
                ${amount}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex items-center gap-2 text-[0.9375rem] leading-[1.5] text-ink-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-hold shrink-0" />
            <span>
              Waiting for Sarah · checked {pollCount === 0 ? 'just now' : '3 seconds ago'}
            </span>
          </p>
        </div>
      )}

      {isCaptured && (
        <div className="rounded-card border border-line bg-safe-tint p-5 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-line bg-surface px-2.5 py-1 text-[0.875rem] font-semibold text-safe">
            <CheckCircleIcon />
            <span>Approved</span>
          </span>

          <h2 className="mt-4 font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
            Payment sent
          </h2>

          <p className="mt-2 text-[1.125rem] leading-[1.55] text-ink">
            {statusMessage || `Your payment of $${amount} to ${payee} has been sent.`}
          </p>

          <dl className="mt-5 divide-y divide-line rounded-control border border-line bg-surface px-4 text-[1rem]">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Recipient</dt>
              <dd className="font-semibold text-ink text-right">{payee}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Amount</dt>
              <dd className="font-serif text-[1.375rem] font-semibold text-ink tabular-nums">
                ${amount}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {isVoided && (
        <div className="rounded-card border border-line bg-paper p-5 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-line bg-surface px-2.5 py-1 text-[0.875rem] font-semibold text-ink-2">
            <ShieldCheckIcon />
            <span>{decision === 'DECLINED' ? 'Declined' : 'Cancelled'}</span>
          </span>

          <h2 className="mt-4 font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
            {decision === 'DECLINED' ? 'Payment declined' : 'Payment cancelled'}
          </h2>

          <p className="mt-2 text-[1.125rem] leading-[1.55] text-ink-2">
            {decision === 'DECLINED'
              ? 'Sarah declined this payment. Nothing was charged.'
              : 'This payment was not confirmed in time. Nothing was charged.'}
          </p>

          <dl className="mt-5 divide-y divide-line rounded-control border border-line bg-surface px-4 text-[1rem]">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Recipient</dt>
              <dd className="font-semibold text-ink text-right">{payee}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-2">Amount</dt>
              <dd className="font-serif text-[1.375rem] font-semibold text-ink tabular-nums">
                ${amount}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-6">
        {isHeld ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-[48px] px-2 text-[1.125rem] font-semibold text-brand hover:text-brand-hover underline underline-offset-4 ui-transition cursor-pointer"
          >
            Return to payment form
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="w-full min-h-[52px] px-6 py-3 rounded-control border-[1.5px] border-brand bg-surface text-brand hover:bg-brand-tint text-[1.125rem] font-semibold ui-transition cursor-pointer"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  )
}
