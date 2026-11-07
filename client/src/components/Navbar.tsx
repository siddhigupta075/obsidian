interface NavbarProps {
  onLogoClick?: () => void
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#009F91]/10 bg-[#F7FAF9]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div
          onClick={onLogoClick}
          className="flex items-center gap-3 cursor-pointer group select-none"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onLogoClick?.()
            }
          }}
          aria-label="SecondSight Home"
        >
          {/* Logo Crest */}
          <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#009F91] to-[#063B3B] p-0.5 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#063B3B]/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                aria-hidden="true"
              >
                {/* Shield Outline */}
                <path
                  d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22.5C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Inner Protective Eye / Aperture */}
                <path
                  d="M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z"
                  fill="#DDF7F0"
                />
                <circle cx="12" cy="12" r="1.5" fill="#063B3B" />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-xl font-extrabold tracking-tight text-[#063B3B]">
                Second<span className="text-[#009F91]">Sight</span>
              </span>
              <span className="hidden rounded-md bg-[#DDF7F0] px-2 py-0.5 text-[11px] font-semibold text-[#063B3B] sm:inline-block">
                PRE-CAPTURE AI
              </span>
            </div>
            <p className="hidden text-xs font-medium text-slate-500 sm:block">
              Pause the payment. Not the person.
            </p>
          </div>
        </div>

        {/* Security status indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-full border border-[#009F91]/20 bg-white/90 px-3 py-1.5 shadow-xs transition-all hover:border-[#009F91]/40"
            role="status"
            aria-label="Security status: AI Guardian active"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009F91] opacity-60"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#009F91]"></span>
            </span>
            <span className="text-xs font-semibold text-[#063B3B]">
              <span className="hidden sm:inline">AI Guardian </span>Active
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3 w-3 text-[#009F91]"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a4 4 0 0 1 8 0v2h.5A2.5 2.5 0 0 1 15 8.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 13.5v-5A2.5 2.5 0 0 1 3.5 6H4V4zm2 2h4V4a2 2 0 1 0-4 0v2z"
                  clipRule="evenodd"
                />
              </svg>
              Zero-Risk Hold
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

