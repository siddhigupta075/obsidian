import { DashboardNavTab } from '../../types/dashboard'

interface DashboardSidebarProps {
  activeTab: DashboardNavTab
  onSelectTab: (tab: DashboardNavTab) => void
  pendingCount: number
  isMobileOpen: boolean
  onCloseMobile: () => void
  onSwitchToElder: () => void
}

export default function DashboardSidebar({
  activeTab,
  onSelectTab,
  pendingCount,
  isMobileOpen,
  onCloseMobile,
  onSwitchToElder,
}: DashboardSidebarProps) {
  const navItems: { id: DashboardNavTab; label: string; badge?: number; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: 'pending',
      label: 'Pending Reviews',
      badge: pendingCount,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'Transaction History',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      id: 'members',
      label: 'Family Members',
      badge: 2,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Safety Settings',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#FCFDFC] border-r border-[#E5ECEA] p-4 lg:p-5 select-none">
      {/* Top: Brand & Navigation */}
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#008F83] to-[#063B3B] p-0.5 shadow-xs">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#063B3B]/10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5.5 w-5.5 text-white"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22.5C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z"
                    fill="#E8F7F3"
                  />
                  <circle cx="12" cy="12" r="1.5" fill="#063B3B" />
                </svg>
              </div>
            </div>
            <div>
              <span className="font-sans text-xl font-extrabold tracking-tight text-[#063B3B]">
                Second<span className="text-[#008F83]">Sight</span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#008F83]">
                Family Safety Network
              </p>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id)
                  onCloseMobile()
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#E8F7F3] text-[#063B3B] shadow-2xs font-bold border-l-3 border-[#008F83]'
                    : 'text-[#718096] hover:bg-slate-50 hover:text-[#063B3B]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-[#008F83]' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      item.id === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom: Protection Status & Quick Switch */}
      <div className="space-y-3 pt-6 border-t border-[#E5ECEA]">
        {/* Protection Active Badge Card */}
        <div className="rounded-xl border border-[#008F83]/20 bg-[#E8F7F3]/70 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <p className="text-xs font-bold text-[#063B3B]">Protection Active</p>
          </div>
          <p className="text-[11px] text-[#718096] leading-relaxed">
            PayPal Authorize protocol armed. Unverified payments are paused automatically.
          </p>
        </div>

        {/* Elder Interface Launcher Button */}
        <button
          type="button"
          onClick={() => {
            onSwitchToElder()
            onCloseMobile()
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#063B3B]/10 bg-white hover:bg-[#E8F7F3] p-2.5 text-xs font-bold text-[#063B3B] shadow-2xs transition-all cursor-pointer"
        >
          <svg className="h-4 w-4 text-[#008F83]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span>Open Elder Payment Screen</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

