import { useEffect, useState } from 'react'

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

export default function FamilyDashboardView() {
  const [identity, setIdentity] = useState<DemoIdentity | null>(null)
  const [holds, setHolds] = useState<HoldItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

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
            ? '✅ Payment was DECLINED. PayPal authorization voided immediately; funds never left the account!'
            : '✅ Payment was APPROVED. PayPal capture completed.',
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

  return (
    <div className="min-h-screen bg-[#F7FAF9] text-[#063B3B] flex flex-col font-sans">
      {/* ── Sub-header Banner ── */}
      <section className="bg-gradient-to-r from-[#063B3B] to-[#009F91] text-white py-8 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold backdrop-blur-xs mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE GUARDIAN SYNC ACTIVE
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Family Protection Dashboard
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Signed in as <strong className="text-white">{identity?.family?.name || 'Sarah Davis'}</strong> · Protecting{' '}
              <strong className="text-white">{identity?.elder?.name || 'Margaret Davis'}</strong> (Threshold: ${identity?.familyLink?.amountLimit || 100})
            </p>
          </div>

          <div className="flex gap-4">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 backdrop-blur-xs text-center min-w-[130px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
                Pending Holds
              </span>
              <span className="text-2xl font-black text-white">{pendingHolds.length}</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 backdrop-blur-xs text-center min-w-[150px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
                Funds Protected
              </span>
              <span className="text-2xl font-black text-emerald-300">${totalProtected}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feedback Notification ── */}
      {feedback && (
        <div className="max-w-7xl mx-auto px-4 mt-6 w-full">
          <div
            className={`rounded-2xl p-4 text-sm font-semibold border flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs underline text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-4 text-sm font-bold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-[#009F91] text-[#063B3B]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>Pending Approvals</span>
            {pendingHolds.length > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-xs font-bold animate-pulse">
                {pendingHolds.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#009F91] text-[#063B3B]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Decision History ({historicalHolds.length})
          </button>
        </div>

        {/* ── TAB: PENDING REVIEWS ── */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#009F91] border-t-transparent" />
                <span>Checking for live transaction holds...</span>
              </div>
            ) : pendingHolds.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[#DDF7F0] text-[#009F91] mb-4">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-extrabold text-[#063B3B]">All Clear! No Pending Holds</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mt-2">
                  When Margaret attempts a transaction that triggers AI risk flags or exceeds ${identity?.familyLink?.amountLimit || 100}, it will appear here in real time before money moves.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Polling PayPal authorize state live every 3 seconds</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {pendingHolds.map((hold) => (
                  <div
                    key={hold.token}
                    className="rounded-3xl border-2 border-amber-300 bg-white p-6 sm:p-8 shadow-md relative overflow-hidden"
                  >
                    {/* Urgency Stripe */}
                    <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400" />

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 tracking-wide">
                            {hold.risk} RISK ALERT
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Hold ID: {hold.token.substring(0, 8)}...
                          </span>
                        </div>
                        <h2 className="text-2xl font-black text-[#063B3B]">
                          ${hold.amount} to {hold.payeeLabel}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Requested reason: <em className="text-slate-700">"{hold.message}"</em>
                        </p>
                      </div>

                      {/* Action Decision Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <button
                          type="button"
                          disabled={actionLoading === hold.token}
                          onClick={() => handleDecision(hold.token, 'decline')}
                          className="py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Decline & Void Payment</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading === hold.token}
                          onClick={() => handleDecision(hold.token, 'approve')}
                          className="py-3 px-6 rounded-xl bg-[#009F91] hover:bg-[#00877A] text-white font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Approve & Transfer</span>
                        </button>
                      </div>
                    </div>

                    {/* AI Explanation Box */}
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4">
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <span>🤖</span> AI Scam Context Summary
                        </h4>
                        <p className="text-xs text-amber-950 font-medium leading-relaxed">
                          {hold.familySummary || 'The AI model flagged high urgency, coercive language, or non-standard gift card/wire payment demands.'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Detected Risk Flags
                        </h4>
                        <ul className="text-xs text-slate-600 space-y-1">
                          {hold.reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-rose-600 font-bold">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                      <span>Zero-Liability Hold · PayPal Authorization ID: {hold.paymentId.substring(0, 12)}</span>
                      <span>Auto-expires if unreviewed: {hold.expiresAt ? new Date(hold.expiresAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: DECISION HISTORY ── */}
        {activeTab === 'history' && (
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-2xs">
            {historicalHolds.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No past transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Risk Level</th>
                      <th className="py-3 px-4">Outcome</th>
                      <th className="py-3 px-4">Decision Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historicalHolds.map((h) => (
                      <tr key={h.token} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-800">{h.payeeLabel}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">${h.amount}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              h.risk === 'HIGH'
                                ? 'bg-rose-100 text-rose-800'
                                : h.risk === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#DDF7F0] text-[#063B3B]'
                            }`}
                          >
                            {h.risk}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {h.status === 'VOIDED' && (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              🛡️ DECLINED / VOIDED (Funds Safe)
                            </span>
                          )}
                          {h.status === 'CAPTURED' && (
                            <span className="text-[#009F91] font-bold flex items-center gap-1">
                              ✓ APPROVED / CAPTURED
                            </span>
                          )}
                          {h.status === 'PROCESSING' && (
                            <span className="text-slate-500 font-medium">Processing...</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {h.decidedAt
                            ? new Date(h.decidedAt).toLocaleDateString()
                            : h.createdAt
                            ? new Date(h.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
