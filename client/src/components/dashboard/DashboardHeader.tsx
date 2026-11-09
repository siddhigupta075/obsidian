import type { DashboardStats } from '../../types/dashboard'

interface DashboardHeaderProps {
  stats: DashboardStats
  onSwitchToElder: () => void
  onToggleMobileNav: () => void
  onSelectPendingTab: () => void
}

export default function DashboardHeader({
  stats,
  onSwitchToElder,
  onToggleMobileNav,
  onSelectPendingTab,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E5ECEA] bg-[#FCFDFC]/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      {/* Left: Mobile hamburger + Page Context */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5ECEA] text-[#263746] hover:bg-[#E8F7F3] lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]"
          aria-label="Open mobile navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-sans text-lg sm:text-xl font-bold tracking-tight text-[#063B3B]">
              Family Safety Dashboard
            </h1>
            <span className="hidden sm:inline-flex items-center rounded-full bg-[#E8F7F3] px-2.5 py-0.5 text-[11px] font-bold text-[#008F83] border border-[#008F83]/20">
              Primary Guardian
            </span>
          </div>
          <p className="hidden text-xs text-[#718096] sm:block">
            A second pair of eyes for every important payment.
          </p>
        </div>
      </div>

      {/* Right: View Switcher Pill + Notifications + Family Avatar */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Switch View Pill (Crucial for Demo / Hackathon) */}
        <button
          type="button"
          onClick={onSwitchToElder}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#008F83]/30 bg-[#E8F7F3] px-3 py-1.5 text-xs font-bold text-[#063B3B] hover:bg-[#008F83] hover:text-white transition-all shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008F83] cursor-pointer"
          title="Switch to the Elder Payment Experience to test simulated payments"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden md:inline">Elder Payment View</span>
          <span className="md:hidden">Elder View</span>
        </button>

        {/* Notification Bell with Pending Badge */}
        <button
          type="button"
          onClick={onSelectPendingTab}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5ECEA] bg-white text-[#263746] hover:bg-[#E8F7F3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008F83] cursor-pointer"
          aria-label={`View ${stats.pendingCount} pending payment reviews`}
          title={`${stats.pendingCount} transactions awaiting your review`}
        >
          <svg className="h-4.5 w-4.5 text-[#263746]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {stats.pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white shadow-xs animate-pulse">
              {stats.pendingCount}
            </span>
          )}
        </button>

        {/* Family Member Profile */}
        <div className="flex items-center gap-2.5 pl-1 border-l border-[#E5ECEA]">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#063B3B] to-[#008F83] text-xs font-bold text-white shadow-xs">
            PS
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div className="hidden text-left xl:block">
            <p className="text-xs font-bold text-[#063B3B] leading-tight">Priya Sharma</p>
            <p className="text-[11px] text-[#718096] leading-tight">Family Guardian</p>
          </div>
        </div>
      </div>
    </header>
  )
}

