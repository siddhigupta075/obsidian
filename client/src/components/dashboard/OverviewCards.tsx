import { DashboardStats } from '../../types/dashboard'

interface OverviewCardsProps {
  stats: DashboardStats
  onSelectPendingTab: () => void
  onSelectHistoryTab: (filter?: 'ALL' | 'APPROVED' | 'DECLINED') => void
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN')
}

export default function OverviewCards({
  stats,
  onSelectPendingTab,
  onSelectHistoryTab,
}: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Pending Reviews */}
      <div
        onClick={onSelectPendingTab}
        className="group relative flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-b from-white to-amber-50/20 p-5 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectPendingTab()}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#718096]">
            Pending Reviews
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs group-hover:scale-105 transition-transform">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-[#063B3B]">
              {stats.pendingCount}
            </span>
            {stats.pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 animate-pulse">
                Action required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                All clear
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#718096]">
            {stats.pendingCount === 1
              ? '1 transaction awaiting your decision'
              : `${stats.pendingCount} transactions awaiting your decision`}
          </p>
        </div>

        <div className="pt-2 border-t border-amber-100/60 flex items-center justify-between text-xs font-semibold text-amber-800">
          <span>Review queue</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>

      {/* 2. Approved Payments */}
      <div
        onClick={() => onSelectHistoryTab('APPROVED')}
        className="group relative flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20 p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectHistoryTab('APPROVED')}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#718096]">
            Approved Payments
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs group-hover:scale-105 transition-transform">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-[#063B3B]">
              {stats.approvedCount}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Verified safe
            </span>
          </div>
          <p className="mt-1 text-xs text-[#718096]">Legitimate family bills & necessities</p>
        </div>

        <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-between text-xs font-semibold text-emerald-800">
          <span>View approved log</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>

      {/* 3. Declined Payments */}
      <div
        onClick={() => onSelectHistoryTab('DECLINED')}
        className="group relative flex flex-col justify-between rounded-2xl border border-rose-200/80 bg-gradient-to-b from-white to-rose-50/20 p-5 shadow-xs hover:shadow-md hover:border-rose-300 transition-all duration-200 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectHistoryTab('DECLINED')}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#718096]">
            Declined & Blocked
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-2xs group-hover:scale-105 transition-transform">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-[#063B3B]">
              {stats.declinedCount}
            </span>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Scams stopped
            </span>
          </div>
          <p className="mt-1 text-xs text-[#718096]">Suspect extortion & fake services</p>
        </div>

        <div className="pt-2 border-t border-rose-100/60 flex items-center justify-between text-xs font-semibold text-rose-800">
          <span>View blocked history</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>

      {/* 4. Total Amount Protected (Hero Highlight) */}
      <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#008F83]/30 bg-gradient-to-br from-white via-[#E8F7F3]/40 to-[#008F83]/10 p-5 shadow-xs hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#063B3B]">
            Total Amount Protected
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#008F83] text-white shadow-2xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline gap-1">
            <span className="font-sans text-3xl sm:text-4xl font-black tracking-tight text-[#063B3B]">
              ₹{formatINR(stats.totalProtectedAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#008F83]">
            Zero rupees captured by scammers
          </p>
        </div>

        <div className="pt-2 border-t border-[#008F83]/20 flex items-center justify-between text-xs font-medium text-[#718096]">
          <span>Protected via PayPal Authorize</span>
          <span className="font-bold text-[#063B3B]">100% Safe</span>
        </div>
      </div>
    </div>
  )
}

