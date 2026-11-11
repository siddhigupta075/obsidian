import { useEffect, useState } from 'react'
import ElderPaymentView from './pages/ElderPaymentView'
import FamilyDashboardView from './pages/FamilyDashboardView'
import { ChevronDownIcon, ChevronUpIcon } from './components/Icons'

type ActiveRole = 'elder' | 'family'

export default function App() {
  const [role, setRole] = useState<ActiveRole>('elder')
  const [demoOpen, setDemoOpen] = useState(true)

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
    <div className="relative min-h-screen flex flex-col bg-paper text-ink">
      {/* ── Render Selected View ── */}
      {role === 'elder' ? <ElderPaymentView /> : <FamilyDashboardView />}

      {/* ── Collapsible Demo Role Switcher (Bottom-Right) ── */}
      <aside
        aria-label="Demo role switcher"
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 max-w-[calc(100vw-1.5rem)]"
      >
        {demoOpen ? (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface p-1.5 shadow-card text-[0.8125rem] text-ink">
            <span className="rounded-tag border border-line bg-paper px-2 py-1 text-[0.8125rem] font-semibold uppercase leading-none text-ink-2">
              DEMO
            </span>

            <div className="flex items-center gap-1" role="group" aria-label="Switch demo view">
              <button
                type="button"
                onClick={() => handleRoleChange('elder')}
                aria-pressed={role === 'elder'}
                className={`min-h-[48px] px-3 py-1.5 rounded-tag text-[0.8125rem] ui-transition cursor-pointer ${
                  role === 'elder'
                    ? 'bg-brand-tint text-brand font-semibold border border-brand'
                    : 'bg-surface text-ink-2 hover:text-ink border border-transparent'
                }`}
              >
                Elder
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('family')}
                aria-pressed={role === 'family'}
                className={`min-h-[48px] px-3 py-1.5 rounded-tag text-[0.8125rem] ui-transition cursor-pointer ${
                  role === 'family'
                    ? 'bg-brand-tint text-brand font-semibold border border-brand'
                    : 'bg-surface text-ink-2 hover:text-ink border border-transparent'
                }`}
              >
                Family
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDemoOpen(false)}
              aria-expanded="true"
              aria-label="Collapse demo switcher"
              className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-tag text-ink-2 hover:text-ink hover:bg-paper ui-transition cursor-pointer"
            >
              <ChevronDownIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            aria-expanded="false"
            aria-label="Expand demo role switcher"
            className="min-h-[48px] inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-1.5 shadow-card text-[0.8125rem] text-ink hover:bg-paper ui-transition cursor-pointer"
          >
            <span className="rounded-tag border border-line bg-paper px-2 py-1 text-[0.8125rem] font-semibold uppercase leading-none text-ink-2">
              DEMO
            </span>
            <span className="font-semibold text-ink">
              {role === 'elder' ? 'Elder' : 'Family'}
            </span>
            <ChevronUpIcon className="text-ink-2" />
          </button>
        )}
      </aside>
    </div>
  )
}
