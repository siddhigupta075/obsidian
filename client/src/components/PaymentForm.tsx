import { useState } from 'react'
import VoiceCapture from './VoiceCapture'
import PaymentAnalysisView from './PaymentAnalysisView'
import PaymentResultView from './PaymentResultView'
import { AlertCircleIcon } from './Icons'
import { analyzePayment, type AnalysisResult } from '../services/riskEvaluator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentFormData {
  payee: string
  amount: string
  purpose: string
}

interface FormErrors {
  payee?: string
  amount?: string
  purpose?: string
}

type SubmitState = 'idle' | 'analysing' | 'result'

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAmount(raw: string): string | null {
  const num = parseFloat(raw.replace(/,/g, '').trim())
  if (isNaN(num) || num <= 0) return 'Enter a valid amount (e.g. 50 or 500).'
  if (num > 10_000) return 'Amount cannot exceed $10,000.'
  return null
}

function validate(data: PaymentFormData): FormErrors {
  const errors: FormErrors = {}

  if (!data.payee.trim()) {
    errors.payee = 'Please enter the recipient or business name.'
  }

  const amountError = validateAmount(data.amount)
  if (amountError) {
    errors.amount = amountError
  }

  if (!data.purpose.trim()) {
    errors.purpose = 'Please describe the reason for this payment.'
  }

  return errors
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PaymentForm() {
  const [form, setForm] = useState<PaymentFormData>({
    payee: '',
    amount: '',
    purpose: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const updateField =
    (field: keyof PaymentFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }

  const handleVoiceTranscript = (text: string) => {
    setForm((prev) => ({
      ...prev,
      purpose: prev.purpose.trim() ? `${prev.purpose.trim()} ${text}` : text,
    }))
    if (errors.purpose) {
      setErrors((prev) => ({ ...prev, purpose: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitState !== 'idle') return
    setSubmitError(null)

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitState('analysing')

    const sanitizedAmount = parseFloat(form.amount.replace(/,/g, ''))

    try {
      // Run dynamic risk evaluation (calls backend /api/check)
      const result = await analyzePayment({
        payee: form.payee,
        amount: sanitizedAmount,
        purpose: form.purpose,
      })

      setAnalysisResult(result)
      setSubmitState('result')
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Payment analysis failed. Please verify your connection and try again.'
      )
      setSubmitState('idle')
    }
  }

  const handleEdit = () => {
    setErrors({})
    setSubmitError(null)
    setSubmitState('idle')
  }

  const handleReset = () => {
    setForm({ payee: '', amount: '', purpose: '' })
    setErrors({})
    setSubmitError(null)
    setAnalysisResult(null)
    setSubmitState('idle')
  }

  // ─── Screen: Analyzing State ───────────────────────────────────────────────
  if (submitState === 'analysing') {
    return <PaymentAnalysisView payee={form.payee} amount={form.amount} />
  }

  // ─── Screen: Result State ──────────────────────────────────────────────────
  if (submitState === 'result' && analysisResult) {
    return (
      <PaymentResultView
        payee={form.payee}
        amount={form.amount}
        analysis={analysisResult}
        onEdit={handleEdit}
        onReset={handleReset}
      />
    )
  }

  // ─── Screen: Payment Entry Form ───────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Payment check form">
      <div className="space-y-6">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-control border border-danger bg-danger-tint p-4 text-ink"
          >
            <AlertCircleIcon className="text-danger mt-0.5" />
            <div className="flex-1">
              <p className="text-[1rem] font-semibold text-danger">
                Could not check this payment
              </p>
              <p className="mt-1 text-[0.9375rem] leading-[1.5] text-ink">{submitError}</p>
            </div>
          </div>
        )}

        {/* Recipient / Payee Name */}
        <div>
          <label
            htmlFor="payee"
            className="mb-2 block text-[1.125rem] font-semibold leading-[1.4] text-ink"
          >
            Who are you paying?
          </label>
          <input
            id="payee"
            type="text"
            value={form.payee}
            onChange={updateField('payee')}
            autoComplete="off"
            placeholder="Duke Energy, Dr. Patel, or a person's name"
            aria-describedby={errors.payee ? 'payee-error' : undefined}
            aria-invalid={!!errors.payee}
            className={`w-full min-h-[56px] rounded-control border-[1.5px] bg-surface px-4 py-3 text-[1.25rem] leading-[1.4] text-ink placeholder:text-ink-3 ui-transition focus:outline-none ${
              errors.payee
                ? 'border-danger focus:border-danger'
                : 'border-field-border focus:border-brand'
            }`}
          />
          {errors.payee && (
            <p
              id="payee-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-[0.9375rem] font-semibold leading-[1.5] text-danger"
            >
              <AlertCircleIcon className="mt-0.5" />
              <span>{errors.payee}</span>
            </p>
          )}
        </div>

        {/* Amount (USD) */}
        <div>
          <label
            htmlFor="amount"
            className="mb-2 block text-[1.125rem] font-semibold leading-[1.4] text-ink"
          >
            Amount
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[1.25rem] font-semibold text-ink-2 tabular-nums"
            >
              $
            </span>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={updateField('amount')}
              placeholder="0.00"
              autoComplete="off"
              aria-describedby={errors.amount ? 'amount-error' : undefined}
              aria-invalid={!!errors.amount}
              className={`w-full min-h-[56px] rounded-control border-[1.5px] bg-surface pl-9 pr-4 py-3 text-[1.25rem] leading-[1.4] text-ink placeholder:text-ink-3 tabular-nums ui-transition focus:outline-none ${
                errors.amount
                  ? 'border-danger focus:border-danger'
                  : 'border-field-border focus:border-brand'
              }`}
            />
          </div>
          {errors.amount && (
            <p
              id="amount-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-[0.9375rem] font-semibold leading-[1.5] text-danger"
            >
              <AlertCircleIcon className="mt-0.5" />
              <span>{errors.amount}</span>
            </p>
          )}
        </div>

        {/* Payment Purpose / Context with Voice Input */}
        <div>
          <label
            htmlFor="purpose"
            className="mb-1 block text-[1.125rem] font-semibold leading-[1.4] text-ink"
          >
            What&apos;s it for?
          </label>
          <p id="purpose-help" className="mb-2 text-[0.9375rem] leading-[1.5] text-ink-3">
            A sentence is plenty. You can say it out loud if that&apos;s easier.
          </p>
          <textarea
            id="purpose"
            rows={3}
            value={form.purpose}
            onChange={updateField('purpose')}
            placeholder="Electric bill for October"
            aria-describedby={
              errors.purpose ? 'purpose-help purpose-error' : 'purpose-help'
            }
            aria-invalid={!!errors.purpose}
            className={`w-full min-h-[112px] rounded-control border-[1.5px] bg-surface p-4 text-[1.25rem] leading-[1.45] text-ink placeholder:text-ink-3 resize-y ui-transition focus:outline-none ${
              errors.purpose
                ? 'border-danger focus:border-danger'
                : 'border-field-border focus:border-brand'
            }`}
          />
          <VoiceCapture onTranscript={handleVoiceTranscript} />
          {errors.purpose && (
            <p
              id="purpose-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-[0.9375rem] font-semibold leading-[1.5] text-danger"
            >
              <AlertCircleIcon className="mt-0.5" />
              <span>{errors.purpose}</span>
            </p>
          )}
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full min-h-[52px] px-6 py-3 rounded-control bg-brand hover:bg-brand-hover text-white text-[1.125rem] font-semibold ui-transition cursor-pointer"
          >
            Check this payment
          </button>
        </div>
      </div>
    </form>
  )
}
