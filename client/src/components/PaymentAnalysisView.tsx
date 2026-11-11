interface PaymentAnalysisViewProps {
  payee: string
  amount: string
}

export default function PaymentAnalysisView({ payee, amount }: PaymentAnalysisViewProps) {
  return (
    <div className="py-4 text-left" role="status" aria-live="polite">
      <p className="font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
        Taking a look…
      </p>

      <p className="mt-3 text-[1.125rem] leading-[1.55] text-ink-2">
        Checking{' '}
        <span className="font-serif font-semibold text-ink tabular-nums">${amount}</span> to{' '}
        <span className="font-semibold text-ink">{payee}</span>. Nothing has been charged.
      </p>

      <progress
        aria-label="Checking payment details"
        className="sr-only"
      />
    </div>
  )
}
