import { useState } from 'react'
import type { AnalysisResult } from '../services/riskEvaluator'

interface PaymentResultViewProps {
  payee: string
  amount: string
  purpose: string
  analysis: AnalysisResult
  onEdit: () => void
  onReset: () => void
}

function formatINR(raw: string): string {
  const sanitized = raw.replace(/,/g, '')
  const num = parseFloat(sanitized)
  if (isNaN(num)) return raw
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export default function PaymentResultView({
  payee,
  amount,
  purpose,
  analysis,
  onEdit,
  onReset,
}: PaymentResultViewProps) {
  const [isRoutingToPayment, setIsRoutingToPayment] = useState(false)

  const isSafe = analysis.risk === 'LOW'
  const isMedium = analysis.risk === 'MEDIUM'
  const isHigh = analysis.risk === 'HIGH'

  return (
    <div
      className="flex flex-col items-center py-4 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Payment assessment complete: ${analysis.risk} risk`}
    >
      {/* ── Visual Shield Illustration & Risk Badge ── */}
      <div className="mb-6 flex flex-col items-center">
        {isSafe && <SafeIllustration />}
        {isMedium && <SuspiciousIllustration />}
        {isHigh && <HighRiskIllustration />}

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
                no funds have been captured or moved
              </strong>
              . A trusted family member will be invited to review it.
            </>
          )}
          {isHigh && (
            <>
              Critical safety alert: This payment exhibits patterns common to fraud or extortion.{' '}
              <strong className="text-rose-900 font-semibold">
                Zero money has left your account.
              </strong>
            </>
          )}
        </p>
      </div>

      {/* ── Transaction Summary Card ── */}
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Payment Summary
          </span>
          <span className="text-[11px] font-semibold text-[#009F91] bg-[#DDF7F0] px-2 py-0.5 rounded">
            Pre-Authorization
          </span>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-slate-500 font-medium">Recipient:</span>
            <span className="font-semibold text-[#063B3B] text-right">{payee}</span>
          </div>
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-slate-500 font-medium">Amount:</span>
            <span className="font-extrabold text-xl text-[#009F91] text-right">
              ₹{formatINR(amount)}
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-slate-500 font-medium">Stated Purpose:</span>
            <span className="text-slate-700 text-right max-w-[65%] break-words italic">
              "{purpose}"
            </span>
          </div>
        </div>
      </div>

      {/* ── AI Assessment Details Card ── */}
      <div className="mt-4 w-full max-w-lg rounded-2xl border p-5 text-left text-sm transition-all shadow-2xs">
        {isSafe ? (
          <div className="space-y-3 border-[#009F91]/20 bg-[#F0FBF7]">
            <p className="font-bold text-[#063B3B] flex items-center gap-2">
              <svg className="w-4 h-4 text-[#009F91]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Safety Evaluation Rationale
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {analysis.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#009F91] font-bold">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            className={`space-y-3 ${
              isHigh ? 'border-rose-200 bg-rose-50/60' : 'border-amber-200 bg-amber-50/60'
            }`}
          >
            <p
              className={`font-bold flex items-center gap-2 ${
                isHigh ? 'text-rose-900' : 'text-amber-900'
              }`}
            >
              <svg
                className={`w-4 h-4 ${isHigh ? 'text-rose-600' : 'text-amber-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {isHigh ? 'Detected Danger Signals' : 'Flagged Attention Signals'}
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {analysis.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={isHigh ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>
                    •
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            {analysis.questionForUser && (
              <div
                className={`mt-2 rounded-xl border p-3 ${
                  isHigh ? 'border-rose-300 bg-white' : 'border-amber-300 bg-white'
                }`}
              >
                <p className="text-xs font-semibold text-slate-800">
                  ⚠️ Question to consider before continuing:
                </p>
                <p className="mt-1 text-xs italic text-slate-600">
                  "{analysis.questionForUser}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status Message when Continuing ── */}
      {isRoutingToPayment && (
        <div className="mt-4 w-full max-w-lg rounded-xl border border-[#009F91]/30 bg-[#DDF7F0] p-4 text-xs font-medium text-[#063B3B] animate-pulse">
          <p className="font-bold">Routing to Secure Gateway…</p>
          <p className="mt-0.5">
            Connecting to PayPal Authorize sandbox protocol. Payment is verified and holds can be executed.
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
        {isSafe ? (
          <>
            <button
              type="button"
              onClick={() => setIsRoutingToPayment(true)}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#009F91] hover:bg-[#00877A] active:bg-[#063B3B] text-white text-base font-semibold shadow-xs transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#009F91]/30 cursor-pointer"
            >
              Continue to Payment →
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 cursor-pointer"
            >
              Analyze Another Payment
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-[#063B3B] hover:bg-[#009F91] text-white text-base font-semibold shadow-xs transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#063B3B]/30 cursor-pointer"
            >
              ← Edit Payment Details
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 cursor-pointer"
            >
              Analyze Another Payment
            </button>
          </>
        )}
      </div>

      {/* ── Honest Disclaimer ── */}
      <p className="mt-4 text-[11px] text-slate-400 max-w-md text-center">
        {isSafe
          ? 'Notice: This payment has not been completed. Funds are only transferred after your explicit PayPal confirmation.'
          : 'Safety Policy: SecondSight uses the PayPal Authorize protocol. Monies remain in your account while under family review.'}
      </p>
    </div>
  )
}

// ─── Custom Illustrations ─────────────────────────────────────────────────────

function SafeIllustration() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className="absolute h-full w-full rounded-full bg-[#DDF7F0] animate-pulse-subtle" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009F91] to-[#063B3B] text-white shadow-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-white"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
    </div>
  )
}

function SuspiciousIllustration() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className="absolute h-full w-full rounded-full bg-amber-100 animate-pulse-subtle" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-white"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="10" y1="9" x2="10" y2="15" />
          <line x1="14" y1="9" x2="14" y2="15" />
        </svg>
      </div>
    </div>
  )
}

function HighRiskIllustration() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className="absolute h-full w-full rounded-full bg-rose-100 animate-pulse-subtle" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-[#063B3B] text-white shadow-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-white"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </div>
  )
}
