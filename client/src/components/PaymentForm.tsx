import { useState } from 'react'
import VoiceCapture from './VoiceCapture'
import PaymentAnalysisView from './PaymentAnalysisView'
import PaymentResultView from './PaymentResultView'
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
  if (num > 100_000) return 'Amount cannot exceed $100,000.'
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
    <form onSubmit={handleSubmit} noValidate aria-label="Payment safety analysis form">
      <div className="space-y-5">
        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-2.5 shadow-2xs"
          >
            <span className="text-rose-600 font-bold shrink-0 mt-0.5 text-base" aria-hidden="true">
              ⚠
            </span>
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Safety Check Error</p>
              <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{submitError}</p>
            </div>
          </div>
        )}
        {/* Recipient / Payee Name */}
        <div>
          <label htmlFor="payee" className="block text-sm font-semibold text-[#063B3B] mb-1.5">
            Recipient or Business Name
          </label>
          <div className="relative rounded-xl shadow-2xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <input
              id="payee"
              type="text"
              value={form.payee}
              onChange={updateField('payee')}
              autoComplete="off"
              placeholder="e.g. Reliance Energy, Dr. Verma, or Tech Support"
              aria-describedby={errors.payee ? 'payee-error' : undefined}
              aria-invalid={!!errors.payee}
              className={`w-full rounded-xl border bg-white py-3.5 pl-10 pr-4 text-base text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                errors.payee
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                  : 'border-slate-200 hover:border-slate-300 focus:border-[#009F91] focus:ring-[#009F91]/15'
              }`}
            />
          </div>
          {errors.payee && (
            <p id="payee-error" role="alert" className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
              <span>⚠</span> {errors.payee}
            </p>
          )}
        </div>

        {/* Amount (INR) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="amount" className="block text-sm font-semibold text-[#063B3B]">
              Payment Amount (INR)
            </label>
            <span className="text-[11px] font-medium text-slate-500">USD ($)</span>
          </div>
          <div className="relative rounded-xl shadow-2xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#063B3B] font-bold text-lg">
              $
            </div>
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
              className={`w-full rounded-xl border bg-white py-3.5 pl-9 pr-4 text-base font-medium text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                errors.amount
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                  : 'border-slate-200 hover:border-slate-300 focus:border-[#009F91] focus:ring-[#009F91]/15'
              }`}
            />
          </div>
          {errors.amount && (
            <p id="amount-error" role="alert" className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
              <span>⚠</span> {errors.amount}
            </p>
          )}
        </div>

        {/* Payment Purpose / Context with Voice Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="purpose" className="block text-sm font-semibold text-[#063B3B]">
              What is this payment for?
            </label>
            <span className="text-[11px] font-medium text-slate-500">Helps AI detect coercive patterns</span>
          </div>
          <div className="flex gap-2.5 items-start">
            <div className="relative flex-1 min-w-0 rounded-xl shadow-2xs">
              <textarea
                id="purpose"
                rows={3}
                value={form.purpose}
                onChange={updateField('purpose')}
                placeholder="e.g. Utility bill payment, doctor consultation, or online purchase"
                aria-describedby={errors.purpose ? 'purpose-error' : undefined}
                aria-invalid={!!errors.purpose}
                className={`w-full rounded-xl border bg-white p-3.5 text-base text-slate-800 placeholder:text-slate-400 resize-none transition-all duration-200 focus:outline-none focus:ring-4 ${
                  errors.purpose
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 hover:border-slate-300 focus:border-[#009F91] focus:ring-[#009F91]/15'
                }`}
              />
            </div>
            <div className="shrink-0 pt-0.5">
              <VoiceCapture onTranscript={handleVoiceTranscript} />
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Tap the microphone 🎙️ to dictate your reason safely</span>
          </div>
          {errors.purpose && (
            <p id="purpose-error" role="alert" className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
              <span>⚠</span> {errors.purpose}
            </p>
          )}
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <button
            type="submit"
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009F91] to-[#00877A] hover:from-[#00877A] hover:to-[#063B3B] py-4 px-6 text-base font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#009F91]/30 cursor-pointer"
          >
            <svg
              className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>Analyze Payment</span>
            <span className="text-white/70 transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg bg-[#F0FBF7] p-2 text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#DDF7F0] text-[#009F91]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-bold text-[#063B3B]">Zero Pre-Capture</p>
                <p className="text-slate-500">Funds never move pre-check</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-[#F0FBF7] p-2 text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#DDF7F0] text-[#009F91]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-bold text-[#063B3B]">AI Heuristics</p>
                <p className="text-slate-500">Detects scam urgency cues</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-[#F0FBF7] p-2 text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#DDF7F0] text-[#009F91]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-bold text-[#063B3B]">Family Safety</p>
                <p className="text-slate-500">Suspicious holds alert loved ones</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
