import { useEffect, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  BrandMark,
  CheckCircleIcon,
  ClockIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from '../components/Icons'

interface HoldItem {
  token: string
  paymentId: string
  amount: number
  payeeLabel: string
  message: string
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  scamType?: string
  reasons: string[]
  familySummary?: string
  expiresAt?: string | null
  status: 'HELD' | 'PROCESSING' | 'CAPTURED' | 'VOIDED'
  decision?: 'APPROVED' | 'DECLINED' | 'EXPIRED' | null
  createdAt?: string
  decidedAt?: string
}

interface DemoIdentity {
  elder: { _id: string; name: string }
  family: { _id: string; name: string }
  familyLink: { amountLimit: number }
}

function formatCurrency(value: number): string {
  const hasCents = value % 1 !== 0
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

function formatRelativeTime(iso?: string): string | null {
  if (!iso) return null
  const createdMs = new Date(iso).getTime()
  if (Number.isNaN(createdMs)) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hr ago`
  return new Date(iso).toLocaleDateString()
}

export default function FamilyDashboardView() {
  const [identity, setIdentity] = useState<DemoIdentity | null>(null)
  const [holds, setHolds] = useState<HoldItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const pendingTabRef = useRef<HTMLButtonElement>(null)
  const historyTabRef = useRef<HTMLButtonElement>(null)

  // 1. Fetch demo identities
  useEffect(() => {
    async function loadIdentity() {
      try {
        const res = await fetch('/api/demo/users')
        if (res.ok) {
          const data = await res.json()
          setIdentity(data)
        }
      } catch (err) {
        console.error('Error loading demo identity:', err)
      }
    }
    loadIdentity()
  }, [])

  // 2. Poll holds every 3 seconds for real-time live sync
  useEffect(() => {
    let active = true

    async function fetchHolds() {
      if (!identity?.family?._id) return
      try {
        const res = await fetch(`/api/holds?familyId=${identity.family._id}&status=all`)
        if (res.ok) {
          const data = await res.json()
          if (active && Array.isArray(data.holds)) {
            setHolds(data.holds)
            setLoading(false)
          }
        }
      } catch (err) {
        console.warn('Error fetching holds:', err)
      }
    }

    fetchHolds()
    const interval = setInterval(fetchHolds, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [identity])

  // Handle Approve / Decline Decision
  const handleDecision = async (token: string, decision: 'approve' | 'decline') => {
    setActionLoading(token)
    setFeedback(null)

    try {
      const res = await fetch(`/api/holds/${token}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to process hold decision.')
      }

      setFeedback({
        type: 'success',
        message:
          decision === 'decline'
            ? 'Payment declined. The PayPal authorization was cancelled and no money left the account.'
            : 'Payment approved. PayPal capture completed.',
      })

      // Refresh list immediately
      if (identity?.family?._id) {
        const refresh = await fetch(`/api/holds?familyId=${identity.family._id}&status=all`)
        if (refresh.ok) {
          const data = await refresh.json()
          setHolds(data.holds || [])
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Action failed. Please try again.',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const pendingHolds = holds.filter((h) => h.status === 'HELD')
  const historicalHolds = holds.filter((h) => h.status !== 'HELD')

  const totalProtected = holds
    .filter((h) => h.status === 'VOIDED')
    .reduce((sum, h) => sum + h.amount, 0)

  const thresholdLimit = identity?.familyLink?.amountLimit || 100
  const familyName = identity?.family?.name || 'Sarah Davis'
  const elderFirstName = (identity?.elder?.name || 'Margaret Davis').split(' ')[0]

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* ── Flat Paper Header ── */}
      <header className="w-full border-b border-line bg-paper">
        <div className="mx-auto max-w-5xl w-full px-6 py-6 lg:px-12 lg:py-10">
          <div className="flex items-center gap-2.5 text-ink mb-6">
            <BrandMark className="text-ink shrink-0" />
            <span className="font-serif text-[1.25rem] font-semibold tracking-[-0.01em] text-ink">
              SecondSight
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif font-semibold text-[2rem] leading-[1.15] tracking-[-0.01em] text-ink">
                {elderFirstName}&apos;s payments
              </h1>
              <p className="mt-2 max-w-2xl text-[1rem] leading-[1.5] text-ink-2">
                Signed in as {familyName}. Anything over{' '}
                <span className="tabular-nums">${thresholdLimit}</span>, or that looks risky,
                waits here for your OK.
              </p>
            </div>

            <dl className="flex items-stretch divide-x divide-line shrink-0">
              <div className="pr-6">
                <dt className="text-[0.875rem] text-ink-2">On hold</dt>
                <dd className="mt-1 font-serif text-[1.5rem] font-semibold leading-none text-ink tabular-nums">
                  {pendingHolds.length}
                </dd>
              </div>
              <div className="pl-6">
                <dt className="text-[0.875rem] text-ink-2">Protected</dt>
                <dd className="mt-1 font-serif text-[1.5rem] font-semibold leading-none text-ink tabular-nums">
                  {formatCurrency(totalProtected)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-5xl w-full px-6 py-6 lg:px-12 lg:py-10 space-y-8">
          {/* Feedback Notification */}
          {feedback && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`rounded-control border p-4 flex flex-wrap items-center justify-between gap-3 text-[1rem] leading-[1.5] ${
                feedback.type === 'success'
                  ? 'border-line bg-safe-tint text-ink'
                  : 'border-danger bg-danger-tint text-ink'
              }`}
            >
              <div className="flex items-start gap-3">
                {feedback.type === 'success' ? (
                  <CheckCircleIcon className="text-safe mt-0.5" />
                ) : (
                  <AlertCircleIcon className="text-danger mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="min-h-[48px] px-2 text-[0.9375rem] font-semibold text-brand hover:text-brand-hover underline underline-offset-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div
            role="tablist"
            aria-label="Margaret's payment views"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
                e.preventDefault()
                const nextTab =
                  e.key === 'Home'
                    ? 'pending'
                    : e.key === 'End'
                    ? 'history'
                    : activeTab === 'pending'
                    ? 'history'
                    : 'pending'
                setActiveTab(nextTab)
                if (nextTab === 'pending') {
                  pendingTabRef.current?.focus()
                } else {
                  historyTabRef.current?.focus()
                }
              }
            }}
            className="flex border-b border-line gap-6"
          >
            <button
              ref={pendingTabRef}
              id="tab-pending"
              type="button"
              role="tab"
              aria-selected={activeTab === 'pending'}
              tabIndex={activeTab === 'pending' ? 0 : -1}
              onClick={() => setActiveTab('pending')}
              className={`min-h-[48px] -mb-px border-b-2 px-1 py-2 text-[1rem] inline-flex items-center gap-2 ui-transition cursor-pointer ${
                activeTab === 'pending'
                  ? 'border-brand text-ink font-semibold'
                  : 'border-transparent text-ink-2 hover:text-ink font-medium'
              }`}
            >
              <span>Pending</span>
              <span className="tabular-nums text-ink-2">({pendingHolds.length})</span>
            </button>

            <button
              ref={historyTabRef}
              id="tab-history"
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              tabIndex={activeTab === 'history' ? 0 : -1}
              onClick={() => setActiveTab('history')}
              className={`min-h-[48px] -mb-px border-b-2 px-1 py-2 text-[1rem] inline-flex items-center gap-2 ui-transition cursor-pointer ${
                activeTab === 'history'
                  ? 'border-brand text-ink font-semibold'
                  : 'border-transparent text-ink-2 hover:text-ink font-medium'
              }`}
            >
              <span>History</span>
              <span className="tabular-nums text-ink-2">({historicalHolds.length})</span>
            </button>
          </div>

          {/* ── TAB: PENDING REVIEWS ── */}
          {activeTab === 'pending' && (
            <div role="tabpanel" aria-labelledby="tab-pending" className="space-y-6">
              {loading ? (
                <div
                  role="status"
                  className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card text-[1rem] text-ink-2"
                >
                  Checking for pending payments…
                </div>
              ) : pendingHolds.length === 0 ? (
                <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card text-left">
                  <h2 className="font-serif font-semibold text-[1.375rem] leading-[1.25] tracking-[-0.01em] text-ink">
                    Nothing waiting for you.
                  </h2>
                  <p className="mt-2 max-w-xl text-[1rem] leading-[1.5] text-ink-2">
                    When {elderFirstName} sends something over{' '}
                    <span className="tabular-nums">${thresholdLimit}</span>, or something that
                    looks risky, it will show up here.
                  </p>
                  <p className="mt-4 inline-flex items-center gap-2 text-[0.875rem] text-ink-3">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-safe shrink-0" />
                    <span>Checked 3 seconds ago</span>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {pendingHolds.map((hold) => {
                    const relTime = formatRelativeTime(hold.createdAt)
                    const isBusy = actionLoading === hold.token

                    return (
                      <article
                        key={hold.token}
                        className="rounded-card border border-line bg-surface p-5 sm:p-8 shadow-card"
                      >
                        {/* Top status & risk tags */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-hold-tint px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
                            <ClockIcon />
                            <span>{relTime ? `On hold · ${relTime}` : 'On hold'}</span>
                          </span>

                          {hold.risk === 'HIGH' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag bg-danger-tint px-2.5 py-1 text-[0.875rem] font-semibold text-danger">
                              <ShieldAlertIcon />
                              <span>Higher risk</span>
                            </span>
                          )}

                          {hold.risk === 'MEDIUM' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-hold-tint px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
                              <AlertTriangleIcon />
                              <span>Moderate risk</span>
                            </span>
                          )}

                          {hold.risk === 'LOW' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag bg-safe-tint px-2.5 py-1 text-[0.875rem] font-semibold text-safe">
                              <CheckCircleIcon />
                              <span>Lower risk</span>
                            </span>
                          )}
                        </div>

                        {/* Recipient beside Amount */}
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 pb-5 border-b border-line">
                          <h2 className="font-serif font-semibold text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink break-words">
                            {hold.payeeLabel}
                          </h2>
                          <p className="font-serif font-semibold text-[2.25rem] leading-[1.15] tracking-[-0.01em] text-ink tabular-nums shrink-0">
                            {formatCurrency(hold.amount)}
                          </p>
                        </div>

                        {/* Elder's stated reason */}
                        <div className="mt-5">
                          <p className="text-[0.875rem] font-semibold text-ink-2">
                            {elderFirstName} said it&apos;s for:
                          </p>
                          <blockquote className="mt-2 rounded-control border border-line bg-paper p-4 text-[1rem] leading-[1.5] text-ink">
                            “{hold.message || 'No reason entered'}”
                          </blockquote>
                        </div>

                        {/* What stood out */}
                        {(hold.familySummary || (hold.reasons && hold.reasons.length > 0)) && (
                          <div className="mt-6">
                            <h3 className="font-sans text-[0.875rem] font-semibold tracking-normal text-ink-2">
                              What stood out
                            </h3>

                            {hold.familySummary && (
                              <p className="mt-2 text-[1rem] leading-[1.5] text-ink">
                                {hold.familySummary}
                              </p>
                            )}

                            {hold.reasons && hold.reasons.length > 0 && (
                              <ul className="mt-3 space-y-2 text-[1rem] leading-[1.5] text-ink-2">
                                {hold.reasons.slice(0, 4).map((reason, idx) => (
                                  <li key={idx} className="flex items-start gap-2.5">
                                    <span aria-hidden="true" className="text-ink-2">
                                      •
                                    </span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Actions: Approve primary above Decline destructive on mobile */}
                        <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDecision(hold.token, 'approve')}
                            className="min-h-[52px] px-6 py-3 rounded-control bg-brand hover:bg-brand-hover text-white text-[1.125rem] font-semibold ui-transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Approve payment
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDecision(hold.token, 'decline')}
                            className="min-h-[52px] px-6 py-3 rounded-control border-[1.5px] border-danger bg-surface text-danger hover:bg-danger-tint text-[1.125rem] font-semibold ui-transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Decline payment
                          </button>
                        </div>

                        {/* Quiet metadata */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.875rem] text-ink-3">
                          <span>Authorization {hold.paymentId.substring(0, 12)}</span>
                          {hold.expiresAt && (
                            <span className="tabular-nums">
                              Expires{' '}
                              {new Date(hold.expiresAt).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: DECISION HISTORY ── */}
          {activeTab === 'history' && (
            <div role="tabpanel" aria-labelledby="tab-history">
              {historicalHolds.length === 0 ? (
                <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card text-[1rem] leading-[1.5] text-ink-2">
                  Nothing decided yet. Approved and declined payments will be listed here.
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
                  {historicalHolds.map((h) => {
                    const dateStr = h.decidedAt
                      ? new Date(h.decidedAt).toLocaleDateString()
                      : h.createdAt
                      ? new Date(h.createdAt).toLocaleDateString()
                      : '—'

                    return (
                      <li
                        key={h.token}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:px-6 sm:py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-[0.875rem] text-ink-3 tabular-nums">{dateStr}</p>
                          <p className="mt-0.5 text-[1rem] font-semibold text-ink break-words">
                            {h.payeeLabel}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 shrink-0">
                          <span className="font-serif font-semibold text-[1.25rem] text-ink tabular-nums">
                            {formatCurrency(h.amount)}
                          </span>

                          {h.status === 'CAPTURED' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag bg-safe-tint px-2.5 py-1 text-[0.875rem] font-semibold text-safe">
                              <CheckCircleIcon />
                              <span>Approved</span>
                            </span>
                          )}

                          {h.status === 'VOIDED' && h.decision === 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag border border-line bg-paper px-2.5 py-1 text-[0.875rem] font-semibold text-ink-2">
                              <ClockIcon />
                              <span>Expired</span>
                            </span>
                          )}

                          {h.status === 'VOIDED' && h.decision !== 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag border border-line bg-paper px-2.5 py-1 text-[0.875rem] font-semibold text-ink">
                              <ShieldCheckIcon />
                              <span>Declined</span>
                            </span>
                          )}

                          {h.status === 'PROCESSING' && (
                            <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-hold-tint px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
                              <ClockIcon />
                              <span>Processing</span>
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-line bg-paper pb-20 sm:pb-6">
        <div className="mx-auto max-w-5xl w-full px-6 py-5 lg:px-12 text-[0.875rem] leading-normal text-ink-2">
          SecondSight · Live from PayPal sandbox · Demo mode
        </div>
      </footer>
    </div>
  )
}
