import { useEffect, useState } from 'react'
import ElderPaymentView from './pages/ElderPaymentView'
import FamilyDashboardView from './pages/FamilyDashboardView'

type ActiveRole = 'elder' | 'family'

export default function App() {
  const [role, setRole] = useState<ActiveRole>('elder')

  // Check URL parameter (?role=family or ?role=elder) for side-by-side windows
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRole = params.get('role')
    if (urlRole === 'family' || urlRole === 'elder') {
      setRole(urlRole)
    }
  }, [])

  const handleRoleChange = (newRole: ActiveRole) => {
    setRole(newRole)
    const url = new URL(window.location.href)
    url.searchParams.set('role', newRole)
    window.history.pushState({}, '', url.toString())
  }

  return (
    <div className="relative">
      {/* ── Demo Role Switcher Toolbar (Fixed Top Bar) ── */}
      <div className="bg-[#063B3B] text-white py-2 px-4 text-xs font-semibold flex items-center justify-between border-b border-[#009F91]/30 z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#009F91] animate-ping" />
          <span className="font-extrabold tracking-wide uppercase text-[#DDF7F0]">
            Second Sight Demo Switcher
          </span>
          <span className="text-white/40 hidden sm:inline">|</span>
          <span className="text-white/70 hidden sm:inline">
            Open two windows side-by-side to test the pause-and-protect flow
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => handleRoleChange('elder')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              role === 'elder'
                ? 'bg-[#009F91] text-white font-bold shadow-xs'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <span>👵</span>
            <span>Elder Window</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange('family')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              role === 'family'
                ? 'bg-[#009F91] text-white font-bold shadow-xs'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <span>👨‍👩‍👧</span>
            <span>Family Approver</span>
          </button>
        </div>
      </div>

      {/* ── Render Selected View ── */}
      {role === 'elder' ? <ElderPaymentView /> : <FamilyDashboardView />}
    </div>
  )
}
